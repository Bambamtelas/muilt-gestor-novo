import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://uwbhzobkvfvkitorweye.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3Ymh6b2JrdmZ2a2l0b3J3ZXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjY0NDcsImV4cCI6MjEwNjQ0MjQ0N30.6NCUHfxHYVAr8ZkZ7z84Rk1xIZYfKiX8YDokgfA9id8';

// Leitura das variáveis de ambiente oficiais do frontend (Vite) com fallback transparente
const rawUrl =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL;

const rawAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_ANON_KEY) ||
  DEFAULT_SUPABASE_ANON_KEY;

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

const formattedUrl = cleanUrl(rawUrl);
const formattedKey = cleanKey(rawAnonKey);

export interface SupabaseConfigValidation {
  isConfigured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  missingUrl: boolean;
  missingAnonKey: boolean;
  missingKeys: string[];
  errorMessage: string | null;
}

/**
 * Validação explícita da presença das variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
 */
export function validateSupabaseConfig(): SupabaseConfigValidation {
  const hasUrl = Boolean(formattedUrl && formattedUrl.length > 0);
  const hasAnonKey = Boolean(formattedKey && formattedKey.length > 0);
  const missingUrl = !hasUrl;
  const missingAnonKey = !hasAnonKey;
  const missingKeys: string[] = [];

  if (missingUrl) missingKeys.push('VITE_SUPABASE_URL');
  if (missingAnonKey) missingKeys.push('VITE_SUPABASE_ANON_KEY');

  const isConfigured = missingKeys.length === 0;

  let errorMessage: string | null = null;
  if (!isConfigured) {
    if (missingUrl && missingAnonKey) {
      errorMessage =
        'Supabase não está configurado: as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não foram informadas no ambiente.';
    } else if (missingUrl) {
      errorMessage =
        'Supabase não está configurado: a variável VITE_SUPABASE_URL está ausente no ambiente.';
    } else {
      errorMessage =
        'Supabase não está configurado: a variável VITE_SUPABASE_ANON_KEY está ausente no ambiente.';
    }
  }

  return {
    isConfigured,
    hasUrl,
    hasAnonKey,
    missingUrl,
    missingAnonKey,
    missingKeys,
    errorMessage,
  };
}

export const supabaseConfigStatus: SupabaseConfigValidation = validateSupabaseConfig();
export const isSupabaseConfigured: boolean = supabaseConfigStatus.isConfigured;

// Cliente Supabase oficial do frontend com gerenciamento automático de sessão
// Utiliza estritamente a chave pública anônima (VITE_SUPABASE_ANON_KEY), sem nunca usar a SERVICE_ROLE_KEY
export const supabase: SupabaseClient = createClient(
  formattedUrl || 'https://placeholder.supabase.co',
  formattedKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);
