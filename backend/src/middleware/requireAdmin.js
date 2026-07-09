const db = require('../db');

function requireAdmin(req, res, next) {
  const userId = req.session && req.session.userId;
  const user = userId ? db.prepare('SELECT id, username, is_owner FROM users WHERE id = ?').get(userId) : null;

  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  req.user = user;
  next();
}

module.exports = requireAdmin;
