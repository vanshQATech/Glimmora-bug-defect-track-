const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate, isProjectMember } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { sendNotificationEmail } = require('../utils/mailer');

const router = express.Router();

// Membership guards for test case / scenario / attachment routes.
// They look up the entity, resolve its project_id, and verify the caller is
// an Admin or a member of that project.
function memberCheck(db, user, projectId) {
  if (user.role === 'Admin') return true;
  const m = db.prepare(
    'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, user.id);
  return !!m;
}

function isCaseMember(req, res, next) {
  const db = getDb();
  const tc = db.prepare('SELECT project_id FROM test_cases WHERE id = ?').get(req.params.id);
  if (!tc) return res.status(404).json({ error: 'Test case not found' });
  if (!memberCheck(db, req.user, tc.project_id)) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }
  req.testCaseProjectId = tc.project_id;
  next();
}

function isScenarioMember(req, res, next) {
  const db = getDb();
  const id = req.params.id || req.params.scenarioId;
  const s = db.prepare('SELECT project_id FROM test_scenarios WHERE id = ?').get(id);
  if (!s) return res.status(404).json({ error: 'Scenario not found' });
  if (!memberCheck(db, req.user, s.project_id)) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }
  req.scenarioProjectId = s.project_id;
  next();
}

function isAttachmentMember(req, res, next) {
  const db = getDb();
  let row;
  if (req.params.filename) {
    row = db.prepare(
      `SELECT a.id, c.project_id FROM test_case_attachments a
       LEFT JOIN test_cases c ON a.test_case_id = c.id
       WHERE a.filename = ?`
    ).get(req.params.filename);
  } else if (req.params.attId) {
    row = db.prepare(
      `SELECT a.id, c.project_id FROM test_case_attachments a
       LEFT JOIN test_cases c ON a.test_case_id = c.id
       WHERE a.id = ?`
    ).get(req.params.attId);
  }
  if (!row) return res.status(404).json({ error: 'Attachment not found' });
  if (row.project_id && !memberCheck(db, req.user, row.project_id)) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }
  next();
}

const reqBaseUrl = (req) => req.headers.origin || `${req.protocol}://${req.get('host')}`;

function notifyUser(db, userId, type, title, message, entityType, entityId, baseUrl) {
  if (!userId) return;
  try {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), userId, type, title, message, entityType, entityId);
  } catch (err) {
    console.error('notifyUser insert failed:', err.message);
  }
  try {
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    if (user) {
      Promise.resolve(
        sendNotificationEmail({ to: user.email, subject: title, message, entityType, entityId, baseUrl })
      ).catch(err => console.error('Notification email failed:', err.message));
    }
  } catch (err) {
    console.error('notifyUser email lookup failed:', err.message);
  }
}

function saveAttachments(db, files, testCaseId, executionId, userId) {
  if (!files || files.length === 0) return [];
  const stmt = db.prepare(`
    INSERT INTO test_case_attachments
    (id, test_case_id, execution_id, filename, original_name, mimetype, size, data, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const saved = [];
  for (const file of files) {
    const id = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    stmt.run(id, testCaseId, executionId || null, filename, file.originalname, file.mimetype, file.size, file.buffer, userId);
    saved.push({ id, filename, original_name: file.originalname, mimetype: file.mimetype, size: file.size, buffer: file.buffer });
  }
  return saved;
}

// ---------- Attachment serving ----------

router.get('/attachments/:filename', authenticate, isAttachmentMember, (req, res) => {
  try {
    const row = getDb().prepare(
      'SELECT mimetype, original_name, data FROM test_case_attachments WHERE filename = ?'
    ).get(req.params.filename);
    if (!row || !row.data) return res.status(404).json({ error: 'File not found' });
    const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
    res.setHeader('Content-Type', row.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${row.original_name || req.params.filename}"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Scenarios ----------

router.get('/scenarios/project/:projectId', authenticate, isProjectMember, (req, res) => {
  try {
    const db = getDb();
    const scenarios = db.prepare(`
      SELECT s.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM test_cases WHERE scenario_id = s.id) as case_count,
        (SELECT COUNT(*) FROM test_cases WHERE scenario_id = s.id AND status = 'Pass') as pass_count,
        (SELECT COUNT(*) FROM test_cases WHERE scenario_id = s.id AND status = 'Fail') as fail_count,
        (SELECT COUNT(*) FROM test_cases WHERE scenario_id = s.id AND status = 'Blocked') as blocked_count,
        (SELECT COUNT(*) FROM test_cases WHERE scenario_id = s.id AND status = 'Not Run') as notrun_count
      FROM test_scenarios s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.project_id = ?
      ORDER BY s.created_at DESC
    `).all(req.params.projectId);
    res.json(scenarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scenarios/:id', authenticate, isScenarioMember, (req, res) => {
  try {
    const db = getDb();
    const scenario = db.prepare(`
      SELECT s.*, p.name as project_name,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM test_scenarios s
      LEFT JOIN projects p ON s.project_id = p.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    res.json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/scenarios', authenticate, isProjectMember, (req, res) => {
  try {
    const { project_id, name, description } = req.body;
    if (!project_id || !name) return res.status(400).json({ error: 'Project and name are required' });
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO test_scenarios (id, project_id, name, description, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, project_id, name, description || '', req.user.id);
    const scenario = db.prepare('SELECT * FROM test_scenarios WHERE id = ?').get(id);
    res.status(201).json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/scenarios/:id', authenticate, isScenarioMember, (req, res) => {
  try {
    const { name, description } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM test_scenarios WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Scenario not found' });
    db.prepare(`
      UPDATE test_scenarios
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(name ?? null, description ?? null, req.params.id);
    const scenario = db.prepare('SELECT * FROM test_scenarios WHERE id = ?').get(req.params.id);
    res.json(scenario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/scenarios/:id', authenticate, isScenarioMember, (req, res) => {
  try {
    const db = getDb();
    const caseIds = db.prepare('SELECT id FROM test_cases WHERE scenario_id = ?').all(req.params.id).map(c => c.id);
    for (const cid of caseIds) {
      db.prepare('DELETE FROM test_executions WHERE test_case_id = ?').run(cid);
      db.prepare('DELETE FROM test_case_attachments WHERE test_case_id = ?').run(cid);
    }
    db.prepare('DELETE FROM test_cases WHERE scenario_id = ?').run(req.params.id);
    db.prepare('DELETE FROM test_scenarios WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Test Cases ----------

router.get('/cases/project/:projectId', authenticate, isProjectMember, (req, res) => {
  try {
    const db = getDb();
    const { status, priority, severity, case_type, scenario_id, assignee_id, search } = req.query;
    let query = `
      SELECT c.*,
        s.name as scenario_name,
        a.first_name || ' ' || a.last_name as assignee_name,
        cu.first_name || ' ' || cu.last_name as created_by_name,
        b.bug_number as linked_bug_number, b.summary as linked_bug_summary,
        (SELECT COUNT(*) FROM test_case_attachments WHERE test_case_id = c.id AND execution_id IS NULL) as attachment_count
      FROM test_cases c
      LEFT JOIN test_scenarios s ON c.scenario_id = s.id
      LEFT JOIN users a ON c.assignee_id = a.id
      LEFT JOIN users cu ON c.created_by = cu.id
      LEFT JOIN bugs b ON c.linked_bug_id = b.id
      WHERE c.project_id = ?
    `;
    const params = [req.params.projectId];
    if (status) { query += ' AND c.status = ?'; params.push(status); }
    if (priority) { query += ' AND c.priority = ?'; params.push(priority); }
    if (severity) { query += ' AND c.severity = ?'; params.push(severity); }
    if (case_type) { query += ' AND c.case_type = ?'; params.push(case_type); }
    if (scenario_id) { query += ' AND c.scenario_id = ?'; params.push(scenario_id); }
    if (assignee_id) { query += ' AND c.assignee_id = ?'; params.push(assignee_id); }
    if (search) {
      query += ' AND (c.title LIKE ? OR c.description LIKE ? OR CAST(c.tc_number AS TEXT) LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY c.tc_number DESC';
    const cases = db.prepare(query).all(...params);
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cases/scenario/:scenarioId', authenticate, isScenarioMember, (req, res) => {
  try {
    const db = getDb();
    const cases = db.prepare(`
      SELECT c.*,
        a.first_name || ' ' || a.last_name as assignee_name,
        b.bug_number as linked_bug_number, b.summary as linked_bug_summary
      FROM test_cases c
      LEFT JOIN users a ON c.assignee_id = a.id
      LEFT JOIN bugs b ON c.linked_bug_id = b.id
      WHERE c.scenario_id = ?
      ORDER BY c.tc_number ASC
    `).all(req.params.scenarioId);
    res.json(cases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cases/:id', authenticate, isCaseMember, (req, res) => {
  try {
    const db = getDb();
    const tc = db.prepare(`
      SELECT c.*,
        s.name as scenario_name,
        p.name as project_name,
        a.first_name || ' ' || a.last_name as assignee_name,
        cu.first_name || ' ' || cu.last_name as created_by_name,
        b.bug_number as linked_bug_number, b.summary as linked_bug_summary, b.status as linked_bug_status
      FROM test_cases c
      LEFT JOIN test_scenarios s ON c.scenario_id = s.id
      LEFT JOIN projects p ON c.project_id = p.id
      LEFT JOIN users a ON c.assignee_id = a.id
      LEFT JOIN users cu ON c.created_by = cu.id
      LEFT JOIN bugs b ON c.linked_bug_id = b.id
      WHERE c.id = ?
    `).get(req.params.id);
    if (!tc) return res.status(404).json({ error: 'Test case not found' });

    const executions = db.prepare(`
      SELECT e.*, u.first_name || ' ' || u.last_name as executed_by_name,
        b.bug_number as exec_bug_number, b.summary as exec_bug_summary
      FROM test_executions e
      LEFT JOIN users u ON e.executed_by = u.id
      LEFT JOIN bugs b ON e.linked_bug_id = b.id
      WHERE e.test_case_id = ?
      ORDER BY e.executed_at DESC
    `).all(tc.id);

    const attachments = db.prepare(`
      SELECT id, test_case_id, execution_id, filename, original_name, mimetype, size, uploaded_at
      FROM test_case_attachments
      WHERE test_case_id = ?
      ORDER BY uploaded_at DESC
    `).all(tc.id);

    res.json({ ...tc, executions, attachments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cases', authenticate, upload.array('attachments', 10), isProjectMember, (req, res) => {
  try {
    const {
      scenario_id, project_id, title, description, preconditions, steps,
      expected_result, priority, severity, case_type, assignee_id,
    } = req.body;

    if (!scenario_id || !project_id || !title) {
      return res.status(400).json({ error: 'Scenario, project, and title are required' });
    }

    const db = getDb();
    const id = uuidv4();
    const maxNum = db.prepare('SELECT COALESCE(MAX(tc_number), 0) as max_num FROM test_cases WHERE project_id = ?').get(project_id);
    const tcNumber = (maxNum?.max_num || 0) + 1;

    db.prepare(`
      INSERT INTO test_cases (
        id, tc_number, scenario_id, project_id, title, description, preconditions, steps,
        expected_result, priority, severity, case_type, assignee_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, tcNumber, scenario_id, project_id, title,
      description || '', preconditions || '', steps || '',
      expected_result || '', priority || 'Medium', severity || 'Major',
      case_type || 'Positive', assignee_id || null, req.user.id
    );

    saveAttachments(db, req.files, id, null, req.user.id);

    if (assignee_id && assignee_id !== req.user.id) {
      notifyUser(db, assignee_id, 'testcase_assigned', 'Test Case Assigned',
        `Test case "${title}" has been assigned to you`, 'testcase', id, reqBaseUrl(req));
    }

    const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
    res.status(201).json(tc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/cases/:id', authenticate, isCaseMember, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Test case not found' });

    const updatable = [
      'title', 'description', 'preconditions', 'steps', 'expected_result',
      'actual_result', 'status', 'priority', 'severity', 'case_type',
      'assignee_id', 'scenario_id', 'linked_bug_id',
    ];
    const sets = [];
    const vals = [];
    for (const key of updatable) {
      if (req.body[key] !== undefined) {
        const newVal = req.body[key] === '' ? null : req.body[key];
        sets.push(`${key} = ?`);
        vals.push(newVal);
      }
    }
    if (sets.length > 0) {
      sets.push(`updated_at = datetime('now')`);
      vals.push(req.params.id);
      db.prepare(`UPDATE test_cases SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }

    const newAssignee = req.body.assignee_id;
    if (newAssignee && newAssignee !== existing.assignee_id && newAssignee !== req.user.id) {
      notifyUser(db, newAssignee, 'testcase_assigned', 'Test Case Assigned',
        `Test case "${existing.title}" has been assigned to you`, 'testcase', req.params.id, reqBaseUrl(req));
    }

    const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
    res.json(tc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/cases/:id', authenticate, isCaseMember, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM test_executions WHERE test_case_id = ?').run(req.params.id);
    db.prepare('DELETE FROM test_case_attachments WHERE test_case_id = ?').run(req.params.id);
    db.prepare('DELETE FROM test_cases WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload attachments to an existing test case (not tied to an execution)
router.post('/cases/:id/attachments', authenticate, upload.array('attachments', 10), isCaseMember, (req, res) => {
  try {
    const db = getDb();
    const saved = saveAttachments(db, req.files, req.params.id, null, req.user.id);
    res.status(201).json(saved.map(a => ({ id: a.id, filename: a.filename, original_name: a.original_name, mimetype: a.mimetype, size: a.size })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/attachments/:attId', authenticate, isAttachmentMember, (req, res) => {
  try {
    getDb().prepare('DELETE FROM test_case_attachments WHERE id = ?').run(req.params.attId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Execution ----------

router.post('/cases/:id/execute', authenticate, upload.array('attachments', 10), isCaseMember, (req, res) => {
  try {
    const { status, actual_result, comments, linked_bug_id, auto_create_bug } = req.body;
    if (!status || !['Pass', 'Fail', 'Blocked'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required (Pass/Fail/Blocked)' });
    }

    const db = getDb();
    const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
    if (!tc) return res.status(404).json({ error: 'Test case not found' });

    const execId = uuidv4();
    db.prepare(`
      INSERT INTO test_executions (id, test_case_id, executed_by, status, actual_result, comments, linked_bug_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(execId, req.params.id, req.user.id, status, actual_result || '', comments || '', linked_bug_id || null);

    const savedAttachments = saveAttachments(db, req.files, req.params.id, execId, req.user.id);

    let finalLinkedBugId = linked_bug_id || tc.linked_bug_id || null;

    // Auto-create a bug on Fail if requested and none is linked yet
    const shouldAutoCreate = String(auto_create_bug) === 'true' && status === 'Fail' && !finalLinkedBugId;
    let createdBug = null;
    if (shouldAutoCreate) {
      const bugId = uuidv4();
      const maxNum = db.prepare('SELECT COALESCE(MAX(bug_number), 0) as max_num FROM bugs WHERE project_id = ?').get(tc.project_id);
      const bugNumber = (maxNum?.max_num || 0) + 1;

      db.prepare(`
        INSERT INTO bugs (
          id, bug_number, project_id, summary, description, steps_to_reproduce,
          expected_result, actual_result, reporter_id, assignee_id, priority, severity, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bugId, bugNumber, tc.project_id,
        `[TC-${tc.tc_number}] ${tc.title}`,
        tc.description || '',
        tc.steps || '',
        tc.expected_result || '',
        actual_result || tc.actual_result || '',
        req.user.id,
        tc.assignee_id || null,
        tc.priority || 'Medium',
        tc.severity || 'Major',
        'Open'
      );

      // Copy execution attachments to bug_attachments so evidence is visible on the bug
      if (savedAttachments.length > 0) {
        const bstmt = db.prepare(`
          INSERT INTO bug_attachments (id, bug_id, filename, original_name, mimetype, size, data)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const a of savedAttachments) {
          bstmt.run(uuidv4(), bugId, a.filename, a.original_name, a.mimetype, a.size, a.buffer);
        }
      }

      try {
        db.prepare(`
          INSERT INTO audit_log (id, entity_type, entity_id, action, field_changed, old_value, new_value, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), 'bug', bugId, 'created', null, null, `Auto-created from failed TC-${tc.tc_number}`, req.user.id);
      } catch (e) { /* ignore */ }

      if (tc.assignee_id && tc.assignee_id !== req.user.id) {
        notifyUser(db, tc.assignee_id, 'bug_assigned', 'Bug Assigned',
          `Bug "[TC-${tc.tc_number}] ${tc.title}" has been assigned to you`, 'bug', bugId, reqBaseUrl(req));
      }

      // Update execution row to reference new bug
      db.prepare('UPDATE test_executions SET linked_bug_id = ? WHERE id = ?').run(bugId, execId);
      finalLinkedBugId = bugId;
      createdBug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(bugId);
    }

    db.prepare(`
      UPDATE test_cases
      SET status = ?, actual_result = ?, linked_bug_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, actual_result || '', finalLinkedBugId, req.params.id);

    const execution = db.prepare(`
      SELECT e.*, u.first_name || ' ' || u.last_name as executed_by_name
      FROM test_executions e LEFT JOIN users u ON e.executed_by = u.id
      WHERE e.id = ?
    `).get(execId);

    res.status(201).json({ execution, created_bug: createdBug, linked_bug_id: finalLinkedBugId });
  } catch (err) {
    console.error('execute error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/cases/:id/link-bug', authenticate, isCaseMember, (req, res) => {
  try {
    const { bug_id } = req.body;
    if (!bug_id) return res.status(400).json({ error: 'bug_id is required' });
    const db = getDb();
    const bug = db.prepare('SELECT id FROM bugs WHERE id = ?').get(bug_id);
    if (!bug) return res.status(404).json({ error: 'Bug not found' });
    db.prepare(`UPDATE test_cases SET linked_bug_id = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(bug_id, req.params.id);
    const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
    res.json(tc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/cases/:id/create-bug', authenticate, upload.array('attachments', 10), isCaseMember, (req, res) => {
  try {
    const db = getDb();
    const tc = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(req.params.id);
    if (!tc) return res.status(404).json({ error: 'Test case not found' });

    const {
      summary, description, steps_to_reproduce, expected_result, actual_result,
      priority, severity, assignee_id,
    } = req.body;

    const bugId = uuidv4();
    const maxNum = db.prepare('SELECT COALESCE(MAX(bug_number), 0) as max_num FROM bugs WHERE project_id = ?').get(tc.project_id);
    const bugNumber = (maxNum?.max_num || 0) + 1;

    db.prepare(`
      INSERT INTO bugs (
        id, bug_number, project_id, summary, description, steps_to_reproduce,
        expected_result, actual_result, reporter_id, assignee_id, priority, severity, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bugId, bugNumber, tc.project_id,
      summary || `[TC-${tc.tc_number}] ${tc.title}`,
      description || tc.description || '',
      steps_to_reproduce || tc.steps || '',
      expected_result || tc.expected_result || '',
      actual_result || tc.actual_result || '',
      req.user.id,
      assignee_id || tc.assignee_id || null,
      priority || tc.priority || 'Medium',
      severity || tc.severity || 'Major',
      'Open'
    );

    // Attach any uploaded files to the bug
    if (req.files && req.files.length > 0) {
      const bstmt = db.prepare(`
        INSERT INTO bug_attachments (id, bug_id, filename, original_name, mimetype, size, data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const f of req.files) {
        const ext = path.extname(f.originalname);
        const filename = `${uuidv4()}${ext}`;
        bstmt.run(uuidv4(), bugId, filename, f.originalname, f.mimetype, f.size, f.buffer);
      }
    }

    db.prepare(`UPDATE test_cases SET linked_bug_id = ?, status = 'Fail', updated_at = datetime('now') WHERE id = ?`)
      .run(bugId, req.params.id);

    if (assignee_id && assignee_id !== req.user.id) {
      notifyUser(db, assignee_id, 'bug_assigned', 'Bug Assigned',
        `Bug "${summary}" has been assigned to you`, 'bug', bugId, reqBaseUrl(req));
    }

    const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(bugId);
    res.status(201).json(bug);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Stats ----------

router.get('/stats/project/:projectId', authenticate, isProjectMember, (req, res) => {
  try {
    const db = getDb();
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_cases,
        SUM(CASE WHEN status = 'Pass' THEN 1 ELSE 0 END) as pass_count,
        SUM(CASE WHEN status = 'Fail' THEN 1 ELSE 0 END) as fail_count,
        SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END) as blocked_count,
        SUM(CASE WHEN status = 'Not Run' THEN 1 ELSE 0 END) as notrun_count,
        SUM(CASE WHEN case_type = 'Positive' THEN 1 ELSE 0 END) as positive_count,
        SUM(CASE WHEN case_type = 'Negative' THEN 1 ELSE 0 END) as negative_count,
        SUM(CASE WHEN case_type = 'Edge' THEN 1 ELSE 0 END) as edge_count
      FROM test_cases WHERE project_id = ?
    `).get(req.params.projectId);

    const scenarioCount = db.prepare('SELECT COUNT(*) as c FROM test_scenarios WHERE project_id = ?').get(req.params.projectId).c;

    res.json({
      scenario_count: scenarioCount,
      total_cases: stats?.total_cases || 0,
      pass_count: stats?.pass_count || 0,
      fail_count: stats?.fail_count || 0,
      blocked_count: stats?.blocked_count || 0,
      notrun_count: stats?.notrun_count || 0,
      positive_count: stats?.positive_count || 0,
      negative_count: stats?.negative_count || 0,
      edge_count: stats?.edge_count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my/summary', authenticate, (req, res) => {
  try {
    const db = getDb();
    let projects;
    if (req.user.role === 'Admin') {
      projects = db.prepare('SELECT id, name FROM projects').all();
    } else {
      projects = db.prepare(`
        SELECT p.id, p.name FROM projects p
        INNER JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
      `).all(req.user.id);
    }

    const rows = projects.map(p => {
      const s = db.prepare(`
        SELECT
          COUNT(*) as total_cases,
          SUM(CASE WHEN status = 'Pass' THEN 1 ELSE 0 END) as pass_count,
          SUM(CASE WHEN status = 'Fail' THEN 1 ELSE 0 END) as fail_count,
          SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END) as blocked_count,
          SUM(CASE WHEN status = 'Not Run' THEN 1 ELSE 0 END) as notrun_count
        FROM test_cases WHERE project_id = ?
      `).get(p.id);
      const sc = db.prepare('SELECT COUNT(*) as c FROM test_scenarios WHERE project_id = ?').get(p.id).c;
      return { ...p, scenario_count: sc, ...s };
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
