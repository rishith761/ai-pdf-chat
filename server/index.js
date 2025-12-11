const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Optional AWS S3 configuration: if `AWS_REGION` and `S3_BUCKET` are set,
// the server will provide presigned URLs for direct uploads and list/serve
// PDFs from the configured bucket.
let s3Client = null;
let S3_BUCKET = process.env.S3_BUCKET || null;
if (process.env.AWS_REGION && S3_BUCKET) {
  const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  s3Client = new S3Client({ region: process.env.AWS_REGION });
  module.exports._s3 = { s3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, getSignedUrl };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

const PDF_DIR = path.join(__dirname, '..', 'pdfs');

// In-memory PDF storage (for Vercel deployments)
const memoryPDFs = {};

app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Get all PDFs (filesystem + memory)
function getAllPDFs() {
  const files = [];
  
  // From filesystem
  try {
    if (fs.existsSync(PDF_DIR)) {
      const fsFiles = fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
      files.push(...fsFiles);
    }
  } catch (err) {
    console.log('Filesystem read error:', err.message);
  }
  
  // From memory
  files.push(...Object.keys(memoryPDFs));
  
  return [...new Set(files)]; // Remove duplicates
}

// Search PDFs by name
app.get('/api/search', (req, res) => {
  const name = (req.query.name || '').toLowerCase();
  try {
    const files = getAllPDFs()
      .filter(f => name === '' || f.toLowerCase().includes(name));

    const results = files.map(f => ({ name: f, url: `/pdf/${encodeURIComponent(f)}` }));
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve PDF files
app.get('/pdf/:filename', (req, res) => {
  const filename = req.params.filename;
  const decoded = decodeURIComponent(filename);
  
  // Check memory first
  if (memoryPDFs[decoded]) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${decoded}"`);
    return res.send(Buffer.from(memoryPDFs[decoded], 'base64'));
  }
  
  // Check filesystem
  const filePath = path.join(PDF_DIR, decoded);
  if (!filePath.startsWith(PDF_DIR)) return res.status(400).send('Invalid path');
  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (!err) return res.sendFile(filePath);

    // Not found locally: if S3 is configured, generate a presigned GET URL and redirect
    if (s3Client && S3_BUCKET) {
      const { GetObjectCommand, getSignedUrl } = module.exports._s3;
      const getCmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: decoded });
      getSignedUrl(s3Client, getCmd, { expiresIn: 60 })
        .then(url => res.redirect(url))
        .catch(e => {
          console.error('S3 signed URL error', e);
          res.status(404).send('PDF not found');
        });
      return;
    }

    return res.status(404).send('PDF not found');
  });
});

// Upload PDF endpoint
app.post('/api/upload', (req, res) => {
  try {
    const { filename, data } = req.body;
    
    if (!filename || !data) {
      return res.status(400).json({ error: 'Missing filename or data' });
    }
    
    if (!filename.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files allowed' });
    }
    
    // Store in memory (base64) — fallback when not using S3
    if (!s3Client) {
      memoryPDFs[filename] = data;
      return res.json({ success: true, message: `${filename} uploaded successfully (in-memory)`, filename });
    }

    // If S3 is configured the preferred flow is direct upload via presigned URL.
    // Keep this endpoint for backward-compatibility.
    memoryPDFs[filename] = data;
    return res.json({ success: true, message: `${filename} uploaded to memory (S3 available)`, filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List all PDFs
app.get('/api/pdfs', (req, res) => {
  try {
    const files = getAllPDFs();
    // If S3 configured, list objects in the bucket and merge
    if (s3Client && S3_BUCKET) {
      const { ListObjectsV2Command } = module.exports._s3;
      s3Client.send(new ListObjectsV2Command({ Bucket: S3_BUCKET }))
        .then(data => {
          const s3files = (data.Contents || []).map(o => o.Key).filter(k => k.toLowerCase().endsWith('.pdf'));
          const merged = Array.from(new Set([...files, ...s3files]));
          res.json({ pdfs: merged });
        })
        .catch(err => {
          console.error('S3 list error', err);
          res.json({ pdfs: files });
        });
      return;
    }

    res.json({ pdfs: files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate S3 presigned PUT URL for direct upload
app.post('/api/presign', async (req, res) => {
  try {
    // simple API key protection: set UPLOAD_KEY in env and pass via `x-api-key` header
    const provided = req.headers['x-api-key'] || req.body.apiKey;
    if (process.env.UPLOAD_KEY && (!provided || provided !== process.env.UPLOAD_KEY)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!s3Client || !S3_BUCKET) return res.status(500).json({ error: 'S3 not configured' });

    const { filename, contentType } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'Missing filename' });
    if (!filename.toLowerCase().endsWith('.pdf')) return res.status(400).json({ error: 'Only PDF uploads allowed' });

    const { PutObjectCommand, getSignedUrl } = module.exports._s3;
    const key = filename;
    const putCmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType || 'application/pdf' });
    const url = await getSignedUrl(s3Client, putCmd, { expiresIn: 60 * 5 }); // 5 minutes
    res.json({ uploadUrl: url, key });
  } catch (err) {
    console.error('Presign error', err);
    res.status(500).json({ error: 'Presign failed' });
  }
});

// Simple chat endpoint: finds PDFs mentioned in the message and returns links,
// otherwise returns a text reply. Optionally, this can be extended to call OpenAI.
app.post('/api/chat', async (req, res) => {
  const message = (req.body.message || '').toLowerCase();
  try {
    const files = getAllPDFs()
      .filter(f => {
        const base = path.parse(f).name.toLowerCase();
        return message.includes(base) || base.includes(message.split(/\s+/)[0]);
      });

    if (files.length) {
      const results = files.map(f => ({ name: f, url: `/pdf/${encodeURIComponent(f)}` }));
      return res.json({ type: 'pdf', results });
    }

    return res.json({ type: 'text', reply: "I couldn't find a matching PDF. Try: 'Get <name>' or use the search box. You can also upload PDFs." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));
