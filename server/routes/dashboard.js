const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Global dashboard stats
router.get('/stats', authenticate, (req, res) => {
  try {
    const db = getDb();

    const bugStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'Fixed' THEN 1 ELSE 0 END) as fixed,
        SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'Approved by PM' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status != 'Approved by PM' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN priority = 'Critical' AND status != 'Approved by PM' THEN 1 ELSE 0 END) as critical
      FROM bugs
    `).get();

    const statusRows = db.prepare('SELECT status, COUNT(*) as count FROM bugs GROUP BY status').all();
    const statusBreakdown = Object.fromEntries(statusRows.map(r => [r.status, r.count]));

    const taskStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'To Do' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN due_date < datetime('now') AND status != 'Done' THEN 1 ELSE 0 END) as overdue
      FROM tasks
    `).get();

    const projectCount = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'Active'").get();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get();

    // My work
    const myBugs = db.prepare('SELECT COUNT(*) as count FROM bugs WHERE assignee_id = ? AND status != ?').get(req.user.id, 'Approved by PM');
    const myTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE assignee_id = ? AND status != ?').get(req.user.id, 'Done');

    // Recent activity
    const recentActivity = db.prepare(`
      SELECT al.*, u.first_name || ' ' || u.last_name as user_name
      FROM audit_log al JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC LIMIT 20
    `).all();

    res.json({
      bugs: bugStats,
      statusBreakdown,
      tasks: taskStats,
      projects: projectCount.count,
      users: userCount.count,
      myBugs: myBugs.count,
      myTasks: myTasks.count,
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export bugs to CSV
router.get('/export/bugs', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { project_id } = req.query;

    let query = `
      SELECT b.bug_number, p.name as project, b.summary, b.description, b.status, b.priority, b.severity,
        r.first_name || ' ' || r.last_name as reporter,
        a.first_name || ' ' || a.last_name as assignee,
        b.created_at, b.updated_at
      FROM bugs b
      LEFT JOIN projects p ON b.project_id = p.id
      LEFT JOIN users r ON b.reporter_id = r.id
      LEFT JOIN users a ON b.assignee_id = a.id
    `;

    if (project_id) query += ' WHERE b.project_id = ?';
    query += ' ORDER BY b.created_at DESC';

    const bugs = project_id ? db.prepare(query).all(project_id) : db.prepare(query).all();

    // Build CSV
    const headers = ['Bug #', 'Project', 'Summary', 'Description', 'Status', 'Priority', 'Severity', 'Reporter', 'Assignee', 'Created', 'Updated'];
    let csv = headers.join(',') + '\n';
    for (const b of bugs) {
      csv += [
        b.bug_number, `"${b.project}"`, `"${(b.summary || '').replace(/"/g, '""')}"`,
        `"${(b.description || '').replace(/"/g, '""')}"`, b.status, b.priority, b.severity,
        `"${b.reporter || ''}"`, `"${b.assignee || ''}"`, b.created_at, b.updated_at
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bugs-export.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export tasks to CSV
router.get('/export/tasks', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { project_id } = req.query;

    let query = `
      SELECT t.title, p.name as project, t.description, t.status, t.priority, t.due_date,
        a.first_name || ' ' || a.last_name as assignee,
        c.first_name || ' ' || c.last_name as created_by,
        t.created_at, t.updated_at
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users a ON t.assignee_id = a.id
      LEFT JOIN users c ON t.created_by = c.id
    `;

    if (project_id) query += ' WHERE t.project_id = ?';
    query += ' ORDER BY t.created_at DESC';

    const tasks = project_id ? db.prepare(query).all(project_id) : db.prepare(query).all();

    const headers = ['Title', 'Project', 'Description', 'Status', 'Priority', 'Due Date', 'Assignee', 'Created By', 'Created', 'Updated'];
    let csv = headers.join(',') + '\n';
    for (const t of tasks) {
      csv += [
        `"${(t.title || '').replace(/"/g, '""')}"`, `"${t.project}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`, t.status, t.priority,
        t.due_date || '', `"${t.assignee || ''}"`, `"${t.created_by || ''}"`,
        t.created_at, t.updated_at
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks-export.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
