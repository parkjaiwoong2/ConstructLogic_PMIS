require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const db = require('../db');
(async () => {
  await db.run("UPDATE subscription_plans SET setup_fee = 100000, is_recommended = true WHERE code = 'basic'");
  await db.run("UPDATE subscription_plans SET setup_fee = 0 WHERE code IN ('trial', 'starter')");
  await db.run("UPDATE subscription_plans SET setup_fee = 300000 WHERE code = 'pro'");
  console.log('Updated plan defaults');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
