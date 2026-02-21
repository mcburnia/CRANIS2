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
