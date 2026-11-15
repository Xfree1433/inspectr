// "Forgot password?" flow: POST /api/auth/forgot-password, /reset-password/verify
// and /reset-password. Starts the real server on a free port against a
// throwaway SQLite file, with its SMTP pointed at a tiny in-test SMTP server
// that captures every message (nothing leaves the machine).
// Run: node --test tests/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { signResetToken, passwordFingerprint } from '../server/password-reset.js';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROVISION = 'test-provision-secret-0123456789';
const SESSION_SECRET = 'test-session-secret-abcdefghijklmnop';
const BASE_URL = 'https://inspectr.example.test';
const GENERIC = "If an account exists for that address, we've emailed a reset link. It works for 1 hour.";

// ── A minimal SMTP server: accepts AUTH and one message per DATA ─────────────
function startSmtp() {
  const messages = [];
  const server = createServer((sock) => {
    let buf = '';
    let inData = false;
    let data = '';
    let rcpt = [];
    sock.write('220 test ESMTP\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\r\n')) !== -1) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === '.') {
            inData = false;
            messages.push({ rcpt, raw: data });
            rcpt = [];
            data = '';
            sock.write('250 OK queued\r\n');
          } else {
            data += (line.startsWith('..') ? line.slice(1) : line) + '\r\n';
          }
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250-test\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        else if (cmd === 'AUTH') sock.write('235 Authenticated\r\n');
        else if (cmd === 'MAIL') { rcpt = []; sock.write('250 OK\r\n'); }
        else if (cmd === 'RCPT') { rcpt.push(line.replace(/^RCPT TO:\s*<?([^>]*)>?.*$/i, '$1')); sock.write('250 OK\r\n'); }
        else if (cmd === 'DATA') { inData = true; sock.write('354 go ahead\r\n'); }
        else if (cmd === 'QUIT') { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('250 OK\r\n');
      }
    });
    sock.on('error', () => {});
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, messages, close: () => server.close() }));
  });
}

// Body text of a captured message, with quoted-printable soft breaks undone.
function bodyOf(msg) {
  const raw = msg.raw;
  const body = raw.slice(raw.indexOf('\r\n\r\n') + 4);
  if (/content-transfer-encoding:\s*quoted-printable/i.test(raw)) {
    return body.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  if (/content-transfer-encoding:\s*base64/i.test(raw)) return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  return body;
}
const linkIn = (msg) => (bodyOf(msg).match(/https?:\/\/\S+\/reset-password\/[A-Za-z0-9_.-]+/) || [])[0];
const tokenIn = (msg) => linkIn(msg).split('/reset-password/')[1];

// ── Server harness (same shape as plan-route.test.mjs) ───────────────────────
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
  const dir = mkdtempSync(join(tmpdir(), 'inspectr-reset-'));
  const port = await freePort();
  const env = {
    PATH: process.env.PATH,
    HOME: dir,
    PORT: String(port),
    SQLITE_PATH: join(dir, 'test.db'),
    POSTHOG_HOST: 'http://127.0.0.1:9',
    ...extraEnv,
  };
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

// Every request gets its own visitor address unless a test says otherwise, so
// the 5-an-hour form limit only bites in the test about it.
let ipSeq = 0;
const freshIp = () => `203.0.113.${++ipSeq}`;
const forgot = (email, { ip = freshIp(), headers = {} } = {}) =>
  call(srv.base, 'POST', '/api/auth/forgot-password', { body: { email }, headers: { 'CF-Connecting-IP': ip, ...headers } });
const verify = (token) => call(srv.base, 'POST', '/api/auth/reset-password/verify', { body: { token }, headers: { 'CF-Connecting-IP': freshIp() } });
const reset = (token, password, confirm = password) =>
  call(srv.base, 'POST', '/api/auth/reset-password', { body: { token, password, confirm }, headers: { 'CF-Connecting-IP': freshIp() } });
const login = (email, password) => call(srv.base, 'POST', '/api/auth/login', { body: { email, password }, headers: { 'CF-Connecting-IP': freshIp() } });
const stats = (sid) => call(srv.base, 'GET', '/api/stats', { headers: { 'x-session-id': sid } });

async function waitForMail(n, ms = 5000) {
  const t0 = Date.now();
  while (smtp.messages.length < n && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 25));
  return smtp.messages.length;
}
const mailTo = (addr) => smtp.messages.filter((m) => m.rcpt.includes(addr));

function dbRun(fn) {
  const db = new Database(srv.dbPath);
  try { return fn(db); } finally { db.close(); }
}

let srv;
let smtp;
const A = { email: 'owner-a@example.com', password: 'pw-a-123456', name: 'Owner A', companyName: 'Org A' };
const LOCKED = { email: 'owner-l@example.com', password: 'pw-l-123456', name: 'Owner L', companyName: 'Org L' };
const U = (n) => ({ email: `user-${n}@example.com`, password: `pw-${n}-123456`, name: `User ${n}`, companyName: `Org ${n}` });

before(async () => {
  smtp = await startSmtp();
  srv = await startServer({
    NODE_ENV: 'production',
    PROVISION_SECRET: PROVISION,
    SESSION_SECRET,
    APP_BASE_URL: BASE_URL + '/',
    ENABLE_DEMO: 'true',
    MAIL_SERVER: '127.0.0.1',
    MAIL_PORT: String(smtp.port),
    MAIL_USE_TLS: 'false',
    MAIL_USERNAME: 'tester',
    MAIL_PASSWORD: 'not-a-real-password',
  });
  for (const u of [A, LOCKED, U(1), U(2), U(3), U(4)]) {
    const r = await call(srv.base, 'POST', '/api/auth/register', { body: u, headers: { 'X-PF9-Provision-Secret': PROVISION } });
    assert.equal(r.status, 201, `register ${u.email}: ${JSON.stringify(r.json)}`);
  }
});

after(() => {
  stopServer(srv);
  smtp?.close();
});

test('unknown email gets the same response as a known one, and no mail', async () => {
  const unknown = await forgot('nobody@example.com');
  const known = await forgot(A.email);
  assert.equal(unknown.status, 200);
  assert.equal(known.status, unknown.status);
  assert.deepEqual(known.json, unknown.json);
  assert.equal(unknown.json.message, GENERIC);
  // Positive control: the known address's mail arrives; nothing else does.
  assert.equal(await waitForMail(1), 1);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(smtp.messages.length, 1);
  assert.deepEqual(smtp.messages[0].rcpt, [A.email]);
  assert.equal(mailTo('nobody@example.com').length, 0);
  smtp.messages.length = 0;
});

test('known email: exactly one mail; link uses the configured base URL despite a forged Host', async () => {
  // node:http, because fetch will not send a made-up Host header.
  const body = JSON.stringify({ email: ' User-1@Example.com ' });
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest(`${srv.base}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        Host: 'evil.example.com',
        'X-Forwarded-Host': 'evil.example.com',
        'X-Forwarded-Proto': 'http',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'CF-Connecting-IP': freshIp(),
      },
    }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end(body);
  });
  assert.equal(status, 200);
  assert.equal(await waitForMail(1), 1);
  await new Promise((res) => setTimeout(res, 300));
  assert.equal(smtp.messages.length, 1);
  const msg = smtp.messages[0];
  assert.deepEqual(msg.rcpt, ['user-1@example.com']);
  assert.match(msg.raw, /^Subject: Reset your INSPECTR password\r?$/m);
  assert.match(msg.raw, /^From: PF9 Support <support@plainspokenfoundrynine\.com>\r?$/m);
  const link = linkIn(msg);
  assert.ok(link.startsWith(`${BASE_URL}/reset-password/`), link);
  assert.ok(!bodyOf(msg).includes('evil.example.com'));
  assert.match(bodyOf(msg), /expires in 1 hour/);
  assert.match(bodyOf(msg), /ignore this email/);
  smtp.messages.length = 0;
});

test('demo account and billing-locked users: demo gets no mail, locked user may reset', async () => {
  // Lock LOCKED's org the way the store does.
  const p = await call(srv.base, 'POST', '/api/auth/plan', { body: { email: LOCKED.email, status: 'canceled' }, headers: { 'X-PF9-Provision-Secret': PROVISION } });
  assert.equal(p.json.action, 'locked');

  const demo = await forgot('demo@acme.com');
  assert.equal(demo.status, 200);
  assert.equal(demo.json.message, GENERIC);
  await forgot(LOCKED.email);
  assert.equal(await waitForMail(1), 1);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(smtp.messages.length, 1, 'only the locked user is mailed');
  assert.equal(mailTo('demo@acme.com').length, 0);
  const token = tokenIn(mailTo(LOCKED.email)[0]);
  // The reset works, but sign-in stays blocked by the lock.
  assert.equal((await reset(token, 'locked-new-pw')).status, 200);
  assert.equal((await login(LOCKED.email, 'locked-new-pw')).status, 403);
  smtp.messages.length = 0;
});

test('a forged token for the demo account is refused', async () => {
  const demo = dbRun((db) => db.prepare('SELECT id, hashed_password FROM users WHERE email = ?').get('demo@acme.com'));
  const token = signResetToken(SESSION_SECRET, { u: demo.id, f: passwordFingerprint(demo.hashed_password), exp: Math.floor(Date.now() / 1000) + 600 });
  assert.equal((await verify(token)).status, 400);
  assert.equal((await reset(token, 'hijacked-pw')).status, 400);
});

test('valid token: check passes (twice: it consumes nothing); bad passwords refused; good one changes it; reuse fails', async () => {
  const u = U(2);
  await forgot(u.email);
  assert.equal(await waitForMail(1), 1);
  const token = tokenIn(smtp.messages[0]);
  smtp.messages.length = 0;

  for (let i = 0; i < 2; i++) {
    const v = await verify(token);
    assert.equal(v.status, 200);
    assert.equal(v.json.valid, true);
  }

  const mismatch = await reset(token, 'new-pass-123', 'new-pass-124');
  assert.equal(mismatch.status, 400);
  assert.match(mismatch.json.error, /match/);
  const short = await reset(token, '12345');
  assert.equal(short.status, 400);
  assert.match(short.json.error, /at least 6/);
  // Refused attempts leave the old password and the token working.
  assert.equal((await login(u.email, u.password)).status, 200);
  assert.equal((await verify(token)).status, 200);

  const ok = await reset(token, 'new-pass-123');
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json, { ok: true });
  assert.ok(!('sessionId' in ok.json), 'not signed in automatically');
  assert.equal((await login(u.email, u.password)).status, 401, 'old password no longer works');
  assert.equal((await login(u.email, 'new-pass-123')).status, 200, 'new password works');

  // Single use: the password hash changed, so the same token is dead.
  assert.equal((await verify(token)).status, 400);
  const again = await reset(token, 'another-pass-1');
  assert.equal(again.status, 400);
  assert.equal(again.json.code, 'invalid_token');
  assert.equal((await login(u.email, 'new-pass-123')).status, 200);
});

test('tampered and expired tokens fail', async () => {
  const u = U(3);
  await forgot(u.email);
  assert.equal(await waitForMail(1), 1);
  const token = tokenIn(smtp.messages[0]);
  smtp.messages.length = 0;
  const [payload, sig] = token.split('.');

  // Payload changed (other user id) with the old signature.
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  const forged = Buffer.from(JSON.stringify({ ...data, exp: data.exp + 86400 })).toString('base64url');
  // Last signature character flipped.
  const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
  // Correct shape but signed with a different secret.
  const wrongKey = signResetToken('some-other-secret-0123456789', data);
  for (const bad of [`${forged}.${sig}`, `${payload}.${flipped}`, wrongKey, payload, '', 'x.y', `${token}x`]) {
    assert.equal((await verify(bad)).status, 400, `verify ${bad}`);
    assert.equal((await reset(bad, 'tampered-pw-1')).status, 400, `reset ${bad}`);
  }

  // Expired: correctly signed, right fingerprint, exp in the past.
  const row = dbRun((db) => db.prepare('SELECT id, hashed_password FROM users WHERE email = ?').get(u.email));
  const expired = signResetToken(SESSION_SECRET, { u: row.id, f: passwordFingerprint(row.hashed_password), exp: Math.floor(Date.now() / 1000) - 1 });
  assert.equal((await verify(expired)).status, 400);
  assert.equal((await reset(expired, 'expired-pw-1')).status, 400);
  // Control: the same construction with a future exp IS accepted, so the
  // refusal above is the expiry and not a bad hand-made token.
  const fresh = signResetToken(SESSION_SECRET, { u: row.id, f: passwordFingerprint(row.hashed_password), exp: Math.floor(Date.now() / 1000) + 60 });
  assert.equal((await verify(fresh)).status, 200);

  // Password changed some other way: the outstanding token dies.
  dbRun((db) => db.prepare('UPDATE users SET hashed_password = ? WHERE id = ?').run(bcrypt.hashSync('changed-elsewhere', 4), row.id));
  assert.equal((await verify(token)).status, 400);
  assert.equal((await login(u.email, u.password)).status, 401);
});

test('a reset ends every session that user has, and no one else\'s', async () => {
  const u = U(4);
  const s1 = (await login(u.email, u.password)).json.sessionId;
  const s2 = (await login(u.email, u.password)).json.sessionId;
  const other = (await login(A.email, A.password)).json.sessionId;
  for (const sid of [s1, s2, other]) assert.equal((await stats(sid)).status, 200);

  await forgot(u.email);
  assert.equal(await waitForMail(1), 1);
  const token = tokenIn(smtp.messages[0]);
  smtp.messages.length = 0;
  assert.equal((await reset(token, 'fresh-pass-99')).status, 200);

  for (const sid of [s1, s2]) assert.equal((await stats(sid)).status, 401);
  assert.equal((await stats(other)).status, 200);
  const left = dbRun((db) => db.prepare('SELECT COUNT(*) AS c FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = ?').get(u.email).c);
  assert.equal(left, 0);
});

test('rate limits: 5 requests an hour per visitor; 3 emails an hour per address', async () => {
  // Per visitor: the 6th request from one address is refused.
  const ip = '198.51.100.7';
  for (let i = 0; i < 5; i++) assert.equal((await forgot(`nobody${i}@example.com`, { ip })).status, 200);
  const sixth = await forgot('nobody5@example.com', { ip });
  assert.equal(sixth.status, 429);
  // A different visitor is not affected.
  assert.equal((await forgot('nobody6@example.com')).status, 200);

  // Per address: from fresh visitors each time, still at most 3 mails (A
  // already had 1 in the first test, so 2 more arrive, then nothing).
  smtp.messages.length = 0;
  for (let i = 0; i < 4; i++) {
    const r = await forgot(A.email);
    assert.equal(r.status, 200);
    assert.equal(r.json.message, GENERIC, 'the limit is invisible to the visitor');
  }
  assert.equal(await waitForMail(2), 2);
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(mailTo(A.email).length, 2);
  smtp.messages.length = 0;
});

test('missing email is a 400; mail not configured still answers generically and logs a warning', async () => {
  assert.equal((await call(srv.base, 'POST', '/api/auth/forgot-password', { body: {}, headers: { 'CF-Connecting-IP': freshIp() } })).status, 400);

  const s = await startServer({ NODE_ENV: 'production', PROVISION_SECRET: PROVISION, SESSION_SECRET });
  try {
    const u = U(9);
    assert.equal((await call(s.base, 'POST', '/api/auth/register', { body: u, headers: { 'X-PF9-Provision-Secret': PROVISION } })).status, 201);
    const r = await call(s.base, 'POST', '/api/auth/forgot-password', { body: { email: u.email } });
    assert.equal(r.status, 200);
    assert.equal(r.json.message, GENERIC);
    for (let i = 0; i < 40 && !s.log().includes('mail not configured'); i++) await new Promise((res) => setTimeout(res, 25));
    assert.match(s.log(), /password reset email not sent: mail not configured/);
  } finally {
    stopServer(s);
  }
});

test('production without SESSION_SECRET sends nothing and accepts no token', async () => {
  const mail = await startSmtp();
  const s = await startServer({
    NODE_ENV: 'production', PROVISION_SECRET: PROVISION,
    MAIL_SERVER: '127.0.0.1', MAIL_PORT: String(mail.port), MAIL_USE_TLS: 'false', MAIL_PASSWORD: 'x',
  });
  try {
    const u = U(8);
    assert.equal((await call(s.base, 'POST', '/api/auth/register', { body: u, headers: { 'X-PF9-Provision-Secret': PROVISION } })).status, 201);
    const r = await call(s.base, 'POST', '/api/auth/forgot-password', { body: { email: u.email } });
    assert.equal(r.status, 200);
    assert.equal(r.json.message, GENERIC);
    await new Promise((res) => setTimeout(res, 400));
    assert.equal(mail.messages.length, 0);
    assert.match(s.log(), /SESSION_SECRET not configured/);
    // Not even a token signed with an empty or a guessed key gets through.
    const rdb = new Database(s.dbPath, { readonly: true });
    const row = rdb.prepare('SELECT id, hashed_password FROM users WHERE email = ?').get(u.email);
    rdb.close();
    for (const key of ['', SESSION_SECRET]) {
      const t = signResetToken(key, { u: row.id, f: passwordFingerprint(row.hashed_password), exp: Math.floor(Date.now() / 1000) + 600 });
      assert.equal((await call(s.base, 'POST', '/api/auth/reset-password/verify', { body: { token: t } })).status, 400);
      assert.equal((await call(s.base, 'POST', '/api/auth/reset-password', { body: { token: t, password: 'guessed-key-1', confirm: 'guessed-key-1' } })).status, 400);
    }
  } finally {
    stopServer(s);
    mail.close();
  }
});
