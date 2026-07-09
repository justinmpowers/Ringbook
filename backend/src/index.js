const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieSession = require('cookie-session');
const config = require('./config');
require('./db'); // ensures schema exists before routes are mounted
const { bootstrapAdmin } = require('./services/bootstrap');
const { enqueueAllPending } = require('./services/transcriptionQueue');

bootstrapAdmin();
enqueueAllPending();

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const publicRoutes = require('./routes/public');
const recordingsRoutes = require('./routes/recordings');
const requireCsrfHeader = require('./middleware/requireCsrfHeader');
const errorHandler = require('./middleware/errorHandler');

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // styles.css's film-grain overlay is a data: URI background-image,
      // which CSP's img-src governs even though it's referenced from CSS.
      imgSrc: ["'self'", 'data:'],
      // Guest recording preview plays the raw browser-recorded blob via a
      // blob: object URL before it's uploaded - media-src must allow that.
      mediaSrc: ["'self'", 'blob:'],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
}));

app.use(express.json());
app.use(cookieSession({
  name: 'ringbook_session',
  secret: config.sessionSecret,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  sameSite: 'lax',
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', requireCsrfHeader, authRoutes);
app.use('/api/events', requireCsrfHeader, eventsRoutes);
app.use('/api/recordings', requireCsrfHeader, recordingsRoutes);
app.use('/api/public', publicRoutes);

const staticDir = path.join(__dirname, 'public');
app.use(express.static(staticDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    next();
    return;
  }
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Ringbook listening on port ${config.port}`);
});
