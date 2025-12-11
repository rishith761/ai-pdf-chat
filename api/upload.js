const lib = require('./_lib');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { filename, data } = req.body || {};
    if (!filename || !data) return res.status(400).json({ error: 'Missing filename or data' });
    if (!filename.toLowerCase().endsWith('.pdf')) return res.status(400).json({ error: 'Only PDF files allowed' });

    const safe = lib.safeFilename(filename);

    // If S3 is configured, upload server-side (not preferred for large files but kept for backward-compat)
    if (lib.s3Client && lib.S3_BUCKET) {
      await lib.putBase64ToS3(safe, data);
      return res.status(200).json({ success: true, message: `${safe} uploaded to S3`, filename: safe });
    }

    // Otherwise write to local pdfs folder (ephemeral on serverless)
    const outDir = lib.PDF_DIR;
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, safe);
    fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
    res.status(200).json({ success: true, message: `${safe} saved locally`, filename: safe });
  } catch (err) {
    console.error('upload error', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};
