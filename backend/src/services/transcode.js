const { execFile } = require('child_process');
const config = require('../config');

// Transcodes any browser-recorded audio (webm/opus, mp4/aac, etc.) into a
// single consistent, universally-playable format: mono MP3 at a voice-appropriate
// bitrate, hard-capped at maxRecordingSeconds regardless of what the client sent.
function transcodeToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-t', String(config.maxRecordingSeconds),
      '-vn',
      '-ac', '1',
      '-codec:a', 'libmp3lame',
      '-b:a', '96k',
      outputPath,
    ];

    execFile('ffmpeg', args, { timeout: 60_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`ffmpeg failed: ${error.message}\n${stderr}`));
        return;
      }
      resolve();
    });
  });
}

function probeDurationSeconds(filePath) {
  return new Promise((resolve) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ];
    execFile('ffprobe', args, { timeout: 15_000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const seconds = parseFloat(stdout.trim());
      resolve(Number.isFinite(seconds) ? seconds : null);
    });
  });
}

module.exports = { transcodeToMp3, probeDurationSeconds };
