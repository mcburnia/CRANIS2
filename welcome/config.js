const PORT = process.env.PORT || 3004;
const LOG_FILE = process.env.LOG_FILE || '/data/access.log';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

// Security-critical: require explicit configuration, no functional defaults
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[WELCOME] FATAL: ${name} environment variable is required but not set`);
    process.exit(1);
  }
  return value;
}

const WELCOME_USER = requireEnv('WELCOME_USER');
const WELCOME_PASS = requireEnv('WELCOME_PASS');
const WELCOME_SECRET = requireEnv('WELCOME_SECRET');

module.exports = {
  PORT,
  WELCOME_USER,
  WELCOME_PASS,
  WELCOME_SECRET,
  LOG_FILE,
  RESEND_API_KEY,
  DATABASE_URL,
};
