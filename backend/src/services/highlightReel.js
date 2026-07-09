const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Every recording is already a homogeneous mono/96k MP3 (transcodeToMp3), so
// the concat demuxer can stream-copy-join them with no re-encoding - fast
// even for a large guestbook, and no new dependency beyond ffmpeg.
function streamHighlightReel(filePaths, res) {
  const listFile = path.join(os.tmpdir(), `ringbook-concat-${crypto.randomUUID()}.txt`);
  const listContents = filePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listFile, listContents);

  const cleanup = () => fs.rm(listFile, { force: true }, () => {});

  const child = spawn('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c', 'copy',
    '-f', 'mp3',
    'pipe:1',
  ]);

  child.stdout.pipe(res);
  child.stderr.on('data', () => {}); // drain to avoid backpressure stalls, ffmpeg's own errors surface via exit code
  child.on('error', () => { cleanup(); if (!res.headersSent) res.status(500).end(); });
  child.on('close', cleanup);
}

module.exports = { streamHighlightReel };
