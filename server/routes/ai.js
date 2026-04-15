const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');
const { getDb } = require('../database');

const router = express.Router();

const MODEL = 'claude-opus-4-5';
const MAX_TOKENS = 1024;

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function buildUserContext(user) {
  const db = getDb();
  const isAdmin = user.role === 'Admin';

  const projects = isAdmin
    ? db.prepare(`SELECT id, name, status, description FROM projects ORDER BY updated_at DESC LIMIT 25`).all()
    : db.prepare(`
        SELECT p.id, p.name, p.status, p.description FROM projects p
        INNER JOIN project_members pm ON pm.project_id = p.id
        WHERE pm.user_id = ? ORDER BY p.updated_at DESC LIMIT 25
      `).all(user.id);

  const assignedBugs = db.prepare(`
    SELECT id, bug_number, summary, status, priority, severity, project_id, due_date
    FROM bugs WHERE assignee_id = ? ORDER BY updated_at DESC LIMIT 25
  `).all(user.id);

  const reportedBugs = db.prepare(`
    SELECT id, bug_number, summary, status, priority, project_id
    FROM bugs WHERE reporter_id = ? ORDER BY updated_at DESC LIMIT 15
  `).all(user.id);

  const assignedTasks = db.prepare(`
    SELECT id, title, status, priority, due_date, project_id
    FROM tasks WHERE assignee_id = ? ORDER BY updated_at DESC LIMIT 25
  `).all(user.id);

  const workTasks = db.prepare(`
    SELECT id, title, status, priority, deadline FROM work_tasks
    WHERE assigned_to = ? ORDER BY updated_at DESC LIMIT 15
  `).all(user.id);

  const unreadNotifs = db.prepare(`
    SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0
  `).get(user.id).c;

  return { projects, assignedBugs, reportedBugs, assignedTasks, workTasks, unreadNotifs };
}

const SYSTEM_PROMPT_STATIC = `You are the AI Assistant for **Glimmora DefectDesk** — a bug tracking and work management platform built by Glimmora International.

## Your role
You help users of Glimmora DefectDesk with questions and tasks that are **directly related to the platform's features**:
- Bug tracking (reporting, triaging, statuses, priorities, severities, assignments)
- Task management (creating, assigning, statuses, due dates, linking to bugs)
- Projects and project membership
- Workspace work tasks and daily updates
- Notifications and email assignment alerts
- User roles (Admin, Standard User) and permissions
- QA / dev / PM workflows inside DefectDesk
- Interpreting the user's own bugs, tasks, projects shown in the context block
- Writing clear bug reports, reproduction steps, test plans, status summaries
- Guidance on how to use DefectDesk features

## Strict scope rule (important)
Before answering, verify the user's prompt is related to Glimmora DefectDesk or its features/data. If the prompt is unrelated (e.g. general coding help unrelated to bug tracking, trivia, personal questions, other software, math homework, jokes, celebrity questions), you MUST politely refuse with:

"I'm the Glimmora DefectDesk assistant, so I can only help with questions related to DefectDesk — bugs, tasks, projects, workspace, notifications, or how to use the platform. Could you rephrase your question in that context?"

Do not answer off-topic prompts even if the user insists.

## Style
- Be concise and practical.
- When referencing the user's data, cite specific bug numbers, task titles, or project names from the context block.
- Use markdown formatting (bold, lists) where it helps readability.
- Never invent bug numbers, task IDs, or project data that isn't in the context.
- If the user asks to *perform* an action (e.g. "assign bug 42 to John"), explain clearly that you can guide them but the user must perform the action in the UI — you do not have write access to the database.

Always brand yourself as the **Glimmora DefectDesk Assistant**.`;

router.post('/chat', authenticate, async (req, res) => {
  const anthropic = getClient();
  if (!anthropic) {
    return res.status(503).json({
      error: 'AI assistant is not configured. Add ANTHROPIC_API_KEY to server .env and restart.',
    });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: 'message too long' });
  }

  let ctx;
  try {
    ctx = buildUserContext(req.user);
  } catch (err) {
    console.error('[AI] context build failed:', err);
    ctx = { projects: [], assignedBugs: [], reportedBugs: [], assignedTasks: [], workTasks: [], unreadNotifs: 0 };
  }

  const userContextBlock = `## Current user
- Name: ${req.user.first_name} ${req.user.last_name}
- Email: ${req.user.email}
- Role: ${req.user.role}
- Unread notifications: ${ctx.unreadNotifs}

## Projects the user can see (${ctx.projects.length})
${ctx.projects.map(p => `- [${p.id.slice(0,8)}] ${p.name} — ${p.status}${p.description ? ` (${String(p.description).slice(0,80)})` : ''}`).join('\n') || '_none_'}

## Bugs assigned to the user (${ctx.assignedBugs.length})
${ctx.assignedBugs.map(b => `- #${b.bug_number || b.id.slice(0,6)} ${b.summary} — ${b.status} / ${b.priority} / ${b.severity}${b.due_date ? ` / due ${b.due_date}` : ''}`).join('\n') || '_none_'}

## Bugs reported by the user (${ctx.reportedBugs.length})
${ctx.reportedBugs.map(b => `- #${b.bug_number || b.id.slice(0,6)} ${b.summary} — ${b.status} / ${b.priority}`).join('\n') || '_none_'}

## Tasks assigned to the user (${ctx.assignedTasks.length})
${ctx.assignedTasks.map(t => `- ${t.title} — ${t.status} / ${t.priority}${t.due_date ? ` / due ${t.due_date}` : ''}`).join('\n') || '_none_'}

## Workspace work tasks (${ctx.workTasks.length})
${ctx.workTasks.map(t => `- ${t.title} — ${t.status} / ${t.priority} / deadline ${t.deadline}`).join('\n') || '_none_'}`;

  const messages = [];
  if (Array.isArray(history)) {
    for (const m of history.slice(-10)) {
      if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') {
        messages.push({ role: m.role, content: m.content });
      }
    }
  }
  messages.push({ role: 'user', content: message });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: SYSTEM_PROMPT_STATIC, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: userContextBlock },
      ],
      messages,
    });

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
    res.status(status).json({
      error: err?.message || 'AI request failed',
    });
  }
});

module.exports = router;
