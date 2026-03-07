import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import db from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Template Checklists ──
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
      'Electrical panel access clear (36″ clearance)',
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

// ── Inspectors ──
app.get('/api/inspectors', (_req, res) => {
  res.json(db.prepare('SELECT * FROM inspectors').all());
});

// ── Sites ──
app.get('/api/sites', (req, res) => {
  const q = req.query.q;
  if (q) {
    res.json(db.prepare("SELECT * FROM sites WHERE name LIKE ?").all(`%${q}%`));
  } else {
    res.json(db.prepare('SELECT * FROM sites').all());
  }
});

// ── Templates ──
app.get('/api/templates', (_req, res) => {
  res.json(db.prepare('SELECT id, icon, name, item_count as count FROM templates').all());
});

// ── Search ──
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;
  const rows = db.prepare(`
    SELECT i.*, ins.initials as inspector_initials, ins.name as inspector_name
    FROM inspections i
    LEFT JOIN inspectors ins ON i.inspector_id = ins.id
    WHERE i.id LIKE ? OR i.site LIKE ? OR i.type LIKE ? OR ins.name LIKE ?
    ORDER BY i.created_at DESC
    LIMIT 20
  `).all(like, like, like, like);
  res.json(rows.map(r => ({
    id: r.id,
    site: r.site,
    type: r.type,
    score: r.score,
    status: r.status,
    inspectorId: r.inspector_id,
    inspectorInitials: r.inspector_initials,
    inspectorName: r.inspector_name,
    createdAt: r.created_at,
    time: formatTimeAgo(r.created_at),
  })));
});

// ── Stats ──
app.get('/api/stats', (_req, res) => {
  const passed = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE status='pass'").get().c;
  const failures = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE status='fail'").get().c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE status='pending'").get().c;
  const total = passed + failures + pending;
  const today = new Date().toISOString().slice(0, 10);
  const passedToday = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE status='pass' AND created_at >= ?").get(today).c;
  const failuresToday = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE status='fail' AND created_at >= ?").get(today).c;
  res.json({
    passed,
    failures,
    pending,
    rate: total > 0 ? Math.round((passed / total) * 100) : 0,
    passedToday,
    failuresToday,
  });
});

// ── Inspections ──
app.get('/api/inspections', (req, res) => {
  const { status, from, to } = req.query;
  const conditions = [];
  const params = [];
  if (status && status !== 'all') { conditions.push('i.status = ?'); params.push(status); }
  if (from) { conditions.push('i.created_at >= ?'); params.push(from); }
  if (to) { conditions.push('i.created_at <= ?'); params.push(to + 'T23:59:59'); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT i.*, ins.initials as inspector_initials, ins.name as inspector_name
    FROM inspections i
    LEFT JOIN inspectors ins ON i.inspector_id = ins.id
    ${where}
    ORDER BY i.created_at DESC
  `).all(...params);
  res.json(rows.map(r => ({
    id: r.id,
    site: r.site,
    type: r.type,
    score: r.score,
    status: r.status,
    inspectorId: r.inspector_id,
    inspectorInitials: r.inspector_initials,
    inspectorName: r.inspector_name,
    createdAt: r.created_at,
    time: formatTimeAgo(r.created_at),
  })));
});

app.post('/api/inspections', (req, res) => {
  const { site, type, inspectorId, notes, templateId } = req.body;
  const id = `INS-${String(db.prepare('SELECT COUNT(*) as c FROM inspections').get().c + 892).padStart(4, '0')}`;
  db.prepare('INSERT INTO inspections (id, site, type, status, inspector_id, notes) VALUES (?, ?, ?, ?, ?, ?)').run(id, site, type, 'pending', inspectorId, notes || '');

  // Create checklist groups based on template
  if (templateId) {
    const groups = TEMPLATE_CHECKLISTS[templateId];
    if (groups) {
      const insGroup = db.prepare('INSERT INTO check_groups (inspection_id, name, sort_order) VALUES (?, ?, ?)');
      const insItem = db.prepare('INSERT INTO check_items (id, group_id, text, status, sort_order) VALUES (?, ?, ?, ?, ?)');
      groups.forEach((group, gi) => {
        const gid = insGroup.run(id, group.name, gi).lastInsertRowid;
        group.items.forEach((text, ii) => insItem.run(uuid(), gid, text, '', ii));
      });
    }
  }

  addFeedEvent('warn', id, `Created for ${site}`);
  res.status(201).json({ id });
});

app.delete('/api/inspections/:id', (req, res) => {
  const insp = db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id);
  if (!insp) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM inspections WHERE id = ?').run(req.params.id);
  addFeedEvent('warn', req.params.id, 'Inspection deleted');
  res.json({ ok: true });
});

// ── Checklist ──
app.get('/api/inspections/:id/checklist', (req, res) => {
  const groups = db.prepare('SELECT * FROM check_groups WHERE inspection_id = ? ORDER BY sort_order').all(req.params.id);
  const result = groups.map(g => ({
    name: g.name,
    items: db.prepare('SELECT id, text, status, fail_note as failNote FROM check_items WHERE group_id = ? ORDER BY sort_order').all(g.id),
  }));
  res.json(result);
});

app.patch('/api/check-items/:id', (req, res) => {
  const { status, failNote } = req.body;
  if (status !== undefined) db.prepare('UPDATE check_items SET status = ? WHERE id = ?').run(status, req.params.id);
  if (failNote !== undefined) db.prepare('UPDATE check_items SET fail_note = ? WHERE id = ?').run(failNote, req.params.id);

  // Recalculate parent inspection score
  const item = db.prepare('SELECT ci.*, cg.inspection_id FROM check_items ci JOIN check_groups cg ON ci.group_id = cg.id WHERE ci.id = ?').get(req.params.id);
  if (item) {
    recalcScore(item.inspection_id);
  }
  res.json({ ok: true });
});

// ── Failures ──
app.post('/api/failures', (req, res) => {
  const { inspectionId, checkItemId, title, severity, description, assigneeId, dueDate, referenceStandard, photos } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO failures (id, inspection_id, check_item_id, title, severity, description, assignee_id, due_date, reference_standard) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, inspectionId, checkItemId, title, severity || 'low', description || '', assigneeId || null, dueDate || null, referenceStandard || '');

  if (photos && photos.length > 0) {
    const insPhoto = db.prepare('INSERT INTO failure_photos (id, failure_id, data_url) VALUES (?, ?, ?)');
    photos.forEach(p => insPhoto.run(uuid(), id, p));
  }

  addFeedEvent('fail', inspectionId, 'Failure flagged', title);
  res.status(201).json({ id });
});

app.get('/api/inspections/:id/failures', (req, res) => {
  const rows = db.prepare(`
    SELECT f.*, ins.name as assignee_name, ins.initials as assignee_initials
    FROM failures f
    LEFT JOIN inspectors ins ON f.assignee_id = ins.id
    WHERE f.inspection_id = ?
    ORDER BY f.created_at DESC
  `).all(req.params.id);
  const result = rows.map(r => {
    const photos = db.prepare('SELECT data_url FROM failure_photos WHERE failure_id = ?').all(r.id).map(p => p.data_url);
    return {
      id: r.id,
      title: r.title,
      severity: r.severity,
      description: r.description,
      assigneeName: r.assignee_name,
      assigneeInitials: r.assignee_initials,
      dueDate: r.due_date,
      referenceStandard: r.reference_standard,
      createdAt: r.created_at,
      photos,
    };
  });
  res.json(result);
});

// ── Feed ──
app.get('/api/feed', (_req, res) => {
  const rows = db.prepare('SELECT * FROM feed_events ORDER BY time DESC LIMIT 50').all();
  res.json(rows.map(r => ({
    id: r.id,
    time: r.time,
    color: r.color,
    inspectionId: r.inspection_id || '',
    message: r.message || '',
    tag: r.tag || '',
  })));
});

// ── Report ──
app.get('/api/inspections/:id/report', (req, res) => {
  const insp = db.prepare(`
    SELECT i.*, ins.name as inspector_name
    FROM inspections i
    LEFT JOIN inspectors ins ON i.inspector_id = ins.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!insp) return res.status(404).json({ error: 'Not found' });

  const groups = db.prepare('SELECT * FROM check_groups WHERE inspection_id = ? ORDER BY sort_order').all(req.params.id);
  const sections = groups.map(g => {
    const items = db.prepare('SELECT text, status, fail_note as note FROM check_items WHERE group_id = ? ORDER BY sort_order').all(g.id);
    const done = items.filter(i => i.status === 'done' || i.status === 'failed').length;
    const passed = items.filter(i => i.status === 'done').length;
    const score = done > 0 ? Math.round((passed / done) * 100) : 0;
    return {
      name: g.name,
      score,
      items: items.map(i => ({
        text: i.text,
        status: i.status === 'done' ? 'pass' : i.status === 'failed' ? 'fail' : 'pending',
        note: i.note || undefined,
      })),
    };
  });

  res.json({
    id: insp.id,
    site: insp.site,
    type: insp.type,
    score: insp.score,
    status: insp.status,
    inspectorName: insp.inspector_name,
    createdAt: insp.created_at,
    sections,
  });
});

// ── Submit report ──
app.post('/api/inspections/:id/submit', (req, res) => {
  const insp = db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id);
  if (!insp) return res.status(404).json({ error: 'Not found' });

  const hasFail = db.prepare("SELECT COUNT(*) as c FROM check_items ci JOIN check_groups cg ON ci.group_id = cg.id WHERE cg.inspection_id = ? AND ci.status = 'failed'").get(req.params.id).c > 0;
  const newStatus = hasFail ? 'fail' : 'pass';
  db.prepare('UPDATE inspections SET status = ? WHERE id = ?').run(newStatus, req.params.id);
  recalcScore(req.params.id);

  const statusLabel = newStatus === 'pass' ? 'PASSED' : 'FAILED';
  addFeedEvent(newStatus === 'pass' ? 'pass' : 'fail', req.params.id, `Inspection ${statusLabel}`, `Score ${insp.score}/100`);

  res.json({ status: newStatus });
});

// ── Helpers ──
function recalcScore(inspectionId) {
  const groups = db.prepare('SELECT id FROM check_groups WHERE inspection_id = ?').all(inspectionId);
  let totalItems = 0, doneItems = 0, passedItems = 0;
  groups.forEach(g => {
    const items = db.prepare('SELECT status FROM check_items WHERE group_id = ?').all(g.id);
    totalItems += items.length;
    items.forEach(i => {
      if (i.status === 'done' || i.status === 'failed') doneItems++;
      if (i.status === 'done') passedItems++;
    });
  });
  const score = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;
  db.prepare('UPDATE inspections SET score = ? WHERE id = ?').run(score, inspectionId);
}

function addFeedEvent(color, inspectionId, message, tag = '') {
  db.prepare('INSERT INTO feed_events (id, time, color, inspection_id, message, tag) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), new Date().toISOString(), color, inspectionId, message, tag);
}

function formatTimeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ${diffMin % 60}m ago`;
  return 'Yesterday';
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`INSPECTR API running on :${PORT}`));
