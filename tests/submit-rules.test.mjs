// Submitting an inspection: every item must be answered first.
// Found 11-21: "no failed items" was enough, so an inspection nobody had
// checked a single item on was submitted as PASSED; the feed quoted the score
// from before the recalculation; a new inspection without site/type was a 500.
// Run: node --test tests/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = 'test-provision-secret-0123456789';
const OWNER = { email: 'owner@example.com', password: 'pw-owner-123456', name: 'Owner', companyName: 'Org' };

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

let srv;
let sid;

async function call(method, path, body) {
  const r = await fetch(`${srv.base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-session-id': sid || '', 'X-PF9-Provision-Secret': SECRET },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
}

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'inspectr-submit-'));
  const port = await freePort();
  const env = { PATH: process.env.PATH, HOME: dir, PORT: String(port), SQLITE_PATH: join(dir, 'test.db'),
    POSTHOG_HOST: 'http://127.0.0.1:9', PROVISION_SECRET: SECRET, NODE_ENV: 'production' };
  const child = spawn(process.execPath, [join(APP_DIR, 'server', 'index.js')], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  srv = { base: `http://127.0.0.1:${port}`, child, dir, dbPath: env.SQLITE_PATH };
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    try { up = (await fetch(`${srv.base}/api/health`)).ok; } catch { /* not up yet */ }
    if (!up) await new Promise((r) => setTimeout(r, 100));
  }
  if (!up) { child.kill(); throw new Error(`server did not start:\n${log}`); }
  const reg = await call('POST', '/api/auth/register', OWNER);
  assert.equal(reg.status, 201, JSON.stringify(reg.json));
  sid = (await call('POST', '/api/auth/login', { email: OWNER.email, password: OWNER.password })).json.sessionId;
  assert.ok(sid);
});

after(() => { if (srv) { srv.child.kill(); rmSync(srv.dir, { recursive: true, force: true }); } });

// An inspection with two unanswered checklist items, added directly (as a
// template would have).
async function inspectionWithTwoItems() {
  const made = await call('POST', '/api/inspections', { site: 'Pad 7', type: 'Safety walk' });
  assert.equal(made.status, 201, JSON.stringify(made.json));
  const db = new Database(srv.dbPath);
  const gid = db.prepare('INSERT INTO check_groups (inspection_id, name, sort_order) VALUES (?, ?, 0)').run(made.json.id, 'General').lastInsertRowid;
  const ids = ['a', 'b'].map((s) => `${made.json.id}-${s}`);
  ids.forEach((id, i) => db.prepare("INSERT INTO check_items (id, group_id, text, status, sort_order) VALUES (?, ?, ?, '', ?)").run(id, gid, `Item ${i}`, i));
  db.close();
  return { id: made.json.id, items: ids };
}

test('an unchecked inspection cannot be submitted as passed', async () => {
  const insp = await inspectionWithTwoItems();
  const r = await call('POST', `/api/inspections/${insp.id}/submit`);
  assert.equal(r.status, 400);
  assert.equal(r.json.unchecked, 2);
  assert.match(r.json.error, /2 checklist items are not checked yet/);
  const db = new Database(srv.dbPath, { readonly: true });
  assert.equal(db.prepare('SELECT status FROM inspections WHERE id = ?').get(insp.id).status, 'pending');
  db.close();
});

test('partly checked is still refused, and says how many are left', async () => {
  const insp = await inspectionWithTwoItems();
  assert.equal((await call('PATCH', `/api/check-items/${insp.items[0]}`, { status: 'done' })).status, 200);
  const r = await call('POST', `/api/inspections/${insp.id}/submit`);
  assert.equal(r.status, 400);
  assert.match(r.json.error, /1 checklist item is not checked yet/);
});

test('fully checked submits; N/A counts as answered; the feed quotes the new score', async () => {
  const insp = await inspectionWithTwoItems();
  await call('PATCH', `/api/check-items/${insp.items[0]}`, { status: 'done' });
  await call('PATCH', `/api/check-items/${insp.items[1]}`, { status: 'na' });
  const r = await call('POST', `/api/inspections/${insp.id}/submit`);
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'pass');
  const feed = (await call('GET', '/api/feed')).json;
  const entry = feed.find((e) => e.inspectionId === insp.id && /PASSED/.test(e.message));
  assert.ok(entry, 'feed has the PASSED entry');
  assert.match(JSON.stringify(entry), /Score 100\/100/);
});

test('a failed item still makes the inspection fail', async () => {
  const insp = await inspectionWithTwoItems();
  await call('PATCH', `/api/check-items/${insp.items[0]}`, { status: 'done' });
  await call('PATCH', `/api/check-items/${insp.items[1]}`, { status: 'failed' });
  const r = await call('POST', `/api/inspections/${insp.id}/submit`);
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'fail');
});

test('a new inspection without a site or type is a 400, not a 500', async () => {
  for (const body of [{}, { site: 'Pad 7' }, { type: 'Safety walk' }, { site: '  ', type: 'x' }, { site: 5, type: 'x' }]) {
    const r = await call('POST', '/api/inspections', body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
});
