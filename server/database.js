const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'bugtracker.db');
const SNAPSHOT_INTERVAL_MS = 3000;

let db;
let pgPool = null;
let saveTimer = null;
let pendingSave = false;

async function getPgPool() {
  if (pgPool) return pgPool;
  if (!process.env.DATABASE_URL) return null;
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS db_snapshot (
      id INTEGER PRIMARY KEY,
      data BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  return pgPool;
}

async function loadSnapshotFromPg() {
  const pool = await getPgPool();
  if (!pool) return null;
  try {
    const res = await pool.query('SELECT data FROM db_snapshot WHERE id = 1');
    if (res.rows.length === 0) return null;
    console.log('Loaded DB snapshot from Postgres');
    return res.rows[0].data;
  } catch (err) {
    console.error('Failed to load DB snapshot from Postgres:', err.message);
    return null;
  }
}

async function saveSnapshotToPg(buffer) {
  const pool = await getPgPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO db_snapshot (id, data, updated_at) VALUES (1, $1, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [buffer]
    );
  } catch (err) {
    console.error('Failed to save DB snapshot to Postgres:', err.message);
  }
}

function scheduleSnapshot() {
  if (!process.env.DATABASE_URL) return;
  pendingSave = true;
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (!pendingSave || !db) return;
    pendingSave = false;
    try {
      const data = db._db.export();
      await saveSnapshotToPg(Buffer.from(data));
    } catch (err) {
      console.error('Snapshot flush failed:', err.message);
    }
  }, SNAPSHOT_INTERVAL_MS);
}

async function flushSnapshotNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!db) return;
  try {
    const data = db._db.export();
    await saveSnapshotToPg(Buffer.from(data));
    console.log('Final DB snapshot flushed to Postgres');
  } catch (err) {
    console.error('Final snapshot flush failed:', err.message);
  }
}

process.on('SIGTERM', async () => { await flushSnapshotNow(); process.exit(0); });
process.on('SIGINT', async () => { await flushSnapshotNow(); process.exit(0); });

// sql.js wrapper to match better-sqlite3 API style
class DbWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self._db.run(sql, params);
        self._save();
        return this;
      },
      get(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
    };
  }

  exec(sql) {
    this._db.exec(sql);
    this._save();
  }

  pragma(sql) {
    this._db.exec(`PRAGMA ${sql}`);
  }

  _save() {
    try {
      const data = this._db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      // Render's FS may be read-only in some dirs; ignore and rely on Postgres snapshot
    }
    scheduleSnapshot();
  }
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

async function initializeDatabase() {
  const SQL = await initSqlJs();

  // Prefer Postgres snapshot (persistent across redeploys), then local file, else empty.
  let sqlDb;
  const pgBuffer = await loadSnapshotFromPg();
  if (pgBuffer) {
    sqlDb = new SQL.Database(pgBuffer);
  } else if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
    console.log('Loaded DB from local file (no Postgres snapshot yet)');
  } else {
    sqlDb = new SQL.Database();
    console.log('Created fresh empty DB');
  }

  db = new DbWrapper(sqlDb);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Standard User',
      avatar TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS bugs (
      id TEXT PRIMARY KEY,
      bug_number INTEGER,
      project_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      description TEXT,
      steps_to_reproduce TEXT,
      expected_result TEXT,
      actual_result TEXT,
      url TEXT,
      reporter_id TEXT NOT NULL,
      assignee_id TEXT,
      status TEXT NOT NULL DEFAULT 'Open',
      priority TEXT NOT NULL DEFAULT 'Medium',
      severity TEXT NOT NULL DEFAULT 'Major',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bug_attachments (
      id TEXT PRIMARY KEY,
      bug_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mimetype TEXT,
      size INTEGER,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      assignee_id TEXT,
      status TEXT NOT NULL DEFAULT 'To Do',
      priority TEXT NOT NULL DEFAULT 'Medium',
      due_date TEXT,
      linked_bug_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      field_changed TEXT,
      old_value TEXT,
      new_value TEXT,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      entity_type TEXT,
      entity_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      project_id TEXT,
      invited_by TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      assigned_to TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      project_id TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Pending',
      deadline TEXT NOT NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_updates (
      id TEXT PRIMARY KEY,
      work_task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      update_text TEXT NOT NULL,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      blockers TEXT,
      update_date TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_updates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      update_date TEXT NOT NULL DEFAULT (date('now')),
      module TEXT,
      tasks_completed TEXT,
      tasks_in_progress TEXT,
      tasks_planned TEXT,
      bugs_worked TEXT,
      bugs_fixed TEXT,
      bugs_raised TEXT,
      blockers TEXT,
      dependencies TEXT,
      status TEXT NOT NULL DEFAULT 'In Progress',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS test_scenarios (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      tc_number INTEGER,
      scenario_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      preconditions TEXT,
      steps TEXT,
      expected_result TEXT,
      actual_result TEXT,
      status TEXT NOT NULL DEFAULT 'Not Run',
      priority TEXT NOT NULL DEFAULT 'Medium',
      severity TEXT NOT NULL DEFAULT 'Major',
      case_type TEXT DEFAULT 'Positive',
      assignee_id TEXT,
      linked_bug_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS test_executions (
      id TEXT PRIMARY KEY,
      test_case_id TEXT NOT NULL,
      executed_by TEXT NOT NULL,
      status TEXT NOT NULL,
      actual_result TEXT,
      comments TEXT,
      linked_bug_id TEXT,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS test_case_attachments (
      id TEXT PRIMARY KEY,
      test_case_id TEXT NOT NULL,
      execution_id TEXT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mimetype TEXT,
      size INTEGER,
      data BLOB,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add case_type if missing
  const tcCols = db.prepare("PRAGMA table_info(test_cases)").all().map(c => c.name);
  if (!tcCols.includes('case_type')) {
    try { db.exec(`ALTER TABLE test_cases ADD COLUMN case_type TEXT DEFAULT 'Positive'`); }
    catch (e) { console.error('migration case_type', e.message); }
  }

  // Lightweight migrations for new bug fields
  const bugCols = db.prepare("PRAGMA table_info(bugs)").all().map(c => c.name);
  const addCol = (name, type) => {
    if (!bugCols.includes(name)) {
      try { db.exec(`ALTER TABLE bugs ADD COLUMN ${name} ${type}`); } catch (e) { console.error('migration', name, e.message); }
    }
  };
  addCol('module', 'TEXT');
  addCol('environment', 'TEXT');
  addCol('browser', 'TEXT');
  addCol('device', 'TEXT');
  addCol('due_date', 'TEXT');
  addCol('qa_owner_id', 'TEXT');

  // Store attachment bytes in the DB so they survive Render's ephemeral disk
  const attachCols = db.prepare("PRAGMA table_info(bug_attachments)").all().map(c => c.name);
  if (!attachCols.includes('data')) {
    try { db.exec(`ALTER TABLE bug_attachments ADD COLUMN data BLOB`); } catch (e) { console.error('migration data BLOB', e.message); }
  }

  // Reporting fields on activity_updates: progress %, remarks, next action
  const actCols = db.prepare("PRAGMA table_info(activity_updates)").all().map(c => c.name);
  const addActCol = (name, type) => {
    if (!actCols.includes(name)) {
      try { db.exec(`ALTER TABLE activity_updates ADD COLUMN ${name} ${type}`); }
      catch (e) { console.error('migration activity', name, e.message); }
    }
  };
  addActCol('progress_percent', 'INTEGER DEFAULT 0');
  addActCol('remarks', 'TEXT');
  addActCol('next_action', 'TEXT');
  addActCol('title', 'TEXT');

  // Seed default accounts
  const seedUser = ({ email, password, firstName, lastName, role }) => {
    const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
    const hashed = bcrypt.hashSync(password, 10);
    if (existing) {
      db.prepare(`
        UPDATE users SET password = ?, first_name = ?, last_name = ?, role = ?, is_active = 1, updated_at = datetime('now')
        WHERE email = ?
      `).run(hashed, firstName, lastName, role, email);
      console.log(`Seed user updated: ${email} (${role})`);
    } else {
      db.prepare(`
        INSERT INTO users (id, email, password, first_name, last_name, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), email, hashed, firstName, lastName, role);
      console.log(`Seed user created: ${email} / ${password} (${role})`);
    }
  };

  seedUser({
    email: 'vanshqalead@glimmora.com',
    password: 'vanshQAlead@123',
    firstName: 'Vansh',
    lastName: 'QA Lead',
    role: 'Admin',
  });

  seedUser({
    email: 'vanshqapm@glimmora.com',
    password: 'vanshQApm@123',
    firstName: 'Vansh',
    lastName: 'QA PM',
    role: 'Project Manager',
  });

  // Deactivate the old default admin if it exists
  db.prepare("UPDATE users SET is_active = 0 WHERE email = 'admin@bugtrack.com'").run();

  // Seed Glimmora Team project with scenarios & test cases (idempotent).
  try {
    const { seedGlimmora } = require('./scripts/seed-glimmora');
    seedGlimmora(db);
  } catch (err) {
    console.error('Glimmora seed failed:', err.message);
  }

  // Force immediate initial snapshot so schema + seed data land in Postgres
  await flushSnapshotNow();

  console.log('Database initialized successfully');
  return db;
}

module.exports = { getDb, initializeDatabase, flushSnapshotNow };
