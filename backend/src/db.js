const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });
fs.mkdirSync(config.recordingsDir, { recursive: true });
fs.mkdirSync(config.coversDir, { recursive: true });
fs.mkdirSync(config.tmpUploadDir, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_owner INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    occasion TEXT,
    greeting TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guest_name TEXT,
    filename TEXT NOT NULL,
    duration_seconds REAL,
    mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
    size_bytes INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_recordings_event_id ON recordings(event_id);
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!userColumns.includes('is_owner')) {
  db.exec('ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0');
}

const eventColumns = db.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
if (!eventColumns.includes('has_cover_image')) {
  db.exec('ALTER TABLE events ADD COLUMN has_cover_image INTEGER NOT NULL DEFAULT 0');
}
if (!eventColumns.includes('owner_id')) {
  db.exec('ALTER TABLE events ADD COLUMN owner_id INTEGER REFERENCES users(id)');
}
if (!eventColumns.includes('scheduled_close_at')) {
  db.exec('ALTER TABLE events ADD COLUMN scheduled_close_at TEXT');
}
if (!eventColumns.includes('webhook_url')) {
  db.exec('ALTER TABLE events ADD COLUMN webhook_url TEXT');
}
if (!eventColumns.includes('public_album_enabled')) {
  db.exec('ALTER TABLE events ADD COLUMN public_album_enabled INTEGER NOT NULL DEFAULT 0');
}

const recordingColumns = db.prepare('PRAGMA table_info(recordings)').all().map((c) => c.name);
if (!recordingColumns.includes('transcript')) {
  db.exec('ALTER TABLE recordings ADD COLUMN transcript TEXT');
}
if (!recordingColumns.includes('transcript_status')) {
  // pending | processing | done | skipped | failed. The DEFAULT here is what
  // backfills existing recordings on upgrade - the startup queue in
  // transcriptionQueue.js picks up every 'pending' row with no migration script.
  db.exec("ALTER TABLE recordings ADD COLUMN transcript_status TEXT NOT NULL DEFAULT 'pending'");
}

module.exports = db;
