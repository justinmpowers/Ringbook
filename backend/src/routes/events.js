const fs = require('fs');
const path = require('path');
const express = require('express');
const archiver = require('archiver');
const QRCode = require('qrcode');
const db = require('../db');
const config = require('../config');
const requireAdmin = require('../middleware/requireAdmin');
const { uniqueSlugFromTitle } = require('../services/slug');

const router = express.Router();

router.use(requireAdmin);

function eventRecordingsDir(eventId) {
  return path.join(config.recordingsDir, String(eventId));
}

function guestUrlForSlug(slug) {
  const base = config.publicBaseUrl.replace(/\/+$/, '');
  return `${base}/r/${slug}`;
}

router.get('/', (req, res) => {
  const events = db.prepare(`
    SELECT e.*, COUNT(r.id) AS recording_count
    FROM events e
    LEFT JOIN recordings r ON r.event_id = e.id
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `).all();
  res.json(events);
});

router.post('/', (req, res) => {
  const { title, occasion, greeting } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const slug = uniqueSlugFromTitle(title);
  const info = db.prepare(`
    INSERT INTO events (slug, title, occasion, greeting)
    VALUES (?, ?, ?, ?)
  `).run(slug, title.trim(), occasion || null, greeting || null);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(event);
});

router.get('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json(event);
});

router.patch('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const { title, occasion, greeting, is_active: isActive } = req.body || {};
  db.prepare(`
    UPDATE events SET
      title = ?,
      occasion = ?,
      greeting = ?,
      is_active = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    typeof title === 'string' && title.trim() ? title.trim() : event.title,
    occasion !== undefined ? occasion : event.occasion,
    greeting !== undefined ? greeting : event.greeting,
    isActive !== undefined ? (isActive ? 1 : 0) : event.is_active,
    event.id,
  );

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(event.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
  fs.rmSync(eventRecordingsDir(event.id), { recursive: true, force: true });
  res.status(204).end();
});

router.get('/:id/qrcode.png', async (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  try {
    const buffer = await QRCode.toBuffer(guestUrlForSlug(event.slug), { width: 512 });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

router.get('/:id/export.zip', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const recordings = db.prepare('SELECT * FROM recordings WHERE event_id = ? ORDER BY created_at').all(event.id);

  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', `attachment; filename="${event.slug}-recordings.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    res.status(500).end(`Export failed: ${err.message}`);
  });
  archive.pipe(res);

  const dir = eventRecordingsDir(event.id);
  for (const recording of recordings) {
    const filePath = path.join(dir, recording.filename);
    if (fs.existsSync(filePath)) {
      const label = recording.guest_name ? recording.guest_name.replace(/[^a-z0-9 _-]/gi, '') : 'guest';
      const niceName = `${recording.created_at.replace(/[: ]/g, '-')}_${label}_${recording.filename}`;
      archive.file(filePath, { name: niceName });
    }
  }

  archive.finalize();
});

router.get('/:id/recordings', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  const recordings = db.prepare('SELECT * FROM recordings WHERE event_id = ? ORDER BY created_at DESC').all(event.id);
  res.json(recordings);
});

module.exports = router;
