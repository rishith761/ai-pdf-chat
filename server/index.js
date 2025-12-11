const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PDF_DIR = path.join(__dirname, '..', 'pdfs');

app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Search PDFs by name (query param `name`)
app.get('/api/search', (req, res) => {
  const name = (req.query.name || '').toLowerCase();
  try {
    if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
    const files = fs.readdirSync(PDF_DIR)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .filter(f => name === '' || f.toLowerCase().includes(name));

    const results = files.map(f => ({ name: f, url: `/pdf/${encodeURIComponent(f)}` }));
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve PDF files (safe-ish path resolution)
app.get('/pdf/:filename', (req, res) => {
  const filename = req.params.filename;
  const decoded = decodeURIComponent(filename);
  const filePath = path.join(PDF_DIR, decoded);
  if (!filePath.startsWith(PDF_DIR)) return res.status(400).send('Invalid path');
  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) return res.status(404).send('Not found');
    res.sendFile(filePath);
  });
});

// Simple chat endpoint: finds PDFs mentioned in the message and returns links,
// otherwise returns a text reply. Optionally, this can be extended to call OpenAI.
app.post('/api/chat', async (req, res) => {
  const message = (req.body.message || '').toLowerCase();
  try {
    if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
    const files = fs.readdirSync(PDF_DIR)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .filter(f => {
        const base = path.parse(f).name.toLowerCase();
        return message.includes(base) || base.includes(message) || message.includes(path.parse(f).name.toLowerCase());
      });

    if (files.length) {
      const results = files.map(f => ({ name: f, url: `/pdf/${encodeURIComponent(f)}` }));
      return res.json({ type: 'pdf', results });
    }

    // If OPENAI_API_KEY is set and you want AI replies, plug OpenAI call here.
    // For now return a default helpful message.
    return res.json({ type: 'text', reply: "I couldn't find a matching PDF. Try: 'Get <name>' or use the search box." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));
