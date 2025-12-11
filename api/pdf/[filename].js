const fs = require('fs');
const path = require('path');
const lib = require('../_lib');

module.exports = async (req, res) => {
  try {
    const filename = req.query.filename || req.query['filename'] || req.url.split('/').pop();
    const decoded = decodeURIComponent(filename || '');
    const safe = lib.safeFilename(decoded);

    // Check local filesystem
    const filePath = path.join(lib.PDF_DIR, safe);
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
      const stream = fs.createReadStream(filePath);
      return stream.pipe(res);
    }

    // If S3 configured, return presigned GET
    if (lib.s3Client && lib.S3_BUCKET) {
      try {
        const url = await lib.presignGetUrl(safe);
        return res.writeHead(302, { Location: url }).end();
      } catch (e) {
        console.error('presign get error', e);
        return res.status(404).send('PDF not found');
      }
    }

    return res.status(404).send('PDF not found');
  } catch (err) {
    console.error('api/pdf error', err);
    res.status(500).send('Server error');
  }
};
