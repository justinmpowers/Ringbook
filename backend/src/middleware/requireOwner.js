// Admin accounts are scoped to only the guestbooks they created - managing
// the roster of admin accounts itself is a broader capability that should
// stay with the instance owner (the bootstrap account), not every admin.
// Must run after requireAdmin, which populates req.user.
function requireOwner(req, res, next) {
  if (!req.user || !req.user.is_owner) {
    res.status(403).json({ error: 'Only the instance owner can manage admin accounts' });
    return;
  }
  next();
}

module.exports = requireOwner;
