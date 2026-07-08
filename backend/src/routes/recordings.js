const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../db');
const config = require('../config');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.use(requireAdmin);

function recordingFilePath(recording) {
  return path.join(config.recordingsDir, String(recording.event_id), recording.filename);
}

function getRecordingOr404(req, res) {
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(req.params.id);
  if (!recording) {
    res.status(404).json({ error: 'Recording not found' });
    return null;
  }
  return recording;
}

router.get('/:id/stream', (req, res) => {
  const recording = getRecordingOr404(req, res);
  if (!recording) return;

  res.sendFile(recordingFilePath(recording), (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'Audio file not found on disk' });
    }
  });
});

router.get('/:id/download', (req, res) => {
  const recording = getRecordingOr404(req, res);
  if (!recording) return;

  const downloadName = `${recording.guest_name || 'guest'}-${recording.filename}`.replace(/[^a-z0-9._-]/gi, '_');
  res.download(recordingFilePath(recording), downloadName, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'Audio file not found on disk' });
    }
  });
});

router.delete('/:id', (req, res) => {
  const recording = getRecordingOr404(req, res);
  if (!recording) return;

  db.prepare('DELETE FROM recordings WHERE id = ?').run(recording.id);
  fs.rmSync(recordingFilePath(recording), { force: true });
  res.status(204).end();
});

module.exports = router;
