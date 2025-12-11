const path = require('path');
const lib = require('./_lib');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const message = (req.body.message || '').toLowerCase();
    const files = (await lib.getAllPDFs()).filter(f => {
      const base = path.parse(f).name.toLowerCase();
      return message.includes(base) || base.includes(message.split(/\s+/)[0]);
    });

    if (files.length) {
      const results = files.map(f => ({ name: f, url: `/pdf/${encodeURIComponent(f)}` }));
      return res.status(200).json({ type: 'pdf', results });
    }

    return res.status(200).json({ type: 'text', reply: "I couldn't find a matching PDF. Try: 'Get <name>' or use the search box. You can also upload PDFs." });
  } catch (err) {
    console.error('chat error', err);
    res.status(500).json({ error: 'Server error' });
  }
};
