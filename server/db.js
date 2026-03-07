import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'inspectr.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS inspectors (
    id TEXT PRIMARY KEY,
    initials TEXT NOT NULL,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    icon TEXT NOT NULL,
    name TEXT NOT NULL,
    item_count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    site TEXT NOT NULL,
    type TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    inspector_id TEXT REFERENCES inspectors(id),
    created_at TEXT DEFAULT (datetime('now')),
    notes TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS check_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id TEXT REFERENCES inspections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS check_items (
    id TEXT PRIMARY KEY,
    group_id INTEGER REFERENCES check_groups(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    status TEXT DEFAULT '',
    fail_note TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS failures (
    id TEXT PRIMARY KEY,
    inspection_id TEXT REFERENCES inspections(id) ON DELETE CASCADE,
    check_item_id TEXT REFERENCES check_items(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    severity TEXT DEFAULT 'low',
    description TEXT DEFAULT '',
    assignee_id TEXT REFERENCES inspectors(id),
    due_date TEXT,
    reference_standard TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS failure_photos (
    id TEXT PRIMARY KEY,
    failure_id TEXT REFERENCES failures(id) ON DELETE CASCADE,
    data_url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed_events (
    id TEXT PRIMARY KEY,
    time TEXT DEFAULT (datetime('now')),
    color TEXT NOT NULL,
    html TEXT NOT NULL DEFAULT '',
    inspection_id TEXT DEFAULT '',
    message TEXT DEFAULT '',
    tag TEXT DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
  CREATE INDEX IF NOT EXISTS idx_inspections_created ON inspections(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_check_groups_insp ON check_groups(inspection_id);
  CREATE INDEX IF NOT EXISTS idx_check_items_group ON check_items(group_id);
  CREATE INDEX IF NOT EXISTS idx_failures_insp ON failures(inspection_id);
  CREATE INDEX IF NOT EXISTS idx_feed_time ON feed_events(time DESC);
`);

// Seed data if empty
const count = db.prepare('SELECT COUNT(*) as c FROM inspectors').get();
if (count.c === 0) {
  const insInspector = db.prepare('INSERT INTO inspectors (id, initials, name) VALUES (?, ?, ?)');
  const insSite = db.prepare('INSERT INTO sites (id, name) VALUES (?, ?)');
  const insTmpl = db.prepare('INSERT INTO templates (id, icon, name, item_count) VALUES (?, ?, ?, ?)');
  const insInsp = db.prepare('INSERT INTO inspections (id, site, type, score, status, inspector_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insFeed = db.prepare('INSERT INTO feed_events (id, time, color, html) VALUES (?, ?, ?, ?)');

  const seedAll = db.transaction(() => {
    insInspector.run('mo', 'MO', 'M. Okafor');
    insInspector.run('sr', 'SR', 'S. Ramos');
    insInspector.run('tk', 'TK', 'T. Kimura');
    insInspector.run('al', 'AL', 'A. Larsson');
    insInspector.run('cb', 'CB', 'C. Balogun');
    insInspector.run('jw', 'JW', 'J. Walsh');

    const sites = [
      'Riverside Pump Station #4', 'Harbor Bridge Section 7', 'Northgate Substation',
      'Eastfield Water Treatment', 'Depot B — Bay 12', 'Terminal 3 Apron',
      'Grid Substation West', 'Central Waste Facility', 'Bayview Treatment Plant',
      'South Dock Warehouse B', 'Airport Taxiway Delta', 'Highway Interchange 12'
    ];
    sites.forEach((s, i) => insSite.run(`st-${1000 + i}`, s));

    insTmpl.run('structural', '🏗', 'Structural', 24);
    insTmpl.run('electrical', '⚡', 'Electrical', 18);
    insTmpl.run('mechanical', '🔧', 'Mechanical', 21);
    insTmpl.run('environmental', '🌿', 'Environmental', 15);
    insTmpl.run('pavement', '🛣', 'Pavement', 12);
    insTmpl.run('facility', '🏭', 'Facility', 30);

    insInsp.run('INS-0891', 'Riverside Pump Station #4', 'STRUCTURAL', 61, 'pending', 'mo', '2024-12-06T12:55:00');
    insInsp.run('INS-0890', 'Harbor Bridge Section 7', 'CIVIL / BRIDGE', 94, 'pass', 'sr', '2024-12-06T13:10:00');
    insInsp.run('INS-0889', 'Northgate Substation', 'ELECTRICAL', 41, 'fail', 'tk', '2024-12-06T11:30:00');
    insInsp.run('INS-0888', 'Eastfield Water Treatment', 'PROCESS', 88, 'pass', 'al', '2024-12-06T10:50:00');
    insInsp.run('INS-0887', 'Depot B — Bay 12', 'FACILITY', 76, 'pass', 'cb', '2024-12-06T09:10:00');
    insInsp.run('INS-0886', 'Terminal 3 Apron', 'PAVEMENT', 55, 'fail', 'jw', '2024-12-06T08:30:00');
    insInsp.run('INS-0885', 'Grid Substation West', 'ELECTRICAL', 91, 'pass', 'sr', '2024-12-05T14:00:00');
    insInsp.run('INS-0884', 'Central Waste Facility', 'ENVIRONMENTAL', 83, 'pass', 'tk', '2024-12-05T11:00:00');

    // Seed checklist for INS-0891
    const insGroup = db.prepare('INSERT INTO check_groups (inspection_id, name, sort_order) VALUES (?, ?, ?)');
    const insItem = db.prepare('INSERT INTO check_items (id, group_id, text, status, fail_note, sort_order) VALUES (?, ?, ?, ?, ?, ?)');

    const g1 = insGroup.run('INS-0891', 'Structural Integrity', 0).lastInsertRowid;
    insItem.run('ci-1', g1, 'Foundation crack assessment', 'done', '', 0);
    insItem.run('ci-2', g1, 'Load-bearing wall inspection', 'done', '', 1);
    insItem.run('ci-3', g1, 'Roof membrane integrity', 'failed', 'Delamination detected — NE quadrant, ~12m²', 2);
    insItem.run('ci-4', g1, 'Expansion joints checked', 'done', '', 3);

    const g2 = insGroup.run('INS-0891', 'Mechanical / Electrical', 1).lastInsertRowid;
    insItem.run('ci-5', g2, 'Main pump unit operation', 'done', '', 0);
    insItem.run('ci-6', g2, 'Emergency shutoff valve test', 'done', '', 1);
    insItem.run('ci-7', g2, 'Control panel voltage reading', '', '', 2);
    insItem.run('ci-8', g2, 'SCADA comms link verified', '', '', 3);

    const g3 = insGroup.run('INS-0891', 'Safety / Compliance', 2).lastInsertRowid;
    insItem.run('ci-9', g3, 'Hazmat signage current', '', '', 0);
    insItem.run('ci-10', g3, 'Egress routes unobstructed', '', '', 1);
    insItem.run('ci-11', g3, 'Fire extinguisher tags', '', '', 2);
    insItem.run('ci-12', g3, 'PPE station stocked', '', '', 3);
    insItem.run('ci-13', g3, 'Spill kit inspection', '', '', 4);

    const insFeedNew = db.prepare('INSERT INTO feed_events (id, time, color, inspection_id, message, tag) VALUES (?, ?, ?, ?, ?, ?)');
    insFeedNew.run('f-1', '14:22:11', 'fail', 'INS-0891', 'Failure flagged', 'Roof membrane delamination');
    insFeedNew.run('f-2', '14:19:04', 'pass', 'INS-0890', 'Inspection PASSED', 'Score 94/100');
    insFeedNew.run('f-3', '13:58:32', 'fail', 'INS-0889', 'Inspection FAILED', '3 critical items');
    insFeedNew.run('f-4', '13:44:50', 'warn', 'INS-0891', 'Item completed', 'Emergency shutoff valve');
    insFeedNew.run('f-5', '13:31:18', 'pass', 'INS-0888', 'Inspection PASSED', 'Score 88/100');
    insFeedNew.run('f-6', '12:55:00', 'warn', 'INS-0891', 'Started by M. Okafor', '');
    insFeedNew.run('f-7', '12:47:33', 'ghost', 'INS-0887', 'Report submitted for review', '');
    insFeedNew.run('f-8', '11:20:09', 'fail', 'INS-0886', 'Inspection FAILED', 'Pavement cracking HIGH');
  });

  seedAll();
}

export default db;
