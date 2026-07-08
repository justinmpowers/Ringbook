const crypto = require('crypto');
const express = require('express');
const config = require('../config');

const router = express.Router();

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a comparison of equal-length buffers so failure timing
    // doesn't leak the correct credential length.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const validUsername = timingSafeStringEqual(username, config.adminUsername);
  const validPassword = timingSafeStringEqual(password, config.adminPassword);

  if (!validUsername || !validPassword) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  req.session.isAdmin = true;
  res.json({ authenticated: true });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ authenticated: false });
});

router.get('/me', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.json({ authenticated: true });
    return;
  }
  res.status(401).json({ authenticated: false });
});

module.exports = router;
