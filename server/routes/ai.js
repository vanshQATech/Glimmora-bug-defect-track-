const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const { getDb } = require('../database');

const router = express.Router();

const MODEL = 'claude-opus-4-5';
const MAX_TOKENS = 1500;
const MAX_TOOL_ITERATIONS = 6;

const LEAD_ROLES = ['Admin', 'Project Manager', 'Team Lead'];
const isLead = (u) => LEAD_ROLES.includes(u?.role);

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// ---------- helpers ----------
function visibleProjectIds(user) {
  const db = getDb();
  if (isLead(user)) return null; // null => no restriction
  const rows = db.prepare('SELECT project_id FROM project_members WHERE user_id = ?').all(user.id);
  return rows.map(r => r.project_id);
}

function projectFilter(alias, user) {
  const ids = visibleProjectIds(user);
  if (ids === null) return { sql: '', params: [] };
  if (ids.length === 0) return { sql: ` AND ${alias}.project_id = '__none__'`, params: [] };
  const placeholders = ids.map(() => '?').join(',');
  return { sql: ` AND ${alias}.project_id IN (${placeholders})`, params: ids };
}

function findUserByName(name) {
  const db = getDb();
  const q = `%${name.toLowerCase()}%`;
  return db.prepare(`
    SELECT id, first_name, last_name, email, role, is_active
    FROM users
    WHERE LOWER(first_name || ' ' || last_name) LIKE ?
       OR LOWER(email) LIKE ?
       OR LOWER(first_name) LIKE ?
       OR LOWER(last_name) LIKE ?
    ORDER BY is_active DESC, first_name
    LIMIT 5
  `).all(q, q, q, q);
}

function findProjectByNameOrId(value) {
  const db = getDb();
  const direct = db.prepare('SELECT id, name, status, description FROM projects WHERE id = ?').get(value);
  if (direct) return direct;
  const q = `%${String(value).toLowerCase()}%`;
  return db.prepare(`
    SELECT id, name, status, description FROM projects
    WHERE LOWER(name) LIKE ? ORDER BY updated_at DESC LIMIT 1
  `).get(q);
}

// ---------- tool definitions ----------
const TOOLS = [
  {
    name: 'list_projects',
    description: 'List projects the current user can see. Returns id, name, status, member count, open bug count, pending task count for each project.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_employees',
    description: 'List employees in the system. Optional name/email filter. Lead/Admin/PM only — standard users will get permission_denied.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional substring to match against name or email' },
        active_only: { type: 'boolean', description: 'Default true' },
      },
    },
  },
  {
    name: 'find_employee',
    description: 'Look up a single employee by name or email and return their id, role and project memberships. Useful before calling other tools that need an employee_id.',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    name: 'get_daily_updates',
    description: 'Fetch daily activity updates (employee work updates with title, project, work done, status, progress %, remarks, next action). Standard users can only fetch their own; leads can fetch for any employee.',
    input_schema: {
      type: 'object',
      properties: {
        employee_name: { type: 'string', description: 'Employee full name or partial name. Omit to query the current user.' },
        from: { type: 'string', description: 'ISO date YYYY-MM-DD (inclusive)' },
        to: { type: 'string', description: 'ISO date YYYY-MM-DD (inclusive)' },
        project_name: { type: 'string', description: 'Optional project name filter' },
        status: { type: 'string', enum: ['Completed', 'In Progress', 'Blocked'] },
        limit: { type: 'integer', description: 'Default 25, max 100' },
      },
    },
  },
  {
    name: 'project_summary',
    description: 'Return a full snapshot of a single project: counts of bugs/tasks/test_cases by status, member list, recent activity updates.',
    input_schema: {
      type: 'object',
      properties: { project: { type: 'string', description: 'Project name or id' } },
      required: ['project'],
    },
  },
  {
    name: 'count_per_project',
    description: 'Return a per-project count for the chosen metric. Use this for questions like "how many cases per project" or "how many open bugs per project".',
    input_schema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: ['bugs', 'open_bugs', 'tasks', 'pending_tasks', 'completed_tasks', 'test_cases', 'daily_updates'],
        },
      },
      required: ['metric'],
    },
  },
  {
    name: 'count_per_employee',
    description: 'Return a per-employee count for the chosen metric. Use this for questions like "how many completed tasks does each employee have". Lead-only for cross-employee metrics.',
    input_schema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: ['completed_updates', 'in_progress_updates', 'blocked_updates', 'open_bugs_assigned', 'pending_tasks_assigned'],
        },
        from: { type: 'string' },
        to: { type: 'string' },
      },
      required: ['metric'],
    },
  },
  {
    name: 'team_progress',
    description: 'Aggregate team activity for a period: total updates, completed/in-progress/blocked counts, top contributors, average progress %. Lead-only.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        project_name: { type: 'string' },
      },
    },
  },
  {
    name: 'top_projects',
    description: 'Return the top N projects ranked by a metric. Use for "which project has the most pending tasks" type questions.',
    input_schema: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: ['open_bugs', 'pending_tasks', 'completed_tasks', 'daily_updates', 'test_cases'] },
        limit: { type: 'integer', description: 'Default 5' },
        order: { type: 'string', enum: ['desc', 'asc'], description: 'Default desc' },
      },
      required: ['metric'],
    },
  },
];

// ---------- tool implementations ----------
function tool_list_projects(_args, user) {
  const db = getDb();
  const ids = visibleProjectIds(user);
  let where = '';
  let params = [];
  if (ids !== null) {
    if (ids.length === 0) return { projects: [] };
    where = `WHERE p.id IN (${ids.map(() => '?').join(',')})`;
    params = ids;
  }
  const rows = db.prepare(`
    SELECT p.id, p.name, p.status, p.description,
      (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
      (SELECT COUNT(*) FROM bugs b WHERE b.project_id = p.id AND b.status != 'Approved by PM') AS open_bugs,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'Done') AS pending_tasks
    FROM projects p
    ${where}
    ORDER BY p.updated_at DESC
    LIMIT 50
  `).all(...params);
  return { projects: rows };
}

function tool_list_employees(args, user) {
  if (!isLead(user)) return { error: 'permission_denied: only Admin/Project Manager/Team Lead can list employees' };
  const db = getDb();
  const activeOnly = args.active_only !== false;
  const query = args.query ? String(args.query).toLowerCase() : null;
  let sql = `SELECT id, first_name || ' ' || last_name AS name, email, role, is_active FROM users WHERE 1=1`;
  const params = [];
  if (activeOnly) sql += ' AND is_active = 1';
  if (query) {
    sql += ' AND (LOWER(first_name || \' \' || last_name) LIKE ? OR LOWER(email) LIKE ?)';
    params.push(`%${query}%`, `%${query}%`);
  }
  sql += ' ORDER BY first_name, last_name LIMIT 50';
  return { employees: db.prepare(sql).all(...params) };
}

function tool_find_employee(args, _user) {
  const matches = findUserByName(args.name || '');
  if (matches.length === 0) return { found: false };
  const db = getDb();
  return {
    found: true,
    matches: matches.map(u => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`,
      email: u.email,
      role: u.role,
      is_active: !!u.is_active,
      projects: db.prepare(`
        SELECT p.id, p.name FROM project_members pm
        JOIN projects p ON pm.project_id = p.id
        WHERE pm.user_id = ? ORDER BY p.name
      `).all(u.id),
    })),
  };
}

function tool_get_daily_updates(args, user) {
  const db = getDb();
  let targetUserId = user.id;
  let targetName = `${user.first_name} ${user.last_name}`;

  if (args.employee_name) {
    const match = findUserByName(args.employee_name)[0];
    if (!match) return { error: `no employee found matching "${args.employee_name}"` };
    if (match.id !== user.id && !isLead(user)) {
      return { error: 'permission_denied: standard users can only view their own updates' };
    }
    targetUserId = match.id;
    targetName = `${match.first_name} ${match.last_name}`;
  }

  let projectId = null;
  if (args.project_name) {
    const p = findProjectByNameOrId(args.project_name);
    if (!p) return { error: `no project found matching "${args.project_name}"` };
    projectId = p.id;
  }

  const limit = Math.min(Math.max(parseInt(args.limit, 10) || 25, 1), 100);
  let sql = `
    SELECT a.update_date, a.title, a.module, a.tasks_completed, a.tasks_in_progress,
           a.tasks_planned, a.status, a.progress_percent, a.remarks, a.next_action,
           a.blockers, p.name AS project_name
    FROM activity_updates a
    LEFT JOIN projects p ON a.project_id = p.id
    WHERE a.user_id = ?
  `;
  const params = [targetUserId];
  if (args.from) { sql += ' AND a.update_date >= ?'; params.push(args.from); }
  if (args.to) { sql += ' AND a.update_date <= ?'; params.push(args.to); }
  if (projectId) { sql += ' AND a.project_id = ?'; params.push(projectId); }
  if (args.status) { sql += ' AND a.status = ?'; params.push(args.status); }
  sql += ' ORDER BY a.update_date DESC, a.created_at DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  return { employee: targetName, count: rows.length, updates: rows };
}

function tool_project_summary(args, user) {
  const db = getDb();
  const project = findProjectByNameOrId(args.project);
  if (!project) return { error: `no project found matching "${args.project}"` };

  const ids = visibleProjectIds(user);
  if (ids !== null && !ids.includes(project.id)) {
    return { error: 'permission_denied: you are not a member of this project' };
  }

  const bugStatus = db.prepare(`SELECT status, COUNT(*) AS c FROM bugs WHERE project_id = ? GROUP BY status`).all(project.id);
  const taskStatus = db.prepare(`SELECT status, COUNT(*) AS c FROM tasks WHERE project_id = ? GROUP BY status`).all(project.id);
  let testCaseStatus = [];
  try {
    testCaseStatus = db.prepare(`SELECT status, COUNT(*) AS c FROM test_cases WHERE project_id = ? GROUP BY status`).all(project.id);
  } catch (_) { /* table may not exist */ }
  const members = db.prepare(`
    SELECT u.first_name || ' ' || u.last_name AS name, u.role
    FROM project_members pm JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ? ORDER BY u.first_name
  `).all(project.id);
  const recentUpdates = db.prepare(`
    SELECT a.update_date, u.first_name || ' ' || u.last_name AS employee, a.title, a.status, a.progress_percent
    FROM activity_updates a JOIN users u ON a.user_id = u.id
    WHERE a.project_id = ? ORDER BY a.update_date DESC LIMIT 10
  `).all(project.id);

  return {
    project: { id: project.id, name: project.name, status: project.status, description: project.description },
    bugs_by_status: Object.fromEntries(bugStatus.map(r => [r.status, r.c])),
    tasks_by_status: Object.fromEntries(taskStatus.map(r => [r.status, r.c])),
    test_cases_by_status: Object.fromEntries(testCaseStatus.map(r => [r.status, r.c])),
    members,
    recent_updates: recentUpdates,
  };
}

function tool_count_per_project(args, user) {
  const db = getDb();
  const ids = visibleProjectIds(user);
  let projectFilterSql = '';
  let projectFilterParams = [];
  if (ids !== null) {
    if (ids.length === 0) return { results: [] };
    projectFilterSql = ` AND p.id IN (${ids.map(() => '?').join(',')})`;
    projectFilterParams = ids;
  }

  const queries = {
    bugs:           `SELECT p.name AS project, COUNT(b.id) AS count FROM projects p LEFT JOIN bugs b ON b.project_id = p.id WHERE 1=1${projectFilterSql} GROUP BY p.id ORDER BY count DESC`,
    open_bugs:      `SELECT p.name AS project, COUNT(b.id) AS count FROM projects p LEFT JOIN bugs b ON b.project_id = p.id AND b.status != 'Approved by PM' WHERE 1=1${projectFilterSql} GROUP BY p.id ORDER BY count DESC`,
    tasks:          `SELECT p.name AS project, COUNT(t.id) AS count FROM projects p LEFT JOIN tasks t ON t.project_id = p.id WHERE 1=1${projectFilterSql} GROUP BY p.id ORDER BY count DESC`,
    pending_tasks:  `SELECT p.name AS project, COUNT(t.id) AS count FROM projects p LEFT JOIN tasks t ON t.project_id = p.id AND t.status != 'Done' WHERE 1=1${projectFilterSql} GROUP BY p.id ORDER BY count DESC`,
    completed_tasks:`SELECT p.name AS project, COUNT(t.id) AS count FROM projects p LEFT JOIN tasks t ON t.project_id = p.id AND t.status = 'Done' WHERE 1=1${projectFilterSql} GROUP BY p.id ORDER BY count DESC`,
    test_cases:     `SELECT p.name AS project, COUNT(tc.id) AS count FROM projects p LEFT JOIN test_cases tc ON tc.project_id = p.id WHERE 1=1${projectFilterSql} GROUP BY p.id ORDER BY count DESC`,
    daily_updates:  `SELECT p.name AS project, COUNT(a.id) AS count FROM projects p LEFT JOIN activity_updates a ON a.project_id = p.id WHERE 1=1${projectFilterSql} GROUP BY p.id ORDER BY count DESC`,
  };
  const sql = queries[args.metric];
  if (!sql) return { error: `unknown metric "${args.metric}"` };
  try {
    return { metric: args.metric, results: db.prepare(sql).all(...projectFilterParams) };
  } catch (err) {
    return { error: err.message };
  }
}

function tool_count_per_employee(args, user) {
  if (!isLead(user)) return { error: 'permission_denied: only leads can run cross-employee aggregations' };
  const db = getDb();
  const dateClause = [];
  const dateParams = [];
  if (args.from) { dateClause.push('update_date >= ?'); dateParams.push(args.from); }
  if (args.to) { dateClause.push('update_date <= ?'); dateParams.push(args.to); }
  const whereDate = dateClause.length ? ` AND ${dateClause.join(' AND ')}` : '';

  let sql;
  let params = [];
  switch (args.metric) {
    case 'completed_updates':
      sql = `SELECT u.first_name || ' ' || u.last_name AS employee, COUNT(a.id) AS count
             FROM users u LEFT JOIN activity_updates a ON a.user_id = u.id AND a.status = 'Completed'${whereDate}
             WHERE u.is_active = 1 GROUP BY u.id ORDER BY count DESC`;
      params = dateParams;
      break;
    case 'in_progress_updates':
      sql = `SELECT u.first_name || ' ' || u.last_name AS employee, COUNT(a.id) AS count
             FROM users u LEFT JOIN activity_updates a ON a.user_id = u.id AND a.status = 'In Progress'${whereDate}
             WHERE u.is_active = 1 GROUP BY u.id ORDER BY count DESC`;
      params = dateParams;
      break;
    case 'blocked_updates':
      sql = `SELECT u.first_name || ' ' || u.last_name AS employee, COUNT(a.id) AS count
             FROM users u LEFT JOIN activity_updates a ON a.user_id = u.id AND a.status = 'Blocked'${whereDate}
             WHERE u.is_active = 1 GROUP BY u.id ORDER BY count DESC`;
      params = dateParams;
      break;
    case 'open_bugs_assigned':
      sql = `SELECT u.first_name || ' ' || u.last_name AS employee, COUNT(b.id) AS count
             FROM users u LEFT JOIN bugs b ON b.assignee_id = u.id AND b.status != 'Approved by PM'
             WHERE u.is_active = 1 GROUP BY u.id ORDER BY count DESC`;
      break;
    case 'pending_tasks_assigned':
      sql = `SELECT u.first_name || ' ' || u.last_name AS employee, COUNT(t.id) AS count
             FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status != 'Done'
             WHERE u.is_active = 1 GROUP BY u.id ORDER BY count DESC`;
      break;
    default:
      return { error: `unknown metric "${args.metric}"` };
  }
  try {
    return { metric: args.metric, results: db.prepare(sql).all(...params) };
  } catch (err) {
    return { error: err.message };
  }
}

function tool_team_progress(args, user) {
  if (!isLead(user)) return { error: 'permission_denied: leads only' };
  const db = getDb();
  const where = ['1=1'];
  const params = [];
  if (args.from) { where.push('a.update_date >= ?'); params.push(args.from); }
  if (args.to) { where.push('a.update_date <= ?'); params.push(args.to); }
  if (args.project_name) {
    const p = findProjectByNameOrId(args.project_name);
    if (!p) return { error: `no project matches "${args.project_name}"` };
    where.push('a.project_id = ?');
    params.push(p.id);
  }
  const W = where.join(' AND ');

  const totals = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
           SUM(CASE WHEN status = 'Blocked' THEN 1 ELSE 0 END) AS blocked,
           ROUND(AVG(COALESCE(progress_percent, 0))) AS avg_progress
    FROM activity_updates a WHERE ${W}
  `).get(...params);

  const top = db.prepare(`
    SELECT u.first_name || ' ' || u.last_name AS employee, COUNT(a.id) AS updates,
           SUM(CASE WHEN a.status = 'Completed' THEN 1 ELSE 0 END) AS completed
    FROM activity_updates a JOIN users u ON a.user_id = u.id
    WHERE ${W} GROUP BY a.user_id ORDER BY completed DESC, updates DESC LIMIT 10
  `).all(...params);

  return { period: { from: args.from || null, to: args.to || null }, totals, top_contributors: top };
}

function tool_top_projects(args, user) {
  const out = tool_count_per_project({ metric: args.metric }, user);
  if (out.error) return out;
  const limit = Math.min(Math.max(parseInt(args.limit, 10) || 5, 1), 25);
  let rows = out.results;
  if (args.order === 'asc') rows = [...rows].sort((a, b) => a.count - b.count);
  return { metric: args.metric, top: rows.slice(0, limit) };
}

const TOOL_HANDLERS = {
  list_projects: tool_list_projects,
  list_employees: tool_list_employees,
  find_employee: tool_find_employee,
  get_daily_updates: tool_get_daily_updates,
  project_summary: tool_project_summary,
  count_per_project: tool_count_per_project,
  count_per_employee: tool_count_per_employee,
  team_progress: tool_team_progress,
  top_projects: tool_top_projects,
};

function runTool(name, args, user) {
  const handler = TOOL_HANDLERS[name];
  if (!handler) return { error: `unknown tool: ${name}` };
  try {
    return handler(args || {}, user);
  } catch (err) {
    console.error(`[AI tool ${name}] error:`, err);
    return { error: err.message || 'tool execution failed' };
  }
}

// ---------- system prompt ----------
const SYSTEM_PROMPT = `You are the AI Assistant for **Glimmora DefectDesk** — a bug tracking, task management and team activity platform built by Glimmora International.

## Your role
You answer questions about the platform's data using the **tools** provided. You can read projects, employees, bugs, tasks, test cases, and daily activity updates, and you can compute aggregations (per-project counts, per-employee counts, team progress, top-N rankings).

## How to answer data questions
1. **Decide which tool fits.** For "give me update for employee Ravi" use \`get_daily_updates\` with employee_name. For "how many cases per project" use \`count_per_project\` with metric=test_cases. For "which project has the most pending tasks" use \`top_projects\` with metric=pending_tasks. For team-wide questions use \`team_progress\`.
2. **Resolve names first.** If the user names a person you haven't already looked up, you may call \`find_employee\` first to confirm spelling and disambiguate.
3. **Use multiple tools if needed**, but stop calling tools as soon as you have what you need.
4. **Never invent data.** If a tool returns no rows or an error like \`permission_denied\`, say so plainly. Don't guess names, counts, or IDs that weren't returned by a tool.

## Style
- Be concise. Lead with the answer, then back it up with the supporting numbers.
- Format lists and counts in clean markdown.
- Cite specific employee names, project names, and counts from tool results.
- If a tool returns \`permission_denied\`, briefly explain who can run that query (e.g. "only Admin / Project Manager / Team Lead can list all employees").

## Strict scope rule
Only answer questions about Glimmora DefectDesk data and features. If the user asks something unrelated (general coding help, trivia, jokes, other software), refuse politely with:

"I'm the Glimmora DefectDesk assistant, so I can only help with questions related to DefectDesk — projects, bugs, tasks, daily updates, team progress, or how to use the platform."

Always brand yourself as the **Glimmora DefectDesk Assistant**.`;

// ---------- chat endpoint ----------
router.post('/chat', authenticate, async (req, res) => {
  const anthropic = getClient();
  if (!anthropic) {
    return res.status(503).json({
      error: 'AI assistant is not configured. Add ANTHROPIC_API_KEY to server .env and restart.',
    });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message is required' });
  if (message.length > 4000) return res.status(400).json({ error: 'message too long' });

  const messages = [];
  if (Array.isArray(history)) {
    for (const m of history.slice(-10)) {
      if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }
  messages.push({ role: 'user', content: message });

  const userHeader = `## Current user
- Name: ${req.user.first_name} ${req.user.last_name}
- Email: ${req.user.email}
- Role: ${req.user.role}
- Is lead (can query other employees): ${isLead(req.user) ? 'yes' : 'no'}`;

  try {
    let response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: userHeader },
      ],
      tools: TOOLS,
      messages,
    });

    let iterations = 0;
    while (response.stop_reason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResultBlocks = toolUseBlocks.map(tu => {
        const result = runTool(tu.name, tu.input, req.user);
        return {
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result).slice(0, 12000),
        };
      });

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResultBlocks });

      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: userHeader },
        ],
        tools: TOOLS,
        messages,
      });
    }

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    res.json({
      reply: text || "I couldn't generate a response. Please try again.",
      usage: response.usage,
    });
  } catch (err) {
    console.error('[AI] Claude API error:', err?.message || err);
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'AI request failed' });
  }
});

// ---------- generate test cases endpoint ----------
const GENERATE_TC_SYSTEM = `You are a QA engineer assistant. Generate comprehensive test cases based on the user's description.

Respond with ONLY valid JSON in this exact format, no other text:
{
  "test_cases": [
    {
      "title": "Descriptive test case title",
      "description": "Brief description of what this test verifies",
      "preconditions": "What must be true before running (empty string if none)",
      "steps": "1. Step one\\n2. Step two\\n3. Step three",
      "expected_result": "What should happen after the steps",
      "priority": "Critical|High|Medium|Low",
      "severity": "Critical|Major|Minor|Trivial",
      "case_type": "Positive|Negative|Edge"
    }
  ]
}

Rules:
- Generate 4-8 test cases covering positive, negative, and edge cases
- Steps must be numbered and clear
- Expected results must be specific and verifiable
- Use Critical/High priority for core flows, Medium/Low for edge cases
- Include at least one Positive, one Negative, and one Edge case
- Keep titles concise (under 80 chars)`;

router.post('/generate-test-cases', authenticate, async (req, res) => {
  const anthropic = getClient();
  if (!anthropic) {
    return res.status(503).json({ error: 'AI assistant is not configured. Add ANTHROPIC_API_KEY to server .env.' });
  }

  const { prompt, scenario_name } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt is required' });
  if (prompt.length > 2000) return res.status(400).json({ error: 'prompt too long (max 2000 chars)' });

  const userMsg = scenario_name
    ? `Generate test cases for: ${prompt}\n\nScenario context: ${scenario_name}`
    : `Generate test cases for: ${prompt}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: GENERATE_TC_SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    });

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');

    let testCases;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      testCases = parsed.test_cases || [];
    } catch (_) {
      return res.status(500).json({ error: 'AI returned unexpected format. Please try again.' });
    }

    const VALID_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
    const VALID_SEVERITIES = ['Critical', 'Major', 'Minor', 'Trivial'];
    const VALID_TYPES = ['Positive', 'Negative', 'Edge'];

    const cleaned = testCases
      .map(tc => ({
        title: String(tc.title || '').trim().slice(0, 200),
        description: String(tc.description || '').trim(),
        preconditions: String(tc.preconditions || '').trim(),
        steps: String(tc.steps || '').trim(),
        expected_result: String(tc.expected_result || '').trim(),
        priority: VALID_PRIORITIES.includes(tc.priority) ? tc.priority : 'Medium',
        severity: VALID_SEVERITIES.includes(tc.severity) ? tc.severity : 'Major',
        case_type: VALID_TYPES.includes(tc.case_type) ? tc.case_type : 'Positive',
      }))
      .filter(tc => tc.title);

    res.json({ test_cases: cleaned });
  } catch (err) {
    console.error('[AI generate-test-cases] error:', err?.message || err);
    res.status(err?.status || 500).json({ error: err?.message || 'AI request failed' });
  }
});

module.exports = router;
