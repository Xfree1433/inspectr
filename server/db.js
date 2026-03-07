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

  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT DEFAULT '',
    phone TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    site TEXT NOT NULL,
    type TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    inspector_id TEXT REFERENCES inspectors(id),
    company_id TEXT REFERENCES companies(id),
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
    remediation_status TEXT DEFAULT 'open',
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

  CREATE TABLE IF NOT EXISTS template_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id TEXT REFERENCES templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS template_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER REFERENCES template_groups(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
  CREATE INDEX IF NOT EXISTS idx_inspections_created ON inspections(created_at DESC);
`);

// Migration: add company_id column if it doesn't exist (for existing databases)
try {
  db.exec("ALTER TABLE inspections ADD COLUMN company_id TEXT REFERENCES companies(id)");
} catch { /* column already exists */ }

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_check_groups_insp ON check_groups(inspection_id);
  CREATE INDEX IF NOT EXISTS idx_check_items_group ON check_items(group_id);
  CREATE INDEX IF NOT EXISTS idx_failures_insp ON failures(inspection_id);
  CREATE INDEX IF NOT EXISTS idx_feed_time ON feed_events(time DESC);
  CREATE INDEX IF NOT EXISTS idx_tmpl_groups ON template_groups(template_id);
  CREATE INDEX IF NOT EXISTS idx_tmpl_items ON template_items(group_id);
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

    const insCompany = db.prepare('INSERT INTO companies (id, name, contact, phone) VALUES (?, ?, ?, ?)');
    insCompany.run('co-1', 'Metro Water Authority', 'J. Henderson', '555-0100');
    insCompany.run('co-2', 'Coastal Transport Corp', 'R. Chen', '555-0200');
    insCompany.run('co-3', 'GridCo Energy', 'D. Patel', '555-0300');

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

// Seed template checklist groups/items if empty (migration for existing DBs)
const tmplGroupCount = db.prepare('SELECT COUNT(*) as c FROM template_groups').get();
if (tmplGroupCount.c === 0) {
  const TEMPLATE_CHECKLISTS = {
    structural: [
      { name: 'Foundation & Substructure', items: [
        'Foundation crack inspection (width, length, pattern)',
        'Settlement or heaving assessment',
        'Anchor bolt condition and torque check',
        'Waterproofing / damp-proof membrane integrity',
        'Soil erosion around footings',
        'Pile cap condition (if applicable)',
      ]},
      { name: 'Superstructure', items: [
        'Load-bearing wall plumb and alignment',
        'Steel beam / column connection inspection',
        'Weld quality visual check (cracks, porosity, undercut)',
        'Concrete spalling or delamination',
        'Reinforcement bar exposure / corrosion',
        'Expansion joint condition and gap measurement',
      ]},
      { name: 'Roof & Envelope', items: [
        'Roof membrane integrity and ponding',
        'Flashing and coping condition',
        'Parapet wall stability',
        'Cladding / curtain wall fastener check',
        'Window and door frame seal inspection',
        'Gutter and downspout drainage flow test',
      ]},
      { name: 'Safety & Documentation', items: [
        'Structural drawings current and on-site',
        'Load rating signage posted',
        'Shoring / bracing temporary works verified',
        'Egress routes unobstructed',
        'PPE compliance confirmed',
        'Previous deficiency close-out verified',
      ]},
    ],
    electrical: [
      { name: 'Switchgear & Distribution', items: [
        'Main breaker operation test',
        'Bus bar torque and thermal scan',
        'Arc flash labels current and visible',
        'Switchgear enclosure condition (rust, damage)',
        'Ground fault protection test',
      ]},
      { name: 'Wiring & Conduit', items: [
        'Conduit support and fastener check',
        'Wire insulation condition (cracking, discoloration)',
        'Junction box covers secure and labeled',
        'Cable tray fill ratio within limits',
        'Conductor termination torque verification',
      ]},
      { name: 'Grounding & Bonding', items: [
        'Ground rod resistance measurement',
        'Bonding jumper continuity test',
        'Equipment grounding conductor check',
        'Lightning protection system inspection',
      ]},
      { name: 'Controls & Safety', items: [
        'Emergency stop function test',
        'Control panel voltage readings recorded',
        'GFCI / RCD trip test',
        'Lockout/tagout devices in place',
      ]},
    ],
    mechanical: [
      { name: 'Rotating Equipment', items: [
        'Motor vibration measurement',
        'Bearing temperature and noise check',
        'Belt / coupling alignment and tension',
        'Shaft seal / packing gland inspection',
        'Lubrication level and condition',
      ]},
      { name: 'Piping & Valves', items: [
        'Pipe support and hanger condition',
        'Valve operation test (open/close/throttle)',
        'Flange bolt torque and gasket check',
        'Expansion loop / bellows inspection',
        'Pipe insulation and lagging condition',
        'Pressure gauge calibration date verified',
      ]},
      { name: 'HVAC Systems', items: [
        'Air handler unit filter condition',
        'Ductwork joint seal and insulation',
        'Thermostat calibration check',
        'Refrigerant charge and leak test',
        'Condensate drain flow and trap condition',
      ]},
      { name: 'Safety & Compliance', items: [
        'Pressure relief valve tag and test date',
        'Emergency shutoff valve accessibility',
        'Machine guarding in place',
        'Safety signage and placards current',
        'Maintenance log up to date',
      ]},
    ],
    environmental: [
      { name: 'Air Quality', items: [
        'Emissions monitoring equipment calibration',
        'Stack / vent discharge visual inspection',
        'Dust suppression measures in place',
        'Odor complaint log reviewed',
      ]},
      { name: 'Water & Stormwater', items: [
        'Outfall discharge sampling (pH, turbidity)',
        'Stormwater BMP condition (silt fence, basins)',
        'Spill prevention containment check',
        'Dewatering discharge permit compliance',
      ]},
      { name: 'Waste & Hazmat', items: [
        'Hazardous waste storage area condition',
        'Container labeling and dating correct',
        'Secondary containment integrity',
        'Waste manifest documentation current',
      ]},
      { name: 'Ecological & Compliance', items: [
        'Erosion and sediment control effectiveness',
        'Protected species / habitat buffer verified',
        'Environmental permit conditions posted',
      ]},
    ],
    pavement: [
      { name: 'Surface Condition', items: [
        'Cracking survey (type, severity, extent)',
        'Rutting depth measurement',
        'Raveling / weathering assessment',
        'Pothole identification and sizing',
      ]},
      { name: 'Structural Assessment', items: [
        'Core sample thickness verification',
        'Subgrade / base layer condition',
        'Deflection testing results review',
        'Joint / crack sealant condition',
      ]},
      { name: 'Drainage & Markings', items: [
        'Surface drainage and cross-slope adequacy',
        'Catch basin and inlet condition',
        'Line striping reflectivity and visibility',
        'Signage and delineator condition',
      ]},
    ],
    facility: [
      { name: 'Building Exterior', items: [
        'Roof condition and drainage',
        'Exterior wall and cladding inspection',
        'Window and door seal integrity',
        'Foundation visible crack check',
        'Parking lot and walkway condition',
        'Exterior lighting function test',
      ]},
      { name: 'Building Interior', items: [
        'Floor surface condition and trip hazards',
        'Ceiling tile and grid condition',
        'Interior wall damage assessment',
        'Door and hardware function test',
        'Stairway handrail and tread check',
      ]},
      { name: 'MEP Systems', items: [
        'HVAC system operation and filter check',
        'Plumbing fixture and drain function',
        'Electrical panel access clear (36" clearance)',
        'Emergency generator run test',
        'Elevator / lift inspection tag current',
        'Fire suppression system gauge check',
      ]},
      { name: 'Life Safety', items: [
        'Fire extinguisher inspection tags current',
        'Emergency exit signage illuminated',
        'Egress routes clear and unobstructed',
        'Smoke / CO detector function test',
        'AED unit inspection and battery date',
        'Emergency evacuation plan posted',
      ]},
      { name: 'Compliance & Documentation', items: [
        'Occupancy permit current and posted',
        'ADA accessibility compliance check',
        'Hazmat / SDS binder location verified',
        'Building maintenance log current',
        'Pest control service log reviewed',
        'Janitorial / sanitation schedule posted',
        'Energy audit / utility meter reading recorded',
      ]},
    ],
  };

  const insTemplGroup = db.prepare('INSERT INTO template_groups (template_id, name, sort_order) VALUES (?, ?, ?)');
  const insTemplItem = db.prepare('INSERT INTO template_items (group_id, text, sort_order) VALUES (?, ?, ?)');
  const seedTemplates = db.transaction(() => {
    for (const [templateId, groups] of Object.entries(TEMPLATE_CHECKLISTS)) {
      groups.forEach((group, gi) => {
        const gid = insTemplGroup.run(templateId, group.name, gi).lastInsertRowid;
        group.items.forEach((text, ii) => insTemplItem.run(gid, text, ii));
      });
    }
  });
  seedTemplates();

  // Update item counts
  const updateCount = db.prepare('UPDATE templates SET item_count = ? WHERE id = ?');
  const templates = db.prepare('SELECT id FROM templates').all();
  templates.forEach(t => {
    const cnt = db.prepare('SELECT COUNT(*) as c FROM template_items ti JOIN template_groups tg ON ti.group_id = tg.id WHERE tg.template_id = ?').get(t.id);
    updateCount.run(cnt.c, t.id);
  });
}

export default db;
