const crypto = require('crypto');

const KEYLEN = 64;
// A syntactically valid but unreachable hash, used to keep failed-login timing
// consistent whether or not the submitted username actually exists.
const DUMMY_HASH = `${'0'.repeat(32)}:${'0'.repeat(KEYLEN * 2)}`;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hashHex] = (stored || DUMMY_HASH).split(':');
  const candidate = crypto.scryptSync(password, salt, KEYLEN);
  const expected = Buffer.from(hashHex, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

module.exports = { hashPassword, verifyPassword, DUMMY_HASH };
