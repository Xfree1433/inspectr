import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import db from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
  res.json({
    passed,
    failures,
    pending,
    rate: total > 0 ? Math.round((passed / total) * 100) : 0,
    passedToday: 12,
    failuresToday: 4,
  });
});

// ── Inspections ──
app.get('/api/inspections', (req, res) => {
  const status = req.query.status;
  let rows;
  if (status && status !== 'all') {
    rows = db.prepare(`
      SELECT i.*, ins.initials as inspector_initials, ins.name as inspector_name
      FROM inspections i
      LEFT JOIN inspectors ins ON i.inspector_id = ins.id
      WHERE i.status = ?
      ORDER BY i.created_at DESC
    `).all(status);
  } else {
    rows = db.prepare(`
      SELECT i.*, ins.initials as inspector_initials, ins.name as inspector_name
      FROM inspections i
      LEFT JOIN inspectors ins ON i.inspector_id = ins.id
      ORDER BY i.created_at DESC
    `).all();
  }
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
    const tmpl = db.prepare('SELECT name FROM templates WHERE id = ?').get(templateId);
    if (tmpl) {
      const gid = db.prepare('INSERT INTO check_groups (inspection_id, name, sort_order) VALUES (?, ?, 0)').run(id, `${tmpl.name} Items`).lastInsertRowid;
      const count = db.prepare('SELECT item_count as c FROM templates WHERE id = ?').get(templateId).c;
      const insItem = db.prepare('INSERT INTO check_items (id, group_id, text, status, sort_order) VALUES (?, ?, ?, ?, ?)');
      for (let i = 0; i < Math.min(count, 10); i++) {
        insItem.run(uuid(), gid, `${tmpl.name} check item ${i + 1}`, '', i);
      }
    }
  }

  addFeedEvent('warn', `<strong>${id}</strong> — Created for <strong>${site}</strong>`);
  res.status(201).json({ id });
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

  addFeedEvent('fail', `<strong>${inspectionId}</strong> — Failure flagged: <span class="tag-f">${title}</span>`);
  res.status(201).json({ id });
});

// ── Feed ──
app.get('/api/feed', (_req, res) => {
  res.json(db.prepare('SELECT * FROM feed_events ORDER BY time DESC LIMIT 50').all());
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

  const statusLabel = newStatus === 'pass' ? '<span class="tag-p">PASSED</span>' : '<span class="tag-f">FAILED</span>';
  addFeedEvent(newStatus === 'pass' ? 'pass' : 'fail', `<strong>${req.params.id}</strong> — Inspection ${statusLabel} · Score ${insp.score}/100`);

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

function addFeedEvent(color, html) {
  db.prepare('INSERT INTO feed_events (id, time, color, html) VALUES (?, ?, ?, ?)').run(uuid(), new Date().toISOString(), color, html);
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
