const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  dataDir,
  dbPath: path.join(dataDir, 'ringbook.db'),
  recordingsDir: path.join(dataDir, 'recordings'),
  coversDir: path.join(dataDir, 'covers'),
  tmpUploadDir: path.join(dataDir, 'tmp'),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'changeme',
  sessionSecret: process.env.SESSION_SECRET || 'ringbook-dev-secret-change-me',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  maxRecordingSeconds: parseInt(process.env.MAX_RECORDING_SECONDS, 10) || 180,
  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB, 10) || 50,
  maxCoverUploadMb: parseInt(process.env.MAX_COVER_UPLOAD_MB, 10) || 20,
  trustProxy: process.env.TRUST_PROXY === 'true',
  transcriptionEnabled: process.env.ENABLE_TRANSCRIPTION !== 'false',
  whisperBin: process.env.WHISPER_BIN || '/usr/local/bin/whisper-cli',
  whisperModelsDir: process.env.WHISPER_MODELS_DIR || '/app/whisper-models',
};
