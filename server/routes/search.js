const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getDb } = require('../database');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ projects: [], bugs: [], tasks: [] });

  const db = getDb();
  const like = `%${q}%`;
  const isAdmin = req.user.role === 'Admin';
  const userId = req.user.id;

  const projects = isAdmin
    ? db.prepare(`
        SELECT id, name, status FROM projects
        WHERE name LIKE ? OR description LIKE ?
        ORDER BY updated_at DESC LIMIT 8
      `).all(like, like)
    : db.prepare(`
        SELECT p.id, p.name, p.status FROM projects p
        INNER JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = ? AND (p.name LIKE ? OR p.description LIKE ?)
        ORDER BY p.updated_at DESC LIMIT 8
      `).all(userId, like, like);

  const bugSql = isAdmin
    ? `SELECT b.id, b.bug_number, b.summary, b.status, b.priority, b.project_id, p.name AS project_name
       FROM bugs b LEFT JOIN projects p ON p.id = b.project_id
       WHERE b.summary LIKE ? OR b.description LIKE ? OR CAST(b.bug_number AS TEXT) LIKE ?
       ORDER BY b.updated_at DESC LIMIT 10`
    : `SELECT b.id, b.bug_number, b.summary, b.status, b.priority, b.project_id, p.name AS project_name
       FROM bugs b
       LEFT JOIN projects p ON p.id = b.project_id
       INNER JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = ?
       WHERE (b.summary LIKE ? OR b.description LIKE ? OR CAST(b.bug_number AS TEXT) LIKE ?)
       ORDER BY b.updated_at DESC LIMIT 10`;

  const bugs = isAdmin
    ? db.prepare(bugSql).all(like, like, like)
    : db.prepare(bugSql).all(userId, like, like, like);

  const taskSql = isAdmin
    ? `SELECT t.id, t.title, t.status, t.priority, t.project_id, p.name AS project_name
       FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.title LIKE ? OR t.description LIKE ?
       ORDER BY t.updated_at DESC LIMIT 10`
    : `SELECT t.id, t.title, t.status, t.priority, t.project_id, p.name AS project_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
       WHERE (t.title LIKE ? OR t.description LIKE ?)
       ORDER BY t.updated_at DESC LIMIT 10`;

  const tasks = isAdmin
    ? db.prepare(taskSql).all(like, like)
    : db.prepare(taskSql).all(userId, like, like);

  res.json({ projects, bugs, tasks });
});

module.exports = router;
