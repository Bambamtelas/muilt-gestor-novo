import {
  Tenant,
  Profile,
  Customer,
  Charge,
  Product,
  SubscriptionPayment,
  SystemStats,
  MonthlyReportData,
  SubscriptionCustomer,
  SubscriptionPlan,
  SubscriptionSale,
  GlobalPlanPrices,
  AppModule,
  WhatsAppAutomationConfig,
  WhatsAppDispatchLog,
  ExternalLinkConfig,
  SupportWhatsAppConfig,
  DEFAULT_SUPPORT_WHATSAPP_CONFIG,
} from '../types/index.js';

/**
 * Wrapper resiliente para fetch com retentativas automáticas e backoff exponencial.
 * Evita falhas intermitentes caso o backend esteja reiniciando ou haja oscilação de rede.
 */
async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await window.fetch(input, init);
      return res;
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  return window.fetch(input, init);
}

// Sobrescreve localmente a chamada fetch neste módulo para usar o retry resiliente
const fetch = (input: RequestInfo | URL, init?: RequestInit) => fetchWithRetry(input, init);

export const api = {
  // Plan Prices
  async getGlobalPlanPrices(): Promise<GlobalPlanPrices> {
    const res = await fetch(`/api/plans/prices?_t=${Date.now()}`);
    return res.json();
  },

  async updateGlobalPlanPrices(prices: Partial<GlobalPlanPrices>): Promise<GlobalPlanPrices> {
    const res = await fetch('/api/plans/prices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prices),
    });
    return res.json();
  },

  // External Link Config (Lojinha / Link Promocional)
  async getExternalLinkConfig(): Promise<ExternalLinkConfig> {
    const res = await fetch('/api/system/external-link');
    return res.json();
  },

  async updateExternalLinkConfig(config: Partial<ExternalLinkConfig>): Promise<ExternalLinkConfig> {
    const res = await fetch('/api/system/external-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.json();
  },

  // Support WhatsApp Config (Botão Flutuante de Suporte)
  async getSupportWhatsAppConfig(): Promise<SupportWhatsAppConfig> {
    try {
      const res = await fetch('/api/system/support-whatsapp');
      if (res.ok) {
        const data = await res.json();
        if (data && data.phone) {
          try {
            localStorage.setItem('support_whatsapp_config', JSON.stringify(data));
          } catch {}
          return data;
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar suporte WhatsApp:', err);
    }
    try {
      const cached = localStorage.getItem('support_whatsapp_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.phone) return parsed;
      }
    } catch {}
    return DEFAULT_SUPPORT_WHATSAPP_CONFIG;
  },

  async updateSupportWhatsAppConfig(config: Partial<SupportWhatsAppConfig>): Promise<SupportWhatsAppConfig> {
    try {
      const res = await fetch('/api/system/support-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const data = await res.json();
        try {
          localStorage.setItem('support_whatsapp_config', JSON.stringify(data));
        } catch {}
        return data;
      }
    } catch (err) {
      console.warn('Erro ao salvar suporte WhatsApp no backend, salvando no localStorage:', err);
    }
    const current = await this.getSupportWhatsAppConfig();
    const updated = {
      ...current,
      ...config,
      updated_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem('support_whatsapp_config', JSON.stringify(updated));
    } catch {}
    return updated;
  },

  // Preventive Expiration Alerts (<= 3 Days)
  async checkPreventiveAlerts(): Promise<{ success: boolean; checked: number; alertedCount: number; alerts: any[] }> {
    const res = await fetch('/api/subscription/check-preventive-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  async sendPreventiveAlert(tenantId: string): Promise<{ success: boolean; tenantId: string; email: string; daysRemaining: number; planPrice: number }> {
    const res = await fetch(`/api/subscription/send-preventive-alert/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },
  // Supabase Database Management
  async getSupabaseStatus(): Promise<{
    configured: boolean;
    connected: boolean;
    url: string | null;
    latencyMs?: number;
    message: string;
    error?: string;
  }> {
    const res = await fetch('/api/database/supabase/status');
    return res.json();
  },

  async syncToSupabase(): Promise<{ success: boolean; message: string; counts?: any; error?: string }> {
    const res = await fetch('/api/database/supabase/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  async getSupabaseSchema(): Promise<{ sql: string; configured: boolean }> {
    const res = await fetch('/api/database/supabase/schema');
    return res.json();
  },

  // Health
  async getHealth() {
    const res = await fetch('/api/health');
    return res.json();
  },

  // Stats
  async getStats(tenantId?: string): Promise<SystemStats> {
    const query = tenantId ? `?tenantId=${tenantId}` : '';
    const res = await fetch(`/api/database/status${query}`);
    return res.json();
  },

  // Auth / Profile
  async login(email: string, password?: string): Promise<{ profile: Profile; tenant: Tenant }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Nenhuma conta cadastrada com este e-mail.');
    }
    return data;
  },

  async resetPassword(email: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Erro ao redefinir senha.');
    }
    return data;
  },

  async changePassword(email: string, password: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Erro ao alterar senha.');
    }
    return data;
  },

  async register(params: {
    email: string;
    password?: string;
    companyName: string;
    fullName: string;
    phone?: string;
    modules: AppModule[];
  }): Promise<{ profile: Profile; tenant: Tenant }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Falha ao cadastrar conta.');
    }
    return data;
  },

  async getProfile(userId: string, email: string): Promise<{ profile: Profile; tenant: Tenant }> {
    const res = await fetch(`/api/auth/profile/${userId}?email=${encodeURIComponent(email)}`);
    return res.json();
  },

  // Mercado Pago PIX Order
  async createSubscriptionOrder(tenantId: string, userEmail: string): Promise<SubscriptionPayment> {
    const res = await fetch('/api/mercadopago/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, userEmail }),
    });
    return res.json();
  },

  async checkOrderStatus(orderId: string, simulateApproval = false): Promise<{
    status: string;
    order: SubscriptionPayment;
    tenant?: Tenant;
    message?: string;
  }> {
    const res = await fetch('/api/mercadopago/order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, simulate_approval: simulateApproval }),
    });
    return res.json();
  },

  async getMercadoPagoConfig(): Promise<{
    configured: boolean;
    valid: boolean;
    maskedToken: string;
    webhookUrl: string;
    accountInfo?: {
      id: number;
      nickname: string;
      first_name?: string;
      last_name?: string;
      email: string;
      site_id: string;
    } | null;
  }> {
    const res = await fetch('/api/mercadopago/config');
    return res.json();
  },

  async saveMercadoPagoConfig(accessToken: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    details?: string;
    account?: any;
  }> {
    const res = await fetch('/api/mercadopago/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    return res.json();
  },

  // WhatsApp Charge
  async sendWhatsAppCharge(params: {
    chargeId: string;
    customerId?: string;
    tenantId?: string;
    templateType?: string;
    customMessage?: string;
    charge?: any;
    customer?: any;
    phone?: string;
    customerName?: string;
    amount?: number;
    dueDate?: string;
    description?: string;
  }) {
    const res = await fetchWithRetry('/api/whatsapp/send-charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  // Automated Tomorrow Due WhatsApp Notices
  async getTomorrowDueCharges(tenantId?: string): Promise<{
    targetDate: string;
    count: number;
    charges: Charge[];
  }> {
    const query = tenantId ? `?tenantId=${tenantId}` : '';
    const res = await fetch(`/api/automation/tomorrow-due${query}`);
    return res.json();
  },

  async notifyTomorrowDueCharges(tenantId?: string): Promise<{
    success: boolean;
    targetDate: string;
    totalPendingTomorrow: number;
    notifiedCount: number;
    dispatches: Array<{
      chargeId: string;
      description: string;
      customerName: string;
      whatsapp: string;
      amount: number;
      result: any;
    }>;
  }> {
    const res = await fetch('/api/automation/notify-tomorrow-due', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    });
    return res.json();
  },

  // WhatsApp & Automações Completas
  async getWhatsAppConfig(tenantId: string): Promise<WhatsAppAutomationConfig> {
    const res = await fetchWithRetry(`/api/whatsapp/config?tenantId=${tenantId}`);
    return res.json();
  },

  async saveWhatsAppConfig(
    tenantId: string,
    config: WhatsAppAutomationConfig
  ): Promise<{ success: boolean; config: WhatsAppAutomationConfig }> {
    const res = await fetchWithRetry('/api/whatsapp/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, config }),
    });
    return res.json();
  },

  async testWhatsAppSend(params: {
    tenantId: string;
    phone: string;
    message: string;
  }): Promise<{ success: boolean; method: string; waDirectUrl?: string; error?: string }> {
    const res = await fetchWithRetry('/api/whatsapp/test-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async sendDirectWhatsApp(params: {
    tenantId: string;
    phone: string;
    message: string;
    customerName?: string;
    description?: string;
  }): Promise<{ success: boolean; method: string; waDirectUrl?: string; error?: string }> {
    const res = await fetchWithRetry('/api/whatsapp/send-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async getWhatsAppInstanceStatus(params: {
    server_url: string;
    api_key: string;
    instance_name: string;
  }): Promise<{ connected: boolean; state: string; message: string }> {
    const res = await fetchWithRetry('/api/whatsapp/instance/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async connectWhatsAppInstance(params: {
    server_url: string;
    api_key: string;
    instance_name: string;
  }): Promise<{ base64?: string; code?: string; pairingCode?: string }> {
    const res = await fetchWithRetry('/api/whatsapp/instance/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async createWhatsAppInstance(params: {
    server_url: string;
    api_key: string;
    instance_name: string;
  }): Promise<{ success: boolean; base64?: string; code?: string; pairingCode?: string; alreadyExists?: boolean; message?: string }> {
    const res = await fetchWithRetry('/api/whatsapp/instance/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async disconnectWhatsAppInstance(params: {
    server_url: string;
    api_key: string;
    instance_name: string;
  }): Promise<{ success: boolean }> {
    const res = await fetchWithRetry('/api/whatsapp/instance/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async getPendingAutomationNotices(tenantId: string): Promise<{
    todayDate: string;
    tomorrowDate: string;
    pendingToday: any[];
    pendingTomorrow: any[];
    pendingOverdue: any[];
    totalPending: number;
    totalOverdue: number;
  }> {
    const res = await fetchWithRetry(`/api/automation/pending?tenantId=${tenantId}`);
    return res.json();
  },

  async getWhatsAppDispatchLogs(tenantId: string, limit = 50): Promise<WhatsAppDispatchLog[]> {
    const res = await fetchWithRetry(`/api/automation/logs?tenantId=${tenantId}&limit=${limit}`);
    return res.json();
  },

  async runAutomatedDispatches(
    tenantId: string,
    force = true
  ): Promise<{
    success: boolean;
    timestamp: string;
    dispatchedCount: number;
    dispatches: WhatsAppDispatchLog[];
    message: string;
  }> {
    const res = await fetchWithRetry('/api/automation/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, force }),
    });
    return res.json();
  },

  // Monthly Report
  async getMonthlyReport(tenantId: string, month?: string): Promise<MonthlyReportData> {
    const query = month ? `?tenantId=${tenantId}&month=${month}` : `?tenantId=${tenantId}`;
    const res = await fetch(`/api/reports/monthly${query}`);
    return res.json();
  },

  // Customers
  async getCustomers(tenantId: string): Promise<Customer[]> {
    const res = await fetch(`/api/customers?tenantId=${tenantId}`);
    return res.json();
  },

  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    });
    return res.json();
  },

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer> {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    });
    return res.json();
  },

  async deleteCustomer(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Charges
  async getCharges(tenantId: string, status = 'all'): Promise<Charge[]> {
    const res = await fetch(`/api/charges?tenantId=${tenantId}&status=${status}`);
    return res.json();
  },

  async createCharge(charge: Partial<Charge>): Promise<Charge> {
    const res = await fetch('/api/charges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(charge),
    });
    return res.json();
  },

  async updateCharge(id: string, charge: Partial<Charge>): Promise<Charge> {
    const res = await fetch(`/api/charges/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(charge),
    });
    return res.json();
  },

  async markChargeAsPaid(id: string, paymentMethod = 'pix'): Promise<Charge> {
    const res = await fetch(`/api/charges/${id}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod }),
    });
    return res.json();
  },

  async deleteCharge(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/charges/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Products
  async getProducts(tenantId: string): Promise<Product[]> {
    const res = await fetch(`/api/products?tenantId=${tenantId}`);
    return res.json();
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    return res.json();
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    return res.json();
  },

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Tenants
  async getTenants(): Promise<Tenant[]> {
    const res = await fetch('/api/tenants');
    return res.json();
  },

  async getTenant(id: string): Promise<Tenant | null> {
    const tenants = await this.getTenants();
    return tenants.find((t) => t.id === id) || null;
  },

  async updateTenant(id: string, tenant: Partial<Tenant>): Promise<Tenant> {
    const res = await fetch(`/api/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenant),
    });
    return res.json();
  },

  async createTenant(tenant: Partial<Tenant>): Promise<Tenant> {
    const res = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenant),
    });
    return res.json();
  },

  async resetTenant(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/tenants/${id}/reset`, {
      method: 'POST',
    });
    return res.json();
  },

  async deleteTenant(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/tenants/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Erro ao excluir cliente');
    }
    return data;
  },

  async addModuleToTenant(id: string, module: AppModule): Promise<{
    success: boolean;
    tenant: Tenant;
    modules: AppModule[];
    planMonthlyPrice: number;
    message: string;
  }> {
    const res = await fetch(`/api/tenants/${id}/add-module`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Falha ao adicionar módulo');
    }
    return data;
  },

  // IPTV
  async getIPTVSubscribers(tenantId: string): Promise<any[]> {
    const res = await fetch(`/api/iptv?tenantId=${tenantId}`);
    return res.json();
  },

  async createIPTVSubscriber(data: any): Promise<any> {
    const res = await fetch('/api/iptv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateIPTVSubscriber(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/iptv/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async renewIPTVSubscriber(id: string, days = 30): Promise<any> {
    const res = await fetch(`/api/iptv/${id}/renew`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    return res.json();
  },

  async deleteIPTVSubscriber(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/iptv/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // IPTV Plans
  async getIPTVPlans(tenantId: string): Promise<any[]> {
    const res = await fetch(`/api/iptv/plans?tenantId=${tenantId}`);
    return res.json();
  },

  async createIPTVPlan(data: any): Promise<any> {
    const res = await fetch('/api/iptv/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteIPTVPlan(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/iptv/plans/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async updateIPTVPlan(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/iptv/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // IPTV Apps
  async getIPTVApps(tenantId: string): Promise<any[]> {
    const res = await fetch(`/api/iptv/apps?tenantId=${tenantId}`);
    return res.json();
  },

  async createIPTVApp(data: any): Promise<any> {
    const res = await fetch('/api/iptv/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateIPTVApp(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/iptv/apps/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteIPTVApp(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/iptv/apps/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Subscriptions - Customers
  async getSubscriptionCustomers(tenantId: string): Promise<SubscriptionCustomer[]> {
    const res = await fetch(`/api/subscriptions/customers?tenantId=${tenantId}`);
    return res.json();
  },

  async createSubscriptionCustomer(data: Partial<SubscriptionCustomer>): Promise<SubscriptionCustomer> {
    const res = await fetch('/api/subscriptions/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateSubscriptionCustomer(id: string, data: Partial<SubscriptionCustomer>): Promise<SubscriptionCustomer> {
    const res = await fetch(`/api/subscriptions/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteSubscriptionCustomer(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/subscriptions/customers/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Subscriptions - Plans
  async getSubscriptionPlans(tenantId: string): Promise<SubscriptionPlan[]> {
    const res = await fetch(`/api/subscriptions/plans?tenantId=${tenantId}`);
    return res.json();
  },

  async createSubscriptionPlan(data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    const res = await fetch('/api/subscriptions/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateSubscriptionPlan(id: string, data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    const res = await fetch(`/api/subscriptions/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteSubscriptionPlan(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/subscriptions/plans/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Subscriptions - Sales
  async getSubscriptionSales(tenantId: string): Promise<SubscriptionSale[]> {
    const res = await fetch(`/api/subscriptions/sales?tenantId=${tenantId}`);
    return res.json();
  },

  async createSubscriptionSale(data: Partial<SubscriptionSale>): Promise<SubscriptionSale> {
    const res = await fetch('/api/subscriptions/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateSubscriptionSale(id: string, data: Partial<SubscriptionSale>): Promise<SubscriptionSale> {
    const res = await fetch(`/api/subscriptions/sales/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteSubscriptionSale(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/subscriptions/sales/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Loans (Módulo Empréstimos)
  async getLoans(tenantId: string): Promise<any[]> {
    const res = await fetch(`/api/loans?tenantId=${encodeURIComponent(tenantId)}`);
    return res.json();
  },

  async createLoan(data: any): Promise<any> {
    const res = await fetch('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async updateLoan(id: string, data: any): Promise<any> {
    const res = await fetch(`/api/loans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteLoan(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/loans/${id}`, { method: 'DELETE' });
    return res.json();
  },

  async syncLoans(tenantId: string, loans: any[]): Promise<any[]> {
    const res = await fetch('/api/loans/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, loans }),
    });
    return res.json();
  },
};
