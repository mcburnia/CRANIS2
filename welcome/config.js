const PORT = process.env.PORT || 3004;
const WELCOME_USER = process.env.WELCOME_USER || 'CRANIS2';
const WELCOME_PASS = process.env.WELCOME_PASS || '(LetMeIn)';
const WELCOME_SECRET = process.env.WELCOME_SECRET || 'dev-secret-change-me';
const LOG_FILE = process.env.LOG_FILE || '/data/access.log';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

module.exports = {
  PORT,
  WELCOME_USER,
  WELCOME_PASS,
  WELCOME_SECRET,
  LOG_FILE,
  RESEND_API_KEY,
  DATABASE_URL,
};
