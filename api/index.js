// Vercel: 모든 /api/* 요청을 받아 Express로 전달 (rewrite로 path 전달됨)
const app = require('../server/index.js');

module.exports = (req, res) => {
  try {
    const url = req.url || req.originalUrl || '/';
    const qIdx = url.indexOf('?');
    const pathPart = qIdx >= 0 ? url.slice(qIdx + 1) : '';
    const params = new URLSearchParams(pathPart);
    const apiPath = params.get('__path') || params.get('path');
    if (apiPath) {
      params.delete('__path');
      params.delete('path');
      const qs = params.toString();
      req.url = '/api/' + apiPath + (qs ? '?' + qs : '');
      req.query = Object.fromEntries(new URLSearchParams(qs));
    }
    app(req, res);
  } catch (err) {
    console.error('[api]', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};
