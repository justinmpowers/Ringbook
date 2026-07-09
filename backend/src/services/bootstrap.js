const db = require('../db');
const config = require('../config');
const { hashPassword } = require('./password');

function bootstrapAdmin() {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

  if (userCount === 0) {
    db.prepare('INSERT INTO users (username, password_hash, is_owner) VALUES (?, ?, 1)').run(
      config.adminUsername,
      hashPassword(config.adminPassword),
    );
    console.log(
      `Seeded initial admin "${config.adminUsername}" from ADMIN_USERNAME/ADMIN_PASSWORD. `
      + 'Those env vars are only used for this one-time bootstrap - manage further accounts from /admin/users.',
    );
  }

  db.prepare(`
    UPDATE events SET owner_id = (SELECT id FROM users ORDER BY id LIMIT 1)
    WHERE owner_id IS NULL
  `).run();

  // Installs upgrading from before the owner role existed: promote whichever
  // account was created first, so account management doesn't become
  // unreachable and every other admin stays scoped to their own guestbooks.
  const ownerCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_owner = 1').get().n;
  if (ownerCount === 0) {
    db.prepare('UPDATE users SET is_owner = 1 WHERE id = (SELECT id FROM users ORDER BY id LIMIT 1)').run();
  }
}

module.exports = { bootstrapAdmin };
