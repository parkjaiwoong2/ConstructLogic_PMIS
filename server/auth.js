const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'construct-logic-pmis-secret';

async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}
async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, is_admin: user.is_admin, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
