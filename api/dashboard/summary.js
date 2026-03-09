// Vercel: /api/dashboard/summary - Express로 위임
const serverless = require('serverless-http');
const app = require('../../server/index.js');
module.exports = serverless(app);
