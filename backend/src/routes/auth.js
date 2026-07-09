const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const requireAdmin = require('../middleware/requireAdmin');
const requireOwner = require('../middleware/requireOwner');
const { hashPassword, verifyPassword } = require('../services/password');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const valid = verifyPassword(password, user ? user.password_hash : null);

  if (!user || !valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  req.session.userId = user.id;
  res.json({ authenticated: true, id: user.id, username: user.username, is_owner: Boolean(user.is_owner) });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ authenticated: false });
});

router.get('/me', (req, res) => {
  const userId = req.session && req.session.userId;
  const user = userId ? db.prepare('SELECT id, username, is_owner FROM users WHERE id = ?').get(userId) : null;

  if (!user) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({
    authenticated: true, id: user.id, username: user.username, is_owner: Boolean(user.is_owner),
  });
});

router.use(requireAdmin);

// Account management is reserved for the instance owner (the bootstrap
// account) - regular admins are scoped to only the guestbooks they created,
// and that scoping would be meaningless if any admin could list, create, or
// delete other admins' accounts.
router.get('/users', requireOwner, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.is_owner, u.created_at, COUNT(e.id) AS event_count
    FROM users u
    LEFT JOIN events e ON e.owner_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `).all();
  res.json(users);
});

router.post('/users', requireOwner, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'A username and a password of at least 8 characters are required' });
    return;
  }

  try {
    const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username.trim(), hashPassword(password));
    res.status(201).json({ id: info.lastInsertRowid, username: username.trim() });
  } catch (err) {
    res.status(409).json({ error: 'That username is already taken' });
  }
});

router.delete('/users/:id', requireOwner, (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    res.status(400).json({ error: "You can't delete your own account while logged in as it" });
    return;
  }

  try {
    const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    res.status(409).json({ error: 'This admin still owns guestbooks. Reassign or delete those first.' });
  }
});

router.patch('/password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }
  if (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
  res.json({ ok: true });
});

module.exports = router;
