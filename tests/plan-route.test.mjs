// Store "subscription changed" route: POST /api/auth/plan.
// Starts the real server on a free port against a throwaway SQLite file and
// drives it over HTTP. Run: node --test tests/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = 'test-provision-secret-0123456789';

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function startServer(extraEnv) {
  const dir = mkdtempSync(join(tmpdir(), 'inspectr-plan-'));
  const port = await freePort();
  const env = {
    PATH: process.env.PATH,
    HOME: dir,
    PORT: String(port),
    SQLITE_PATH: join(dir, 'test.db'),
    // Analytics/store reporting pointed at a closed port: nothing leaves the machine.
    POSTHOG_HOST: 'http://127.0.0.1:9',
    ...extraEnv,
  };
  // cwd = the temp dir so dotenv cannot pick up the repo's .env.
  const child = spawn(process.execPath, [join(APP_DIR, 'server', 'index.js')], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return { base, child, dir, dbPath: env.SQLITE_PATH, log: () => log };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`server did not start:\n${log}`);
}

function stopServer(s) {
  if (!s) return;
  s.child.kill();
  rmSync(s.dir, { recursive: true, force: true });
}

async function call(base, method, path, { body, headers = {} } = {}) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
}

const plan = (base, body, secret = SECRET) =>
  call(base, 'POST', '/api/auth/plan', { body, headers: secret === null ? {} : { 'X-PF9-Provision-Secret': secret } });
const login = (base, email, password) => call(base, 'POST', '/api/auth/login', { body: { email, password } });
const stats = (base, sid) => call(base, 'GET', '/api/stats', { headers: { 'x-session-id': sid } });
const sessionUser = async (base, sid) => (await call(base, 'GET', '/api/auth/session', { headers: { 'x-session-id': sid } })).json.user;

let srv;
const A = { email: 'owner-a@example.com', password: 'pw-a-123456', name: 'Owner A', companyName: 'Org A' };
const B = { email: 'owner-b@example.com', password: 'pw-b-123456', name: 'Owner B', companyName: 'Org B' };
const MEMBER = { email: 'member-a@example.com', password: 'pw-m-123456' };
let orgA;
let orgB;

before(async () => {
  srv = await startServer({ PROVISION_SECRET: SECRET, NODE_ENV: 'production' });
  for (const u of [A, B]) {
    const r = await call(srv.base, 'POST', '/api/auth/register', { body: u, headers: { 'X-PF9-Provision-Secret': SECRET } });
    assert.equal(r.status, 201, `register ${u.email}: ${JSON.stringify(r.json)}`);
    u.orgId = r.json.user.orgId;
  }
  orgA = A.orgId;
  orgB = B.orgId;
  // INSPECTR has no invite UI, so the second member of org A is added directly.
  const db = new Database(srv.dbPath);
  db.prepare('INSERT INTO users (id, email, name, hashed_password, org_id, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run('member-a-id', MEMBER.email, 'Member A', bcrypt.hashSync(MEMBER.password, 4), orgA, 'member');
  db.close();
});

after(() => stopServer(srv));

function lockedAt(orgId) {
  const db = new Database(srv.dbPath, { readonly: true });
  try {
    return db.prepare('SELECT billing_locked_at FROM organizations WHERE id = ?').get(orgId).billing_locked_at;
  } finally {
    db.close();
  }
}

test('no PROVISION_SECRET configured -> 404', async () => {
  const s = await startServer({ NODE_ENV: 'production' });
  try {
    const r = await plan(s.base, { email: 'x@example.com', status: 'canceled' });
    assert.equal(r.status, 404);
  } finally {
    stopServer(s);
  }
});

test('no PROVISION_SECRET even outside production -> 404 (no dev bypass)', async () => {
  const s = await startServer({});
  try {
    assert.equal((await plan(s.base, { email: 'x@example.com', status: 'canceled' })).status, 404);
  } finally {
    stopServer(s);
  }
});

test('missing or wrong secret -> 403 and nothing changes', async () => {
  assert.equal((await plan(srv.base, { email: A.email, status: 'canceled' }, null)).status, 403);
  assert.equal((await plan(srv.base, { email: A.email, status: 'canceled' }, 'wrong')).status, 403);
  assert.equal((await plan(srv.base, { email: A.email, status: 'canceled' }, SECRET.replace(/.$/, 'X'))).status, 403);
  assert.equal(lockedAt(orgA), null);
  assert.equal((await login(srv.base, A.email, A.password)).status, 200);
});

test('past_due, unknown status and unknown email -> no change', async () => {
  for (const status of ['past_due', 'incomplete', 'paused', '', 'bogus']) {
    const r = await plan(srv.base, { email: A.email, status });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, action: 'none' });
  }
  const r = await plan(srv.base, { email: 'nobody@example.com', status: 'canceled' });
  assert.deepEqual(r.json, { ok: true, action: 'none' });
  assert.equal(lockedAt(orgA), null);
});

test('a member (not the store-provisioned admin) owns nothing -> no change', async () => {
  const r = await plan(srv.base, { email: MEMBER.email, status: 'canceled' });
  assert.deepEqual(r.json, { ok: true, action: 'none' });
  assert.equal(lockedAt(orgA), null);
});

test('the demo account is never locked', async () => {
  const r = await plan(srv.base, { email: 'demo@acme.com', status: 'canceled' });
  assert.deepEqual(r.json, { ok: true, action: 'none' });
  assert.equal(lockedAt('demo-org'), null);
});

test('cancel locks the whole org, cuts live sessions, leaves other orgs alone; unlock restores', async () => {
  const ownerSid = (await login(srv.base, A.email, A.password)).json.sessionId;
  const memberSid = (await login(srv.base, MEMBER.email, MEMBER.password)).json.sessionId;
  const otherSid = (await login(srv.base, B.email, B.password)).json.sessionId;
  for (const sid of [ownerSid, memberSid, otherSid]) assert.equal((await stats(srv.base, sid)).status, 200);

  // Status is compared trimmed and lower-cased.
  const lock = await plan(srv.base, { email: ' Owner-A@Example.com ', status: ' Canceled ', product: 'x', stripeSubscriptionId: 'sub_1' });
  assert.equal(lock.status, 200);
  assert.equal(lock.json.ok, true);
  assert.equal(lock.json.action, 'locked');
  assert.equal(lock.json.orgId, orgA);
  assert.equal(lock.json.usersAffected, 2);
  const firstLock = lockedAt(orgA);
  assert.ok(firstLock);

  // Existing sessions of owner AND member refused on their next request.
  for (const sid of [ownerSid, memberSid]) {
    const r = await stats(srv.base, sid);
    assert.equal(r.status, 403);
    assert.equal(r.json.code, 'org_locked');
    assert.equal(await sessionUser(srv.base, sid), null);
  }
  // Neither can sign in again; a wrong password still reads as wrong.
  assert.equal((await login(srv.base, A.email, A.password)).status, 403);
  assert.equal((await login(srv.base, MEMBER.email, MEMBER.password)).status, 403);
  assert.equal((await login(srv.base, A.email, 'wrong-password')).status, 401);
  // Org B untouched.
  assert.equal((await stats(srv.base, otherSid)).status, 200);
  assert.equal((await login(srv.base, B.email, B.password)).status, 200);
  assert.equal(lockedAt(orgB), null);

  // Repeat lock (and the other lock statuses) is harmless and keeps the first lock time.
  for (const status of ['canceled', 'cancelled', 'unpaid', 'incomplete_expired']) {
    const r = await plan(srv.base, { email: A.email, status });
    assert.equal(r.json.action, 'locked');
  }
  assert.equal(lockedAt(orgA), firstLock);
  // past_due while locked does not unlock.
  assert.equal((await plan(srv.base, { email: A.email, status: 'past_due' })).json.action, 'none');
  assert.equal((await stats(srv.base, ownerSid)).status, 403);

  // Unlock: the same sessions work again, sign-in works again.
  const un = await plan(srv.base, { email: A.email, status: 'active' });
  assert.equal(un.json.action, 'unlocked');
  assert.equal(lockedAt(orgA), null);
  for (const sid of [ownerSid, memberSid]) {
    assert.equal((await stats(srv.base, sid)).status, 200);
    assert.ok(await sessionUser(srv.base, sid));
  }
  assert.equal((await login(srv.base, A.email, A.password)).status, 200);
  assert.equal((await login(srv.base, MEMBER.email, MEMBER.password)).status, 200);

  // Repeat unlock / trialing is harmless.
  assert.equal((await plan(srv.base, { email: A.email, status: 'trialing' })).json.action, 'unlocked');
  assert.equal((await plan(srv.base, { email: A.email, status: 'active' })).json.action, 'unlocked');
  assert.equal((await stats(srv.base, ownerSid)).status, 200);
});

test('lock and unlock leave the org\'s data and users untouched', async () => {
  const snap = () => {
    const db = new Database(srv.dbPath, { readonly: true });
    try {
      return {
        users: db.prepare('SELECT id, email, role, org_id, hashed_password FROM users WHERE org_id = ? ORDER BY id').all(orgA),
        org: db.prepare('SELECT id, name FROM organizations WHERE id = ?').get(orgA),
        sessions: db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE org_id = ?').get(orgA).c,
      };
    } finally {
      db.close();
    }
  };
  const beforeSnap = snap();
  assert.equal((await plan(srv.base, { email: A.email, status: 'unpaid' })).json.action, 'locked');
  assert.deepEqual(snap(), beforeSnap);
  assert.equal((await plan(srv.base, { email: A.email, status: 'active' })).json.action, 'unlocked');
  assert.deepEqual(snap(), beforeSnap);
});
