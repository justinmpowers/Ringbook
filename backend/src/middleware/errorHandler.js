const multer = require('multer');
const config = require('../config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    const maxMb = err.field === 'image' ? config.maxCoverUploadMb : config.maxUploadMb;
    res.status(413).json({ error: `File exceeds the ${maxMb}MB upload limit` });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
