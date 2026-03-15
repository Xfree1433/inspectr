import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

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

export function authMiddleware(db) {
  return (req, res, next) => {
    // Skip auth for login, register, demo, and health routes
    if (req.path === '/api/auth/login' ||
        req.path === '/api/auth/register' ||
        req.path === '/api/auth/demo' ||
        req.path === '/api/auth/session' ||
        req.path === '/api/auth/logout' ||
        req.path === '/api/health' ||
        req.path === '/api/reset-demo' ||
        !req.path.startsWith('/api/')) {
      return next();
    }

    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = db.prepare('SELECT s.*, u.name as user_name, u.email as user_email, u.role as user_role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime("now")').get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Session expired' });
    }

    req.user = {
      id: session.user_id,
      name: session.user_name,
      email: session.user_email,
      role: session.user_role,
      orgId: session.org_id,
    };
    req.orgId = session.org_id;
    next();
  };
}

export function setupAuthRoutes(app, db) {
  // Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user || !bcrypt.compareSync(password, user.hashed_password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionId = uuid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)').run(sessionId, user.id, user.org_id, expiresAt);

    res.json({
      sessionId,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.org_id },
    });
  });

  // Demo auto-login
  app.post('/api/auth/demo', (_req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('demo@acme.com');
    if (!user) return res.status(500).json({ error: 'Demo account not found' });

    const sessionId = uuid();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)').run(sessionId, user.id, user.org_id, expiresAt);

    res.json({
      sessionId,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.org_id },
    });
  });

  // Session check
  app.get('/api/auth/session', (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.json({ user: null });

    const session = db.prepare('SELECT s.*, u.name as user_name, u.email as user_email, u.role as user_role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > datetime("now")').get(sessionId);
    if (!session) return res.json({ user: null });

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

  // Register (creates new org + admin user)
  app.post('/api/auth/register', (req, res) => {
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

    res.status(201).json({
      sessionId,
      user: { id: userId, name: name.trim(), email: email.toLowerCase().trim(), role: 'admin', orgId },
    });
  });
}
