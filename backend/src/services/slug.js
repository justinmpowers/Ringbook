const crypto = require('crypto');
const db = require('../db');

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'event';
}

function slugExists(slug) {
  return !!db.prepare('SELECT 1 FROM events WHERE slug = ?').get(slug);
}

function uniqueSlugFromTitle(title) {
  const base = slugify(title);
  if (!slugExists(base)) return base;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${crypto.randomBytes(2).toString('hex')}`;
    if (!slugExists(candidate)) return candidate;
  }
  throw new Error('Could not generate a unique slug');
}

module.exports = { slugify, uniqueSlugFromTitle };
