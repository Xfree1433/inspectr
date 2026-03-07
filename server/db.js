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
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    company_id TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    lat REAL DEFAULT NULL,
    lng REAL DEFAULT NULL
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

// Migration: add columns if they don't exist (for existing databases)
try { db.exec("ALTER TABLE inspections ADD COLUMN company_id TEXT REFERENCES companies(id)"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE inspectors ADD COLUMN email TEXT DEFAULT ''"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE inspectors ADD COLUMN phone TEXT DEFAULT ''"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE inspectors ADD COLUMN company_id TEXT DEFAULT ''"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE sites ADD COLUMN contact_name TEXT DEFAULT ''"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE sites ADD COLUMN contact_phone TEXT DEFAULT ''"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE sites ADD COLUMN address TEXT DEFAULT ''"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE sites ADD COLUMN lat REAL DEFAULT NULL"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE sites ADD COLUMN lng REAL DEFAULT NULL"); } catch { /* already exists */ }

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
  const insInspector = db.prepare('INSERT INTO inspectors (id, initials, name, email, phone, company_id) VALUES (?, ?, ?, ?, ?, ?)');
  const insSite = db.prepare('INSERT INTO sites (id, name, contact_name, contact_phone, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insTmpl = db.prepare('INSERT INTO templates (id, icon, name, item_count) VALUES (?, ?, ?, ?)');
  const insInsp = db.prepare('INSERT INTO inspections (id, site, type, score, status, inspector_id, company_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insFeed = db.prepare('INSERT INTO feed_events (id, time, color, html) VALUES (?, ?, ?, ?)');

  const seedAll = db.transaction(() => {
    // Companies
    const insCompany = db.prepare('INSERT INTO companies (id, name, contact, phone) VALUES (?, ?, ?, ?)');
    insCompany.run('co-1', 'Metro Water Authority', 'James Henderson', '(555) 010-0100');
    insCompany.run('co-2', 'Coastal Transport Corp', 'Rachel Chen', '(555) 020-0200');
    insCompany.run('co-3', 'GridCo Energy', 'Dev Patel', '(555) 030-0300');
    insCompany.run('co-4', 'Apex Environmental Services', 'Maria Santos', '(555) 040-0400');
    insCompany.run('co-5', 'Pacific Infrastructure Group', 'Tom Bradley', '(555) 050-0500');

    // Inspectors (with email, phone, company)
    insInspector.run('mo', 'MO', 'Michael Okafor', 'm.okafor@metrowater.gov', '(555) 111-2001', 'co-1');
    insInspector.run('sr', 'SR', 'Sofia Ramos', 's.ramos@coastaltransport.com', '(555) 111-2002', 'co-2');
    insInspector.run('tk', 'TK', 'Takeshi Kimura', 't.kimura@gridcoenergy.com', '(555) 111-2003', 'co-3');
    insInspector.run('al', 'AL', 'Anna Larsson', 'a.larsson@apexenviro.com', '(555) 111-2004', 'co-4');
    insInspector.run('cb', 'CB', 'Chidi Balogun', 'c.balogun@pacificinfra.com', '(555) 111-2005', 'co-5');
    insInspector.run('jw', 'JW', 'Jack Walsh', 'j.walsh@pacificinfra.com', '(555) 111-2006', 'co-5');

    // Sites (with contact, address, coordinates)
    insSite.run('st-1000', 'Riverside Pump Station #4', 'Dave Morton', '(555) 300-1000', '2401 River Rd, Sacramento, CA 95833', 38.5976, -121.5010);
    insSite.run('st-1001', 'Harbor Bridge Section 7', 'Lisa Tran', '(555) 300-1001', '901 Harbor Bridge Dr, Corpus Christi, TX 78401', 27.8103, -97.3964);
    insSite.run('st-1002', 'Northgate Substation', 'Frank Reeves', '(555) 300-1002', '7800 Northgate Blvd, Sacramento, CA 95834', 38.6128, -121.4490);
    insSite.run('st-1003', 'Eastfield Water Treatment', 'Priya Sharma', '(555) 300-1003', '4500 Eastfield Ave, Mesquite, TX 75150', 32.7668, -96.5992);
    insSite.run('st-1004', 'Depot B — Bay 12', 'Carlos Mendez', '(555) 300-1004', '1200 Industrial Pkwy, Hayward, CA 94545', 37.6313, -122.0957);
    insSite.run('st-1005', 'Terminal 3 Apron', 'Nancy Keane', '(555) 300-1005', 'SFO Airport, San Francisco, CA 94128', 37.6213, -122.3790);
    insSite.run('st-1006', 'Grid Substation West', 'Ray Cooper', '(555) 300-1006', '15200 W Grid Access Rd, Bakersfield, CA 93311', 35.3733, -119.0187);
    insSite.run('st-1007', 'Central Waste Facility', 'Angela Brooks', '(555) 300-1007', '8900 Landfill Rd, Fresno, CA 93706', 36.7378, -119.7871);
    insSite.run('st-1008', 'Bayview Treatment Plant', 'Oscar Diaz', '(555) 300-1008', '700 Phelps St, San Francisco, CA 94124', 37.7294, -122.3944);
    insSite.run('st-1009', 'South Dock Warehouse B', 'Kim Nguyen', '(555) 300-1009', '3200 S Dock Ave, Long Beach, CA 90802', 33.7504, -118.2166);
    insSite.run('st-1010', 'Airport Taxiway Delta', 'Steve Jarrett', '(555) 300-1010', 'LAX Airport, Los Angeles, CA 90045', 33.9416, -118.4085);
    insSite.run('st-1011', 'Highway Interchange 12', 'Pat Sullivan', '(555) 300-1011', '', 36.1060, -120.0623);  // Remote — coords only

    // Templates
    insTmpl.run('structural', '🏗', 'Structural', 24);
    insTmpl.run('electrical', '⚡', 'Electrical', 18);
    insTmpl.run('mechanical', '🔧', 'Mechanical', 21);
    insTmpl.run('environmental', '🌿', 'Environmental', 15);
    insTmpl.run('pavement', '🛣', 'Pavement', 12);
    insTmpl.run('facility', '🏭', 'Facility', 30);

    // Inspections
    insInsp.run('INS-0891', 'Riverside Pump Station #4', 'STRUCTURAL', 61, 'pending', 'mo', 'co-1', '2024-12-06T12:55:00');
    insInsp.run('INS-0890', 'Harbor Bridge Section 7', 'CIVIL / BRIDGE', 94, 'pass', 'sr', 'co-2', '2024-12-06T13:10:00');
    insInsp.run('INS-0889', 'Northgate Substation', 'ELECTRICAL', 41, 'fail', 'tk', 'co-3', '2024-12-06T11:30:00');
    insInsp.run('INS-0888', 'Eastfield Water Treatment', 'PROCESS', 88, 'pass', 'al', 'co-4', '2024-12-06T10:50:00');
    insInsp.run('INS-0887', 'Depot B — Bay 12', 'FACILITY', 76, 'pass', 'cb', 'co-5', '2024-12-06T09:10:00');
    insInsp.run('INS-0886', 'Terminal 3 Apron', 'PAVEMENT', 55, 'fail', 'jw', 'co-5', '2024-12-06T08:30:00');
    insInsp.run('INS-0885', 'Grid Substation West', 'ELECTRICAL', 91, 'pass', 'sr', 'co-3', '2024-12-05T14:00:00');
    insInsp.run('INS-0884', 'Central Waste Facility', 'ENVIRONMENTAL', 83, 'pass', 'tk', 'co-4', '2024-12-05T11:00:00');

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
