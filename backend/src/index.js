const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const config = require('./config');
require('./db'); // ensures schema exists before routes are mounted

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const publicRoutes = require('./routes/public');
const recordingsRoutes = require('./routes/recordings');
const errorHandler = require('./middleware/errorHandler');

const app = express();

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

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/recordings', recordingsRoutes);

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
