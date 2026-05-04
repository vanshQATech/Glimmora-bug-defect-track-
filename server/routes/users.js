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

// Reset another user's password (admin only). If no password is provided,
// generate a strong random one and return it so the admin can share it.
router.post('/:id/reset-password', authenticate, authorize('Admin'), (req, res) => {
  try {
    const db = getDb();
    const target = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    let { password } = req.body || {};
    if (password) {
      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
    } else {
      const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const lower = 'abcdefghijkmnpqrstuvwxyz';
      const digits = '23456789';
      const symbols = '!@#$%';
      const all = upper + lower + digits + symbols;
      const pick = (s) => s[Math.floor(Math.random() * s.length)];
      const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
      while (chars.length < 12) chars.push(pick(all));
      password = chars.sort(() => Math.random() - 0.5).join('');
    }

    const hashed = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hashed, target.id);

    res.json({
      message: 'Password reset successfully. Share this password with the user — it will not be shown again.',
      email: target.email,
      password,
    });
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
        baseUrl: req.headers.origin || `${req.protocol}://${req.get('host')}`,
      }).catch(err => console.error('Email send failed:', err.message));
    }

    const appUrl = req.headers.origin || process.env.APP_URL || `${req.protocol}://${req.headers.host}`;
    const inviteLink = `${appUrl}/register?invitation=${token}`;

    // Try to send invite email (non-blocking — we still return success)
    const result = await sendInviteEmail({
      to: email.toLowerCase(),
      inviterName,
      projectName,
      token,
      baseUrl: appUrl,
    }).catch(err => ({ success: false, error: err.message }));

    res.status(201).json({
      message: result.success
        ? 'Invitation sent successfully'
        : 'Invitation created. Email could not be sent — share the link below manually.',
      email_sent: !!result.success,
      email_error: result.success ? null : (result.error || 'SMTP not configured'),
      invite_link: inviteLink,
      token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
