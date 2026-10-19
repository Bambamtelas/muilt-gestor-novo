import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cache do cliente Supabase para reaproveitamento
let cachedClient: SupabaseClient | null = null;

function formatSupabaseUrl(rawUrl: string): string {
  let u = rawUrl.trim();
  u = u.replace(/\/rest\/v1\/?$/, '');
  u = u.replace(/\/+$/, '');
  return u;
}

const DEFAULT_SUPABASE_URL = 'https://uwbhzobkvfvkitorweye.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3Ymh6b2JrdmZ2a2l0b3J3ZXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjY0NDcsImV4cCI6MjEwNjQ0MjQ0N30.6NCUHfxHYVAr8ZkZ7z84Rk1xIZYfKiX8YDokgfA9id8';

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;
  return Boolean(url && url.trim().length > 0 && key && key.trim().length > 0);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  if (!rawUrl || !key) return null;

  try {
    const formattedUrl = formatSupabaseUrl(rawUrl);
    cachedClient = createClient(formattedUrl, key.trim(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('[Supabase] Erro ao inicializar cliente Supabase:', err);
    return null;
  }
}

export async function testSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  url: string | null;
  latencyMs?: number;
  message: string;
  error?: string;
  tables?: { name: string; count: number }[];
}> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null;
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      url,
      message: 'SUPABASE_URL e SUPABASE_ANON_KEY não estão configurados nas variáveis de ambiente (.env).',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      configured: true,
      connected: false,
      url,
      message: 'Falha ao instanciar o cliente Supabase.',
    };
  }

  const startTime = Date.now();
  try {
    // Tenta uma consulta rápida na tabela de tenants ou na tabela de sistema
    const { data, error } = await client.from('tenants').select('id', { count: 'exact', head: true });
    const latencyMs = Date.now() - startTime;

    if (error && error.code !== 'PGRST116' && !error.message.includes('relation "tenants" does not exist')) {
      return {
        configured: true,
        connected: false,
        url,
        latencyMs,
        message: `Erro ao conectar com Supabase: ${error.message}`,
        error: error.message,
      };
    }

    const tableNotFound = error && error.message.includes('relation "tenants" does not exist');

    return {
      configured: true,
      connected: true,
      url,
      latencyMs,
      message: tableNotFound
        ? 'Conexão com Supabase bem-sucedida! Porém a tabela "tenants" ainda não foi criada. Execute o Script SQL no SQL Editor do Supabase.'
        : `Conectado com sucesso ao Supabase PostgreSQL (${latencyMs}ms)!`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      configured: true,
      connected: false,
      url,
      latencyMs,
      message: `Erro na requisição ao Supabase: ${err?.message}`,
      error: err?.message,
    };
  }
}

// Script SQL completo para criar todas as tabelas no Supabase SQL Editor
export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- MULTI GESTOR - SCRIPT DE CRIAÇÃO DO BANCO DE DADOS NO SUPABASE POSTGRESQL
-- Copie e cole este script no painel "SQL Editor" do seu Supabase e clique em "RUN".
-- ==============================================================================

-- 1. TABELA DE EMPRESAS / CLIENTES DO SISTEMA (TENANTS)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trade_name TEXT,
  document TEXT,
  email TEXT,
  phone TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  logo_url TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 days'),
  subscription_expires_at TIMESTAMPTZ,
  selected_modules JSONB DEFAULT '["loans", "iptv", "business", "subscriptions"]'::jsonb,
  plan_monthly_price NUMERIC(10,2) DEFAULT 24.90,
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_reason TEXT,
  last_expiration_warning_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA DE PERFIS DE USUÁRIOS
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. MÓDULO EMPRÉSTIMO & NEGÓCIOS: CLIENTES (DEVEDORES)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  trade_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  street TEXT,
  number TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. MÓDULO EMPRÉSTIMO & NEGÓCIOS: COBRANÇAS / CONTRATOS / PARCELAS
CREATE TABLE IF NOT EXISTS charges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  payment_method TEXT DEFAULT 'pix',
  paid_at TIMESTAMPTZ,
  pix_copy_paste TEXT,
  pix_qr_code TEXT,
  loan_id TEXT,
  installment_number INTEGER,
  total_installments INTEGER,
  interest_amount NUMERIC(12,2) DEFAULT 0,
  fine_amount NUMERIC(12,2) DEFAULT 0,
  type TEXT DEFAULT 'sale',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. MÓDULO NEGÓCIOS: PRODUTOS / SERVIÇOS
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  category TEXT,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. MÓDULO IPTV: CLIENTES / ASSINANTES
CREATE TABLE IF NOT EXISTS iptv_subscribers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  server_name TEXT,
  username TEXT,
  password TEXT,
  mac_address TEXT,
  device_type TEXT,
  app_name TEXT,
  plan_name TEXT,
  plan_price NUMERIC(10,2) NOT NULL,
  screens_count INTEGER DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. MÓDULO IPTV: PLANOS
CREATE TABLE IF NOT EXISTS iptv_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  screens INTEGER DEFAULT 1,
  duration_days INTEGER DEFAULT 30,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. MÓDULO IPTV: APLICATIVOS
CREATE TABLE IF NOT EXISTS iptv_apps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT,
  download_url TEXT,
  activation_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. MÓDULO ASSINATURAS STREAMING: CLIENTES
CREATE TABLE IF NOT EXISTS subscription_customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. MÓDULO ASSINATURAS STREAMING: PLANOS
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  plan_title TEXT NOT NULL,
  monthly_price NUMERIC(10,2) NOT NULL,
  duration_days INTEGER DEFAULT 30,
  screens INTEGER DEFAULT 1,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. MÓDULO ASSINATURAS STREAMING: VENDAS
CREATE TABLE IF NOT EXISTS subscription_sales (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES subscription_customers(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  account_email TEXT,
  account_password TEXT,
  pin_code TEXT,
  profile_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TABELA DE PAGAMENTOS DE ASSINATURA DO MULTI GESTOR (MERCADO PAGO PIX)
CREATE TABLE IF NOT EXISTS subscription_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  pix_copy_paste TEXT,
  pix_qr_code TEXT,
  ticket_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

-- 13. CONFIGURAÇÕES GLOBAIS DO SISTEMA (VALORES DOS PLANOS)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. MÓDULO EMPRÉSTIMOS & COBRANÇAS PARCELADAS (ESPAÇO DEDICADO DE EMPRÉSTIMOS)
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  description TEXT,
  principal_amount NUMERIC(10,2) NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  is_recurring_or_installment BOOLEAN DEFAULT false,
  billing_type TEXT DEFAULT 'single',
  installments_count INTEGER DEFAULT 1,
  frequency TEXT DEFAULT 'monthly',
  payment_method TEXT DEFAULT 'pix',
  instructions TEXT,
  status TEXT DEFAULT 'active',
  total_to_receive NUMERIC(10,2) NOT NULL,
  installments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserção de valores padrão para os planos
INSERT INTO system_settings (key, value)
VALUES ('global_plan_prices', '{"module_1": 24.90, "module_2": 39.90, "module_3": 49.90, "module_4": 69.90}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ÍNDICES PARA VELOCIDADE MÁXIMA DE CONSULTAS
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_charges_tenant ON charges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_charges_customer ON charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_iptv_subscribers_tenant ON iptv_subscribers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_sales_tenant ON subscription_sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loans_tenant ON loans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);

-- GARANTIR ACESSO DIRETO DA APLICAÇÃO (EVITA BLOQUEIOS DE RLS)
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE charges DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE iptv_subscribers DISABLE ROW LEVEL SECURITY;
ALTER TABLE iptv_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE iptv_apps DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;

-- HABILITAR SUPABASE REALTIME (PUBLICAÇÃO OFICIAL DE EVENTOS EM TEMPO REAL)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE loans;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE customers;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE charges;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE iptv_subscribers;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE subscription_sales;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
`;
