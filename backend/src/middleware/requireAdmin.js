function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
    return;
  }
  res.status(401).json({ error: 'Not authenticated' });
}

module.exports = requireAdmin;
