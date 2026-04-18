require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files from DB (Render's disk is ephemeral, so files are stored as BLOBs).
// Falls back to local disk for any legacy files saved before the DB-storage change.
app.get('/api/uploads/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const db = getDb();
    const row = db.prepare('SELECT mimetype, original_name, data FROM bug_attachments WHERE filename = ?').get(filename);
    if (row && row.data) {
      const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
      res.setHeader('Content-Type', row.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${row.original_name || filename}"`);
      return res.send(buf);
    }
    const diskPath = path.join(__dirname, 'uploads', filename);
    if (fs.existsSync(diskPath)) return res.sendFile(diskPath);
    return res.status(404).json({ error: 'File not found' });
  } catch (err) {
    console.error('GET /api/uploads error:', err);
    res.status(500).json({ error: 'Failed to load file' });
  }
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/bugs', require('./routes/bugs'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/workspace', require('./routes/workspace'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/search', require('./routes/search'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/admin', require('./routes/admin'));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Glimmora Bug Tracker API is running' });
});

// Initialize database then start server
async function start() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
