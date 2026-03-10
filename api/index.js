// Vercel: 모든 /api/* 요청을 받아 Express로 전달 (rewrite로 path 전달됨)
const app = require('../server/index.js');

module.exports = (req, res) => {
  const pathPart = req.url && req.url.includes('?') ? req.url.split('?')[1] : '';
  const params = new URLSearchParams(pathPart);
  const apiPath = params.get('__path');
  if (apiPath) {
    params.delete('__path');
    const qs = params.toString();
    req.url = '/api/' + apiPath + (qs ? '?' + qs : '');
    // Express가 수정된 URL의 query를 사용하도록 req.query 갱신
    req.query = Object.fromEntries(new URLSearchParams(qs));
  }
  app(req, res);
};
