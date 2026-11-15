import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { DEMO_EMAIL } from './auth.js';
import { sendMail } from './mailer.js';

// ── "Forgot password?" by email (PF9 fleet spec, 2026-11-14) ────────────────
// Stateless: the emailed token is base64url(JSON {u, f, exp}) + "." +
// base64url(HMAC-SHA256(key, payload)), where f is a fingerprint of the user's
// CURRENT password hash. Setting a new password changes the hash, so a token
// works once and dies if the password changes any other way. No table, no
// schema change. GET of the reset page consumes nothing.

export const RESET_TTL_SECONDS = 3600;
// Same rule as the sign-up form (LoginPage: minLength={6}).
export const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 200;
export const GENERIC_MESSAGE =
  "If an account exists for that address, we've emailed a reset link. It works for 1 hour.";
const INVALID_LINK = 'This reset link is invalid or has expired. Request a new one.';
const DEFAULT_BASE_URL = 'https://inspectr.plainspokenfoundrynine.com';
const EMAILS_PER_ADDRESS_PER_HOUR = 3;

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function passwordFingerprint(hashedPassword) {
  return createHash('sha256').update(String(hashedPassword)).digest('hex').slice(0, 16);
}

function subKey(secret) {
  return createHmac('sha256', secret).update('pf9-password-reset-v1').digest();
}

export function signResetToken(secret, { u, f, exp }) {
  const payload = b64url(JSON.stringify({ u, f, exp }));
  const sig = b64url(createHmac('sha256', subKey(secret)).update(payload).digest());
  return `${payload}.${sig}`;
}

// Returns {u, f, exp} when the signature is good and it has not expired, else null.
export function readResetToken(secret, token, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || token.length > 1000) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payload, sig] = parts;
  const expected = createHmac('sha256', subKey(secret)).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data.u !== 'string' || typeof data.f !== 'string' || typeof data.exp !== 'number') return null;
  if (data.exp <= nowSeconds) return null;
  return data;
}

// INSPECTR has no session secret of its own (sessions are random ids in the
// sessions table), so the signing key is SESSION_SECRET. Production without it
// (or with a short one) sends no reset mail at all - fail closed. Elsewhere a
// random per-process key is used, so links simply die on restart.
let devSecret = null;
function resetSecret() {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') return null;
  if (!devSecret) {
    devSecret = randomBytes(32).toString('hex');
    console.warn('[password-reset] SESSION_SECRET unset: using a temporary key (dev only; links die on restart)');
  }
  return devSecret;
}

// The link base is configuration, never the request's Host header.
function baseUrl() {
  return (process.env.APP_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
}

// Max 3 reset emails per address per hour (in memory). Only addresses that
// were actually mailed are tracked, so unknown addresses cost no memory.
const sentLog = new Map();
function addressAllowed(email, now = Date.now()) {
  const recent = (sentLog.get(email) || []).filter((t) => now - t < 3600 * 1000);
  if (recent.length >= EMAILS_PER_ADDRESS_PER_HOUR) {
    sentLog.set(email, recent);
    return false;
  }
  recent.push(now);
  sentLog.set(email, recent);
  // Keep the map small: drop addresses with nothing in the last hour.
  if (sentLog.size > 1000) {
    for (const [k, v] of sentLog) if (!v.some((t) => now - t < 3600 * 1000)) sentLog.delete(k);
  }
  return true;
}

// The user a token belongs to, if it is still good: signature, expiry, the
// user still exists, is not the shared demo account, and the password has
// not changed since the token was issued.
function userForToken(db, token) {
  const secret = resetSecret();
  if (!secret) return null;
  const data = readResetToken(secret, token);
  if (!data) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(data.u);
  if (!user || user.email === DEMO_EMAIL) return null;
  const a = Buffer.from(passwordFingerprint(user.hashed_password));
  const b = Buffer.from(data.f);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return user;
}

function resetEmailText(user, link) {
  return [
    `Hello ${user.name || ''}`.trim() + ',',
    '',
    `Someone asked to reset the password for the INSPECTR account ${user.email}.`,
    '',
    'To choose a new password, open this link:',
    link,
    '',
    'The link expires in 1 hour and can be used once.',
    '',
    "If you didn't ask for this, you can ignore this email - your password hasn't changed.",
    '',
    'PF9 Support',
  ].join('\n');
}

export function setupPasswordResetRoutes(app, db) {
  // Always the same 200 + message, whether or not the address is registered.
  // The mail is sent in the background, so response time does not depend on
  // whether one was sent.
  app.post('/api/auth/forgot-password', (req, res) => {
    const raw = req.body && req.body.email;
    if (typeof raw !== 'string' || !raw.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const email = raw.toLowerCase().trim();
    res.json({ ok: true, message: GENERIC_MESSAGE });

    try {
      const user = db.prepare('SELECT id, email, name, hashed_password FROM users WHERE email = ?').get(email);
      // No mail for unknown addresses or the shared demo account. INSPECTR has
      // no deactivated-user state; billing-locked users may reset (sign-in
      // stays blocked by the lock).
      if (!user || user.email === DEMO_EMAIL) return;
      const secret = resetSecret();
      if (!secret) {
        console.warn('[password-reset] password reset email not sent: SESSION_SECRET not configured');
        return;
      }
      if (!addressAllowed(user.email)) {
        console.warn(`[password-reset] per-address limit reached for user ${user.id}; no email sent`);
        return;
      }
      const token = signResetToken(secret, {
        u: user.id,
        f: passwordFingerprint(user.hashed_password),
        exp: Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS,
      });
      const link = `${baseUrl()}/reset-password/${token}`;
      void sendMail(
        { to: user.email, subject: 'Reset your INSPECTR password', text: resetEmailText(user, link) },
        'password reset email',
      ).then((ok) => {
        if (ok) console.log(`[password-reset] reset email sent for user ${user.id}`);
      });
    } catch (err) {
      console.error('[password-reset] request failed:', err);
    }
  });

  // Is this link still good? Lets the reset page say so before the visitor
  // types a password. Read-only: consumes nothing. The token travels in the
  // body, not the URL, so it stays out of request logs.
  app.post('/api/auth/reset-password/verify', (req, res) => {
    const user = userForToken(db, req.body && req.body.token);
    if (!user) return res.status(400).json({ valid: false, error: INVALID_LINK });
    res.json({ valid: true });
  });

  // Set the new password. Ends every session the user has and does not sign
  // them in: the page sends them to sign in with the new password.
  app.post('/api/auth/reset-password', (req, res) => {
    const body = req.body || {};
    const user = userForToken(db, body.token);
    if (!user) return res.status(400).json({ error: INVALID_LINK, code: 'invalid_token' });

    const { password, confirm } = body;
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` });
    }
    if (password !== confirm) {
      return res.status(400).json({ error: 'The two passwords do not match.' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    // Compare-and-set on the old hash: if the password changed between the
    // check above and here, this token is no longer good and nothing happens.
    const changed = db.transaction(() => {
      const r = db.prepare('UPDATE users SET hashed_password = ? WHERE id = ? AND hashed_password = ?')
        .run(hashed, user.id, user.hashed_password);
      if (r.changes !== 1) return false;
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      return true;
    })();
    if (!changed) return res.status(400).json({ error: INVALID_LINK, code: 'invalid_token' });

    console.log(`[password-reset] password reset for user ${user.id}; all sessions ended`);
    res.json({ ok: true });
  });
}
