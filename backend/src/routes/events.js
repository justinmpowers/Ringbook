const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const archiver = require('archiver');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const db = require('../db');
const config = require('../config');
const requireAdmin = require('../middleware/requireAdmin');
const { uniqueSlugFromTitle } = require('../services/slug');
const { normalizeCoverImage } = require('../services/image');
const { settleScheduledClose } = require('../services/eventSchedule');
const { sendWebhook, assertSafeWebhookTarget } = require('../services/webhook');
const { streamHighlightReel } = require('../services/highlightReel');

const router = express.Router();

router.use(requireAdmin);

const coverUpload = multer({
  dest: config.tmpUploadDir,
  limits: { fileSize: config.maxCoverUploadMb * 1024 * 1024 },
});

function eventRecordingsDir(eventId) {
  return path.join(config.recordingsDir, String(eventId));
}

function eventCoverPath(eventId) {
  return path.join(config.coversDir, `${eventId}.jpg`);
}

function guestUrlForSlug(slug) {
  const base = config.publicBaseUrl.replace(/\/+$/, '');
  return `${base}/r/${slug}`;
}

// Every single-event lookup below goes through this so a non-owner gets the
// same 404 as a nonexistent event - never a 403 that would confirm existence.
function getOwnedEvent(id, ownerId) {
  return db.prepare('SELECT * FROM events WHERE id = ? AND owner_id = ?').get(id, ownerId);
}

router.get('/', (req, res) => {
  const events = db.prepare(`
    SELECT e.*, COUNT(r.id) AS recording_count
    FROM events e
    LEFT JOIN recordings r ON r.event_id = e.id
    WHERE e.owner_id = ?
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `).all(req.user.id).map(settleScheduledClose);
  res.json(events);
});

router.post('/', (req, res) => {
  const { title, occasion, greeting, scheduled_close_at: scheduledCloseAt } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (scheduledCloseAt && Number.isNaN(new Date(scheduledCloseAt).getTime())) {
    res.status(400).json({ error: 'scheduled_close_at must be a valid date or null' });
    return;
  }

  const slug = uniqueSlugFromTitle(title);
  const info = db.prepare(`
    INSERT INTO events (slug, title, occasion, greeting, owner_id, scheduled_close_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(slug, title.trim(), occasion || null, greeting || null, req.user.id, scheduledCloseAt || null);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(event);
});

router.get('/:id', (req, res) => {
  const event = getOwnedEvent(req.params.id, req.user.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  res.json(settleScheduledClose(event));
});

router.patch('/:id', async (req, res) => {
  const event = getOwnedEvent(req.params.id, req.user.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const {
    title, occasion, greeting, is_active: isActive, scheduled_close_at: scheduledCloseAt,
    webhook_url: webhookUrl, public_album_enabled: publicAlbumEnabled,
  } = req.body || {};

  if (scheduledCloseAt !== undefined && scheduledCloseAt !== null && Number.isNaN(new Date(scheduledCloseAt).getTime())) {
    res.status(400).json({ error: 'scheduled_close_at must be a valid date or null' });
    return;
  }
  if (webhookUrl) {
    try {
      await assertSafeWebhookTarget(webhookUrl);
    } catch (err) {
      res.status(400).json({ error: `webhook_url is invalid: ${err.message}` });
      return;
    }
  }

  db.prepare(`
    UPDATE events SET
      title = ?,
      occasion = ?,
      greeting = ?,
      is_active = ?,
      scheduled_close_at = ?,
      webhook_url = ?,
      public_album_enabled = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    typeof title === 'string' && title.trim() ? title.trim() : event.title,
    occasion !== undefined ? occasion : event.occasion,
    greeting !== undefined ? greeting : event.greeting,
    isActive !== undefined ? (isActive ? 1 : 0) : event.is_active,
    scheduledCloseAt !== undefined ? scheduledCloseAt : event.scheduled_close_at,
    webhookUrl !== undefined ? (webhookUrl || null) : event.webhook_url,
    publicAlbumEnabled !== undefined ? (publicAlbumEnabled ? 1 : 0) : event.public_album_enabled,
    event.id,
  );

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(event.id);
  res.json(settleScheduledClose(updated));
});

router.delete('/:id', (req, res) => {
  const event = getOwnedEvent(req.params.id, req.user.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
  fs.rmSync(eventRecordingsDir(event.id), { recursive: true, force: true });
  fs.rmSync(eventCoverPath(event.id), { force: true });
  res.status(204).end();
});

router.post('/:id/cover', coverUpload.single('image'), async (req, res) => {
  const event = getOwnedEvent(req.params.id, req.user.id);
  const cleanup = () => { if (req.file) fs.rm(req.file.path, { force: true }, () => {}); };

  if (!event) {
    cleanup();
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  if (!req.file || !req.file.mimetype.startsWith('image/')) {
    cleanup();
    res.status(400).json({ error: 'A valid image file is required' });
    return;
  }

  try {
    await normalizeCoverImage(req.file.path, eventCoverPath(event.id));
    db.prepare("UPDATE events SET has_cover_image = 1, updated_at = datetime('now') WHERE id = ?").run(event.id);
    res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(event.id));
  } catch (err) {
    res.status(500).json({ error: 'Could not process that image' });
  } finally {
    cleanup();
  }
});

router.delete('/:id/cover', (req, res) => {
  const event = getOwnedEvent(req.params.id, req.user.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  fs.rmSync(eventCoverPath(event.id), { force: true });
  db.prepare("UPDATE events SET has_cover_image = 0, updated_at = datetime('now') WHERE id = ?").run(event.id);
  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(event.id));
});

router.get('/:id/qrcode.png', async (req, res) => {
  const event = getOwnedEvent(req.params.id, req.user.id);
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

router.post('/:id/webhook/test', async (req, res) => {
  const event = getOwnedEvent(req.params.id, req.user.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  if (!event.webhook_url) {
    res.status(400).json({ error: 'No webhook URL configured for this guestbook' });
    return;
  }

  const result = await sendWebhook(event.webhook_url, event, { guest_name: 'Test Notification' });
  res.json(result);
});

router.get('/:id/table-card.pdf', async (req, res) => {
  const event = getOwnedEvent(req.params.id, req.user.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  try {
    const qrBuffer = await QRCode.toBuffer(guestUrlForSlug(event.slug), { width: 480, margin: 1 });

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${event.slug}-table-card.pdf"`);

    const doc = new PDFDocument({ size: [360, 504], margins: 36 }); // 5in x 7in at 72dpi
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(22).text(event.title, { align: 'center' });
    if (event.occasion) {
      doc.moveDown(0.3).font('Helvetica').fontSize(11).fillColor('#7d6f5f')
        .text(event.occasion.toUpperCase(), { align: 'center', characterSpacing: 1 })
        .fillColor('#000000');
    }
    doc.moveDown(1.2);
    doc.image(qrBuffer, (doc.page.width - 240) / 2, doc.y, { width: 240 });
    doc.y += 256;
    doc.font('Helvetica-Bold').fontSize(14).text('Scan to leave a voice message', { align: 'center' });
    if (event.greeting) {
      doc.moveDown(0.5).font('Helvetica').fontSize(10).fillColor('#7d6f5f').text(event.greeting, { align: 'center' });
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Could not generate table card' });
  }
});

router.get('/:id/highlight-reel.mp3', (req, res) => {
  const event = getOwnedEvent(req.params.id, req.user.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const recordings = db.prepare('SELECT * FROM recordings WHERE event_id = ? ORDER BY created_at').all(event.id);
  const dir = eventRecordingsDir(event.id);
  const filePaths = recordings
    .map((r) => path.join(dir, r.filename))
    .filter((p) => fs.existsSync(p));

  if (filePaths.length === 0) {
    res.status(404).json({ error: 'No recordings to compile yet' });
    return;
  }

  res.set('Content-Type', 'audio/mpeg');
  res.set('Content-Disposition', `attachment; filename="${event.slug}-highlight-reel.mp3"`);
  streamHighlightReel(filePaths, res);
});

router.get('/:id/export.zip', (req, res) => {
  const event = getOwnedEvent(req.params.id, req.user.id);
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
  const event = getOwnedEvent(req.params.id, req.user.id);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }
  const recordings = db.prepare('SELECT * FROM recordings WHERE event_id = ? ORDER BY created_at DESC').all(event.id);
  res.json(recordings);
});

module.exports = router;
