import type { Request, Response } from 'express';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_SUPABASE_URL = 'https://uwbhzobkvfvkitorweye.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3Ymh6b2JrdmZ2a2l0b3J3ZXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjY0NDcsImV4cCI6MjEwNjQ0MjQ0N30.6NCUHfxHYVAr8ZkZ7z84Rk1xIZYfKiX8YDokgfA9id8';

if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = DEFAULT_SUPABASE_URL;
if (!process.env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = DEFAULT_SUPABASE_URL;
if (!process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY;
if (!process.env.VITE_SUPABASE_ANON_KEY) process.env.VITE_SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY;

async function startServer() {
  const { createApiApp } = await import('./src/serverApp.js');
  const app = createApiApp();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const rootDir = process.cwd();

  // Vite Integration (Dev middleware vs Prod static serving)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.get('*', async (req: Request, res: Response, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(rootDir, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(rootDir, 'dist');
    const publicPath = path.resolve(rootDir, 'public');
    app.use(express.static(distPath, { maxAge: '7d', index: false }));
    app.use(express.static(publicPath, { maxAge: '7d', index: false }));
    app.get('*', (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Multi Gestor Server running on http://0.0.0.0:${PORT}`);
  });
}

const isTsx = process.execArgv.some((a) => a.includes('tsx')) || Boolean(process.env.TSX_ACTIVE);
const isServerTs = import.meta.url.endsWith('server.ts');
const compiledPath = path.resolve(process.cwd(), 'dist', 'server.js');

if (isServerTs && !isTsx) {
  if (fs.existsSync(compiledPath)) {
    await import(compiledPath);
  } else {
    const { spawn } = await import('node:child_process');
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
      {
        stdio: 'inherit',
        env: { ...process.env, TSX_ACTIVE: '1' },
      }
    );
    child.on('exit', (code) => process.exit(code ?? 0));
  }
} else {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
