const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/mailer');

const router = express.Router();

// Register
router.post('/register', (req, res) => {
  try {
    const { email, password, first_name, last_name, invitation_token } = req.body;
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, email, password, first_name, last_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, email.toLowerCase(), hashedPassword, first_name, last_name);

    // If registering via invitation, accept it and add to project
    if (invitation_token) {
      const invitation = db.prepare(
        "SELECT * FROM invitations WHERE token = ? AND status = 'pending'"
      ).get(invitation_token);

      if (invitation) {
        db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(invitation.id);
        if (invitation.project_id) {
          db.prepare('INSERT OR IGNORE INTO project_members (id, project_id, user_id) VALUES (?, ?, ?)').run(uuidv4(), invitation.project_id, userId);
        }
      }
    }

    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    const user = db.prepare('SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?').get(userId);

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_active: user.is_active,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Forgot password — generate token and send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const db = getDb();
    const user = db.prepare('SELECT id, email FROM users WHERE email = ? AND is_active = 1').get(email.toLowerCase());

    // Always respond success to prevent email enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), user.id, token, expiresAt);

    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      console.error('[Auth] APP_URL is not set in environment variables. Password reset emails will have broken links.');
    }
    const resetLink = `${appUrl || 'http://localhost:5173'}/reset-password?token=${token}`;

    const emailResult = await sendPasswordResetEmail({ to: user.email, resetLink });
    if (!emailResult.success) {
      console.error(`[Auth] Failed to send password reset email to ${user.email}: ${emailResult.error}`);
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset password — validate token and update password
router.post('/reset-password', (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const db = getDb();
    const record = db.prepare(`
      SELECT * FROM password_reset_tokens
      WHERE token = ? AND used = 0 AND expires_at > datetime('now')
    `).get(token);

    if (!record) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hashedPassword, record.user_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(record.id);

    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
