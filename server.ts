// ==========================================================
// SteriTrack: Full-Stack Express & Vite Server Entry Point
// ==========================================================

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './server/src/db/index.js';
import apiRouter from './server/src/routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';
  app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Basic security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProd) res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
    next();
  });

  await db.init();

  // Serialize local commands while their in-memory state is being committed.
  let commandTail: Promise<void> = Promise.resolve();
  app.use('/api', (req, res, next) => {
    if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
    let release!: () => void;
    const completed = new Promise<void>(resolve => { release = resolve; });
    const previous = commandTail;
    commandTail = completed;
    void previous.then(() => {
    let released = false;
    const done = () => { if (!released) { released = true; release(); } };
    res.once('finish', done);
    res.once('close', done);
    const before = db.store.snapshot();
    const send = res.json.bind(res);
    res.json = ((body: any) => {
      try {
        if (res.statusCode < 400 && body?.success !== false) db.persist();
        else db.store.restore(before);
        return send(body);
      } catch (error) {
        db.store.restore(before);
        res.status(503);
        return send({ success: false, error: 'The change could not be saved. Please retry.' });
      }
    }) as typeof res.json;
    next();
    });
  });

  app.use('/api', apiRouter);

  // Mount Frontend (Vite in Dev, Static in Prod)
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('⚡ Vite dev middleware mounted on Express');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const host = process.env.HOST || '127.0.0.1';
  app.listen(PORT, host, () => {
    console.log(`SteriTrack listening on http://${host}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting SteriTrack server:', err);
  process.exit(1);
});
