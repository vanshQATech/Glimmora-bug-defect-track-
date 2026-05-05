const express = require('express');
const { getDb } = require('../database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// List all tables + row counts
router.get('/tables', authenticate, authorize('Admin'), (req, res) => {
  try {
    const db = getDb();
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();
    const withCounts = tables.map(t => {
      let count = 0;
      try {
        const row = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
        count = row?.c || 0;
      } catch (e) { /* ignore */ }
      return { name: t.name, count };
    });
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch rows from a specific table
router.get('/tables/:name', authenticate, authorize('Admin'), (req, res) => {
  try {
    const db = getDb();
    const { name } = req.params;

    // Validate table name against sqlite_master to prevent injection
    const valid = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
    ).get(name);
    if (!valid) return res.status(404).json({ error: 'Table not found' });

    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const offset = parseInt(req.query.offset) || 0;

    const columns = db.prepare(`PRAGMA table_info("${name}")`).all().map(c => ({
      name: c.name, type: c.type, pk: c.pk, notnull: c.notnull,
    }));

    const rows = db.prepare(`SELECT * FROM "${name}" LIMIT ? OFFSET ?`).all(limit, offset);
    const total = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get()?.c || 0;

    // Redact sensitive fields
    const redacted = rows.map(r => {
      const copy = { ...r };
      if ('password' in copy) copy.password = '••• hidden •••';
      return copy;
    });

    res.json({ table: name, total, limit, offset, columns, rows: redacted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a test email to verify Brevo config
router.get('/test-email', authenticate, authorize('Admin'), async (req, res) => {
  const { to } = req.query;
  if (!to) return res.status(400).json({ error: 'to email is required' });
  try {
    const https = require('https');
    const apiKey = (process.env.BREVO_API_KEY || process.env.SMTP_PASS || '').trim();
    const smtpFrom = process.env.SMTP_FROM || '';
    const fromMatch = smtpFrom.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
    const sender = fromMatch
      ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() }
      : { name: 'Glimmora DefectDesk', email: smtpFrom.trim() };

    if (!apiKey) return res.status(500).json({ error: 'BREVO_API_KEY / SMTP_PASS not set' });
    if (!sender.email) return res.status(500).json({ error: 'SMTP_FROM not set or invalid format' });

    const body = JSON.stringify({
      sender,
      to: [{ email: to }],
      subject: '[Glimmora DefectDesk] Test Email',
      htmlContent: '<p>This is a test email to verify your Brevo configuration is working.</p>',
    });

    await new Promise((resolve, reject) => {
      const r = https.request({
        hostname: 'api.brevo.com', path: '/v3/smtp/email', method: 'POST',
        headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, resp => {
        let data = '';
        resp.on('data', c => data += c);
        resp.on('end', () => resp.statusCode >= 200 && resp.statusCode < 300 ? resolve(data) : reject(new Error(`Brevo ${resp.statusCode}: ${data}`)));
      });
      r.setTimeout(15000, () => r.destroy(new Error('Brevo timeout')));
      r.on('error', reject);
      r.write(body); r.end();
    });

    res.json({ success: true, message: `Test email sent to ${to}`, sender: sender.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
