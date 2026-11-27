// Content-Security-Policy (loose version, 2026-11-27): on the page, not on the
// JSON API; PF9_CSP_MODE switches it to report-only or off.
// Needs dist/ (npm run build); skips the page checks if there is none.
// Run: node --test tests/
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const HAS_DIST = existsSync(join(APP_DIR, 'dist', 'index.html'));
const cleanup = [];
after(() => { for (const f of cleanup) { try { f(); } catch { /* best effort */ } } });
const freePort = () => new Promise((res, rej) => { const s = createServer(); s.unref(); s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });

async function start(extraEnv = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'inspectr-csp-'));
  const port = await freePort();
  const env = { PATH: process.env.PATH, HOME: dir, PORT: String(port), SQLITE_PATH: join(dir, 'test.db'),
    POSTHOG_HOST: 'http://127.0.0.1:9', ...extraEnv };
  // cwd = the temp dir so dotenv cannot pick up the repo's .env.
  const child = spawn(process.execPath, [join(APP_DIR, 'server', 'index.js')], { cwd: dir, env, stdio: 'ignore' });
  cleanup.push(() => child.kill(), () => rmSync(dir, { recursive: true, force: true }));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/api/health`)).ok) return base; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  throw new Error('server did not start');
}

test('the page carries the policy; the JSON API does not', { skip: !HAS_DIST && 'no dist/' }, async () => {
  const base = await start();
  for (const path of ['/', '/inspections/anything']) {      // index.html and the SPA fallback
    const p = (await fetch(`${base}${path}`)).headers.get('content-security-policy');
    assert.ok(p, `no Content-Security-Policy on ${path}`);
    for (const part of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'"]) {
      assert.ok(p.includes(part), `missing ${part}`);
    }
    assert.ok(!p.replace('https:', '').includes('*'), 'wildcard source');
  }
  assert.equal((await fetch(`${base}/api/health`)).headers.get('content-security-policy'), null);
});

test('PF9_CSP_MODE=report sends it report-only; off sends nothing', { skip: !HAS_DIST && 'no dist/' }, async () => {
  const r = (await fetch(`${await start({ PF9_CSP_MODE: 'report' })}/`)).headers;
  assert.equal(r.get('content-security-policy'), null);
  assert.ok(r.get('content-security-policy-report-only'));
  const o = (await fetch(`${await start({ PF9_CSP_MODE: 'off' })}/`)).headers;
  assert.equal(o.get('content-security-policy'), null);
  assert.equal(o.get('content-security-policy-report-only'), null);
});
