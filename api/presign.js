const lib = require('./_lib');

module.exports = async (req, res) => {
  try {
    // allow simple API-key protection
    const provided = req.headers['x-api-key'] || req.body && req.body.apiKey;
    if (process.env.UPLOAD_KEY && (!provided || provided !== process.env.UPLOAD_KEY)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { filename, contentType } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'Missing filename' });
    if (!filename.toLowerCase().endsWith('.pdf')) return res.status(400).json({ error: 'Only PDF uploads allowed' });

    if (!lib.initS3() || !process.env.S3_BUCKET) {
      console.error('S3 not configured:', { AWS_REGION: process.env.AWS_REGION, S3_BUCKET: process.env.S3_BUCKET });
      return res.status(500).json({ error: 'S3 not configured' });
    }

    const safe = lib.safeFilename(filename);
    const uploadUrl = await lib.presignPutUrl(safe, contentType);
    res.status(200).json({ uploadUrl, key: safe });
  } catch (err) {
    console.error('presign error', err);
    res.status(500).json({ error: 'Presign failed: ' + err.message });
  }
};
