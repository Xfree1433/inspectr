import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import { v4 as uuid } from 'uuid';
import { captureServer } from './posthog.js';
import { report as storeReport } from './store-activity.js';

// Security audit 2026-10-26: /api/auth/register had no gate, so anyone could
// create a paid org + admin, or pre-register a buyer's email so the real
// purchase hit 409. In production only the PF9 store, presenting the shared
// secret, can register (same contract as FLOWTRACK). Fails closed: no
// PROVISION_SECRET configured means no bypass exists.
function registrationAllowed(req) {
  if (process.env.ALLOW_PUBLIC_REGISTRATION === 'true') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return provisionSecretMatches(req);
}

// Timing-safe check of the store's X-PF9-Provision-Secret against
// PROVISION_SECRET. False when either side is missing.
function provisionSecretMatches(req) {
  const secret = process.env.PROVISION_SECRET;
  const presented = req.headers['x-pf9-provision-secret'];
  if (!secret || !presented) return false;
  const a = Buffer.from(String(presented));
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Store "subscription changed" (POST /api/auth/plan) ──────────────────────
// When Stripe ends a subscription the store tells us here, and the org it
// provisioned is locked by billing: organizations.billing_locked_at is set and
// authMiddleware / login / session refuse every user of that org until the
// store reports the subscription active again. The lock is an org-level flag,
// so unlocking never touches users and no org data is changed.
const LOCK_STATUSES = new Set(['canceled', 'cancelled', 'unpaid', 'incomplete_expired']);
const UNLOCK_STATUSES = new Set(['active', 'trialing']);
const ORG_LOCKED_ERROR = {
  error: 'This account\'s subscription has ended. Renew it in the PF9 store to continue.',
  code: 'org_locked',
};

function isOrgLocked(db, orgId) {
  const row = db.prepare('SELECT billing_locked_at FROM organizations WHERE id = ?').get(orgId);
  return Boolean(row && row.billing_locked_at);
}

export function setupAuth(db) {
  // Create auth tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      hashed_password TEXT NOT NULL,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      role TEXT DEFAULT 'member',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      org_id TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  // Add org_id to existing tables if not present
  const tables = ['inspectors', 'companies', 'sites', 'templates', 'inspections', 'documents', 'feed_events'];
  for (const table of tables) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN org_id TEXT DEFAULT ''`);
    } catch { /* column already exists */ }
  }

  // Create indexes for org_id
  for (const table of tables) {
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_org ON ${table}(org_id)`);
    } catch { /* index exists */ }
  }

  // Billing lock set by the store's plan route (NULL = not locked).
  try {
    db.exec('ALTER TABLE organizations ADD COLUMN billing_locked_at TEXT DEFAULT NULL');
  } catch { /* column already exists */ }

  // Seed demo org and user if none exist
  const orgCount = db.prepare('SELECT COUNT(*) as c FROM organizations').get().c;
  if (orgCount === 0) {
    const orgId = 'demo-org';
    const userId = uuid();
    const hashedPassword = bcrypt.hashSync('password123', 10);

    db.prepare('INSERT INTO organizations (id, name) VALUES (?, ?)').run(orgId, 'Acme Inspections');

    db.prepare('INSERT INTO users (id, email, name, hashed_password, org_id, role) VALUES (?, ?, ?, ?, ?, ?)').run(
      userId, 'demo@acme.com', 'Demo User', hashedPassword, orgId, 'admin'
    );

    // Assign existing seed data to demo org
    for (const table of tables) {
      db.prepare(`UPDATE ${table} SET org_id = ? WHERE org_id = '' OR org_id IS NULL`).run(orgId);
    }
  }
}

// ── The shared public demo account (security audit 2026-11-14) ──────────────
// POST /api/auth/demo hands every anonymous visitor the same account. It used
// to be a full admin of the demo org with no limits, so anyone could fill the
// database with 10 MB uploads or wipe the demo data. It is now:
//   * opt-in     - off unless ENABLE_DEMO=true;
//   * read-only  - authMiddleware refuses every non-GET from it, in one place;
//   * not reachable by password - only the demo button signs it in.
export const DEMO_EMAIL = 'demo@acme.com';
export const demoEnabled = () => process.env.ENABLE_DEMO === 'true';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function authMiddleware(db) {
  return (req, res, next) => {
    // Skip auth for login, register, demo, and health routes
    if (req.path === '/api/auth/login' ||
        req.path === '/api/auth/register' ||
        req.path === '/api/auth/plan' ||
        req.path === '/api/auth/demo' ||
        req.path === '/api/auth/session' ||
        req.path === '/api/auth/logout' ||
        req.path === '/api/auth/forgot-password' ||
        req.path === '/api/auth/reset-password' ||
        req.path === '/api/auth/reset-password/verify' ||
        req.path === '/api/health' ||
        req.path === '/api/reset-demo' ||
        !req.path.startsWith('/api/')) {
      return next();
    }

    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = db.prepare(`SELECT s.*, u.name as user_name, u.email as user_email, u.role as user_role, o.billing_locked_at as org_locked_at FROM sessions s JOIN users u ON s.user_id = u.id LEFT JOIN organizations o ON o.id = s.org_id WHERE s.id = ? AND s.expires_at > datetime('now')`).get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Session expired' });
    }
    // Checked on every request, so a store lock cuts off signed-in users at once.
    if (session.org_locked_at) {
      return res.status(403).json(ORG_LOCKED_ERROR);
    }

    req.user = {
      id: session.user_id,
      name: session.user_name,
      email: session.user_email,
      role: session.user_role,
      orgId: session.org_id,
    };
    req.orgId = session.org_id;

    if (req.user.email === DEMO_EMAIL) {
      // Demo switched off: sessions handed out earlier stop working at once.
      if (!demoEnabled()) return res.status(401).json({ error: 'Session expired' });
      if (!SAFE_METHODS.has(req.method)) {
        return res.status(403).json({ error: 'The demo is read-only. Start a trial to make changes.' });
      }
    }
    next();
  };
}

export function setupAuthRoutes(app, db) {
  // Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    // The demo account's seed password is in this repo; it never signs in by password.
    if (!user || user.email === DEMO_EMAIL || !bcrypt.compareSync(password, user.hashed_password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Only after the password checks out, so the lock state isn't disclosed.
    if (isOrgLocked(db, user.org_id)) {
      return res.status(403).json(ORG_LOCKED_ERROR);
    }

    const sessionId = uuid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)').run(sessionId, user.id, user.org_id, expiresAt);

    // Analytics: login.
    captureServer('app_login', user.email, {}, { account: user.org_id });
    void storeReport(user.email, 'login'); // store lifecycle: last_login_at

    res.json({
      sessionId,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.org_id },
    });
  });

  // Demo auto-login
  app.post('/api/auth/demo', (_req, res) => {
    if (!demoEnabled()) return res.status(404).json({ error: 'Not found' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(DEMO_EMAIL);
    if (!user) return res.status(500).json({ error: 'Demo account not found' });
    // Each demo login adds a session row; clear this account's expired ones so
    // the table cannot grow without bound.
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?").run(user.id, new Date().toISOString());

    const sessionId = uuid();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)').run(sessionId, user.id, user.org_id, expiresAt);

    res.json({
      sessionId,
      // Reported as a viewer whatever the stored role says: the account cannot write.
      user: { id: user.id, name: user.name, email: user.email, role: 'viewer', orgId: user.org_id, demo: true },
    });
  });

  // Session check
  app.get('/api/auth/session', (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.json({ user: null });

    const session = db.prepare(`SELECT s.*, u.name as user_name, u.email as user_email, u.role as user_role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime('now')`).get(sessionId);
    if (!session) return res.json({ user: null });
    // A billing-locked org reads as signed out; the login page then explains why.
    if (isOrgLocked(db, session.org_id)) return res.json({ user: null });

    res.json({
      user: { id: session.user_id, name: session.user_name, email: session.user_email, role: session.user_role, orgId: session.org_id },
    });
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    res.json({ ok: true });
  });

  // Store "subscription changed": lock or unlock the org the store provisioned
  // for this email. Secret first: 404 when PROVISION_SECRET is unset, 403 when
  // the header is missing or wrong. Unlike register there is no dev bypass.
  app.post('/api/auth/plan', (req, res) => {
    if (!process.env.PROVISION_SECRET) return res.status(404).json({ error: 'Not found' });
    if (!provisionSecretMatches(req)) return res.status(403).json({ error: 'Forbidden' });

    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    const status = typeof body.status === 'string' ? body.status.toLowerCase().trim() : '';
    const want = LOCK_STATUSES.has(status) ? 'locked' : UNLOCK_STATUSES.has(status) ? 'unlocked' : 'none';
    if (want === 'none' || !email) return res.json({ ok: true, action: 'none' });

    // The store's org is the one register created: this email as its admin.
    // The shared demo org is never locked.
    const user = db.prepare('SELECT org_id, role FROM users WHERE email = ?').get(email);
    if (!user || user.role !== 'admin' || email === DEMO_EMAIL || user.org_id === 'demo-org') {
      return res.json({ ok: true, action: 'none' });
    }
    const orgId = user.org_id;
    if (want === 'locked') {
      // COALESCE keeps the first lock time on a repeat.
      db.prepare("UPDATE organizations SET billing_locked_at = COALESCE(billing_locked_at, datetime('now')) WHERE id = ?").run(orgId);
    } else {
      db.prepare('UPDATE organizations SET billing_locked_at = NULL WHERE id = ?').run(orgId);
    }
    const users = db.prepare('SELECT COUNT(*) AS c FROM users WHERE org_id = ?').get(orgId).c;
    console.log(`[plan] store ${want} org ${orgId} (status=${status}, users=${users})`);
    res.json({ ok: true, action: want, orgId, usersAffected: users });
  });

  // Register (creates new org + admin user)
  app.post('/api/auth/register', (req, res) => {
    if (!registrationAllowed(req)) {
      return res.status(403).json({ error: 'Registration is by subscription only. Contact sales to get started.' });
    }
    const { email, password, name, companyName } = req.body;
    if (!email || !password || !name || !companyName) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const orgId = `org-${uuid().slice(0, 8)}`;
    const userId = uuid();
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.transaction(() => {
      db.prepare('INSERT INTO organizations (id, name) VALUES (?, ?)').run(orgId, companyName.trim());
      db.prepare('INSERT INTO users (id, email, name, hashed_password, org_id, role) VALUES (?, ?, ?, ?, ?, ?)').run(
        userId, email.toLowerCase().trim(), name.trim(), hashedPassword, orgId, 'admin'
      );
    })();

    const sessionId = uuid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)').run(sessionId, userId, orgId, expiresAt);

    // Analytics: signup. distinctId = email to stitch with the storefront journey.
    const normEmail = email.toLowerCase().trim();
    captureServer('app_signup', normEmail, {
      organization: companyName.trim(),
      $set: { email: normEmail, name: name.trim(), signup_app: 'inspectr' },
    }, { account: orgId });

    res.status(201).json({
      sessionId,
      user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), role: 'admin', orgId },
    });
  });
}
