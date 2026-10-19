import express, { Request, Response, Express } from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { store } from './lib/store.js';
import { notifyAdminsNewCustomer, sendSubscriptionExpiringAlert } from './lib/mailer.js';
import {
  sendWhatsAppMessage,
  sendDirectWhatsAppTextMessage,
  checkEvolutionInstanceStatus,
  fetchEvolutionQRCode,
  createEvolutionInstance,
  disconnectEvolutionInstance,
  TemplateType,
} from './lib/evolution.js';
import { calculatePlanPrice, AppModule } from './types/index.js';
import { testSupabaseConnection, isSupabaseConfigured, getSupabaseClient, SUPABASE_SCHEMA_SQL } from './lib/supabase.js';
import { initAllSavedBaileysSessions, syncSessionFilesToSupabase } from './lib/baileysManager.js';

dotenv.config();

const DEFAULT_SUPABASE_URL = 'https://uwbhzobkvfvkitorweye.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3Ymh6b2JrdmZ2a2l0b3J3ZXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NjY0NDcsImV4cCI6MjEwNjQ0MjQ0N30.6NCUHfxHYVAr8ZkZ7z84Rk1xIZYfKiX8YDokgfA9id8';

if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = DEFAULT_SUPABASE_URL;
if (!process.env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = DEFAULT_SUPABASE_URL;
if (!process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY;
if (!process.env.VITE_SUPABASE_ANON_KEY) process.env.VITE_SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApiApp(): Express {
  const app = express();

  app.use(compression() as any);
  app.use(express.json());
  
  // Public assets
  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));

  // 1. Health Endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        mercadoPago: {
          configured: Boolean(store.mercadoPagoToken || process.env.MERCADO_PAGO_ACCESS_TOKEN),
          mode: (store.mercadoPagoToken || process.env.MERCADO_PAGO_ACCESS_TOKEN) ? 'production_api' : 'sandbox_simulation',
        },
        supabase: {
          configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
          mode: Boolean(process.env.SUPABASE_URL) ? 'postgresql_connected' : 'embedded_store',
        },
        whatsappEvolution: {
          configured: Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY),
          mode: Boolean(process.env.EVOLUTION_API_URL) ? 'evolution_instance' : 'direct_wa_me_ready',
        },
        smtp: {
          configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
        },
      },
    });
  });

  // 2. Database Status
  app.get('/api/database/status', (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || undefined;
    const stats = store.getSystemStats(tenantId);
    res.json(stats);
  });

  // Supabase PostgreSQL Management
  app.get('/api/database/supabase/status', async (_req: Request, res: Response) => {
    try {
      const status = await testSupabaseConnection();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao verificar Supabase', details: err?.message });
    }
  });

  app.post('/api/database/supabase/sync', async (_req: Request, res: Response) => {
    try {
      const result = await store.syncAllToSupabase();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao sincronizar com Supabase', details: err?.message });
    }
  });

  app.get('/api/database/supabase/schema', (_req: Request, res: Response) => {
    res.json({
      sql: SUPABASE_SCHEMA_SQL,
      configured: isSupabaseConfigured(),
    });
  });

  // 3. Auth & Profile Provisioning
  // 3.1 Login com verificação OBRIGATÓRIA de conta existente
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({
          error: 'E-mail obrigatório',
          message: 'Por favor, informe seu e-mail para acessar a conta.',
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const account = await store.findAccountAsync(cleanEmail);

      // Se NÃO tiver conta cadastrada, NÃO ENTRA de forma alguma!
      if (!account) {
        return res.status(404).json({
          error: 'Conta não encontrada',
          message: 'Nenhuma conta cadastrada com este e-mail. Por favor, acesse a aba "Criar Conta" ao lado para se cadastrar.',
        });
      }

      // Verificação de senha caso tenha sido definida
      if (password && !store.verifyPassword(cleanEmail, password)) {
        return res.status(401).json({
          error: 'Senha incorreta',
          message: 'A senha digitada está incorreta para esta conta.',
        });
      }

      res.json({
        success: true,
        profile: account.profile,
        tenant: account.tenant,
      });
    } catch (err: any) {
      console.error('[Login Error]', err);
      res.status(500).json({ error: 'Erro no servidor durante o login', message: err?.message });
    }
  });

  // 3.1.1 Redefinição de Senha
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { email, newPassword } = req.body;
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'E-mail obrigatório' });
      }
      if (!newPassword || typeof newPassword !== 'string' || !newPassword.trim()) {
        return res.status(400).json({ error: 'Nova senha obrigatória' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const account = await store.findAccountAsync(cleanEmail);
      if (!account) {
        return res.status(404).json({
          error: 'Conta não encontrada',
          message: 'Nenhuma conta cadastrada com este e-mail.',
        });
      }

      store.setPassword(cleanEmail, newPassword.trim());
      res.json({
        success: true,
        message: 'Senha redefinida com sucesso!',
      });
    } catch (err: any) {
      console.error('[Reset Password Error]', err);
      res.status(500).json({ error: 'Erro ao redefinir senha', message: err?.message });
    }
  });

  // 3.1.2 Alteração de Senha do Administrador Master
  app.post('/api/auth/change-master-password', async (req: Request, res: Response) => {
    try {
      const { email, newPassword } = req.body;
      const targetEmail = (email && typeof email === 'string' && email.trim())
        ? email.trim().toLowerCase()
        : 'betaof10@hotmail.com';

      if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres.' });
      }

      store.setPassword(targetEmail, newPassword.trim());
      console.log(`[Auth] ✅ Senha do Admin Master (${targetEmail}) alterada com sucesso!`);

      res.json({
        success: true,
        message: 'Senha do Admin Master alterada com sucesso!',
      });
    } catch (err: any) {
      console.error('[Change Master Password Error]', err);
      res.status(500).json({ error: 'Erro ao alterar senha do Admin Master', details: err?.message });
    }
  });

  // 3.1.3 Verificação de Senha do Administrador Master (para abertura do painel restrito)
  app.post('/api/auth/verify-master-password', (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Senha é obrigatória' });
      }

      const masterEmail = 'betaof10@hotmail.com';
      const cleanPass = password.trim();

      const isValid = store.verifyPassword(masterEmail, cleanPass);

      if (isValid) {
        res.json({ success: true, message: 'Autenticação Master realizada com sucesso.' });
      } else {
        res.status(401).json({ error: 'Senha incorreta', message: 'Senha incorreta para Administrador Master.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao verificar senha', details: err?.message });
    }
  });

  // 3.1.4 Alteração de Senha de Acesso do Usuário / Tenant
  app.post('/api/auth/change-password', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'E-mail obrigatório' });
      }
      if (!password || typeof password !== 'string' || password.trim().length < 4) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      store.setPassword(cleanEmail, password.trim());
      console.log(`[Auth] ✅ Senha de ${cleanEmail} alterada com sucesso!`);
      res.json({ success: true, message: 'Senha de acesso alterada com sucesso!' });
    } catch (err: any) {
      console.error('[Change Password Error]', err);
      res.status(500).json({ error: 'Erro ao alterar senha', details: err?.message });
    }
  });

  // 3.1.5 Checagem de e-mail existente (Anti-duplicação)
  app.get('/api/auth/check-email', async (req: Request, res: Response) => {
    try {
      const email = (req.query.email as string) || '';
      if (!email || !email.trim()) {
        return res.json({ exists: false });
      }
      const cleanEmail = email.trim().toLowerCase();
      const existing = await store.findAccountAsync(cleanEmail);
      res.json({ exists: Boolean(existing) });
    } catch {
      res.json({ exists: false });
    }
  });

  // 3.2 Cadastro de Nova Conta
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password, companyName, fullName, phone, modules } = req.body;
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'E-mail obrigatório', message: 'Informe o e-mail da conta.' });
      }
      if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        return res.status(400).json({ error: 'Nome da empresa obrigatório', message: 'Informe o nome da sua empresa.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = await store.findAccountAsync(cleanEmail);
      if (existing) {
        return res.status(409).json({
          error: 'E-mail já cadastrado',
          message: 'Já existe uma conta cadastrada com este e-mail. Por favor, acesse pela aba "Entrar".',
        });
      }

      const created = store.createAccount({
        email: cleanEmail,
        companyName,
        fullName,
        phone,
        modules,
        password,
      });

      res.status(201).json({
        success: true,
        profile: created.profile,
        tenant: created.tenant,
      });
    } catch (err: any) {
      console.error('[Register Error]', err);
      res.status(500).json({ error: 'Erro no servidor durante o cadastro', message: err?.message });
    }
  });

  app.get('/api/auth/profile/:userId', async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const email = (req.query.email as string) || '';
    const allowCreate = req.query.allowCreate === 'true';

    if (!email) {
      return res.status(400).json({ error: 'E-mail não informado' });
    }

    if (allowCreate) {
      const data = store.getOrCreateProfile(userId, email);
      return res.json(data);
    }

    const account = await store.findAccountAsync(email);
    if (!account) {
      return res.status(404).json({
        error: 'Conta não encontrada',
        message: 'Nenhuma conta cadastrada com este e-mail.',
      });
    }

    res.json(account);
  });

  app.post('/api/auth/profile', (req: Request, res: Response) => {
    const { userId, email, fullName } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail obrigatório' });
    }
    const data = store.getOrCreateProfile(userId || `user-${Date.now()}`, email);
    if (fullName) {
      data.profile.full_name = fullName;
    }
    res.json(data);
  });

  // 4. Mercado Pago PIX Subscription Order Creation
  app.post('/api/mercadopago/create-order', async (req: Request, res: Response) => {
    try {
      const { tenantId = 'tenant-default', userEmail = 'dlinformatica3137@gmail.com' } = req.body;
      const order = await store.createSubscriptionOrder(tenantId, userEmail);
      res.json(order);
    } catch (err: any) {
      console.error('Error creating Mercado Pago order:', err);
      res.status(500).json({ error: 'Failed to create subscription order', details: err?.message });
    }
  });

  // 5. Mercado Pago Order Status & Approval (Extends 30 days)
  app.post('/api/mercadopago/order-status', async (req: Request, res: Response) => {
    try {
      const { order_id, simulate_approval } = req.body;
      if (!order_id) {
        return res.status(400).json({ error: 'order_id is required' });
      }

      if (simulate_approval) {
        const approved = store.approveSubscriptionOrder(order_id, true);
        if (!approved) {
          return res.status(404).json({ error: 'Order not found' });
        }
        return res.json({
          status: 'approved',
          order: approved.payment,
          tenant: approved.tenant,
          message: 'Assinatura renovada por 30 dias com sucesso!',
        });
      }

      const payment = store.getSubscriptionPayment(order_id);
      if (!payment) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Se ainda pendente, verifica diretamente na API oficial do Mercado Pago
      if (payment.status === 'pending') {
        const mpToken = store.mercadoPagoToken || process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (mpToken) {
          try {
            let isApproved = false;
            if (payment.gateway_payment_id) {
              const mpCheck = await fetch(`https://api.mercadopago.com/v1/payments/${payment.gateway_payment_id}`, {
                headers: { Authorization: `Bearer ${mpToken}` },
              });
              if (mpCheck.ok) {
                const mpData = await mpCheck.json();
                if (mpData.status === 'approved') isApproved = true;
              }
            } else {
              const mpSearch = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${order_id}`, {
                headers: { Authorization: `Bearer ${mpToken}` },
              });
              if (mpSearch.ok) {
                const searchData = await mpSearch.json();
                if (searchData.results?.some((r: any) => r.status === 'approved')) {
                  isApproved = true;
                }
              }
            }

            if (isApproved) {
              const approved = store.approveSubscriptionOrder(order_id);
              if (approved) {
                return res.json({
                  status: 'approved',
                  order: approved.payment,
                  tenant: approved.tenant,
                  message: 'Pagamento PIX confirmado pelo Mercado Pago! +30 dias liberados!',
                });
              }
            }
          } catch (mpErr) {
            console.warn('[Mercado Pago polling check error]', mpErr);
          }
        }
      }

      if (payment.status === 'approved') {
        let tenant = store.getTenant(payment.tenant_id);
        if (!tenant || (tenant.subscription_status !== 'active' && tenant.subscription_status !== 'lifetime')) {
          const approved = store.approveSubscriptionOrder(order_id);
          if (approved) tenant = approved.tenant;
        }
        return res.json({
          status: 'approved',
          order: payment,
          tenant: tenant || store.getTenant(payment.tenant_id),
          message: 'Assinatura ativa por 30 dias!',
        });
      }

      res.json({
        status: payment.status,
        order: payment,
      });
    } catch (err: any) {
      console.error('Error checking order status:', err);
      res.status(500).json({ error: 'Failed to check order status', details: err?.message });
    }
  });

  // 5.1 Webhook Oficial do Mercado Pago para Liberação Instantânea (+30 Dias)
  app.all('/api/mercadopago/webhook', async (req: Request, res: Response) => {
    try {
      const topic = req.query.topic || req.body?.type || req.query.type;
      const id = req.query.id || req.body?.data?.id || req.query['data.id'];

      console.log(`[Mercado Pago Webhook] Notificação recebida: topic=${topic}, id=${id}`);

      if ((topic === 'payment' || req.body?.action?.startsWith('payment')) && id) {
        const mpToken = store.mercadoPagoToken || process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (mpToken) {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
            headers: { Authorization: `Bearer ${mpToken}` },
          });
          if (mpRes.ok) {
            const paymentData = await mpRes.json();
            console.log(`[Mercado Pago Webhook] Status do pagamento ${id}: ${paymentData.status}`);
            if (paymentData.status === 'approved') {
              const externalRef = paymentData.external_reference;
              if (externalRef) {
                const approved = store.approveSubscriptionOrder(externalRef);
                if (approved) {
                  console.log(`[Mercado Pago Webhook] ✅ Pedido ${externalRef} liberado automaticamente (+30 dias) para ${approved.tenant.name}!`);
                }
              }
            }
          }
        }
      }
      res.status(200).send('OK');
    } catch (err) {
      console.error('[Mercado Pago Webhook Error]', err);
      res.status(200).send('OK');
    }
  });

  // 5.2 Consulta da Configuração do Mercado Pago
  app.get('/api/mercadopago/config', async (req: Request, res: Response) => {
    let mpToken = store.mercadoPagoToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || '';

    // Fallback dinâmico: se ainda não estiver carregado em memória, busca do Supabase em tempo real
    if (!mpToken && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data } = await client.from('system_settings').select('value').eq('key', 'mercadopago_config').maybeSingle();
          if (data?.value?.access_token) {
            mpToken = String(data.value.access_token).trim();
            await store.setMercadoPagoToken(mpToken);
          }
        }
      } catch {}
    }

    const isConfigured = Boolean(mpToken && mpToken.trim().length > 10);
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${appUrl}/api/mercadopago/webhook`;

    let accountInfo: any = null;
    let valid = false;

    if (isConfigured) {
      try {
        const mpRes = await fetch('https://api.mercadopago.com/users/me', {
          headers: { Authorization: `Bearer ${mpToken.trim()}` },
        });
        if (mpRes.ok) {
          const data = await mpRes.json();
          valid = true;
          accountInfo = {
            id: data.id,
            nickname: data.nickname,
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            site_id: data.site_id,
          };
        }
      } catch (e) {
        console.warn('[Mercado Pago config check]', e);
      }
    }

    const maskedToken = isConfigured
      ? `${mpToken.slice(0, 10)}...${mpToken.slice(-6)}`
      : '';

    res.json({
      configured: isConfigured,
      valid,
      maskedToken,
      webhookUrl,
      accountInfo,
    });
  });

  // 5.3 Salvar Credenciais do Mercado Pago e Testar
  app.post('/api/mercadopago/config', async (req: Request, res: Response) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken || typeof accessToken !== 'string' || accessToken.trim().length < 10) {
        return res.status(400).json({ error: 'Access Token do Mercado Pago inválido ou muito curto' });
      }

      const cleanToken = accessToken.trim();

      // Testa na API do Mercado Pago
      const mpRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });

      if (!mpRes.ok) {
        return res.status(400).json({
          error: 'Credencial inválida no Mercado Pago',
          details: 'Verifique se você copiou o "Access Token de Produção" no portal Mercado Pago Developers.',
        });
      }

      const accountData = await mpRes.json();

      // Salva no store, .env e Supabase
      await store.setMercadoPagoToken(cleanToken);

      res.json({
        success: true,
        message: 'Mercado Pago conectado com sucesso! Liberação automática de 30 dias ativada.',
        account: {
          id: accountData.id,
          nickname: accountData.nickname,
          name: `${accountData.first_name || ''} ${accountData.last_name || ''}`.trim() || accountData.nickname,
          email: accountData.email,
          country: accountData.site_id,
        },
      });
    } catch (err: any) {
      console.error('[Save MP Token Error]', err);
      res.status(500).json({ error: 'Falha ao salvar configuração do Mercado Pago', details: err?.message });
    }
  });

  // 6. Plan Prices Management (Admin Master)
  app.get('/api/plans/prices', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(store.getGlobalPlanPrices());
  });

  app.put('/api/plans/prices', (req: Request, res: Response) => {
    try {
      const updated = store.updateGlobalPlanPrices(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update plan prices', details: err?.message });
    }
  });

  // 6.1 Configuração Global de Link Externo / Lojinha Online
  app.get('/api/system/external-link', (_req: Request, res: Response) => {
    res.json(store.getExternalLinkConfig());
  });

  app.post('/api/system/external-link', (req: Request, res: Response) => {
    try {
      const updated = store.updateExternalLinkConfig(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Falha ao atualizar link externo', details: err?.message });
    }
  });

  app.put('/api/system/external-link', (req: Request, res: Response) => {
    try {
      const updated = store.updateExternalLinkConfig(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Falha ao atualizar link externo', details: err?.message });
    }
  });

  // 6.2 Configuração Global de Suporte WhatsApp (Botão Flutuante)
  app.get('/api/system/support-whatsapp', (_req: Request, res: Response) => {
    res.json(store.getSupportWhatsAppConfig());
  });

  app.post('/api/system/support-whatsapp', (req: Request, res: Response) => {
    try {
      const updated = store.updateSupportWhatsAppConfig(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Falha ao atualizar suporte WhatsApp', details: err?.message });
    }
  });

  app.put('/api/system/support-whatsapp', (req: Request, res: Response) => {
    try {
      const updated = store.updateSupportWhatsAppConfig(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Falha ao atualizar suporte WhatsApp', details: err?.message });
    }
  });

  // 7. Notify Master Admins on New Customer
  app.post('/api/notify-new-customer', async (req: Request, res: Response) => {
    try {
      const { customer, tenantId, userEmail } = req.body;
      if (!customer || !customer.name) {
        return res.status(400).json({ error: 'Customer details are required' });
      }

      const tenant = tenantId ? store.getTenant(tenantId) : undefined;
      const result = await notifyAdminsNewCustomer({ customer, tenant, userEmail });
      res.json(result);
    } catch (err: any) {
      console.error('Error in notify-new-customer:', err);
      res.status(500).json({ error: 'Failed to notify admins', details: err?.message });
    }
  });

  // 8. Preventive Expiration Notifications (<= 3 Days Alert)
  app.post('/api/subscription/check-preventive-alerts', async (_req: Request, res: Response) => {
    try {
      const allTenants = store.getAllTenants();
      const globalPrices = store.getGlobalPlanPrices();
      const results: any[] = [];
      const now = Date.now();

      for (const t of allTenants) {
        if (t.subscription_status === 'lifetime') continue;
        const expiry = t.subscription_expires_at
          ? new Date(t.subscription_expires_at).getTime()
          : new Date(t.trial_ends_at).getTime();
        const diffMs = expiry - now;
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Check if between 0 and 3 days remaining
        if (diffMs > 0 && daysRemaining <= 3) {
          const planPrice =
            t.plan_monthly_price ||
            (t.selected_modules && t.selected_modules.length > 0
              ? calculatePlanPrice(t.selected_modules.length, globalPrices)
              : globalPrices.module_1);

          const mailRes = await sendSubscriptionExpiringAlert({ tenant: t, daysRemaining, planPrice });

          if (t.phone) {
            const waMsg = `⚠️ *[Multi Gestor - Alerta de Renovação]*\n\nOlá, *${t.trade_name || t.name}*!\n\nInformamos que faltam apenas *${daysRemaining} dia(s)* para a expiração da sua assinatura do Multi Gestor.\n\nEvite o bloqueio dos seus módulos e cobranças renovando antecipadamente via PIX instantâneo no valor de *R$ ${planPrice.toFixed(2).replace('.', ',')}*.\n\nAcesse seu painel e clique em *Assinar PIX* para liberar seus 30 dias na hora! 🚀`;
            await sendDirectWhatsAppTextMessage({ phone: t.phone, message: waMsg });
          }

          store.updateTenant(t.id, { last_expiration_warning_sent_at: new Date().toISOString() });
          results.push({
            tenantId: t.id,
            name: t.name,
            email: t.email,
            daysRemaining,
            planPrice,
            alert: mailRes,
          });
        }
      }

      res.json({
        success: true,
        checked: allTenants.length,
        alertedCount: results.length,
        alerts: results,
      });
    } catch (err: any) {
      console.error('Error in check-preventive-alerts:', err);
      res.status(500).json({ error: 'Failed to process preventive alerts', details: err?.message });
    }
  });

  app.post('/api/subscription/send-preventive-alert/:tenantId', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const tenant = store.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const globalPrices = store.getGlobalPlanPrices();
      const expiry = tenant.subscription_expires_at
        ? new Date(tenant.subscription_expires_at).getTime()
        : new Date(tenant.trial_ends_at).getTime();
      const diffMs = expiry - Date.now();
      const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const planPrice =
        tenant.plan_monthly_price ||
        (tenant.selected_modules && tenant.selected_modules.length > 0
          ? calculatePlanPrice(tenant.selected_modules.length, globalPrices)
          : globalPrices.module_1);

      const mailRes = await sendSubscriptionExpiringAlert({ tenant, daysRemaining, planPrice });

      if (tenant.phone) {
        const waMsg = `⚠️ *[Multi Gestor - Alerta de Renovação]*\n\nOlá, *${tenant.trade_name || tenant.name}*!\n\nInformamos que faltam apenas *${daysRemaining} dia(s)* para a expiração da sua assinatura do Multi Gestor.\n\nEvite o bloqueio dos seus módulos e cobranças renovando antecipadamente via PIX instantâneo no valor de *R$ ${planPrice.toFixed(2).replace('.', ',')}*.\n\nAcesse seu painel e clique em *Assinar PIX* para liberar seus 30 dias na hora! 🚀`;
        await sendDirectWhatsAppTextMessage({ phone: tenant.phone, message: waMsg });
      }

      store.updateTenant(tenant.id, { last_expiration_warning_sent_at: new Date().toISOString() });

      res.json({
        success: true,
        tenantId: tenant.id,
        email: tenant.email,
        daysRemaining,
        planPrice,
        result: mailRes,
      });
    } catch (err: any) {
      console.error('Error sending individual preventive alert:', err);
      res.status(500).json({ error: 'Failed to send alert', details: err?.message });
    }
  });

  // 9. Send Charge via WhatsApp (Evolution API or direct wa.me link)
  app.post('/api/whatsapp/send-charge', async (req: Request, res: Response) => {
    try {
      const {
        chargeId,
        customerId,
        tenantId,
        templateType = 'friendly',
        customMessage,
        charge: chargeFromReq,
        customer: customerFromReq,
        phone: phoneFromReq,
        customerName: customerNameFromReq,
        amount: amountFromReq,
        dueDate: dueDateFromReq,
        description: descriptionFromReq,
      } = req.body;

      let charge = chargeFromReq || (chargeId ? store.getChargeById(chargeId) : undefined);

      // Se ainda não encontrou e o Supabase está configurado, busca na tabela charges
      if (!charge && isSupabaseConfigured() && chargeId) {
        try {
          const client = getSupabaseClient();
          if (client) {
            const { data } = await client.from('charges').select('*').eq('id', chargeId).maybeSingle();
            if (data) charge = data;
          }
        } catch (dbErr) {
          console.warn('[WhatsApp] Erro ao consultar cobrança no Supabase:', dbErr);
        }
      }

      // Fallback resiliente para charge
      if (!charge) {
        charge = {
          id: chargeId || `chg-${Date.now()}`,
          customer_id: customerId || 'cust-manual',
          tenant_id: tenantId || 'tenant-default',
          amount: Number(amountFromReq || 0),
          due_date: dueDateFromReq || new Date().toISOString().slice(0, 10),
          status: 'pending',
          description: descriptionFromReq || 'Cobrança de Serviços',
        };
      }

      let customer = customerFromReq || (customerId || charge.customer_id ? store.getCustomerById(customerId || charge.customer_id) : undefined);

      // Se ainda não encontrou e o Supabase está configurado, busca na tabela customers
      if (!customer && isSupabaseConfigured() && (customerId || charge.customer_id)) {
        try {
          const client = getSupabaseClient();
          if (client) {
            const cid = customerId || charge.customer_id;
            const { data } = await client.from('customers').select('*').eq('id', cid).maybeSingle();
            if (data) customer = data;
          }
        } catch (dbErr) {
          console.warn('[WhatsApp] Erro ao consultar cliente no Supabase:', dbErr);
        }
      }

      // Fallback resiliente para customer
      if (!customer) {
        customer = {
          id: customerId || charge.customer_id || 'cust-manual',
          tenant_id: tenantId || charge.tenant_id || 'tenant-default',
          name: customerNameFromReq || (charge as any).customer_name || 'Cliente',
          whatsapp: phoneFromReq || (charge as any).customer_whatsapp || (charge as any).customer_phone || '',
          phone: phoneFromReq || (charge as any).customer_phone || (charge as any).customer_whatsapp || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      const tenant = (tenantId ? store.getTenant(tenantId) : undefined)
        || (charge.tenant_id ? store.getTenant(charge.tenant_id) : undefined)
        || req.body.tenant
        || (store.tenants && store.tenants[0])
        || { id: tenantId || 'tenant-default', name: 'Multi Gestor', pix_key: '' };

      const apiConfig = tenant ? store.getWhatsAppConfig(tenant.id) : undefined;

      const rawPhone = phoneFromReq || customer.whatsapp || customer.phone || (charge as any).customer_whatsapp || (charge as any).customer_phone || '';
      const cleanPhone = (rawPhone || '').replace(/\D/g, '');
      const formattedPhone = cleanPhone.length === 10 || cleanPhone.length === 11 
        ? `55${cleanPhone}` 
        : cleanPhone;

      if (!customer.whatsapp) customer.whatsapp = formattedPhone;
      if (!customer.phone) customer.phone = formattedPhone;

      const defaultWaUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(customMessage || '')}`;

      let result: any;
      try {
        result = await sendWhatsAppMessage({
          charge,
          customer,
          tenant,
          templateType: templateType as TemplateType,
          customMessage,
          apiConfig,
          phone: formattedPhone,
        });
      } catch (sendErr: any) {
        console.error('[WhatsApp] Erro no envio Baileys/Evolution:', sendErr);
        result = {
          success: false,
          method: 'direct_whatsapp',
          sentDirectly: false,
          error: sendErr?.message || 'Falha ao disparar pelo WhatsApp',
        };
      }

      if (!result.waDirectUrl) {
        result.waDirectUrl = defaultWaUrl;
      }
      if (!result.phone) {
        result.phone = formattedPhone;
      }

      if (result.success && (result as any).instanceName && tenant && apiConfig) {
        const actualInst = (result as any).instanceName;
        if (apiConfig.instance_name !== actualInst || apiConfig.status !== 'connected') {
          console.log(`[WhatsApp Sync] Sincronizando config para "${actualInst}"`);
          apiConfig.instance_name = actualInst;
          apiConfig.status = 'connected';
          store.saveWhatsAppConfig(tenant.id, apiConfig);
        }
      }

      // Salva no log de disparos para acompanhamento no painel
      if (tenant) {
        store.addWhatsAppDispatchLog({
          id: `charge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tenant_id: tenant.id,
          timestamp: new Date().toISOString(),
          type: 'direct_charge',
          customer_name: customer.name || customerNameFromReq || 'Cliente',
          phone: formattedPhone,
          amount: Number(charge.amount || 0),
          description: charge.description || 'Cobrança de Serviços',
          status: result.success && result.sentDirectly ? 'sent' : 'fallback_wa',
          method: result.method,
          details: result.success && result.sentDirectly
            ? `Enviado diretamente via WhatsApp do aparelho conectado (${result.instanceName})`
            : result.error || 'Enviado via link manual',
          wa_link: result.waDirectUrl,
        });
      }

      res.json(result);
    } catch (err: any) {
      console.error('Error sending WhatsApp charge:', err);
      const cleanPhone = (req.body.phone || req.body.customer?.whatsapp || '').replace(/\D/g, '');
      const formattedPhone = cleanPhone.length === 10 || cleanPhone.length === 11 ? `55${cleanPhone}` : cleanPhone;
      const waDirectUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(req.body.customMessage || '')}`;
      res.json({
        success: false,
        sentDirectly: false,
        error: err?.message || 'Falha no processamento da cobrança',
        waDirectUrl,
      });
    }
  });

  // 9.1 Obter e Salvar Configurações da Instância WhatsApp do Tenant
  app.get('/api/whatsapp/config', async (req: Request, res: Response) => {
    try {
      const tenantId = (req.query.tenantId as string);
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId é obrigatório' });
      }
      const config = store.getWhatsAppConfig(tenantId);

      // Sincroniza o status em tempo real com a instância real
      if (config && config.instance_name) {
        const isMaster = tenantId === '2caa686e-9c14-439b-8e9d-9b25cfbac345';
        try {
          const liveCheck = await checkEvolutionInstanceStatus({
            server_url: config.server_url,
            api_key: config.api_key,
            instance_name: config.instance_name,
          });

          const actualStatus = liveCheck.connected ? 'connected' : 'disconnected';
          let changed = false;

          const actualInst = (liveCheck as any).actualInstanceName || (liveCheck as any).instanceName;
          if (actualInst && config.instance_name !== actualInst) {
            // Conta de cliente nunca pode herdar nome de instância com ativação do master
            if (isMaster || (!actualInst.includes('ativa') && !actualInst.includes('master') && !actualInst.startsWith('instancia_'))) {
              console.log(`[WhatsApp Sync] Atualizando instância de "${config.instance_name}" para "${actualInst}"`);
              config.instance_name = actualInst;
              changed = true;
            }
          }

          if (config.status !== actualStatus) {
            // Se não for master e reportar conectado mas com dados do master, força disconnected
            if (!isMaster && (config.instance_name.includes('ativa') || (liveCheck.ownerPhone && (liveCheck.ownerPhone.includes('219899850026') || liveCheck.ownerPhone.includes('21989850026'))))) {
              config.status = 'disconnected';
              config.connected_phone = '';
              delete config.connected_at;
              changed = true;
            } else {
              config.status = actualStatus;
              changed = true;
            }
          }

          if (liveCheck.ownerPhone && config.connected_phone !== liveCheck.ownerPhone) {
            if (!isMaster && (liveCheck.ownerPhone.includes('219899850026') || liveCheck.ownerPhone.includes('21989850026'))) {
              config.connected_phone = '';
            } else {
              config.connected_phone = liveCheck.ownerPhone;
            }
            changed = true;
          }

          if (config.status === 'connected' && !config.connected_at) {
            config.connected_at = new Date().toISOString();
            changed = true;
          } else if (config.status === 'disconnected' && config.connected_at) {
            config.connected_at = undefined;
            changed = true;
          }

          if (changed) {
            store.saveWhatsAppConfig(tenantId, config);
          }
        } catch (checkErr) {
          console.warn('[WhatsApp Config] Não foi possível verificar status ao vivo:', checkErr);
        }
      }

      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load WhatsApp config', details: err?.message });
    }
  });

  app.post('/api/whatsapp/config', (req: Request, res: Response) => {
    try {
      const { tenantId, config } = req.body;
      if (!tenantId || !config) {
        return res.status(400).json({ error: 'tenantId and config are required' });
      }
      const saved = store.saveWhatsAppConfig(tenantId, config);
      res.json({ success: true, config: saved });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save WhatsApp config', details: err?.message });
    }
  });

  // 9.2 Teste Real de Disparo via WhatsApp
  app.post('/api/whatsapp/test-send', async (req: Request, res: Response) => {
    try {
      const { tenantId, phone, message } = req.body;
      if (!tenantId || !phone || !message) {
        return res.status(400).json({ error: 'tenantId, telefone e mensagem são obrigatórios.' });
      }

      const tenant = store.getTenant(tenantId);
      const config = store.getWhatsAppConfig(tenantId);

      const result = await sendDirectWhatsAppTextMessage({
        phone,
        message,
        apiConfig: config,
      });

      // Salva no log de disparos
      if (tenant || tenantId) {
        store.addWhatsAppDispatchLog({
          id: `test-${Date.now()}`,
          tenant_id: tenant?.id || tenantId,
          timestamp: new Date().toISOString(),
          type: 'manual_test',
          customer_name: 'Envio de Teste',
          phone,
          amount: 0,
          description: 'Teste de Disparo de Mensagem WhatsApp',
          status: result.success && result.method === 'evolution_api' ? 'sent' : 'fallback_wa',
          method: result.method,
          details: result.success ? 'Teste concluído' : (result as any).error,
          wa_link: result.waDirectUrl,
        });
      }

      res.json(result);
    } catch (err: any) {
      console.error('Error in WhatsApp test send:', err);
      res.status(500).json({ error: 'Failed to execute test send', details: err?.message });
    }
  });

  // 9.2.1 Disparo Direto de Cobrança / Mensagem via WhatsApp do Aparelho Conectado
  app.post('/api/whatsapp/send-direct', async (req: Request, res: Response) => {
    try {
      const { tenantId, phone, message, customerName, description } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios.' });
      }

      const tenant = store.getTenant(tenantId) || store.tenants[0];
      const config = tenant ? store.getWhatsAppConfig(tenant.id) : undefined;

      const result = await sendDirectWhatsAppTextMessage({
        phone,
        message,
        apiConfig: config,
      });

      if (result.success && result.instanceName && tenant && config) {
        if (config.instance_name !== result.instanceName || config.status !== 'connected') {
          console.log(`[WhatsApp Sync] Sincronizando config do tenant "${tenant.name}" com instância ativa "${result.instanceName}"`);
          config.instance_name = result.instanceName;
          config.status = 'connected';
          store.saveWhatsAppConfig(tenant.id, config);
        }
      }

      // Salva no log de disparos para acompanhamento no painel
      if (tenant) {
        store.addWhatsAppDispatchLog({
          id: `direct-${Date.now()}`,
          tenant_id: tenant.id,
          timestamp: new Date().toISOString(),
          type: 'direct_charge',
          customer_name: customerName || 'Cliente',
          phone,
          amount: 0,
          description: description || 'Cobrança manual enviada via WhatsApp',
          status: result.success && result.method === 'evolution_api' ? 'sent' : 'fallback_wa',
          method: result.method,
          details: result.success && result.method === 'evolution_api'
            ? 'Enviado diretamente via WhatsApp do aparelho conectado'
            : (result as any).error || 'Enviado via link manual',
          wa_link: result.waDirectUrl,
        });
      }

      res.json(result);
    } catch (err: any) {
      console.error('Error in WhatsApp send direct:', err);
      res.status(500).json({ error: 'Failed to execute direct send', details: err?.message });
    }
  });

  // 9.3 Consultar Status Real da Instância na Evolution API
  app.post('/api/whatsapp/instance/status', async (req: Request, res: Response) => {
    try {
      const { server_url, api_key, instance_name } = req.body;
      const statusResult = await checkEvolutionInstanceStatus({
        server_url,
        api_key,
        instance_name,
      });
      res.json(statusResult);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to check instance status', details: err?.message });
    }
  });

  // 9.4 Gerar QR Code Real da Instância (Conectar)
  app.post('/api/whatsapp/instance/connect', async (req: Request, res: Response) => {
    try {
      const { server_url, api_key, instance_name } = req.body;
      const qrResult = await fetchEvolutionQRCode({
        server_url,
        api_key,
        instance_name,
      });
      res.json(qrResult);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch QR Code' });
    }
  });

  // 9.4.1 Criar Nova Instância Diretamente na Evolution API
  app.post('/api/whatsapp/instance/create', async (req: Request, res: Response) => {
    try {
      const { server_url, api_key, instance_name } = req.body;
      const result = await createEvolutionInstance({
        server_url,
        api_key,
        instance_name,
      });

      // Se a criação não retornou QR Code imediato ou já existia, busca via fetchEvolutionQRCode
      if (!result.base64 && !result.code) {
        try {
          const qr = await fetchEvolutionQRCode({ server_url, api_key, instance_name });
          return res.json({ ...result, ...qr });
        } catch {}
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create instance' });
    }
  });

  // 9.5 Desconectar Instância da Evolution API
  app.post('/api/whatsapp/instance/disconnect', async (req: Request, res: Response) => {
    try {
      const { server_url, api_key, instance_name } = req.body;
      const result = await disconnectEvolutionInstance({
        server_url,
        api_key,
        instance_name,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to disconnect' });
    }
  });

  // 9.6 Obter Faturas e Assinaturas Pendentes de Automação (Hoje e Amanhã)
  app.get('/api/automation/pending', (req: Request, res: Response) => {
    try {
      const tenantId = (req.query.tenantId as string) || store.tenants[0]?.id || 'tenant-default';
      const notices = store.getPendingAutomationNotices(tenantId);
      res.json(notices);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch pending automation notices', details: err?.message });
    }
  });

  // 9.7 Obter Histórico de Disparos / Logs
  app.get('/api/automation/logs', (req: Request, res: Response) => {
    try {
      const tenantId = (req.query.tenantId as string) || undefined;
      const limit = Number(req.query.limit) || 50;
      const logs = store.getWhatsAppDispatchLogs(tenantId, limit);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch dispatch logs', details: err?.message });
    }
  });

  // 9.7.1 Limpar Histórico de Disparos / Logs
  app.delete('/api/automation/logs', (req: Request, res: Response) => {
    try {
      const tenantId = (req.query.tenantId as string) || (req.body?.tenantId as string) || undefined;
      store.clearWhatsAppDispatchLogs(tenantId);
      res.json({ success: true, message: 'Logs de disparos limpos com sucesso.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to clear dispatch logs', details: err?.message });
    }
  });

  // 9.7.2 Sincronizar Sessão WhatsApp Nativamente com Supabase PostgreSQL
  app.post('/api/whatsapp/sync-session', async (req: Request, res: Response) => {
    try {
      const { instance_name, instanceName } = req.body;
      const target = instance_name || instanceName;
      if (!target) return res.status(400).json({ error: 'instance_name is required' });
      await syncSessionFilesToSupabase(target, true);
      res.json({ success: true, message: `Sessão "${target}" sincronizada com o Supabase com sucesso!` });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to sync session to cloud', details: err?.message });
    }
  });

  // 9.8 Executar Disparos Automáticos Imediatamente (Botão Disparar Agora / Manual Run)
  app.post('/api/automation/run', async (req: Request, res: Response) => {
    try {
      const { tenantId, force = true } = req.body;
      const targetTenantId = tenantId || store.tenants[0]?.id;
      if (!targetTenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
      }
      const runResult = await store.runAutomatedDispatches(targetTenantId, force);
      res.json(runResult);
    } catch (err: any) {
      console.error('Error running automated dispatches:', err);
      res.status(500).json({ error: 'Failed to run automation', details: err?.message });
    }
  });

  // 9.9 Cronjob Webhook (GET & POST) - Compatível com cron-job.org, EasyCron, UptimeRobot
  app.all(['/api/cron/trigger', '/api/cron/whatsapp', '/api/cron/run', '/api/cron'], async (req: Request, res: Response) => {
    try {
      const tenantId = (req.query.tenantId as string) || (req.body?.tenantId as string);
      const force = req.query.force === 'true' || req.body?.force === true;

      const targetTenants = tenantId
        ? store.tenants.filter((t) => t.id === tenantId)
        : store.tenants.filter((t) => t.id !== 'tenant-default');

      const results = [];
      for (const t of targetTenants) {
        const config = store.getWhatsAppConfig(t.id);
        if (!config || (!config.auto_send_enabled && !force)) continue;
        const resRun = await store.runAutomatedDispatches(t.id, force);
        results.push({ tenant: t.name, tenantId: t.id, ...resRun });
      }

      res.json({
        success: true,
        message: 'Cronjob executado com sucesso',
        timestamp: new Date().toISOString(),
        tenantsProcessed: results.length,
        results,
      });
    } catch (err: any) {
      console.error('Erro no cron trigger:', err);
      res.status(500).json({ error: 'Falha ao executar cron', details: err?.message });
    }
  });

  // 7.1 Automated Tomorrow-Due WhatsApp Verification & Dispatch (Evolution API)
  app.get('/api/automation/tomorrow-due', (req: Request, res: Response) => {
    try {
      const tenantId = (req.query.tenantId as string) || undefined;
      const chargesDueTomorrow = store.getChargesDueTomorrow(tenantId);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      res.json({
        targetDate: tomorrow.toISOString().slice(0, 10),
        count: chargesDueTomorrow.length,
        charges: chargesDueTomorrow,
      });
    } catch (err: any) {
      console.error('Error fetching tomorrow-due charges:', err);
      res.status(500).json({ error: 'Failed to get tomorrow-due charges', details: err?.message });
    }
  });

  app.post('/api/automation/notify-tomorrow-due', async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.body;
      const result = await store.notifyChargesDueTomorrow(tenantId);
      res.json(result);
    } catch (err: any) {
      console.error('Error running automated tomorrow-due notices:', err);
      res.status(500).json({ error: 'Failed to process automated notices', details: err?.message });
    }
  });

  // 8. Monthly Analytics Report
  app.get('/api/reports/monthly', (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const month = (req.query.month as string) || undefined;
    const report = store.getMonthlyReport(tenantId, month);
    res.json(report);
  });

  // 9. Customers CRUD
  app.get('/api/customers', async (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const customers = await store.getCustomersAsync(tenantId);
    res.json(customers);
  });

  app.post('/api/customers', async (req: Request, res: Response) => {
    try {
      const newCust = await store.createCustomerAsync(req.body);
      // Trigger background notification to master admins
      const tenant = store.getTenant(newCust.tenant_id);
      notifyAdminsNewCustomer({ customer: newCust, tenant }).catch((e) =>
        console.error('Async mail notification failed', e)
      );
      res.status(201).json(newCust);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create customer', details: err?.message });
    }
  });

  app.put('/api/customers/:id', async (req: Request, res: Response) => {
    const updated = await store.updateCustomerAsync(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Customer not found' });
    res.json(updated);
  });

  app.delete('/api/customers/:id', async (req: Request, res: Response) => {
    const success = await store.deleteCustomerAsync(req.params.id);
    res.json({ success });
  });

  // 10. Charges CRUD
  app.get('/api/charges', (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const status = (req.query.status as string) || 'all';
    const charges = store.getCharges(tenantId, status);
    res.json(charges);
  });

  app.post('/api/charges', async (req: Request, res: Response) => {
    try {
      const newCharge = await store.createChargeAsync(req.body);
      res.status(201).json(newCharge);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create charge', details: err?.message });
    }
  });

  app.put('/api/charges/:id', async (req: Request, res: Response) => {
    const updated = await store.updateChargeAsync(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Charge not found' });
    res.json(updated);
  });

  app.patch('/api/charges/:id/pay', async (req: Request, res: Response) => {
    const method = req.body.paymentMethod || 'pix';
    const updated = await store.markChargeAsPaidAsync(req.params.id, method);
    if (!updated) return res.status(404).json({ error: 'Charge not found' });
    res.json(updated);
  });

  app.delete('/api/charges/:id', async (req: Request, res: Response) => {
    const success = await store.deleteChargeAsync(req.params.id);
    res.json({ success });
  });

  // 11. Products CRUD
  app.get('/api/products', (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const products = store.getProducts(tenantId);
    res.json(products);
  });

  app.post('/api/products', (req: Request, res: Response) => {
    try {
      const newProd = store.createProduct(req.body);
      res.status(201).json(newProd);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create product', details: err?.message });
    }
  });

  app.put('/api/products/:id', (req: Request, res: Response) => {
    const updated = store.updateProduct(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json(updated);
  });

  app.delete('/api/products/:id', (req: Request, res: Response) => {
    const success = store.deleteProduct(req.params.id);
    res.json({ success });
  });

  // 12. Tenants (Master Admin & Settings)
  app.get('/api/tenants', (req: Request, res: Response) => {
    const tenants = store.getAllTenants();
    res.json(tenants);
  });

  app.get('/api/tenants/:id', (req: Request, res: Response) => {
    const tenant = store.getTenant(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  });

  app.patch('/api/tenants/:id', (req: Request, res: Response) => {
    const updated = store.updateTenant(req.params.id, req.body);
    res.json(updated);
  });

  app.put('/api/tenants/:id', (req: Request, res: Response) => {
    const updated = store.updateTenant(req.params.id, req.body);
    res.json(updated);
  });

  app.delete('/api/tenants/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = req.params.id;
      const success = await store.deleteTenantAsync(tenantId);
      if (!success) {
        return res.status(404).json({ error: 'Cliente não encontrado para exclusão' });
      }
      res.json({ success: true, message: 'Cliente excluído definitivamente do banco de dados.' });
    } catch (err: any) {
      console.error('[Delete Tenant Route Error]', err);
      res.status(400).json({ error: err?.message || 'Erro ao excluir cliente' });
    }
  });

  app.post('/api/tenants/:id/reset', (req: Request, res: Response) => {
    store.resetTenantData(req.params.id);
    res.json({ success: true, message: 'Dados do tenant resetados com sucesso.' });
  });

  // 12.1 Adição Dinâmica de Módulos (Upgrade de Plano / Adesão Avulsa)
  app.post('/api/tenants/:id/add-module', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { module: newModule } = req.body;
      const validModules = ['loans', 'iptv', 'business', 'subscriptions'];

      if (!newModule || !validModules.includes(newModule)) {
        return res.status(400).json({ error: 'Módulo inválido informado.' });
      }

      const tenant = store.getTenant(id);
      if (!tenant) {
        return res.status(404).json({ error: 'Empresa não encontrada.' });
      }

      const currentMods: AppModule[] = tenant.selected_modules && tenant.selected_modules.length > 0
        ? [...tenant.selected_modules]
        : ['business'];

      if (!currentMods.includes(newModule)) {
        currentMods.push(newModule);
      }

      const globalPrices = store.getGlobalPlanPrices();
      const newPlanPrice = calculatePlanPrice(currentMods.length, globalPrices);

      const updated = store.updateTenant(id, {
        selected_modules: currentMods,
        plan_monthly_price: newPlanPrice,
      });

      res.json({
        success: true,
        tenant: updated,
        modules: currentMods,
        planMonthlyPrice: newPlanPrice,
        message: `Módulo adicionado com sucesso! Sua próxima mensalidade será R$ ${newPlanPrice.toFixed(2).replace('.', ',')}/mês.`
      });
    } catch (err: any) {
      console.error('[Add Module Error]', err);
      res.status(500).json({ error: 'Falha ao adicionar módulo', message: err?.message });
    }
  });

  app.post('/api/tenants', (req: Request, res: Response) => {
    const newId = `tenant-${Date.now()}`;
    const newTenant = store.updateTenant(newId, req.body);
    res.status(201).json(newTenant);
  });

  // 13. IPTV Subscribers CRUD
  app.get('/api/iptv', async (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const subscribers = await store.getIPTVSubscribersAsync(tenantId);
    res.json(subscribers);
  });

  app.post('/api/iptv', async (req: Request, res: Response) => {
    try {
      const newSub = await store.createIPTVSubscriberAsync(req.body);
      res.status(201).json(newSub);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create IPTV subscriber', details: err?.message });
    }
  });

  app.put('/api/iptv/:id', async (req: Request, res: Response) => {
    const updated = await store.updateIPTVSubscriberAsync(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Subscriber not found' });
    res.json(updated);
  });

  app.patch('/api/iptv/:id/renew', async (req: Request, res: Response) => {
    const days = parseInt(req.body.days || '30', 10);
    const renewed = await store.renewIPTVSubscriberAsync(req.params.id, days);
    if (!renewed) return res.status(404).json({ error: 'Subscriber not found' });
    res.json(renewed);
  });

  app.delete('/api/iptv/:id', async (req: Request, res: Response) => {
    const success = await store.deleteIPTVSubscriberAsync(req.params.id);
    res.json({ success });
  });

  // IPTV Plans
  app.get('/api/iptv/plans', (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const plans = store.getIPTVPlans(tenantId);
    res.json(plans);
  });

  app.post('/api/iptv/plans', async (req: Request, res: Response) => {
    try {
      const plan = await store.createIPTVPlanAsync(req.body);
      res.status(201).json(plan);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create plan', details: err?.message });
    }
  });

  app.delete('/api/iptv/plans/:id', async (req: Request, res: Response) => {
    const success = await store.deleteIPTVPlanAsync(req.params.id);
    res.json({ success });
  });

  app.put('/api/iptv/plans/:id', async (req: Request, res: Response) => {
    const updated = await store.updateIPTVPlanAsync(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Plan not found' });
    res.json(updated);
  });

  // IPTV Apps
  app.get('/api/iptv/apps', (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const apps = store.getIPTVApps(tenantId);
    res.json(apps);
  });

  app.post('/api/iptv/apps', async (req: Request, res: Response) => {
    try {
      const appItem = await store.createIPTVAppAsync(req.body);
      res.status(201).json(appItem);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create app', details: err?.message });
    }
  });

  app.put('/api/iptv/apps/:id', async (req: Request, res: Response) => {
    const updated = await store.updateIPTVAppAsync(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'App not found' });
    res.json(updated);
  });

  app.delete('/api/iptv/apps/:id', async (req: Request, res: Response) => {
    const success = await store.deleteIPTVAppAsync(req.params.id);
    res.json({ success });
  });

  // Alias dedicado para Clientes IPTV
  app.get('/api/iptv/subscribers', async (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const subscribers = await store.getIPTVSubscribersAsync(tenantId);
    res.json(subscribers);
  });

  // 14. MÓDULO ASSINATURAS - Clientes (Subscribers)
  app.get('/api/subscriptions/customers', (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const list = store.getSubscriptionCustomers(tenantId);
    res.json(list);
  });

  app.post('/api/subscriptions/customers', (req: Request, res: Response) => {
    try {
      const created = store.createSubscriptionCustomer(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create subscription customer', details: err?.message });
    }
  });

  app.put('/api/subscriptions/customers/:id', (req: Request, res: Response) => {
    const updated = store.updateSubscriptionCustomer(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Subscription customer not found' });
    res.json(updated);
  });

  app.delete('/api/subscriptions/customers/:id', (req: Request, res: Response) => {
    const success = store.deleteSubscriptionCustomer(req.params.id);
    res.json({ success });
  });

  // 15. MÓDULO ASSINATURAS - Planos (Plans)
  app.get('/api/subscriptions/plans', (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const plans = store.getSubscriptionPlans(tenantId);
    res.json(plans);
  });

  app.post('/api/subscriptions/plans', (req: Request, res: Response) => {
    try {
      const plan = store.createSubscriptionPlan(req.body);
      res.status(201).json(plan);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create subscription plan', details: err?.message });
    }
  });

  app.put('/api/subscriptions/plans/:id', (req: Request, res: Response) => {
    const updated = store.updateSubscriptionPlan(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Subscription plan not found' });
    res.json(updated);
  });

  app.delete('/api/subscriptions/plans/:id', (req: Request, res: Response) => {
    const success = store.deleteSubscriptionPlan(req.params.id);
    res.json({ success });
  });

  // 16. MÓDULO ASSINATURAS - Vendas (Sales)
  app.get('/api/subscriptions/sales', (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const sales = store.getSubscriptionSales(tenantId);
    res.json(sales);
  });

  app.post('/api/subscriptions/sales', (req: Request, res: Response) => {
    try {
      const sale = store.createSubscriptionSale(req.body);
      res.status(201).json(sale);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create subscription sale', details: err?.message });
    }
  });

  app.put('/api/subscriptions/sales/:id', (req: Request, res: Response) => {
    const updated = store.updateSubscriptionSale(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Subscription sale not found' });
    res.json(updated);
  });

  app.delete('/api/subscriptions/sales/:id', (req: Request, res: Response) => {
    const success = store.deleteSubscriptionSale(req.params.id);
    res.json({ success });
  });

  // 17. MÓDULO EMPRÉSTIMOS & COBRANÇAS PARCELADAS (ESPAÇO DEDICADO)
  app.get('/api/loans', (req: Request, res: Response) => {
    const tenantId = (req.query.tenantId as string) || 'tenant-default';
    const loans = store.getLoans(tenantId);
    res.json(loans);
  });

  app.post('/api/loans', (req: Request, res: Response) => {
    try {
      const loan = store.saveLoan(req.body);
      res.status(201).json(loan);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save loan', details: err?.message });
    }
  });

  app.put('/api/loans/:id', (req: Request, res: Response) => {
    const updated = store.updateLoan(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Loan not found' });
    res.json(updated);
  });

  app.delete('/api/loans/:id', (req: Request, res: Response) => {
    const success = store.deleteLoan(req.params.id);
    res.json({ success });
  });

  app.post('/api/loans/sync', (req: Request, res: Response) => {
    try {
      const { tenantId = 'tenant-default', loans = [] } = req.body;
      const synced = store.syncLoans(tenantId, loans);
      res.json(synced);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to sync loans', details: err?.message });
    }
  });

  // 18. INICIALIZAÇÃO DO AGENDADOR EM SEGUNDO PLANO DE DISPAROS WHATSAPP
  startWhatsAppAutomationScheduler();

  return app;
}

// Background scheduler for automatic daily WhatsApp notices
let schedulerRunning = false;
function startWhatsAppAutomationScheduler() {
  if (schedulerRunning) return;
  schedulerRunning = true;

  console.log('[WhatsApp Scheduler] Serviço em segundo plano de automação do WhatsApp inicializado.');
  initAllSavedBaileysSessions().catch((err) => {
    console.warn('[WhatsApp Scheduler] Aviso ao restaurar sessões salvas do WhatsApp:', err?.message);
  });

  setInterval(async () => {
    try {
      const now = new Date();
      // Current Brasília time as HH:MM
      const brTime = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);

      const todayIso = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Sao_Paulo',
      }).format(now); // gives YYYY-MM-DD in São Paulo timezone

      const allTenantIds = Array.from(
        new Set([
          ...store.tenants.map((t) => t.id),
          ...Object.keys(store.whatsappConfigs || {}),
        ])
      );

      for (const tenantId of allTenantIds) {
        if (tenantId === 'tenant-default') continue;
        const tenant = store.getTenant(tenantId) || { id: tenantId, name: 'Empresa', email: '' };
        if (tenant.email === 'dlinformatica3137@gmail.com') continue;
        const config = store.getWhatsAppConfig(tenantId);
        if (!config || !config.auto_send_enabled) continue;

        // 1º Horário agendado
        const scheduledTime = config.scheduled_time || '09:00';
        const currentScheduleKey = `${todayIso}_T1_${scheduledTime}`;
        const lastRunScheduleKey = (config as any).last_run_schedule || '';

        // Dispara se o horário atual de Brasília atingiu ou passou o horário agendado
        // E ainda não foi disparado para esta data e horário configurados:
        if (brTime >= scheduledTime && lastRunScheduleKey !== currentScheduleKey) {
          console.log(`[WhatsApp Scheduler] 1º Horário programado atingido (${scheduledTime} / atual: ${brTime}). Disparando avisos para ${tenant.name} (${tenantId}) em segundo plano.`);
          try {
            const dispatchResult = await store.runAutomatedDispatches(tenantId, false);
            console.log(`[WhatsApp Scheduler] 1º Horário concluído para ${tenant.name}:`, dispatchResult?.message || 'OK');
            (config as any).last_run_schedule = currentScheduleKey;
            config.last_run_at = new Date().toISOString();
            store.saveWhatsAppConfig(tenantId, config);
          } catch (dispatchErr) {
            console.error(`[WhatsApp Scheduler] Erro ao disparar avisos do 1º horário para ${tenantId}:`, dispatchErr);
          }
        }

        // 2º Horário agendado (Turno da Tarde / Repescagem de Inadimplentes)
        if (config.second_scheduled_time_enabled && config.second_scheduled_time) {
          const secondScheduledTime = config.second_scheduled_time;
          const currentSecondScheduleKey = `${todayIso}_T2_${secondScheduledTime}`;
          const lastRunScheduleKeySecond = (config as any).last_run_schedule_second || '';

          if (brTime >= secondScheduledTime && lastRunScheduleKeySecond !== currentSecondScheduleKey) {
            console.log(`[WhatsApp Scheduler] 2º Horário (Repescagem) atingido (${secondScheduledTime} / atual: ${brTime}). Disparando avisos para ${tenant.name} (${tenant.id}) em segundo plano.`);
            try {
              const dispatchResult = await store.runAutomatedDispatches(tenant.id, false);
              console.log(`[WhatsApp Scheduler] 2º Horário concluído para ${tenant.name}:`, dispatchResult?.message || 'OK');
              (config as any).last_run_schedule_second = currentSecondScheduleKey;
              config.last_run_at = new Date().toISOString();
              store.saveWhatsAppConfig(tenant.id, config);
            } catch (dispatchErr) {
              console.error(`[WhatsApp Scheduler] Erro ao disparar avisos do 2º horário para ${tenant.id}:`, dispatchErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('[WhatsApp Scheduler] Erro no loop de automação:', err);
    }
  }, 30000);
}

export const apiApp = createApiApp();
