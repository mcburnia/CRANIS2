const fs = require('fs');
const { LOG_FILE } = require('../config');

function logAccess(req, event, extra) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip,
    country: req.headers['cf-ipcountry'] || null,
    city: req.headers['cf-ipcity'] || null,
    userAgent: req.headers['user-agent'] || null,
    path: req.originalUrl,
    ...(extra || {}),
  };
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('Failed to write access log:', err.message);
  }
}

module.exports = { logAccess };
