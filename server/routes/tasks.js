const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, isProjectMember } = require('../middleware/auth');
const { sendNotificationEmail } = require('../utils/mailer');

const router = express.Router();

// List tasks for project
router.get('/project/:projectId', authenticate, isProjectMember, (req, res) => {
  try {
    const db = getDb();
    const { status, priority, assignee_id, search } = req.query;

    let query = `
      SELECT t.*,
        a.first_name || ' ' || a.last_name as assignee_name,
        c.first_name || ' ' || c.last_name as created_by_name,
        b.summary as linked_bug_summary, b.bug_number as linked_bug_number,
        (SELECT COUNT(*) FROM comments WHERE entity_type = 'task' AND entity_id = t.id) as comment_count
      FROM tasks t
      LEFT JOIN users a ON t.assignee_id = a.id
      LEFT JOIN users c ON t.created_by = c.id
      LEFT JOIN bugs b ON t.linked_bug_id = b.id
      WHERE t.project_id = ?
    `;
    const params = [req.params.projectId];

    if (status) { query += ' AND t.status = ?'; params.push(status); }
    if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
    if (assignee_id) { query += ' AND t.assignee_id = ?'; params.push(assignee_id); }
    if (search) { query += ' AND (t.title LIKE ? OR t.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    query += ' ORDER BY t.created_at DESC';

    const tasks = db.prepare(query).all(...params);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single task
router.get('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare(`
      SELECT t.*,
        a.first_name || ' ' || a.last_name as assignee_name,
        c.first_name || ' ' || c.last_name as created_by_name,
        b.summary as linked_bug_summary, b.bug_number as linked_bug_number
      FROM tasks t
      LEFT JOIN users a ON t.assignee_id = a.id
      LEFT JOIN users c ON t.created_by = c.id
      LEFT JOIN bugs b ON t.linked_bug_id = b.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!task) return res.status(404).json({ error: 'Task not found' });

    const comments = db.prepare(`
      SELECT c.*, u.first_name || ' ' || u.last_name as user_name
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.entity_type = 'task' AND c.entity_id = ?
      ORDER BY c.created_at ASC
    `).all(task.id);

    const history = db.prepare(`
      SELECT al.*, u.first_name || ' ' || u.last_name as user_name
      FROM audit_log al JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = 'task' AND al.entity_id = ?
      ORDER BY al.created_at DESC
    `).all(task.id);

    res.json({ ...task, comments, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create task
router.post('/', authenticate, (req, res) => {
  try {
    const { project_id, title, description, assignee_id, priority, due_date, linked_bug_id } = req.body;
    if (!project_id || !title) return res.status(400).json({ error: 'Project and title are required' });

    const db = getDb();
    const taskId = uuidv4();

    db.prepare(`
      INSERT INTO tasks (id, project_id, title, description, assignee_id, priority, due_date, linked_bug_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(taskId, project_id, title, description || '', assignee_id || null, priority || 'Medium', due_date || null, linked_bug_id || null, req.user.id);

    // Audit
    db.prepare('INSERT INTO audit_log (id, entity_type, entity_id, action, user_id) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), 'task', taskId, 'created', req.user.id);

    // Notify assignee
    if (assignee_id && assignee_id !== req.user.id) {
      const notifMsg = `Task "${title}" has been assigned to you`;
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), assignee_id, 'task_assigned', 'Task Assigned', notifMsg, 'task', taskId);

      const assignee = db.prepare('SELECT email FROM users WHERE id = ?').get(assignee_id);
      if (assignee) {
        sendNotificationEmail({ to: assignee.email, subject: 'Task Assigned', message: notifMsg, entityType: 'task', entityId: taskId })
          .catch(err => console.error('Notification email failed:', err.message));
      }
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update task
router.put('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const { title, description, assignee_id, status, priority, due_date, linked_bug_id } = req.body;

    const fields = { title, description, assignee_id, status, priority, due_date, linked_bug_id };
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined && val !== existing[key]) {
        db.prepare('INSERT INTO audit_log (id, entity_type, entity_id, action, field_changed, old_value, new_value, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(uuidv4(), 'task', req.params.id, 'updated', key, existing[key], val, req.user.id);
      }
    }

    db.prepare(`
      UPDATE tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        assignee_id = COALESCE(?, assignee_id),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        due_date = COALESCE(?, due_date),
        linked_bug_id = COALESCE(?, linked_bug_id),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(title, description, assignee_id, status, priority, due_date, linked_bug_id, req.params.id);

    if (assignee_id && assignee_id !== existing.assignee_id && assignee_id !== req.user.id) {
      const notifMsg = `Task "${existing.title}" has been assigned to you`;
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), assignee_id, 'task_assigned', 'Task Assigned', notifMsg, 'task', req.params.id);

      const assignee = db.prepare('SELECT email FROM users WHERE id = ?').get(assignee_id);
      if (assignee) {
        sendNotificationEmail({ to: assignee.email, subject: 'Task Assigned', message: notifMsg, entityType: 'task', entityId: req.params.id })
          .catch(err => console.error('Notification email failed:', err.message));
      }
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add comment to task
router.post('/:id/comments', authenticate, (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const db = getDb();
    const commentId = uuidv4();

    db.prepare('INSERT INTO comments (id, entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?, ?)')
      .run(commentId, 'task', req.params.id, req.user.id, content);

    const comment = db.prepare(`
      SELECT c.*, u.first_name || ' ' || u.last_name as user_name
      FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?
    `).get(commentId);

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get my tasks
router.get('/my/assigned', authenticate, (req, res) => {
  try {
    const tasks = getDb().prepare(`
      SELECT t.*, p.name as project_name,
        c.first_name || ' ' || c.last_name as created_by_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.assignee_id = ?
      ORDER BY t.updated_at DESC
    `).all(req.user.id);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
