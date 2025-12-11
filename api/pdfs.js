const lib = require('./_lib');

module.exports = async (req, res) => {
  try {
    const files = await lib.getAllPDFs();
    res.status(200).json({ pdfs: files });
  } catch (err) {
    console.error('pdfs error', err);
    res.status(500).json({ error: 'Server error' });
  }
};
