const crypto = require('crypto');
const config = require('../config');

// A capability token, not an access-control secret shared with anyone else:
// lets the guest who just recorded a message download their own normalized
// copy without a real user account, while keeping recording ids
// non-enumerable (unlike the public album's streaming route, this endpoint
// has no per-event opt-in, so it must never work without the right token).
function tokenForRecording(id) {
  return crypto.createHmac('sha256', `${config.sessionSecret}:download-token`).update(String(id)).digest('hex');
}

function verifyDownloadToken(id, token) {
  if (typeof token !== 'string' || !token) return false;
  const expected = Buffer.from(tokenForRecording(id));
  const actual = Buffer.from(token);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

module.exports = { tokenForRecording, verifyDownloadToken };
