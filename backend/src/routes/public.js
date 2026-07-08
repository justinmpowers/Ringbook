const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const config = require('../config');
const { transcodeToMp3, probeDurationSeconds } = require('../services/transcode');

const router = express.Router();

const upload = multer({
  dest: config.tmpUploadDir,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

router.get('/config', (req, res) => {
  res.json({
    maxRecordingSeconds: config.maxRecordingSeconds,
    maxUploadMb: config.maxUploadMb,
  });
});

router.get('/events/:slug', (req, res) => {
  const event = db.prepare(`
    SELECT slug, title, occasion, greeting, is_active FROM events WHERE slug = ?
  `).get(req.params.slug);

  if (!event) {
    res.status(404).json({ error: 'Guestbook not found' });
    return;
  }
  res.json(event);
});

router.post('/events/:slug/recordings', upload.single('audio'), async (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE slug = ?').get(req.params.slug);

  const cleanup = () => {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  };

  if (!event) {
    cleanup();
    res.status(404).json({ error: 'Guestbook not found' });
    return;
  }
  if (!event.is_active) {
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

    res.status(201).json({ id: info.lastInsertRowid, duration_seconds: duration });
  } catch (err) {
    fs.rm(outputPath, { force: true }, () => {});
    res.status(500).json({ error: 'Could not process recording' });
  } finally {
    cleanup();
  }
});

module.exports = router;
