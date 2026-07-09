// Cross-site HTML forms can't set custom headers, and cross-site fetch/XHR
// that tries to would trigger a CORS preflight this server never approves -
// so requiring this header on state-changing requests blocks CSRF without
// needing a token library (the session cookie is already SameSite=lax too,
// which independently blocks the classic cross-site-form-POST vector).
function requireCsrfHeader(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    next();
    return;
  }
  if (req.get('X-Ringbook-Client') !== '1') {
    res.status(403).json({ error: 'Missing required client header' });
    return;
  }
  next();
}

module.exports = requireCsrfHeader;
