const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = getDb().prepare('SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = ?').get(decoded.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account inactive or not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function isProjectMember(req, res, next) {
  const projectId = req.params.projectId || req.body.project_id;
  if (!projectId) return next();

  if (req.user.role === 'Admin') return next();

  const member = getDb().prepare(
    'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, req.user.id);

  if (!member) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }
  next();
}

module.exports = { authenticate, authorize, isProjectMember };
