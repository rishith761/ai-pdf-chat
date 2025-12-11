const lib = require('./_lib');

module.exports = async (req, res) => {
  try {
    const name = (req.query.name || '').toLowerCase();
    const files = (await lib.getAllPDFs()).filter(f => name === '' || f.toLowerCase().includes(name));
    const results = files.map(f => ({ name: f, url: `/pdf/${encodeURIComponent(f)}` }));
    res.status(200).json({ results });
  } catch (err) {
    console.error('search error', err);
    res.status(500).json({ error: 'Server error' });
  }
};
