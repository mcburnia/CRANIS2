const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const { PORT, WELCOME_SECRET, LOG_FILE } = require('./config');
const { initDatabase } = require('./lib/database');

const welcomeRoutes = require('./routes/welcome');
const craRoutes = require('./routes/cra-assessment');
const nis2Routes = require('./routes/nis2-assessment');
const importerRoutes = require('./routes/importer-assessment');
const pqcRoutes = require('./routes/pqc-assessment');
const notifiedBodyRoutes = require('./routes/notified-body-directory');
const marketSurveillanceRoutes = require('./routes/market-surveillance');
const incidentReadinessRoutes = require('./routes/incident-readiness');
const subscriptionRoutes = require('./routes/subscriptions');

/* ── Express setup ─────────────────────────────────────────────────── */

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(WELCOME_SECRET));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch {
  console.warn('Could not create log directory:', logDir);
}

/* ── Routes ────────────────────────────────────────────────────────── */

app.use('/cra-conformity-assessment', craRoutes);
app.use('/nis2-conformity-assessment', nis2Routes);
app.use('/importer-obligations-assessment', importerRoutes);
app.use('/pqc-readiness-assessment', pqcRoutes);
app.use('/notified-body-directory', notifiedBodyRoutes);
app.use('/market-surveillance-registration', marketSurveillanceRoutes);
app.use('/incident-readiness-checklist', incidentReadinessRoutes);
app.use('/conformity-assessment', subscriptionRoutes);
app.use('/', welcomeRoutes);

/* ── Start ─────────────────────────────────────────────────────────── */

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('CRANIS2 Welcome site running on port ' + PORT);
  });
}).catch(err => {
  console.error('Failed to initialise database:', err);
  // Start anyway without persistence
  app.listen(PORT, () => {
    console.log('CRANIS2 Welcome site running on port ' + PORT + ' (no database)');
  });
});
