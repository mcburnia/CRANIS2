const crypto = require('crypto');
const { WELCOME_SECRET } = require('../config');

function makeToken(username) {
  const payload = JSON.stringify({ u: username, t: Date.now() });
  const hmac = crypto.createHmac('sha256', WELCOME_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + hmac;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [b64, hmac] = token.split('.');
    const payload = Buffer.from(b64, 'base64').toString();
    const expected = crypto.createHmac('sha256', WELCOME_SECRET).update(payload).digest('hex');
    if (hmac !== expected) return null;
    const data = JSON.parse(payload);
    if (Date.now() - data.t > 24 * 60 * 60 * 1000) return null;
    return data.u;
  } catch {
    return null;
  }
}

function makeUnsubscribeToken(email) {
  const payload = email.toLowerCase();
  const hmac = crypto.createHmac('sha256', WELCOME_SECRET).update('unsub:' + payload).digest('hex');
  return Buffer.from(payload).toString('base64url') + '.' + hmac;
}

function verifyUnsubscribeToken(token) {
  if (!token) return null;
  try {
    const [b64, hmac] = token.split('.');
    const email = Buffer.from(b64, 'base64url').toString();
    const expected = crypto.createHmac('sha256', WELCOME_SECRET).update('unsub:' + email).digest('hex');
    if (hmac !== expected) return null;
    return email;
  } catch {
    return null;
  }
}

function getUnsubscribeUrl(email) {
  const token = makeUnsubscribeToken(email);
  return `https://dev.cranis2.dev/conformity-assessment/unsubscribe?token=${token}`;
}

function isAuthenticated(req) {
  return verifyToken(req.cookies.welcome_auth) !== null;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports = {
  makeToken,
  verifyToken,
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  getUnsubscribeUrl,
  isAuthenticated,
  escapeHtml,
  generateCode,
};
