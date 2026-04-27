const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { sendNotificationEmail } = require('../utils/mailer');

const router = express.Router();

// Get all work tasks (admin/PM sees all, others see their own)
router.get('/tasks', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { assigned_to, status, project_id } = req.query;
    const isManager = ['Admin', 'Project Manager'].includes(req.user.role);

    let query = `
      SELECT wt.*,
        a.first_name || ' ' || a.last_name as assigned_to_name,
        a.email as assigned_to_email,
        ab.first_name || ' ' || ab.last_name as assigned_by_name,
        p.name as project_name,
        (SELECT COUNT(*) FROM daily_updates WHERE work_task_id = wt.id) as update_count,
        (SELECT MAX(update_date) FROM daily_updates WHERE work_task_id = wt.id) as last_update_date,
        (SELECT progress_percent FROM daily_updates WHERE work_task_id = wt.id ORDER BY created_at DESC LIMIT 1) as latest_progress
      FROM work_tasks wt
      LEFT JOIN users a ON wt.assigned_to = a.id
      LEFT JOIN users ab ON wt.assigned_by = ab.id
      LEFT JOIN projects p ON wt.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (!isManager) {
      query += ' AND wt.assigned_to = ?';
      params.push(req.user.id);
    } else if (assigned_to) {
      query += ' AND wt.assigned_to = ?';
      params.push(assigned_to);
    }

    if (status) { query += ' AND wt.status = ?'; params.push(status); }
    if (project_id) { query += ' AND wt.project_id = ?'; params.push(project_id); }

    query += ' ORDER BY wt.deadline ASC, wt.created_at DESC';

    const tasks = db.prepare(query).all(...params);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single work task with daily updates
router.get('/tasks/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare(`
      SELECT wt.*,
        a.first_name || ' ' || a.last_name as assigned_to_name,
        ab.first_name || ' ' || ab.last_name as assigned_by_name,
        p.name as project_name
      FROM work_tasks wt
      LEFT JOIN users a ON wt.assigned_to = a.id
      LEFT JOIN users ab ON wt.assigned_by = ab.id
      LEFT JOIN projects p ON wt.project_id = p.id
      WHERE wt.id = ?
    `).get(req.params.id);

    if (!task) return res.status(404).json({ error: 'Work task not found' });

    const updates = db.prepare(`
      SELECT du.*, u.first_name || ' ' || u.last_name as user_name
      FROM daily_updates du
      JOIN users u ON du.user_id = u.id
      WHERE du.work_task_id = ?
      ORDER BY du.update_date DESC, du.created_at DESC
    `).all(req.params.id);

    res.json({ ...task, updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create work task (Admin/PM only)
router.post('/tasks', authenticate, authorize('Admin', 'Project Manager'), (req, res) => {
  try {
    const { title, description, assigned_to, project_id, priority, deadline } = req.body;
    if (!title || !assigned_to || !deadline) {
      return res.status(400).json({ error: 'Title, assignee, and deadline are required' });
    }

    const db = getDb();
    const taskId = uuidv4();

    db.prepare(`
      INSERT INTO work_tasks (id, title, description, assigned_to, assigned_by, project_id, priority, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(taskId, title, description || '', assigned_to, req.user.id, project_id || null, priority || 'Medium', deadline);

    // Notify assignee
    const assignee = db.prepare('SELECT email, first_name FROM users WHERE id = ?').get(assigned_to);
    const assigner = `${req.user.first_name} ${req.user.last_name}`;
    const notifMsg = `${assigner} assigned you a work task: "${title}" — Deadline: ${deadline}`;

    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), assigned_to, 'work_assigned', 'New Work Assigned', notifMsg, 'work_task', taskId);

    if (assignee) {
      sendNotificationEmail({
        to: assignee.email,
        subject: 'New Work Task Assigned',
        message: notifMsg,
        entityType: 'work_task',
        entityId: taskId,
        baseUrl: req.headers.origin || `${req.protocol}://${req.get('host')}`,
      }).catch(err => console.error('Work task email failed:', err.message));
    }

    const task = db.prepare('SELECT * FROM work_tasks WHERE id = ?').get(taskId);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update work task status
router.put('/tasks/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM work_tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Work task not found' });

    const { status, priority, deadline } = req.body;
    const completedAt = status === 'Completed' ? new Date().toISOString() : existing.completed_at;

    db.prepare(`
      UPDATE work_tasks SET
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        deadline = COALESCE(?, deadline),
        completed_at = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(status, priority, deadline, completedAt, req.params.id);

    const task = db.prepare('SELECT * FROM work_tasks WHERE id = ?').get(req.params.id);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit daily update
router.post('/tasks/:id/updates', authenticate, (req, res) => {
  try {
    const { update_text, progress_percent, blockers } = req.body;
    if (!update_text) return res.status(400).json({ error: 'Update text is required' });

    const db = getDb();
    const task = db.prepare('SELECT * FROM work_tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Work task not found' });

    const updateId = uuidv4();
    const today = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO daily_updates (id, work_task_id, user_id, update_text, progress_percent, blockers, update_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(updateId, req.params.id, req.user.id, update_text, progress_percent || 0, blockers || '', today);

    // Update task status based on progress
    if (progress_percent >= 100) {
      db.prepare("UPDATE work_tasks SET status = 'Completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    } else if (progress_percent > 0 && task.status === 'Pending') {
      db.prepare("UPDATE work_tasks SET status = 'In Progress', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    }

    // Notify the manager who assigned the task
    if (task.assigned_by !== req.user.id) {
      const updaterName = `${req.user.first_name} ${req.user.last_name}`;
      const notifMsg = `${updaterName} posted a daily update on "${task.title}" — Progress: ${progress_percent}%`;
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), task.assigned_by, 'daily_update', 'Daily Update', notifMsg, 'work_task', req.params.id);
    }

    const update = db.prepare(`
      SELECT du.*, u.first_name || ' ' || u.last_name as user_name
      FROM daily_updates du JOIN users u ON du.user_id = u.id WHERE du.id = ?
    `).get(updateId);

    res.status(201).json(update);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get team activity overview (Admin/PM)
router.get('/activity', authenticate, (req, res) => {
  try {
    const db = getDb();
    const isManager = ['Admin', 'Project Manager'].includes(req.user.role);

    // Get all active users with their work summary
    let usersQuery;
    if (isManager) {
      usersQuery = db.prepare(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.role,
          (SELECT COUNT(*) FROM work_tasks WHERE assigned_to = u.id AND status != 'Completed') as active_tasks,
          (SELECT COUNT(*) FROM work_tasks WHERE assigned_to = u.id AND status = 'Completed') as completed_tasks,
          (SELECT COUNT(*) FROM work_tasks WHERE assigned_to = u.id AND deadline < date('now') AND status != 'Completed') as overdue_tasks,
          (SELECT MAX(du.created_at) FROM daily_updates du JOIN work_tasks wt ON du.work_task_id = wt.id WHERE wt.assigned_to = u.id) as last_activity
        FROM users u
        WHERE u.is_active = 1
        ORDER BY u.first_name ASC
      `).all();
    } else {
      usersQuery = db.prepare(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.role,
          (SELECT COUNT(*) FROM work_tasks WHERE assigned_to = u.id AND status != 'Completed') as active_tasks,
          (SELECT COUNT(*) FROM work_tasks WHERE assigned_to = u.id AND status = 'Completed') as completed_tasks,
          (SELECT COUNT(*) FROM work_tasks WHERE assigned_to = u.id AND deadline < date('now') AND status != 'Completed') as overdue_tasks,
          (SELECT MAX(du.created_at) FROM daily_updates du JOIN work_tasks wt ON du.work_task_id = wt.id WHERE wt.assigned_to = u.id) as last_activity
        FROM users u WHERE u.id = ? AND u.is_active = 1
      `).all(req.user.id);
    }

    // Recent daily updates across team
    let recentUpdates;
    if (isManager) {
      recentUpdates = db.prepare(`
        SELECT du.*, u.first_name || ' ' || u.last_name as user_name, wt.title as task_title
        FROM daily_updates du
        JOIN users u ON du.user_id = u.id
        JOIN work_tasks wt ON du.work_task_id = wt.id
        ORDER BY du.created_at DESC LIMIT 30
      `).all();
    } else {
      recentUpdates = db.prepare(`
        SELECT du.*, u.first_name || ' ' || u.last_name as user_name, wt.title as task_title
        FROM daily_updates du
        JOIN users u ON du.user_id = u.id
        JOIN work_tasks wt ON du.work_task_id = wt.id
        WHERE du.user_id = ?
        ORDER BY du.created_at DESC LIMIT 30
      `).all(req.user.id);
    }

    res.json({ users: usersQuery, recentUpdates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
