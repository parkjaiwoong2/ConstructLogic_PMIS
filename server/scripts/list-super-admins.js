require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');

db.query("SELECT id, email, name, role, is_admin FROM auth_users WHERE role = 'superAdmin' OR is_admin = true ORDER BY id")
  .then(rows => {
    console.log('슈퍼관리자 목록:', rows?.length || 0, '명');
    (rows || []).forEach(u => console.log(' -', u.email, '|', u.name, '| role:', u.role, '| is_admin:', u.is_admin));
  })
  .catch(e => console.error(e))
  .finally(() => process.exit(0));
