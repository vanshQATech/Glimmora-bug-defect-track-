const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'bugtracker.db');

let db;

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
    const data = this._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
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

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
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
  `);

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

  console.log('Database initialized successfully');
  return db;
}

module.exports = { getDb, initializeDatabase };
