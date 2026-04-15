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

module.exports = router;
