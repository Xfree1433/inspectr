import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import db from './db.js';
import { setupAuth, authMiddleware, setupAuthRoutes } from './auth.js';

// Initialize auth tables and seed demo data
setupAuth(db);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = join(__dirname, '..', 'dist');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth routes (login, register, demo, session, logout)
setupAuthRoutes(app, db);

// Auth middleware - protects all /api/* routes below this point
app.use(authMiddleware(db));

// Serve production frontend build if it exists
if (existsSync(distPath)) {
  console.log(`Serving static files from ${distPath}`);
  app.use(express.static(distPath));
} else {
  console.log(`No dist/ found at ${distPath} — running API-only mode`);
}

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
app.get('/api/companies', (req, res) => {
  res.json(db.prepare('SELECT * FROM companies WHERE org_id = ? ORDER BY name').all(req.orgId));
});
app.post('/api/companies', (req, res) => {
  const { name, contact, phone } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const id = `co-${uuid().slice(0, 8)}`;
  db.prepare('INSERT INTO companies (id, name, contact, phone, org_id) VALUES (?, ?, ?, ?, ?)').run(id, name.trim(), contact?.trim() || '', phone?.trim() || '', req.orgId);
  res.status(201).json({ id, name: name.trim(), contact: contact?.trim() || '', phone: phone?.trim() || '' });
});
app.patch('/api/companies/:id', (req, res) => {
  const { name, contact, phone } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  db.prepare('UPDATE companies SET name = ?, contact = ?, phone = ? WHERE id = ? AND org_id = ?').run(name.trim(), contact?.trim() || '', phone?.trim() || '', req.params.id, req.orgId);
  res.json({ ok: true });
});
app.delete('/api/companies/:id', (req, res) => {
  db.prepare('DELETE FROM companies WHERE id = ? AND org_id = ?').run(req.params.id, req.orgId);
  res.json({ ok: true });
});

// ── Inspectors ──
function mapInspector(r) {
  return {
    id: r.id, initials: r.initials, name: r.name,
    email: r.email || '', phone: r.phone || '',
    companyId: r.company_id || '', companyName: r.company_name || '',
  };
}
app.get('/api/inspectors', (req, res) => {
  const rows = db.prepare('SELECT i.*, c.name as company_name FROM inspectors i LEFT JOIN companies c ON i.company_id = c.id WHERE i.org_id = ? ORDER BY i.name').all(req.orgId);
  res.json(rows.map(mapInspector));
});
app.post('/api/inspectors', (req, res) => {
  const { name, initials, email, phone, companyId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const id = uuid().slice(0, 8);
  const init = initials?.trim().toUpperCase() || name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  db.prepare('INSERT INTO inspectors (id, initials, name, email, phone, company_id, org_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, init, name.trim(), email?.trim() || '', phone?.trim() || '', companyId || '', req.orgId);
  const row = db.prepare('SELECT i.*, c.name as company_name FROM inspectors i LEFT JOIN companies c ON i.company_id = c.id WHERE i.id = ?').get(id);
  res.status(201).json(mapInspector(row));
});
app.patch('/api/inspectors/:id', (req, res) => {
  const { name, initials, email, phone, companyId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const init = initials?.trim().toUpperCase() || name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  db.prepare('UPDATE inspectors SET name = ?, initials = ?, email = ?, phone = ?, company_id = ? WHERE id = ? AND org_id = ?').run(name.trim(), init, email?.trim() || '', phone?.trim() || '', companyId || '', req.params.id, req.orgId);
  res.json({ ok: true });
});
app.delete('/api/inspectors/:id', (req, res) => {
  db.prepare('DELETE FROM inspectors WHERE id = ? AND org_id = ?').run(req.params.id, req.orgId);
  res.json({ ok: true });
});

// ── Sites ──
function mapSite(r) {
  return {
    id: r.id, name: r.name,
    contactName: r.contact_name || '', contactPhone: r.contact_phone || '',
    address: r.address || '',
    lat: r.lat ?? null, lng: r.lng ?? null,
  };
}
app.get('/api/sites', (req, res) => {
  const q = req.query.q;
  if (q) {
    res.json(db.prepare("SELECT * FROM sites WHERE org_id = ? AND (name LIKE ? OR address LIKE ?) ORDER BY name").all(req.orgId, `%${q}%`, `%${q}%`).map(mapSite));
  } else {
    res.json(db.prepare('SELECT * FROM sites WHERE org_id = ? ORDER BY name').all(req.orgId).map(mapSite));
  }
});
app.post('/api/sites', (req, res) => {
  const { name, contactName, contactPhone, address, lat, lng } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const id = `st-${uuid().slice(0, 8)}`;
  db.prepare('INSERT INTO sites (id, name, contact_name, contact_phone, address, lat, lng, org_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, name.trim(), contactName?.trim() || '', contactPhone?.trim() || '', address?.trim() || '', lat ?? null, lng ?? null, req.orgId);
  res.status(201).json(mapSite(db.prepare('SELECT * FROM sites WHERE id = ?').get(id)));
});
app.patch('/api/sites/:id', (req, res) => {
  const { name, contactName, contactPhone, address, lat, lng } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  db.prepare('UPDATE sites SET name = ?, contact_name = ?, contact_phone = ?, address = ?, lat = ?, lng = ? WHERE id = ? AND org_id = ?').run(name.trim(), contactName?.trim() || '', contactPhone?.trim() || '', address?.trim() || '', lat ?? null, lng ?? null, req.params.id, req.orgId);
  res.json({ ok: true });
});
app.delete('/api/sites/:id', (req, res) => {
  db.prepare('DELETE FROM sites WHERE id = ? AND org_id = ?').run(req.params.id, req.orgId);
  res.json({ ok: true });
});

// ── Templates ──
app.get('/api/templates', (req, res) => {
  res.json(db.prepare('SELECT id, icon, name, item_count as count FROM templates WHERE org_id = ? ORDER BY name').all(req.orgId));
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
      items: db.prepare('SELECT id, text FROM template_items WHERE group_id = ? ORDER BY sort_order').all(g.id).map(i => ({
        ...i,
        photos: db.prepare('SELECT id, data_url as dataUrl FROM template_item_photos WHERE template_item_id = ?').all(i.id),
      })),
    })),
  };
  res.json(result);
});

app.post('/api/templates', (req, res) => {
  const { name, icon, groups } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  const id = `tmpl-${uuid().slice(0, 8)}`;
  db.prepare('INSERT INTO templates (id, icon, name, item_count, org_id) VALUES (?, ?, ?, ?, ?)').run(id, icon || '📋', name.trim(), 0, req.orgId);
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

// ── Template Item Photos ──
app.get('/api/template-items/:id/photos', (req, res) => {
  const photos = db.prepare('SELECT id, data_url as dataUrl FROM template_item_photos WHERE template_item_id = ?').all(req.params.id);
  res.json(photos);
});

app.post('/api/template-items/:id/photos', (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl is required' });
  const id = uuid();
  db.prepare('INSERT INTO template_item_photos (id, template_item_id, data_url) VALUES (?, ?, ?)').run(id, req.params.id, dataUrl);
  res.status(201).json({ id });
});

app.delete('/api/template-item-photos/:id', (req, res) => {
  db.prepare('DELETE FROM template_item_photos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Documents ──
app.get('/api/documents', (req, res) => {
  const { companyId, siteId } = req.query;
  let query = 'SELECT d.id, d.name, d.file_type, d.company_id, d.site_id, d.created_at, c.name as company_name, s.name as site_name FROM documents d LEFT JOIN companies c ON d.company_id = c.id LEFT JOIN sites s ON d.site_id = s.id';
  const conditions = ['d.org_id = ?'];
  const params = [req.orgId];
  if (companyId) { conditions.push('d.company_id = ?'); params.push(companyId); }
  if (siteId) { conditions.push('d.site_id = ?'); params.push(siteId); }
  query += ` WHERE ${conditions.join(' AND ')}`;
  query += ' ORDER BY d.created_at DESC';
  const rows = db.prepare(query).all(...params);
  res.json(rows.map(r => ({
    id: r.id, name: r.name, fileType: r.file_type,
    companyId: r.company_id || '', companyName: r.company_name || '',
    siteId: r.site_id || '', siteName: r.site_name || '',
    createdAt: r.created_at,
  })));
});

app.post('/api/documents', (req, res) => {
  const { name, fileType, dataUrl, companyId, siteId } = req.body;
  if (!name?.trim() || !dataUrl) return res.status(400).json({ error: 'Name and file are required' });
  const id = `doc-${uuid().slice(0, 8)}`;
  db.prepare('INSERT INTO documents (id, name, file_type, data_url, company_id, site_id, org_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, name.trim(), fileType || '', dataUrl, companyId || '', siteId || '', req.orgId);
  res.status(201).json({ id, name: name.trim() });
});

app.patch('/api/documents/:id', (req, res) => {
  const { name, companyId, siteId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  db.prepare('UPDATE documents SET name = ?, company_id = ?, site_id = ? WHERE id = ?').run(name.trim(), companyId || '', siteId || '', req.params.id);
  res.json({ ok: true });
});

app.get('/api/documents/:id/download', (req, res) => {
  const doc = db.prepare('SELECT data_url, name, file_type FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ dataUrl: doc.data_url, name: doc.name, fileType: doc.file_type });
});

app.delete('/api/documents/:id', (req, res) => {
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Search ──
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;
  // Search inspections
  const rows = db.prepare(`
    SELECT i.*, ins.initials as inspector_initials, ins.name as inspector_name, c.name as company_name
    FROM inspections i
    LEFT JOIN inspectors ins ON i.inspector_id = ins.id
    LEFT JOIN companies c ON i.company_id = c.id
    LEFT JOIN sites s ON s.name = i.site
    WHERE i.org_id = ? AND (i.id LIKE ? OR i.site LIKE ? OR i.type LIKE ? OR ins.name LIKE ? OR ins.email LIKE ? OR ins.phone LIKE ? OR c.name LIKE ? OR s.address LIKE ? OR s.contact_name LIKE ?)
    ORDER BY i.created_at DESC
    LIMIT 20
  `).all(req.orgId, like, like, like, like, like, like, like, like, like);

  // Search documents
  const docs = db.prepare(`
    SELECT d.id, d.name, d.file_type, d.company_id, d.site_id, d.created_at, c.name as company_name, s.name as site_name
    FROM documents d
    LEFT JOIN companies c ON d.company_id = c.id
    LEFT JOIN sites s ON d.site_id = s.id
    WHERE d.org_id = ? AND (d.name LIKE ? OR d.file_type LIKE ? OR c.name LIKE ? OR s.name LIKE ?)
    ORDER BY d.created_at DESC
    LIMIT 10
  `).all(req.orgId, like, like, like, like);

  res.json({ inspections: rows.map(r => ({
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
  })), documents: docs.map(d => ({
    id: d.id,
    name: d.name,
    fileType: d.file_type,
    companyId: d.company_id || '',
    companyName: d.company_name || '',
    siteId: d.site_id || '',
    siteName: d.site_name || '',
    createdAt: d.created_at,
  })) });
});

// ── Stats ──
app.get('/api/stats', (req, res) => {
  const passed = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE status='pass' AND org_id = ?").get(req.orgId).c;
  const failures = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE status='fail' AND org_id = ?").get(req.orgId).c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE status='pending' AND org_id = ?").get(req.orgId).c;
  const total = passed + failures + pending;
  const today = new Date().toISOString().slice(0, 10);
  const passedToday = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE status='pass' AND org_id = ? AND created_at >= ?").get(req.orgId, today).c;
  const failuresToday = db.prepare("SELECT COUNT(*) as c FROM inspections WHERE status='fail' AND org_id = ? AND created_at >= ?").get(req.orgId, today).c;
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
  conditions.push('i.org_id = ?'); params.push(req.orgId);
  if (status && status !== 'all') { conditions.push('i.status = ?'); params.push(status); }
  if (from) { conditions.push('i.created_at >= ?'); params.push(from); }
  if (to) { conditions.push('i.created_at <= ?'); params.push(to + 'T23:59:59'); }
  const where = `WHERE ${conditions.join(' AND ')}`;
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
  const id = `INS-${String(db.prepare('SELECT COUNT(*) as c FROM inspections WHERE org_id = ?').get(req.orgId).c + 892).padStart(4, '0')}`;
  db.prepare('INSERT INTO inspections (id, site, type, status, inspector_id, company_id, notes, org_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, site, type, 'pending', inspectorId, companyId || null, notes || '', req.orgId);

  // Create checklist from template and copy any reference photos
  if (templateId) {
    const tmplGroups = db.prepare('SELECT * FROM template_groups WHERE template_id = ? ORDER BY sort_order').all(templateId);
    if (tmplGroups.length > 0) {
      const insGroup = db.prepare('INSERT INTO check_groups (inspection_id, name, sort_order) VALUES (?, ?, ?)');
      const insItem = db.prepare('INSERT INTO check_items (id, group_id, text, status, sort_order) VALUES (?, ?, ?, ?, ?)');
      const insRefPhoto = db.prepare('INSERT INTO check_item_photos (id, check_item_id, data_url, is_reference) VALUES (?, ?, ?, 1)');
      tmplGroups.forEach((tg, gi) => {
        const gid = insGroup.run(id, tg.name, gi).lastInsertRowid;
        const tmplItems = db.prepare('SELECT * FROM template_items WHERE group_id = ? ORDER BY sort_order').all(tg.id);
        tmplItems.forEach((ti, ii) => {
          const ciId = uuid();
          insItem.run(ciId, gid, ti.text, '', ii);
          const tmplPhotos = db.prepare('SELECT data_url FROM template_item_photos WHERE template_item_id = ?').all(ti.id);
          tmplPhotos.forEach(p => insRefPhoto.run(uuid(), ciId, p.data_url));
        });
      });
    }
  }

  addFeedEvent('warn', id, `Created for ${site}`, '', req.orgId);
  res.status(201).json({ id });
});

app.delete('/api/inspections/:id', (req, res) => {
  const insp = db.prepare('SELECT * FROM inspections WHERE id = ? AND org_id = ?').get(req.params.id, req.orgId);
  if (!insp) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM inspections WHERE id = ? AND org_id = ?').run(req.params.id, req.orgId);
  addFeedEvent('warn', req.params.id, 'Inspection deleted', '', req.orgId);
  res.json({ ok: true });
});

// ── Checklist ──
app.get('/api/inspections/:id/checklist', (req, res) => {
  const groups = db.prepare('SELECT * FROM check_groups WHERE inspection_id = ? ORDER BY sort_order').all(req.params.id);
  const result = groups.map(g => ({
    name: g.name,
    items: db.prepare('SELECT id, text, status, fail_note as failNote FROM check_items WHERE group_id = ? ORDER BY sort_order').all(g.id).map(ci => {
      const photos = db.prepare('SELECT id, data_url as dataUrl, is_reference as isReference FROM check_item_photos WHERE check_item_id = ? ORDER BY is_reference DESC, created_at').all(ci.id);
      return { ...ci, photos: photos.map(p => ({ id: p.id, dataUrl: p.dataUrl, isReference: !!p.isReference })) };
    }),
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

// ── Check Item Photos ──
app.get('/api/check-items/:id/photos', (req, res) => {
  const photos = db.prepare('SELECT id, data_url as dataUrl, is_reference as isReference FROM check_item_photos WHERE check_item_id = ? ORDER BY created_at').all(req.params.id);
  res.json(photos.map(p => ({ ...p, isReference: !!p.isReference })));
});

app.post('/api/check-items/:id/photos', (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl is required' });
  const id = uuid();
  db.prepare('INSERT INTO check_item_photos (id, check_item_id, data_url) VALUES (?, ?, ?)').run(id, req.params.id, dataUrl);

  // Feed event
  const item = db.prepare('SELECT ci.text, cg.inspection_id FROM check_items ci JOIN check_groups cg ON ci.group_id = cg.id WHERE ci.id = ?').get(req.params.id);
  if (item) addFeedEvent('warn', item.inspection_id, 'Photo added', item.text, req.orgId);

  res.status(201).json({ id });
});

app.delete('/api/check-item-photos/:id', (req, res) => {
  db.prepare('DELETE FROM check_item_photos WHERE id = ?').run(req.params.id);
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

  addFeedEvent('fail', inspectionId, 'Failure flagged', title, req.orgId);
  res.status(201).json({ id });
});

app.patch('/api/failures/:id', (req, res) => {
  const { remediationStatus } = req.body;
  const validStatuses = ['open', 'in-progress', 'verified', 'closed'];
  if (!validStatuses.includes(remediationStatus)) return res.status(400).json({ error: 'Invalid remediation status' });
  const failure = db.prepare('SELECT * FROM failures WHERE id = ?').get(req.params.id);
  if (!failure) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE failures SET remediation_status = ? WHERE id = ?').run(remediationStatus, req.params.id);
  addFeedEvent('warn', failure.inspection_id, `Failure ${remediationStatus}`, failure.title, req.orgId);
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
app.get('/api/feed', (req, res) => {
  const rows = db.prepare('SELECT * FROM feed_events WHERE org_id = ? ORDER BY time DESC LIMIT 50').all(req.orgId);
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
    SELECT i.*, ins.name as inspector_name, ins.email as inspector_email, ins.phone as inspector_phone,
           c.name as inspector_company,
           s.address as site_address, s.contact_name as site_contact_name, s.contact_phone as site_contact_phone,
           s.lat as site_lat, s.lng as site_lng
    FROM inspections i
    LEFT JOIN inspectors ins ON i.inspector_id = ins.id
    LEFT JOIN companies c ON ins.company_id = c.id
    LEFT JOIN sites s ON s.name = i.site
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
    inspectorEmail: insp.inspector_email || '',
    inspectorPhone: insp.inspector_phone || '',
    inspectorCompany: insp.inspector_company || '',
    siteAddress: insp.site_address || '',
    siteContactName: insp.site_contact_name || '',
    siteContactPhone: insp.site_contact_phone || '',
    siteLat: insp.site_lat ?? null,
    siteLng: insp.site_lng ?? null,
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
  addFeedEvent(newStatus === 'pass' ? 'pass' : 'fail', req.params.id, `Inspection ${statusLabel}`, `Score ${insp.score}/100`, req.orgId);

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

function addFeedEvent(color, inspectionId, message, tag = '', orgId = '') {
  db.prepare('INSERT INTO feed_events (id, time, color, inspection_id, message, tag, org_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuid(), new Date().toISOString(), color, inspectionId, message, tag, orgId);
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

// ── Demo Reset ──
app.post('/api/reset-demo', (req, res) => {
  const secret = process.env.RESET_SECRET;
  if (secret && req.headers['x-reset-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    // Wipe all user-generated data, keep seed tables intact
    db.transaction(() => {
      db.prepare('DELETE FROM feed_events').run();
      db.prepare('DELETE FROM failures').run();
      db.prepare('DELETE FROM check_items').run();
      db.prepare('DELETE FROM check_groups').run();
      db.prepare('DELETE FROM inspections').run();
    })();

    // Re-seed inspections and checklists
    const insInsp = db.prepare('INSERT INTO inspections (id, site, type, score, status, inspector_id, company_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insGroup = db.prepare('INSERT INTO check_groups (inspection_id, name, sort_order) VALUES (?, ?, ?)');
    const insItem = db.prepare('INSERT INTO check_items (id, group_id, text, status, fail_note, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    const insFeed = db.prepare('INSERT INTO feed_events (id, time, color, inspection_id, message, tag) VALUES (?, ?, ?, ?, ?, ?)');

    db.transaction(() => {
      insInsp.run('INS-0891', 'Riverside Pump Station #4', 'STRUCTURAL', 61, 'pending', 'mo', 'co-1', '2024-12-06T12:55:00');
      insInsp.run('INS-0890', 'Harbor Bridge Section 7', 'CIVIL / BRIDGE', 94, 'pass', 'sr', 'co-2', '2024-12-06T13:10:00');
      insInsp.run('INS-0889', 'Northgate Substation', 'ELECTRICAL', 41, 'fail', 'tk', 'co-3', '2024-12-06T11:30:00');
      insInsp.run('INS-0888', 'Eastfield Water Treatment', 'PROCESS', 88, 'pass', 'al', 'co-4', '2024-12-06T10:50:00');
      insInsp.run('INS-0887', 'Depot B — Bay 12', 'FACILITY', 76, 'pass', 'cb', 'co-5', '2024-12-06T09:10:00');
      insInsp.run('INS-0886', 'Terminal 3 Apron', 'PAVEMENT', 55, 'fail', 'jw', 'co-5', '2024-12-06T08:30:00');
      insInsp.run('INS-0885', 'Grid Substation West', 'ELECTRICAL', 91, 'pass', 'sr', 'co-3', '2024-12-05T14:00:00');
      insInsp.run('INS-0884', 'Central Waste Facility', 'ENVIRONMENTAL', 83, 'pass', 'tk', 'co-4', '2024-12-05T11:00:00');

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

      insFeed.run('f-1', '14:22:11', 'fail', 'INS-0891', 'Failure flagged', 'Roof membrane delamination');
      insFeed.run('f-2', '14:19:04', 'pass', 'INS-0890', 'Inspection PASSED', 'Score 94/100');
      insFeed.run('f-3', '13:58:32', 'fail', 'INS-0889', 'Inspection FAILED', '3 critical items');
      insFeed.run('f-4', '13:44:50', 'warn', 'INS-0891', 'Item completed', 'Emergency shutoff valve');
      insFeed.run('f-5', '13:31:18', 'pass', 'INS-0888', 'Inspection PASSED', 'Score 88/100');
      insFeed.run('f-6', '12:55:00', 'warn', 'INS-0891', 'Started by M. Okafor', '');
      insFeed.run('f-7', '12:47:33', 'ghost', 'INS-0887', 'Report submitted for review', '');
      insFeed.run('f-8', '11:20:09', 'fail', 'INS-0886', 'Inspection FAILED', 'Pavement cracking HIGH');
    })();

    console.log('[demo-reset] Demo data restored', new Date().toISOString());
    res.json({ ok: true, message: 'Demo data reset successfully' });
  } catch (err) {
    console.error('[demo-reset] Failed:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// Global error handler — return JSON instead of raw stack traces
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// SPA fallback — serve index.html for non-API routes in production
if (existsSync(distPath)) {
  app.get('{*path}', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`INSPECTR running on http://localhost:${PORT}`));
