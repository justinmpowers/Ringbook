const path = require('path');
const db = require('../db');
const config = require('../config');
const { isAvailable, transcribeAudio } = require('./transcribe');

// Minimal in-process, single-worker FIFO - no Redis/Bull. Serialized on
// purpose: running whisper-cli jobs concurrently would compete for CPU with
// any concurrent ffmpeg transcodes on what's likely a small self-hosted box.
const queue = [];
let processing = false;

async function transcribeOne(id) {
  const recording = db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
  if (!recording) return;

  if (!isAvailable()) {
    db.prepare("UPDATE recordings SET transcript_status = 'skipped' WHERE id = ?").run(id);
    return;
  }

  db.prepare("UPDATE recordings SET transcript_status = 'processing' WHERE id = ?").run(id);
  try {
    const audioPath = path.join(config.recordingsDir, String(recording.event_id), recording.filename);
    const transcript = await transcribeAudio(audioPath);
    db.prepare("UPDATE recordings SET transcript = ?, transcript_status = 'done' WHERE id = ?").run(transcript || '', id);
  } catch (err) {
    db.prepare("UPDATE recordings SET transcript_status = 'failed' WHERE id = ?").run(id);
  }
}

async function processNext() {
  if (processing || queue.length === 0) return;
  processing = true;
  const id = queue.shift();
  await transcribeOne(id);
  processing = false;
  processNext();
}

function enqueue(recordingId) {
  queue.push(recordingId);
  processNext();
}

// Backfills any recording left over from before this feature existed (or
// from an unclean shutdown) - called once at startup, no manual trigger needed.
function enqueueAllPending() {
  db.prepare("UPDATE recordings SET transcript_status = 'pending' WHERE transcript_status = 'processing'").run();
  const rows = db.prepare("SELECT id FROM recordings WHERE transcript_status = 'pending'").all();
  rows.forEach((row) => enqueue(row.id));
}

module.exports = { enqueue, enqueueAllPending };
