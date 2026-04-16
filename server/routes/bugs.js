const express = require('express');
const fs = require('fs');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, isProjectMember } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { sendNotificationEmail } = require('../utils/mailer');

const router = express.Router();

const IMPORT_FIELDS = [
  'summary', 'description', 'steps_to_reproduce', 'expected_result', 'actual_result',
  'url', 'status', 'priority', 'severity', 'module', 'environment', 'browser', 'device', 'due_date',
];

const normalizeKey = (k) => String(k || '').trim().toLowerCase().replace(/[\s\-/]+/g, '_');

const KEY_ALIASES = {
  // summary
  title: 'summary',
  name: 'summary',
  bug: 'summary',
  issue: 'summary',
  subject: 'summary',
  bug_title: 'summary',
  bug_name: 'summary',
  bug_summary: 'summary',
  issue_title: 'summary',
  issue_summary: 'summary',
  short_description: 'summary',
  // description
  long_description: 'description',
  details: 'description',
  bug_description: 'description',
  issue_description: 'description',
  // steps
  steps: 'steps_to_reproduce',
  repro: 'steps_to_reproduce',
  reproduction_steps: 'steps_to_reproduce',
  steps_to_reproduce_the_bug: 'steps_to_reproduce',
  how_to_reproduce: 'steps_to_reproduce',
  // expected / actual
  expected: 'expected_result',
  expected_behavior: 'expected_result',
  expected_outcome: 'expected_result',
  actual: 'actual_result',
  actual_behavior: 'actual_result',
  actual_outcome: 'actual_result',
  // meta
  env: 'environment',
  browser_version: 'browser',
  device_type: 'device',
  // assignee
  assignee: 'assignee_email',
  assigned_to: 'assignee_email',
  assigned_email: 'assignee_email',
  owner: 'assignee_email',
};

const resolveField = (raw) => {
  const k = normalizeKey(raw);
  if (KEY_ALIASES[k]) return KEY_ALIASES[k];
  // Fuzzy fallback: any header containing "summary" or "title" maps to summary
  if (/summary|title|subject/.test(k)) return 'summary';
  return k;
};

function addAuditLog(db, entityType, entityId, action, field, oldVal, newVal, userId) {
  db.prepare(`
    INSERT INTO audit_log (id, entity_type, entity_id, action, field_changed, old_value, new_value, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), entityType, entityId, action, field, oldVal, newVal, userId);
}

function notifyUser(db, userId, type, title, message, entityType, entityId) {
  if (!userId) return;
  try {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), userId, type, title, message, entityType, entityId);
  } catch (err) {
    console.error('notifyUser insert failed:', err.message);
  }

  try {
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    if (user) {
      Promise.resolve(
        sendNotificationEmail({ to: user.email, subject: title, message, entityType, entityId })
      ).catch(err => console.error('Notification email failed:', err.message));
    }
  } catch (err) {
    console.error('notifyUser email lookup failed:', err.message);
  }
}

// List bugs for a project
router.get('/project/:projectId', authenticate, isProjectMember, (req, res) => {
  try {
    const db = getDb();
    const { status, priority, severity, assignee_id, search, sort_by, sort_order } = req.query;

    let query = `
      SELECT b.*,
        r.first_name || ' ' || r.last_name as reporter_name,
        a.first_name || ' ' || a.last_name as assignee_name,
        (SELECT COUNT(*) FROM comments WHERE entity_type = 'bug' AND entity_id = b.id) as comment_count,
        (SELECT COUNT(*) FROM bug_attachments WHERE bug_id = b.id) as attachment_count
      FROM bugs b
      LEFT JOIN users r ON b.reporter_id = r.id
      LEFT JOIN users a ON b.assignee_id = a.id
      WHERE b.project_id = ?
    `;
    const params = [req.params.projectId];

    if (status) { query += ' AND b.status = ?'; params.push(status); }
    if (priority) { query += ' AND b.priority = ?'; params.push(priority); }
    if (severity) { query += ' AND b.severity = ?'; params.push(severity); }
    if (assignee_id) { query += ' AND b.assignee_id = ?'; params.push(assignee_id); }
    if (search) { query += ' AND (b.summary LIKE ? OR b.description LIKE ? OR CAST(b.bug_number AS TEXT) LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const sortField = sort_by || 'created_at';
    const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY b.${sortField} ${sortDir}`;

    const bugs = db.prepare(query).all(...params);
    res.json(bugs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all bugs assigned to current user (must be before /:id to avoid matching "my" as an id)
router.get('/my/assigned', authenticate, (req, res) => {
  try {
    const bugs = getDb().prepare(`
      SELECT b.*, p.name as project_name,
        r.first_name || ' ' || r.last_name as reporter_name
      FROM bugs b
      LEFT JOIN projects p ON b.project_id = p.id
      LEFT JOIN users r ON b.reporter_id = r.id
      WHERE b.assignee_id = ?
      ORDER BY b.updated_at DESC
    `).all(req.user.id);
    res.json(bugs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single bug
router.get('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const bug = db.prepare(`
      SELECT b.*,
        r.first_name || ' ' || r.last_name as reporter_name,
        a.first_name || ' ' || a.last_name as assignee_name
      FROM bugs b
      LEFT JOIN users r ON b.reporter_id = r.id
      LEFT JOIN users a ON b.assignee_id = a.id
      WHERE b.id = ?
    `).get(req.params.id);

    if (!bug) return res.status(404).json({ error: 'Bug not found' });

    const attachments = db.prepare('SELECT * FROM bug_attachments WHERE bug_id = ?').all(bug.id);
    const comments = db.prepare(`
      SELECT c.*, u.first_name || ' ' || u.last_name as user_name
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.entity_type = 'bug' AND c.entity_id = ?
      ORDER BY c.created_at ASC
    `).all(bug.id);
    const history = db.prepare(`
      SELECT al.*, u.first_name || ' ' || u.last_name as user_name
      FROM audit_log al JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = 'bug' AND al.entity_id = ?
      ORDER BY al.created_at DESC
    `).all(bug.id);

    res.json({ ...bug, attachments, comments, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create bug
router.post('/', authenticate, upload.array('attachments', 10), (req, res) => {
  try {
    const { project_id, summary, description, steps_to_reproduce, expected_result, actual_result, url, assignee_id, priority, severity } = req.body;

    if (!project_id || !summary) {
      return res.status(400).json({ error: 'Project and summary are required' });
    }

    const db = getDb();
    const bugId = uuidv4();

    // Get next bug number for this project
    const maxNum = db.prepare('SELECT COALESCE(MAX(bug_number), 0) as max_num FROM bugs WHERE project_id = ?').get(project_id);
    const bugNumber = (maxNum?.max_num || 0) + 1;

    db.prepare(`
      INSERT INTO bugs (id, bug_number, project_id, summary, description, steps_to_reproduce, expected_result, actual_result, url, reporter_id, assignee_id, priority, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(bugId, bugNumber, project_id, summary, description || '', steps_to_reproduce || '', expected_result || '', actual_result || '', url || '', req.user.id, assignee_id || null, priority || 'Medium', severity || 'Major');

    // Save attachments
    if (req.files && req.files.length > 0) {
      const stmt = db.prepare('INSERT INTO bug_attachments (id, bug_id, filename, original_name, mimetype, size) VALUES (?, ?, ?, ?, ?, ?)');
      for (const file of req.files) {
        stmt.run(uuidv4(), bugId, file.filename, file.originalname, file.mimetype, file.size);
      }
    }

    addAuditLog(db, 'bug', bugId, 'created', null, null, null, req.user.id);

    // Notify assignee
    if (assignee_id && assignee_id !== req.user.id) {
      notifyUser(db, assignee_id, 'bug_assigned', 'Bug Assigned', `Bug "${summary}" has been assigned to you`, 'bug', bugId);
    }

    const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(bugId);
    res.status(201).json(bug);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update bug
router.put('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Bug not found' });

    const updatable = [
      'summary', 'description', 'steps_to_reproduce', 'expected_result', 'actual_result',
      'url', 'assignee_id', 'status', 'priority', 'severity',
      'module', 'environment', 'browser', 'device', 'due_date', 'qa_owner_id',
    ];

    const sets = [];
    const vals = [];
    for (const key of updatable) {
      if (req.body[key] !== undefined) {
        const newVal = req.body[key] === '' ? null : req.body[key];
        if (newVal !== existing[key]) {
          try {
            addAuditLog(db, 'bug', req.params.id, 'updated', key, existing[key], newVal, req.user.id);
          } catch (e) { console.error('audit log failed:', e.message); }
        }
        sets.push(`${key} = ?`);
        vals.push(newVal);
      }
    }

    if (sets.length > 0) {
      sets.push(`updated_at = datetime('now')`);
      vals.push(req.params.id);
      db.prepare(`UPDATE bugs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }

    // Notify on assignment change
    const newAssignee = req.body.assignee_id;
    if (newAssignee && newAssignee !== existing.assignee_id && newAssignee !== req.user.id) {
      notifyUser(db, newAssignee, 'bug_assigned', 'Bug Assigned', `Bug "${existing.summary}" has been assigned to you`, 'bug', req.params.id);
    }

    // Notify on status change
    const newStatus = req.body.status;
    if (newStatus && newStatus !== existing.status && existing.reporter_id !== req.user.id) {
      notifyUser(db, existing.reporter_id, 'status_change', 'Bug Status Updated', `Bug "${existing.summary}" status changed to ${newStatus}`, 'bug', req.params.id);
    }

    const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
    res.json(bug);
  } catch (err) {
    console.error('PUT /bugs/:id error:', err);
    res.status(500).json({ error: err.message || 'Failed to update bug' });
  }
});

// Upload attachment to existing bug
router.post('/:id/attachments', authenticate, upload.array('attachments', 10), (req, res) => {
  try {
    const db = getDb();
    const attachments = [];
    if (req.files) {
      const stmt = db.prepare('INSERT INTO bug_attachments (id, bug_id, filename, original_name, mimetype, size) VALUES (?, ?, ?, ?, ?, ?)');
      for (const file of req.files) {
        const attId = uuidv4();
        stmt.run(attId, req.params.id, file.filename, file.originalname, file.mimetype, file.size);
        attachments.push({ id: attId, filename: file.filename, original_name: file.originalname });
      }
    }
    res.status(201).json(attachments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add comment to bug
router.post('/:id/comments', authenticate, (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const db = getDb();
    const commentId = uuidv4();

    db.prepare('INSERT INTO comments (id, entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?, ?)')
      .run(commentId, 'bug', req.params.id, req.user.id, content);

    addAuditLog(db, 'bug', req.params.id, 'comment_added', null, null, content, req.user.id);

    const comment = db.prepare(`
      SELECT c.*, u.first_name || ' ' || u.last_name as user_name
      FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?
    `).get(commentId);

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export bugs to Excel (.xlsx)
router.get('/project/:projectId/export', authenticate, isProjectMember, (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT b.bug_number, b.summary, b.description, b.steps_to_reproduce,
        b.expected_result, b.actual_result, b.url, b.status, b.priority, b.severity,
        b.module, b.environment, b.browser, b.device, b.due_date,
        r.email as reporter_email, a.email as assignee_email,
        b.created_at, b.updated_at
      FROM bugs b
      LEFT JOIN users r ON b.reporter_id = r.id
      LEFT JOIN users a ON b.assignee_id = a.id
      WHERE b.project_id = ?
      ORDER BY b.bug_number ASC
    `).all(req.params.projectId);

    const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(req.params.projectId);
    const safeName = (project?.name || 'project').replace(/[^a-z0-9]+/gi, '_').toLowerCase();

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: [
        'bug_number', 'summary', 'description', 'steps_to_reproduce',
        'expected_result', 'actual_result', 'url', 'status', 'priority', 'severity',
        'module', 'environment', 'browser', 'device', 'due_date',
        'reporter_email', 'assignee_email', 'created_at', 'updated_at',
      ],
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bugs');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bugs_${safeName}_${Date.now()}.xlsx"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download import template
router.get('/project/:projectId/import-template', authenticate, isProjectMember, (req, res) => {
  try {
    const sample = [{
      summary: 'Login button unresponsive on Safari',
      description: 'Clicking the login button does nothing on Safari 17.',
      steps_to_reproduce: '1. Open Safari\n2. Go to /login\n3. Click Login',
      expected_result: 'User is logged in',
      actual_result: 'Nothing happens',
      url: 'https://example.com/login',
      status: 'Open',
      priority: 'High',
      severity: 'Major',
      module: 'Authentication',
      environment: 'Production',
      browser: 'Safari 17',
      device: 'MacBook Pro',
      due_date: '',
      assignee_email: '',
    }];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bugs');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bugs_import_template.xlsx"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import bugs from Excel / CSV
router.post('/project/:projectId/import', authenticate, isProjectMember, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });

  const filePath = req.file.path;
  try {
    const db = getDb();
    const { projectId } = req.params;

    const wb = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return res.status(400).json({ error: 'No sheets found in file' });
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (rawRows.length === 0) return res.status(400).json({ error: 'No rows found in file' });

    // Detect original headers and how they were mapped (for debugging)
    const detectedHeaders = Object.keys(rawRows[0] || {});
    const headerMap = {};
    detectedHeaders.forEach(h => { headerMap[h] = resolveField(h); });

    // Map raw keys to schema keys
    const rows = rawRows.map((raw) => {
      const mapped = {};
      for (const [k, v] of Object.entries(raw)) {
        const field = resolveField(k);
        mapped[field] = typeof v === 'string' ? v.trim() : v;
      }
      return mapped;
    });

    const maxNumRow = db.prepare('SELECT COALESCE(MAX(bug_number), 0) as max_num FROM bugs WHERE project_id = ?').get(projectId);
    let nextNumber = (maxNumRow?.max_num || 0) + 1;

    const usersByEmail = new Map();
    db.prepare('SELECT id, email FROM users').all().forEach(u => {
      usersByEmail.set(String(u.email).toLowerCase(), u.id);
    });

    const results = { created: 0, skipped: 0, errors: [] };

    rows.forEach((row, idx) => {
      try {
        if (!row.summary) {
          results.skipped++;
          results.errors.push({ row: idx + 2, error: 'Missing summary' });
          return;
        }

        const assigneeEmail = (row.assignee_email || '').toLowerCase();
        const assigneeId = assigneeEmail ? usersByEmail.get(assigneeEmail) || null : null;

        const bugId = uuidv4();
        const values = {
          summary: row.summary,
          description: row.description || '',
          steps_to_reproduce: row.steps_to_reproduce || '',
          expected_result: row.expected_result || '',
          actual_result: row.actual_result || '',
          url: row.url || '',
          status: row.status || 'Open',
          priority: row.priority || 'Medium',
          severity: row.severity || 'Major',
          module: row.module || null,
          environment: row.environment || null,
          browser: row.browser || null,
          device: row.device || null,
          due_date: row.due_date || null,
        };

        db.prepare(`
          INSERT INTO bugs (
            id, bug_number, project_id, summary, description, steps_to_reproduce,
            expected_result, actual_result, url, reporter_id, assignee_id,
            status, priority, severity, module, environment, browser, device, due_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          bugId, nextNumber, projectId,
          values.summary, values.description, values.steps_to_reproduce,
          values.expected_result, values.actual_result, values.url,
          req.user.id, assigneeId,
          values.status, values.priority, values.severity,
          values.module, values.environment, values.browser, values.device, values.due_date
        );

        addAuditLog(db, 'bug', bugId, 'imported', null, null, null, req.user.id);
        nextNumber++;
        results.created++;
      } catch (rowErr) {
        results.skipped++;
        results.errors.push({ row: idx + 2, error: rowErr.message });
      }
    });

    res.json({ ...results, detected_headers: detectedHeaders, header_map: headerMap });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(filePath, () => {});
  }
});

module.exports = router;
