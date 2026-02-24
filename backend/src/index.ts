import express from 'express';
import cors from 'cors';
import { initDb } from './db/pool.js';
import { initGraph, closeDriver } from './db/neo4j.js';
import authRoutes from './routes/auth.js';
import orgRoutes from './routes/org.js';
import auditRoutes from './routes/audit.js';
import productRoutes from './routes/products.js';
import devRoutes from './routes/dev.js';  // DEV ONLY — REMOVE BEFORE PRODUCTION
import githubRoutes from './routes/github.js';
import technicalFileRoutes from './routes/technical-file.js';
import dashboardRoutes from './routes/dashboard.js';
import stakeholderRoutes from './routes/stakeholders.js';
import technicalFilesOverviewRoutes from './routes/technical-files-overview.js';
import obligationRoutes from './routes/obligations.js';
import reposOverviewRoutes from "./routes/repos-overview.js";
import contributorsOverviewRoutes from "./routes/contributors-overview.js";
import dependenciesOverviewRoutes from "./routes/dependencies-overview.js";
import riskFindingsRoutes from "./routes/risk-findings.js";
import adminRoutes from "./routes/admin.js";
import notificationRoutes from "./routes/notifications.js";
import feedbackRoutes from "./routes/feedback.js";
import sbomExportRoutes from "./routes/sbom-export.js";
import { startScheduler } from './services/scheduler.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/audit-log', auditRoutes);
app.use('/api/products', productRoutes);
app.use('/api/dev', devRoutes);  // DEV ONLY — REMOVE BEFORE PRODUCTION
app.use('/api/github', githubRoutes);
app.use('/api/technical-file', technicalFileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/stakeholders', stakeholderRoutes);
app.use('/api/technical-files', technicalFilesOverviewRoutes);
app.use('/api/obligations', obligationRoutes);
app.use('/api/repos', reposOverviewRoutes);
app.use('/api/contributors', contributorsOverviewRoutes);
app.use('/api/dependencies', dependenciesOverviewRoutes);
app.use('/api/risk-findings', riskFindingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/sbom', sbomExportRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Start server
async function start() {
  try {
    await initDb();
    await initGraph();
    app.listen(PORT, () => {
      console.log(`CRANIS2 backend listening on port ${PORT}`);
      startScheduler();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closeDriver();
  process.exit(0);
});

start();
