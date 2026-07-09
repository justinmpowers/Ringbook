const { execFile } = require('child_process');

// Normalizes any admin-uploaded cover photo (phone camera JPEG, PNG screenshot,
// etc.) into a single consistent format: JPEG capped at 1600px wide, so a raw
// multi-MB photo doesn't get shipped to every guest's phone unmodified.
function normalizeCoverImage(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-vf', "scale='min(1600,iw)':-2",
      '-q:v', '3',
      '-frames:v', '1',
      outputPath,
    ];

    execFile('ffmpeg', args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`ffmpeg failed: ${error.message}\n${stderr}`));
        return;
      }
      resolve();
    });
  });
}

module.exports = { normalizeCoverImage };
