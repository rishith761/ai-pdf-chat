const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

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
    if (err) return res.status(404).send('PDF not found');
    res.sendFile(filePath);
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
    
    // Store in memory (base64)
    memoryPDFs[filename] = data;
    
    res.json({ success: true, message: `${filename} uploaded successfully`, filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List all PDFs
app.get('/api/pdfs', (req, res) => {
  try {
    const files = getAllPDFs();
    res.json({ pdfs: files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
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
