const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, authorize, isProjectMember } = require('../middleware/auth');
const { sendInviteEmail } = require('../utils/mailer');

const router = express.Router();

// List projects (user sees their projects, admin sees all)
router.get('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    let projects;

    if (req.user.role === 'Admin') {
      projects = db.prepare(`
        SELECT p.*, u.first_name || ' ' || u.last_name as created_by_name,
          (SELECT COUNT(*) FROM bugs WHERE project_id = p.id) as bug_count,
          (SELECT COUNT(*) FROM bugs WHERE project_id = p.id AND status = 'Open') as open_bugs,
          (SELECT COUNT(*) FROM bugs WHERE project_id = p.id AND status = 'In Progress') as in_progress_bugs,
          (SELECT COUNT(*) FROM bugs WHERE project_id = p.id AND status = 'Done') as done_bugs,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'Done') as pending_tasks,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `).all();
    } else {
      projects = db.prepare(`
        SELECT p.*, u.first_name || ' ' || u.last_name as created_by_name,
          (SELECT COUNT(*) FROM bugs WHERE project_id = p.id) as bug_count,
          (SELECT COUNT(*) FROM bugs WHERE project_id = p.id AND status = 'Open') as open_bugs,
          (SELECT COUNT(*) FROM bugs WHERE project_id = p.id AND status = 'In Progress') as in_progress_bugs,
          (SELECT COUNT(*) FROM bugs WHERE project_id = p.id AND status = 'Done') as done_bugs,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'Done') as pending_tasks,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        INNER JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
        ORDER BY p.created_at DESC
      `).all(req.user.id);
    }

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single project
router.get('/:projectId', authenticate, isProjectMember, (req, res) => {
  try {
    const db = getDb();
    const project = db.prepare(`
      SELECT p.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM projects p LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(req.params.projectId);

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const members = db.prepare(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, pm.added_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `).all(req.params.projectId);

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_bugs,
        SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open_bugs,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_bugs,
        SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as done_bugs,
        SUM(CASE WHEN status = 'Ready for QA' THEN 1 ELSE 0 END) as ready_for_qa
      FROM bugs WHERE project_id = ?
    `).get(req.params.projectId);

    const taskStats = db.prepare(`
      SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'To Do' THEN 1 ELSE 0 END) as todo_tasks,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as done_tasks,
        SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END) as blocked_tasks
      FROM tasks WHERE project_id = ?
    `).get(req.params.projectId);

    res.json({ ...project, members, stats, taskStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create project
router.post('/', authenticate, authorize('Admin', 'Project Manager'), (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const db = getDb();
    const projectId = uuidv4();

    db.prepare('INSERT INTO projects (id, name, description, created_by) VALUES (?, ?, ?, ?)')
      .run(projectId, name, description || '', req.user.id);

    // Add creator as member
    db.prepare('INSERT INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)')
      .run(uuidv4(), projectId, req.user.id);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update project
router.put('/:projectId', authenticate, authorize('Admin', 'Project Manager'), (req, res) => {
  try {
    const { name, description, status } = req.body;
    const db = getDb();

    db.prepare("UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description), status = COALESCE(?, status), updated_at = datetime('now') WHERE id = ?")
      .run(name, description, status, req.params.projectId);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a project (cascades to members, bugs, tasks, comments, audit log)
router.delete('/:projectId', authenticate, authorize('Admin'), (req, res) => {
  try {
    const db = getDb();
    const { projectId } = req.params;

    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const bugIds = db.prepare('SELECT id FROM bugs WHERE project_id = ?').all(projectId).map(b => b.id);
    const taskIds = db.prepare('SELECT id FROM tasks WHERE project_id = ?').all(projectId).map(t => t.id);

    for (const bugId of bugIds) {
      db.prepare('DELETE FROM bug_attachments WHERE bug_id = ?').run(bugId);
      db.prepare("DELETE FROM comments WHERE entity_type = 'bug' AND entity_id = ?").run(bugId);
      db.prepare("DELETE FROM audit_log WHERE entity_type = 'bug' AND entity_id = ?").run(bugId);
    }
    for (const taskId of taskIds) {
      db.prepare("DELETE FROM comments WHERE entity_type = 'task' AND entity_id = ?").run(taskId);
      db.prepare("DELETE FROM audit_log WHERE entity_type = 'task' AND entity_id = ?").run(taskId);
    }

    db.prepare('DELETE FROM bugs WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM project_members WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM work_tasks WHERE project_id = ?').run(projectId);
    db.prepare("DELETE FROM notifications WHERE entity_type = 'project' AND entity_id = ?").run(projectId);
    db.prepare("DELETE FROM audit_log WHERE entity_type = 'project' AND entity_id = ?").run(projectId);
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

    res.json({ success: true });
  } catch (err) {
    console.error('[projects] delete failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add member to project
router.post('/:projectId/members', authenticate, authorize('Admin', 'Project Manager'), (req, res) => {
  try {
    const { user_id } = req.body;
    const db = getDb();

    db.prepare('INSERT OR IGNORE INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)')
      .run(uuidv4(), req.params.projectId, user_id);

    // Notify user
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), user_id, 'project_invite', 'Added to Project',
      'You have been added to a project', 'project', req.params.projectId);

    res.json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invite user to project by email
router.post('/:projectId/invite', authenticate, authorize('Admin', 'Project Manager'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const db = getDb();
    const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const inviterName = `${req.user.first_name} ${req.user.last_name}`;

    // Check if user already exists
    const existingUser = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email.toLowerCase());
    if (existingUser) {
      // Add them to the project directly
      const alreadyMember = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, existingUser.id);
      if (alreadyMember) {
        return res.status(409).json({ error: 'User is already a member of this project' });
      }
      db.prepare('INSERT OR IGNORE INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)').run(uuidv4(), req.params.projectId, existingUser.id);

      // Notify them
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), existingUser.id, 'project_invite', 'Added to Project',
        `${inviterName} added you to project "${project.name}"`, 'project', req.params.projectId);
    }

    // Create invitation record
    const token = uuidv4();
    db.prepare(`
      INSERT INTO invitations (id, email, project_id, invited_by, token)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), email.toLowerCase(), req.params.projectId, req.user.id, token);

    const appUrl = process.env.APP_URL || req.headers.origin || 'http://localhost:5173';
    const inviteLink = `${appUrl}/register?invitation=${token}`;

    // Try to send invite email (non-blocking — don't fail request if SMTP missing)
    const result = await sendInviteEmail({
      to: email.toLowerCase(),
      inviterName,
      projectName: project.name,
      token,
    }).catch(err => ({ success: false, error: err.message }));

    const baseMessage = existingUser
      ? `${email} has been added to the project`
      : `Invitation created for ${email}`;

    res.status(201).json({
      message: result.success
        ? `${baseMessage} and notified by email`
        : `${baseMessage}. Email could not be sent — share the link below manually.`,
      email_sent: !!result.success,
      email_error: result.success ? null : (result.error || 'SMTP not configured'),
      invite_link: inviteLink,
      token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove member from project
router.delete('/:projectId/members/:userId', authenticate, authorize('Admin', 'Project Manager'), (req, res) => {
  try {
    getDb().prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
      .run(req.params.projectId, req.params.userId);
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
