// Vercel serverless: /api/health
const db = require('../server/db');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    await db.query('SELECT 1');
    res.status(200).json({ ok: true, db: 'connected' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};
