const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const config = require('../config');

// whisper-cli decodes mp3/wav/ogg/flac directly via its built-in miniaudio
// decoder, so recordings.mp3 (already normalized by transcodeToMp3) can be
// fed to it as-is - no separate ffmpeg-to-WAV conversion step needed.
function findModelFile() {
  if (!fs.existsSync(config.whisperModelsDir)) return null;
  // Real downloaded models are always named "ggml-<model>.bin" - deliberately
  // stricter than a bare *.bin match, since whisper.cpp's own repo also ships
  // tiny "for-tests-*.bin" dummy fixtures that aren't usable real models.
  const file = fs.readdirSync(config.whisperModelsDir).find((f) => /^ggml-.+\.bin$/.test(f));
  return file ? path.join(config.whisperModelsDir, file) : null;
}

// Runtime graceful degradation: if transcription is disabled, or the binary
// or model aren't present at the expected paths, transcription is silently
// skipped and everything else in the app keeps working exactly as before.
function isAvailable() {
  return config.transcriptionEnabled && fs.existsSync(config.whisperBin) && Boolean(findModelFile());
}

function transcribeAudio(audioPath) {
  return new Promise((resolve, reject) => {
    const modelPath = findModelFile();
    if (!modelPath) {
      resolve(null);
      return;
    }

    const args = ['-np', '-nt', '-m', modelPath, '-f', audioPath];
    execFile(config.whisperBin, args, { timeout: 5 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(new Error(`whisper-cli failed: ${error.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

module.exports = { isAvailable, transcribeAudio };
