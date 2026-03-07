import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import db from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Helper: get template checklist from DB ──
function getTemplateChecklist(templateId) {
  const groups = db.prepare('SELECT * FROM template_groups WHERE template_id = ? ORDER BY sort_order').all(templateId);
  return groups.map(g => ({
    name: g.name,
    items: db.prepare('SELECT text FROM template_items WHERE group_id = ? ORDER BY sort_order').all(g.id).map(i => i.text),
  }));
}

function updateTemplateItemCount(templateId) {
  const cnt = db.prepare('SELECT COUNT(*) as c FROM template_items ti JOIN template_groups tg ON ti.group_id = tg.id WHERE tg.template_id = ?').get(templateId);
  db.prepare('UPDATE templates SET item_count = ? WHERE id = ?').run(cnt.c, templateId);
}

// ── Companies ──
app.get('/api/companies', (_req, res) => {
  res.json(db.prepare('SELECT * FROM companies ORDER BY name').all());
});
app.post('/api/companies', (req, res) => {
  const { name, contact, phone } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const id = `co-${uuid().slice(0, 8)}`;
  db.prepare('INSERT INTO companies (id, name, contact, phone) VALUES (?, ?, ?, ?)').run(id, name.trim(), contact?.trim() || '', phone?.trim() || '');
  res.status(201).json({ id, name: name.trim(), contact: contact?.trim() || '', phone: phone?.trim() || '' });
});
app.patch('/api/companies/:id', (req, res) => {
  const { name, contact, phone } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  db.prepare('UPDATE companies SET name = ?, contact = ?, phone = ? WHERE id = ?').run(name.trim(), contact?.trim() || '', phone?.trim() || '', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/companies/:id', (req, res) => {
  db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Inspectors ──
app.get('/api/inspectors', (_req, res) => {
  res.json(db.prepare('SELECT * FROM inspectors ORDER BY name').all());
});
app.post('/api/inspectors', (req, res) => {
  const { name, initials } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const id = uuid().slice(0, 8);
  const init = initials?.trim().toUpperCase() || name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  db.prepare('INSERT INTO inspectors (id, initials, name) VALUES (?, ?, ?)').run(id, init, name.trim());
  res.status(201).json({ id, initials: init, name: name.trim() });
});
app.patch('/api/inspectors/:id', (req, res) => {
  const { name, initials } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const init = initials?.trim().toUpperCase() || name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  db.prepare('UPDATE inspectors SET name = ?, initials = ? WHERE id = ?').run(name.trim(), init, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/inspectors/:id', (req, res) => {
  db.prepare('DELETE FROM inspectors WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Sites ──
app.get('/api/sites', (req, res) => {
  const q = req.query.q;
  if (q) {
    res.json(db.prepare("SELECT * FROM sites WHERE name LIKE ? ORDER BY name").all(`%${q}%`));
  } else {
    res.json(db.prepare('SELECT * FROM sites ORDER BY name').all());
  }
});
app.post('/api/sites', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const id = `st-${uuid().slice(0, 8)}`;
  db.prepare('INSERT INTO sites (id, name) VALUES (?, ?)').run(id, name.trim());
  res.status(201).json({ id, name: name.trim() });
});
app.patch('/api/sites/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  db.prepare('UPDATE sites SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/sites/:id', (req, res) => {
  db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Templates ──
app.get('/api/templates', (_req, res) => {
  res.json(db.prepare('SELECT id, icon, name, item_count as count FROM templates ORDER BY name').all());
});

app.get('/api/templates/:id', (req, res) => {
  const tmpl = db.prepare('SELECT id, icon, name, item_count as count FROM templates WHERE id = ?').get(req.params.id);
  if (!tmpl) return res.status(404).json({ error: 'Not found' });
  const groups = db.prepare('SELECT * FROM template_groups WHERE template_id = ? ORDER BY sort_order').all(req.params.id);
  const result = {
    ...tmpl,
    groups: groups.map(g => ({
      id: g.id,
      name: g.name,
      items: db.prepare('SELECT id, text FROM template_items WHERE group_id = ? ORDER BY sort_order').all(g.id),
    })),
  };
  res.json(result);
});

app.post('/api/templates', (req, res) => {
  const { name, icon, groups } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const id = `tmpl-${uuid().slice(0, 8)}`;
  db.prepare('INSERT INTO templates (id, icon, name, item_count) VALUES (?, ?, ?, ?)').run(id, icon || '📋', name.trim(), 0);
  if (groups && groups.length > 0) {
    const insGroup = db.prepare('INSERT INTO template_groups (template_id, name, sort_order) VALUES (?, ?, ?)');
    const insItem = db.prepare('INSERT INTO template_items (group_id, text, sort_order) VALUES (?, ?, ?)');
    db.transaction(() => {
      groups.forEach((g, gi) => {
        const gid = insGroup.run(id, g.name, gi).lastInsertRowid;
        (g.items || []).forEach((text, ii) => insItem.run(gid, typeof text === 'string' ? text : text.text, ii));
      });
    })();
  }
  updateTemplateItemCount(id);
  const tmpl = db.prepare('SELECT id, icon, name, item_count as count FROM templates WHERE id = ?').get(id);
  res.status(201).json(tmpl);
});

app.patch('/api/templates/:id', (req, res) => {
  const { name, icon, groups } = req.body;
  const tmpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!tmpl) return res.status(404).json({ error: 'Not found' });
  if (name !== undefined) db.prepare('UPDATE templates SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  if (icon !== undefined) db.prepare('UPDATE templates SET icon = ? WHERE id = ?').run(icon, req.params.id);
  if (groups !== undefined) {
    db.transaction(() => {
      db.prepare('DELETE FROM template_groups WHERE template_id = ?').run(req.params.id);
      const insGroup = db.prepare('INSERT INTO template_groups (template_id, name, sort_order) VALUES (?, ?, ?)');
      const insItem = db.prepare('INSERT INTO template_items (group_id, text, sort_order) VALUES (?, ?, ?)');
      groups.forEach((g, gi) => {
        const gid = insGroup.run(req.params.id, g.name, gi).lastInsertRowid;
        (g.items || []).forEach((item, ii) => insItem.run(gid, typeof item === 'string' ? item : item.text, ii));
      });
    })();
  }
  updateTemplateItemCount(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/templates/:id', (req, res) => {
  db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Search ──
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;
  const rows = db.prepare(`
    SELECT i.*, ins.initials as inspector_initials, ins.name as inspector_name, c.name as company_name
    FROM inspections i
    LEFT JOIN inspectors ins ON i.inspector_id = ins.id
    LEFT JOIN companies c ON i.company_id = c.id
    WHERE i.id LIKE ? OR i.site LIKE ? OR i.type LIKE ? OR ins.name LIKE ? OR c.name LIKE ?
    ORDER BY i.created_at DESC
    LIMIT 20
  `).all(like, like, like, like, like);
  res.json(rows.map(r => ({
    id: r.id,
    site: r.site,
    type: r.type,
    score: r.score,
    status: r.status,
    inspectorId: r.inspector_id,
    inspectorInitials: r.inspector_initials,
    inspectorName: r.inspector_name,
    companyId: r.company_id || '',
    companyName: r.company_name || '',
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
    SELECT i.*, ins.initials as inspector_initials, ins.name as inspector_name, c.name as company_name
    FROM inspections i
    LEFT JOIN inspectors ins ON i.inspector_id = ins.id
    LEFT JOIN companies c ON i.company_id = c.id
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
    companyId: r.company_id || '',
    companyName: r.company_name || '',
    createdAt: r.created_at,
    time: formatTimeAgo(r.created_at),
  })));
});

app.post('/api/inspections', (req, res) => {
  const { site, type, inspectorId, notes, templateId, companyId } = req.body;
  const id = `INS-${String(db.prepare('SELECT COUNT(*) as c FROM inspections').get().c + 892).padStart(4, '0')}`;
  db.prepare('INSERT INTO inspections (id, site, type, status, inspector_id, company_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, site, type, 'pending', inspectorId, companyId || null, notes || '');

  // Create checklist groups based on template (from DB)
  if (templateId) {
    const groups = getTemplateChecklist(templateId);
    if (groups.length > 0) {
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
  const validStatuses = ['', 'done', 'failed', 'na'];
  if (status !== undefined && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
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

app.patch('/api/failures/:id', (req, res) => {
  const { remediationStatus } = req.body;
  const validStatuses = ['open', 'in-progress', 'verified', 'closed'];
  if (!validStatuses.includes(remediationStatus)) return res.status(400).json({ error: 'Invalid remediation status' });
  const failure = db.prepare('SELECT * FROM failures WHERE id = ?').get(req.params.id);
  if (!failure) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE failures SET remediation_status = ? WHERE id = ?').run(remediationStatus, req.params.id);
  addFeedEvent('warn', failure.inspection_id, `Failure ${remediationStatus}`, failure.title);
  res.json({ ok: true });
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
      remediationStatus: r.remediation_status || 'open',
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
    const applicable = items.filter(i => i.status !== 'na');
    const passed = applicable.filter(i => i.status === 'done').length;
    const score = applicable.length > 0 ? Math.round((passed / applicable.length) * 100) : 0;
    return {
      name: g.name,
      score,
      items: items.map(i => ({
        text: i.text,
        status: i.status === 'done' ? 'pass' : i.status === 'failed' ? 'fail' : i.status === 'na' ? 'na' : 'pending',
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
  let totalItems = 0, passedItems = 0;
  groups.forEach(g => {
    const items = db.prepare('SELECT status FROM check_items WHERE group_id = ?').all(g.id);
    items.forEach(i => {
      if (i.status === 'na') return; // N/A items excluded from scoring
      totalItems++;
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
