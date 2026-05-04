const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Dashboard stats — scoped by user permissions:
//   Admin sees everything; everyone else only sees projects they're a member of.
router.get('/stats', authenticate, (req, res) => {
  try {
    const db = getDb();
    const isAdmin = req.user.role === 'Admin';

    // Resolve which project IDs this user is allowed to see
    let allowedProjectIds = null; // null = no restriction (admin)
    if (!isAdmin) {
      const rows = db.prepare('SELECT project_id FROM project_members WHERE user_id = ?').all(req.user.id);
      allowedProjectIds = rows.map(r => r.project_id);

      // User has no projects — return all-zero stats
      if (allowedProjectIds.length === 0) {
        return res.json({
          bugs: { total: 0, new_count: 0, open: 0, in_progress: 0, fixed: 0, failed: 0, done: 0, active: 0, critical: 0 },
          statusBreakdown: {},
          tasks: { total: 0, todo: 0, in_progress: 0, done: 0, blocked: 0, overdue: 0 },
          projects: 0,
          users: 0,
          myBugs: 0,
          myTasks: 0,
          recentActivity: [],
        });
      }
    }

    // Build a "project_id IN (...)" filter (or empty string for admin)
    const projScope = (col = 'project_id') => {
      if (allowedProjectIds === null) return { sql: '', params: [] };
      const placeholders = allowedProjectIds.map(() => '?').join(',');
      return { sql: ` AND ${col} IN (${placeholders})`, params: allowedProjectIds };
    };

    const bugScope = projScope('project_id');
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
      WHERE 1=1 ${bugScope.sql}
    `).get(...bugScope.params);

    const statusRows = db.prepare(`
      SELECT status, COUNT(*) as count FROM bugs WHERE 1=1 ${bugScope.sql} GROUP BY status
    `).all(...bugScope.params);
    const statusBreakdown = Object.fromEntries(statusRows.map(r => [r.status, r.count]));

    const taskScope = projScope('project_id');
    const taskStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'To Do' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN due_date < datetime('now') AND status != 'Done' THEN 1 ELSE 0 END) as overdue
      FROM tasks
      WHERE 1=1 ${taskScope.sql}
    `).get(...taskScope.params);

    // Project count — projects use `id`, not `project_id`
    const projectCount = (() => {
      if (allowedProjectIds === null) {
        return db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'Active'").get();
      }
      const placeholders = allowedProjectIds.map(() => '?').join(',');
      return db.prepare(`SELECT COUNT(*) as count FROM projects WHERE status = 'Active' AND id IN (${placeholders})`).get(...allowedProjectIds);
    })();

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get();

    // My work — already user-scoped, no project filter needed
    const myBugs = db.prepare('SELECT COUNT(*) as count FROM bugs WHERE assignee_id = ? AND status != ?').get(req.user.id, 'Approved by PM');
    const myTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE assignee_id = ? AND status != ?').get(req.user.id, 'Done');

    // Recent activity — scope through the entity's project for non-admins
    let recentActivity;
    if (allowedProjectIds === null) {
      recentActivity = db.prepare(`
        SELECT al.*, u.first_name || ' ' || u.last_name as user_name
        FROM audit_log al JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC LIMIT 20
      `).all();
    } else {
      const ph = allowedProjectIds.map(() => '?').join(',');
      recentActivity = db.prepare(`
        SELECT al.*, u.first_name || ' ' || u.last_name as user_name
        FROM audit_log al
        JOIN users u ON al.user_id = u.id
        WHERE
          al.user_id = ?
          OR (al.entity_type = 'bug'     AND EXISTS (SELECT 1 FROM bugs    WHERE id = al.entity_id AND project_id IN (${ph})))
          OR (al.entity_type = 'task'    AND EXISTS (SELECT 1 FROM tasks   WHERE id = al.entity_id AND project_id IN (${ph})))
          OR (al.entity_type = 'project' AND al.entity_id IN (${ph}))
        ORDER BY al.created_at DESC LIMIT 20
      `).all(req.user.id, ...allowedProjectIds, ...allowedProjectIds, ...allowedProjectIds);
    }

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
