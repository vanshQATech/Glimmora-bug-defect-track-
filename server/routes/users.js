const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');
const { sendInviteEmail, sendNotificationEmail } = require('../utils/mailer');

const router = express.Router();

// List all users (admin/PM)
router.get('/', authenticate, (req, res) => {
  try {
    const users = getDb().prepare(
      'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
    ).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user by ID
router.get('/:id', authenticate, (req, res) => {
  try {
    const user = getDb().prepare(
      'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = ?'
    ).get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user profile
router.put('/:id', authenticate, (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Cannot edit other users' });
    }

    const { first_name, last_name, password } = req.body;
    const db = getDb();

    if (password) {
      const hashed = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), password = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(first_name, last_name, hashed, req.params.id);
    } else {
      db.prepare('UPDATE users SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), updated_at = datetime(\'now\') WHERE id = ?')
        .run(first_name, last_name, req.params.id);
    }

    const user = db.prepare('SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user role (admin only)
router.put('/:id/role', authenticate, authorize('Admin'), (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['Admin', 'Project Manager', 'Developer', 'QA', 'Product Manager', 'Standard User'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const db = getDb();
    db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(role, req.params.id);
    const user = db.prepare('SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activate/deactivate user (admin only)
router.put('/:id/status', authenticate, authorize('Admin'), (req, res) => {
  try {
    const { is_active } = req.body;
    const db = getDb();
    db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(is_active ? 1 : 0, req.params.id);
    const user = db.prepare('SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invite user
router.post('/invite', authenticate, authorize('Admin', 'Project Manager'), async (req, res) => {
  try {
    const { email, project_id } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const db = getDb();
    const token = uuidv4();

    db.prepare(`
      INSERT INTO invitations (id, email, project_id, invited_by, token)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), email.toLowerCase(), project_id || null, req.user.id, token);

    // Get project name for the email
    let projectName = null;
    if (project_id) {
      const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(project_id);
      projectName = project?.name;
    }

    const inviterName = `${req.user.first_name} ${req.user.last_name}`;

    // Create notification for existing user
    const existingUser = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email.toLowerCase());
    if (existingUser && project_id) {
      // Auto-add existing user to project
      db.prepare('INSERT OR IGNORE INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)').run(uuidv4(), project_id, existingUser.id);

      const notifMessage = projectName
        ? `${inviterName} added you to project "${projectName}"`
        : `${inviterName} added you to a project`;

      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), existingUser.id, 'project_invite', 'Project Invitation',
        notifMessage, 'project', project_id);

      // Send email notification to existing user
      sendNotificationEmail({
        to: existingUser.email,
        subject: 'Added to Project',
        message: notifMessage,
        entityType: 'project',
        entityId: project_id,
      }).catch(err => console.error('Email send failed:', err.message));
    }

    // Send invite email (for new or existing users)
    const result = await sendInviteEmail({
      to: email.toLowerCase(),
      inviterName,
      projectName,
      token,
    });

    if (!result.success) {
      return res.status(500).json({ error: `Invitation created but email failed: ${result.error}` });
    }

    res.status(201).json({ message: 'Invitation sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
