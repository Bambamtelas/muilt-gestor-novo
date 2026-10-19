import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cleanUrl(raw: string): string {
  if (!raw) return '';
  let u = raw.trim();
  while (u.startsWith('=')) u = u.substring(1).trim();
  u = u.replace(/\/rest\/v1\/?$/, '');
  u = u.replace(/\/+$/, '');
  return u;
}

function cleanKey(raw: string): string {
  if (!raw) return '';
  let k = raw.trim();
  while (k.startsWith('=')) k = k.substring(1).trim();
  return k;
}

export default defineConfig(({ mode }) => {
  // Carrega as variáveis do ambiente e dos arquivos .env / .env.local
  const env = loadEnv(mode, process.cwd(), '');

  const DEFAULT_SUPABASE_URL = 'https://uwbhzobkvfvkitorweye.supabase.co';
  const DEFAULT_SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3Ymh6b2JrdmZ2a2l0b3J3ZXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjY0NDcsImV4cCI6MjEwNjQ0MjQ0N30.6NCUHfxHYVAr8ZkZ7z84Rk1xIZYfKiX8YDokgfA9id8';

  const rawUrl =
    env.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    env.SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  const rawKey =
    env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  const viteSupabaseUrl = cleanUrl(rawUrl);
  const viteSupabaseAnonKey = cleanKey(rawKey);

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(viteSupabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(viteSupabaseAnonKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      exclude: ['@whiskeysockets/baileys', 'pino'],
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/data/**',
          '**/baileys_auth_info*/**',
          '**/*.json',
          '**/*.log',
          '**/.agents/**',
          '**/node_modules/**',
        ],
      },
    },
  };
});
