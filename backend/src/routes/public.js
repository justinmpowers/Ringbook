const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { transcodeToMp3, probeDurationSeconds } = require('../services/transcode');
const { isEffectivelyOpen, settleScheduledClose } = require('../services/eventSchedule');
const { tokenForRecording, verifyDownloadToken } = require('../services/downloadToken');
const { sendWebhook } = require('../services/webhook');
const { enqueue: enqueueTranscription } = require('../services/transcriptionQueue');

const router = express.Router();

const upload = multer({
  dest: config.tmpUploadDir,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

const recordingUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages from this device recently. Please try again later.' },
});

router.get('/config', (req, res) => {
  res.json({
    maxRecordingSeconds: config.maxRecordingSeconds,
    maxUploadMb: config.maxUploadMb,
  });
});

router.get('/events/:slug', (req, res) => {
  const event = db.prepare(`
    SELECT e.id, e.slug, e.title, e.occasion, e.greeting, e.is_active, e.scheduled_close_at,
           e.has_cover_image, e.updated_at,
           (SELECT COUNT(*) FROM recordings r WHERE r.event_id = e.id) AS recording_count
    FROM events e WHERE e.slug = ?
  `).get(req.params.slug);

  if (!event) {
    res.status(404).json({ error: 'Guestbook not found' });
    return;
  }
  const settled = settleScheduledClose(event);
  const { id, ...publicEvent } = settled;
  res.json(publicEvent);
});

router.get('/events/:slug/cover', (req, res) => {
  const event = db.prepare('SELECT id, has_cover_image FROM events WHERE slug = ?').get(req.params.slug);

  if (!event || !event.has_cover_image) {
    res.status(404).end();
    return;
  }

  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(path.join(config.coversDir, `${event.id}.jpg`), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

router.post('/events/:slug/recordings', recordingUploadLimiter, upload.single('audio'), async (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE slug = ?').get(req.params.slug);

  const cleanup = () => {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  };

  if (!event) {
    cleanup();
    res.status(404).json({ error: 'Guestbook not found' });
    return;
  }
  if (!isEffectivelyOpen(event)) {
    settleScheduledClose(event);
    cleanup();
    res.status(403).json({ error: 'This guestbook is closed' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'audio file is required' });
    return;
  }

  const eventDir = path.join(config.recordingsDir, String(event.id));
  fs.mkdirSync(eventDir, { recursive: true });

  const filename = `${crypto.randomUUID()}.mp3`;
  const outputPath = path.join(eventDir, filename);

  try {
    await transcodeToMp3(req.file.path, outputPath);
    const duration = await probeDurationSeconds(outputPath);
    const { size } = fs.statSync(outputPath);
    const guestName = typeof req.body.guest_name === 'string' ? req.body.guest_name.trim().slice(0, 200) : null;

    const info = db.prepare(`
      INSERT INTO recordings (event_id, guest_name, filename, duration_seconds, mime_type, size_bytes)
      VALUES (?, ?, ?, ?, 'audio/mpeg', ?)
    `).run(event.id, guestName || null, filename, duration, size);

    res.status(201).json({
      id: info.lastInsertRowid,
      duration_seconds: duration,
      download_token: tokenForRecording(info.lastInsertRowid),
    });

    // Fire-and-forget: never awaited on the guest's path, so a slow or
    // unreachable webhook target can't delay or fail their upload.
    sendWebhook(event.webhook_url, event, { guest_name: guestName }).catch(() => {});
    enqueueTranscription(info.lastInsertRowid);
  } catch (err) {
    fs.rm(outputPath, { force: true }, () => {});
    res.status(500).json({ error: 'Could not process recording' });
  } finally {
    cleanup();
  }
});

router.get('/events/:slug/album', (req, res) => {
  const event = db.prepare(`
    SELECT id, slug, title, occasion, greeting, has_cover_image, updated_at
    FROM events WHERE slug = ? AND public_album_enabled = 1
  `).get(req.params.slug);

  // Same 404 whether the slug doesn't exist or the owner hasn't opted in -
  // don't let a guess distinguish "no such guestbook" from "not public".
  if (!event) {
    res.status(404).json({ error: 'Album not found' });
    return;
  }

  const recordings = db.prepare(`
    SELECT id, guest_name, duration_seconds, created_at FROM recordings
    WHERE event_id = ? ORDER BY created_at DESC
  `).all(event.id);

  const { id, ...publicEvent } = event;
  res.json({ ...publicEvent, recordings });
});

router.get('/recordings/:id/stream', (req, res) => {
  // The one predicate that matters: without requiring public_album_enabled
  // here too (not just on the listing route above), any recording id would
  // be publicly streamable regardless of the per-event opt-in.
  const recording = db.prepare(`
    SELECT r.* FROM recordings r
    JOIN events e ON e.id = r.event_id
    WHERE r.id = ? AND e.public_album_enabled = 1
  `).get(req.params.id);

  if (!recording) {
    res.status(404).end();
    return;
  }

  const filePath = path.join(config.recordingsDir, String(recording.event_id), recording.filename);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

router.get('/recordings/:id/download', (req, res) => {
  if (!verifyDownloadToken(req.params.id, req.query.token)) {
    res.status(404).end();
    return;
  }

  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.id);
  if (!recording) {
    res.status(404).end();
    return;
  }

  const filePath = path.join(config.recordingsDir, String(recording.event_id), recording.filename);
  res.download(filePath, `message-${recording.id}.mp3`, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

module.exports = router;
