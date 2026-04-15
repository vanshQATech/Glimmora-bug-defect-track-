const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, isProjectMember } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { sendNotificationEmail } = require('../utils/mailer');

const router = express.Router();

function addAuditLog(db, entityType, entityId, action, field, oldVal, newVal, userId) {
  db.prepare(`
    INSERT INTO audit_log (id, entity_type, entity_id, action, field_changed, old_value, new_value, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), entityType, entityId, action, field, oldVal, newVal, userId);
}

function notifyUser(db, userId, type, title, message, entityType, entityId) {
  if (!userId) return;
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), userId, type, title, message, entityType, entityId);

  // Also send email
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  if (user) {
    sendNotificationEmail({ to: user.email, subject: title, message, entityType, entityId })
      .catch(err => console.error('Notification email failed:', err.message));
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
router.post('/', authenticate, upload.array('attachments', 5), (req, res) => {
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

    const { summary, description, steps_to_reproduce, expected_result, actual_result, url, assignee_id, status, priority, severity } = req.body;

    // Track changes for audit
    const fields = { summary, description, steps_to_reproduce, expected_result, actual_result, url, assignee_id, status, priority, severity };
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined && val !== existing[key]) {
        addAuditLog(db, 'bug', req.params.id, 'updated', key, existing[key], val, req.user.id);
      }
    }

    db.prepare(`
      UPDATE bugs SET
        summary = COALESCE(?, summary),
        description = COALESCE(?, description),
        steps_to_reproduce = COALESCE(?, steps_to_reproduce),
        expected_result = COALESCE(?, expected_result),
        actual_result = COALESCE(?, actual_result),
        url = COALESCE(?, url),
        assignee_id = COALESCE(?, assignee_id),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        severity = COALESCE(?, severity),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(summary, description, steps_to_reproduce, expected_result, actual_result, url, assignee_id, status, priority, severity, req.params.id);

    // Notify on assignment change
    if (assignee_id && assignee_id !== existing.assignee_id && assignee_id !== req.user.id) {
      notifyUser(db, assignee_id, 'bug_assigned', 'Bug Assigned', `Bug "${existing.summary}" has been assigned to you`, 'bug', req.params.id);
    }

    // Notify on status change
    if (status && status !== existing.status && existing.reporter_id !== req.user.id) {
      notifyUser(db, existing.reporter_id, 'status_change', 'Bug Status Updated', `Bug "${existing.summary}" status changed to ${status}`, 'bug', req.params.id);
    }

    const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
    res.json(bug);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload attachment to existing bug
router.post('/:id/attachments', authenticate, upload.array('attachments', 5), (req, res) => {
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

// Get all bugs assigned to current user
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

module.exports = router;
