const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const LEAD_ROLES = ['Admin', 'Project Manager', 'Team Lead'];
const isLead = (user) => LEAD_ROLES.includes(user?.role);

const SELECT_UPDATE = `
  SELECT a.*,
    u.first_name || ' ' || u.last_name as employee_name,
    u.email as employee_email,
    u.role as employee_role,
    p.name as project_name
  FROM activity_updates a
  LEFT JOIN users u ON a.user_id = u.id
  LEFT JOIN projects p ON a.project_id = p.id
`;

const clampPct = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

// Create a daily activity update
router.post('/', authenticate, (req, res) => {
  try {
    const {
      project_id, update_date, module, title,
      tasks_completed, tasks_in_progress, tasks_planned,
      bugs_worked, bugs_fixed, bugs_raised,
      blockers, dependencies, status,
      progress_percent, remarks, next_action,
    } = req.body;

    if (!tasks_completed && !tasks_in_progress && !tasks_planned) {
      return res.status(400).json({ error: 'At least one of completed / in-progress / planned tasks is required' });
    }

    const db = getDb();
    const id = uuidv4();
    const date = update_date || new Date().toISOString().slice(0, 10);

    db.prepare(`
      INSERT INTO activity_updates (
        id, user_id, project_id, update_date, module, title,
        tasks_completed, tasks_in_progress, tasks_planned,
        bugs_worked, bugs_fixed, bugs_raised,
        blockers, dependencies, status,
        progress_percent, remarks, next_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.user.id, project_id || null, date, module || null, title || null,
      tasks_completed || null, tasks_in_progress || null, tasks_planned || null,
      bugs_worked || null, bugs_fixed || null, bugs_raised || null,
      blockers || null, dependencies || null, status || 'In Progress',
      clampPct(progress_percent), remarks || null, next_action || null
    );

    // Notify leads/admins if blocked
    if ((status || '').toLowerCase() === 'blocked') {
      const leads = db.prepare("SELECT id FROM users WHERE role IN ('Admin','Project Manager','Team Lead') AND id != ?").all(req.user.id);
      const msg = `${req.user.first_name} ${req.user.last_name} reported a blocker on ${date}`;
      leads.forEach(l => {
        db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), l.id, 'activity_blocked', 'Blocker reported', msg, 'activity', id);
      });
    }

    const row = db.prepare(`${SELECT_UPDATE} WHERE a.id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update existing activity entry (owner only, unless lead)
router.put('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM activity_updates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.user_id !== req.user.id && !isLead(req.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const fields = [
      'project_id', 'module', 'title', 'tasks_completed', 'tasks_in_progress', 'tasks_planned',
      'bugs_worked', 'bugs_fixed', 'bugs_raised', 'blockers', 'dependencies', 'status',
      'progress_percent', 'remarks', 'next_action',
    ];
    const sets = [];
    const vals = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        vals.push(f === 'progress_percent' ? clampPct(req.body[f]) : req.body[f]);
      }
    }
    if (sets.length === 0) return res.json(existing);
    sets.push(`updated_at = datetime('now')`);
    vals.push(req.params.id);

    db.prepare(`UPDATE activity_updates SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    const row = db.prepare(`${SELECT_UPDATE} WHERE a.id = ?`).get(req.params.id);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete (owner or lead)
router.delete('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM activity_updates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.user_id !== req.user.id && !isLead(req.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    db.prepare('DELETE FROM activity_updates WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// My updates (history)
router.get('/my', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { from, to, project_id } = req.query;
    let query = `${SELECT_UPDATE} WHERE a.user_id = ?`;
    const params = [req.user.id];
    if (from) { query += ' AND a.update_date >= ?'; params.push(from); }
    if (to) { query += ' AND a.update_date <= ?'; params.push(to); }
    if (project_id) { query += ' AND a.project_id = ?'; params.push(project_id); }
    query += ' ORDER BY a.update_date DESC, a.created_at DESC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Team view (leads/admins) with filters
router.get('/team', authenticate, (req, res) => {
  try {
    if (!isLead(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const db = getDb();
    const { from, to, user_id, project_id, status } = req.query;
    let query = `${SELECT_UPDATE} WHERE 1=1`;
    const params = [];
    if (from) { query += ' AND a.update_date >= ?'; params.push(from); }
    if (to) { query += ' AND a.update_date <= ?'; params.push(to); }
    if (user_id) { query += ' AND a.user_id = ?'; params.push(user_id); }
    if (project_id) { query += ' AND a.project_id = ?'; params.push(project_id); }
    if (status) { query += ' AND a.status = ?'; params.push(status); }
    query += ' ORDER BY a.update_date DESC, a.created_at DESC';
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Summary for leads: today's stats
router.get('/summary', authenticate, (req, res) => {
  try {
    if (!isLead(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    const submittedToday = db.prepare(
      "SELECT COUNT(DISTINCT user_id) as c FROM activity_updates WHERE update_date = ?"
    ).get(today)?.c || 0;

    const totalActiveUsers = db.prepare(
      "SELECT COUNT(*) as c FROM users WHERE is_active = 1"
    ).get()?.c || 0;

    const blockedToday = db.prepare(
      "SELECT COUNT(*) as c FROM activity_updates WHERE update_date = ? AND status = 'Blocked'"
    ).get(today)?.c || 0;

    const completedToday = db.prepare(
      "SELECT COUNT(*) as c FROM activity_updates WHERE update_date = ? AND status = 'Completed'"
    ).get(today)?.c || 0;

    // Users who haven't submitted today
    const pendingUsers = db.prepare(`
      SELECT u.id, u.first_name || ' ' || u.last_name as name, u.email, u.role
      FROM users u
      WHERE u.is_active = 1
        AND u.id NOT IN (SELECT user_id FROM activity_updates WHERE update_date = ?)
      ORDER BY u.first_name
    `).all(today);

    res.json({
      date: today,
      submitted_today: submittedToday,
      total_active_users: totalActiveUsers,
      pending_count: pendingUsers.length,
      blocked_today: blockedToday,
      completed_today: completedToday,
      pending_users: pendingUsers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV export of team updates (leads only)
router.get('/export.csv', authenticate, (req, res) => {
  try {
    if (!isLead(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const db = getDb();
    const { from, to, user_id, project_id, status } = req.query;
    let query = `${SELECT_UPDATE} WHERE 1=1`;
    const params = [];
    if (from) { query += ' AND a.update_date >= ?'; params.push(from); }
    if (to) { query += ' AND a.update_date <= ?'; params.push(to); }
    if (user_id) { query += ' AND a.user_id = ?'; params.push(user_id); }
    if (project_id) { query += ' AND a.project_id = ?'; params.push(project_id); }
    if (status) { query += ' AND a.status = ?'; params.push(status); }
    query += ' ORDER BY a.update_date DESC, a.created_at DESC';
    const rows = db.prepare(query).all(...params);

    const headers = [
      'Date', 'Employee', 'Project', 'Title', 'Module',
      'Work Done', 'Status', 'Progress %', 'Remarks', 'Next Action',
    ];
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\r\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push([
        r.update_date,
        r.employee_name || '',
        r.project_name || '',
        r.title || '',
        r.module || '',
        r.tasks_completed || '',
        r.status || '',
        r.progress_percent ?? 0,
        r.remarks || '',
        r.next_action || '',
      ].map(escape).join(','));
    }

    const csv = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="team-updates-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aggregated chart data for the team dashboard (leads only)
router.get('/charts', authenticate, (req, res) => {
  try {
    if (!isLead(req.user)) return res.status(403).json({ error: 'Forbidden' });

    const db = getDb();
    const { from, to, project_id } = req.query;
    const where = ['1=1'];
    const params = [];
    if (from) { where.push('a.update_date >= ?'); params.push(from); }
    if (to) { where.push('a.update_date <= ?'); params.push(to); }
    if (project_id) { where.push('a.project_id = ?'); params.push(project_id); }
    const W = where.join(' AND ');

    const byEmployeeCompleted = db.prepare(`
      SELECT u.first_name || ' ' || u.last_name as label, COUNT(*) as value
      FROM activity_updates a
      JOIN users u ON a.user_id = u.id
      WHERE ${W} AND a.status = 'Completed'
      GROUP BY a.user_id
      ORDER BY value DESC
    `).all(...params);

    const statusBreakdown = db.prepare(`
      SELECT a.status as label, COUNT(*) as value
      FROM activity_updates a
      WHERE ${W}
      GROUP BY a.status
    `).all(...params);

    const dailyTrend = db.prepare(`
      SELECT a.update_date as label,
             COUNT(*) as value,
             SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) as completed
      FROM activity_updates a
      WHERE ${W}
      GROUP BY a.update_date
      ORDER BY a.update_date ASC
    `).all(...params);

    const byProject = db.prepare(`
      SELECT COALESCE(p.name, '— Unassigned —') as label, COUNT(*) as value
      FROM activity_updates a
      LEFT JOIN projects p ON a.project_id = p.id
      WHERE ${W}
      GROUP BY a.project_id
      ORDER BY value DESC
    `).all(...params);

    const byEmployeeProgress = db.prepare(`
      SELECT u.first_name || ' ' || u.last_name as label,
             ROUND(AVG(COALESCE(a.progress_percent, 0))) as value
      FROM activity_updates a
      JOIN users u ON a.user_id = u.id
      WHERE ${W}
      GROUP BY a.user_id
      ORDER BY value DESC
    `).all(...params);

    res.json({
      byEmployeeCompleted,
      statusBreakdown,
      dailyTrend,
      byProject,
      byEmployeeProgress,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
