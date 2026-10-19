import {
  Tenant,
  Profile,
  Customer,
  Charge,
  Product,
  SubscriptionPayment,
  SystemStats,
  MonthlyReportData,
  IPTVSubscriber,
  IPTVPlan,
  IPTVApp,
  SubscriptionCustomer,
  SubscriptionPlan,
  SubscriptionSale,
  Loan,
  LoanInstallment,
  GlobalPlanPrices,
  DEFAULT_PLAN_PRICES,
  calculatePlanPrice,
  AppModule,
  WhatsAppAutomationConfig,
  WhatsAppDispatchLog,
  ExternalLinkConfig,
  DEFAULT_EXTERNAL_LINK_CONFIG,
  SupportWhatsAppConfig,
  DEFAULT_SUPPORT_WHATSAPP_CONFIG,
} from '../types/index.js';
import { generatePixPayload, generateQrCodeDataUrl } from './pix.js';
import { sendWhatsAppMessage, sendDirectWhatsAppTextMessage, renderCustomTemplate } from './evolution.js';
import { getSupabaseClient, isSupabaseConfigured, testSupabaseConnection, SUPABASE_SCHEMA_SQL } from './supabase.js';
import { disconnectBaileysInstance } from './baileysManager.js';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'database.json');

// Arquivos de persistência isolados e dedicados por Módulo e Entidade
// 1. Módulo IPTV (Clientes, Planos, Apps)
const FILE_IPTV_SUBSCRIBERS = path.join(DATA_DIR, 'iptv_subscribers.json');
const FILE_IPTV_PLANS = path.join(DATA_DIR, 'iptv_plans.json');
const FILE_IPTV_APPS = path.join(DATA_DIR, 'iptv_apps.json');

// 2. Módulo Negócios e Empresas (Clientes, Produtos/Serviços, Vendas)
const FILE_BUSINESS_CUSTOMERS = path.join(DATA_DIR, 'business_customers.json');
const FILE_BUSINESS_PRODUCTS = path.join(DATA_DIR, 'business_products.json');
const FILE_BUSINESS_SALES = path.join(DATA_DIR, 'business_sales.json');

// 3. Módulo Assinaturas (Clientes, Planos, Vendas de Assinatura)
const FILE_SUBSCRIPTION_CUSTOMERS = path.join(DATA_DIR, 'subscription_customers.json');
const FILE_SUBSCRIPTION_PLANS = path.join(DATA_DIR, 'subscription_plans.json');
const FILE_SUBSCRIPTION_SALES = path.join(DATA_DIR, 'subscription_sales.json');

// 4. Módulo Empréstimos & Cobranças Parceladas (Espaço isolado de Empréstimos)
const FILE_LOANS = path.join(DATA_DIR, 'loans.json');

// 5. Módulo Sistema / Contas / Licenças
const FILE_TENANTS = path.join(DATA_DIR, 'tenants.json');
const FILE_PROFILES = path.join(DATA_DIR, 'profiles.json');
const FILE_PAYMENTS = path.join(DATA_DIR, 'payments.json');
const FILE_GLOBAL_PLANS = path.join(DATA_DIR, 'global_plans.json');
const FILE_USER_PASSWORDS = path.join(DATA_DIR, 'user_passwords.json');

// 6. Módulo Automação WhatsApp & Logs
const FILE_WHATSAPP_CONFIGS = path.join(DATA_DIR, 'whatsapp_configs.json');
const FILE_WHATSAPP_LOGS = path.join(DATA_DIR, 'whatsapp_dispatch_logs.json');

// 7. Link Promocional Externo (Lojinha / Banner Global) & Configurações Globais
const FILE_EXTERNAL_LINK = path.join(DATA_DIR, 'external_link_config.json');
const FILE_SUPPORT_WHATSAPP = path.join(DATA_DIR, 'support_whatsapp.json');
const FILE_SYSTEM_SETTINGS = path.join(DATA_DIR, 'system_settings.json');

// Função utilitária para gerar nome de instância 100% único e isolado por tenant
export function generateTenantInstanceName(tenantId: string, tenantName?: string): string {
  // Apenas a conta oficial do administrador (Betão) utiliza a instância mestre histórica
  if (tenantId === '2caa686e-9c14-439b-8e9d-9b25cfbac345') {
    return 'instancia_ativacoes_e_vendas';
  }
  const cleanId = (tenantId || 'tenant').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
  const slug = (tenantName || 'cliente')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 15) || 'cliente';
  return `inst_${slug}_${cleanId}`;
}

// Persistent JSON File Store (Persiste cada módulo e entidade em arquivos separados)
class DataStore {
  // Configurações Globais de Preços dos Planos
  public globalPlanPrices: GlobalPlanPrices = { ...DEFAULT_PLAN_PRICES };

  // 1. Negócios & Empresas (Espaço próprio)
  public customers: Customer[] = [];
  public products: Product[] = [];
  public charges: Charge[] = [];

  // 2. IPTV (Espaço próprio)
  public iptvSubscribers: IPTVSubscriber[] = [];
  public iptvPlans: IPTVPlan[] = [];
  public iptvApps: IPTVApp[] = [];

  // 3. Assinaturas (Espaço próprio)
  public subscriptionCustomers: SubscriptionCustomer[] = [];
  public subscriptionPlans: SubscriptionPlan[] = [];
  public subscriptionSales: SubscriptionSale[] = [];

  // 4. Empréstimos (Espaço próprio)
  public loans: Loan[] = [];

  // 5. Sistema & Tenants
  public tenants: Tenant[] = [];
  public profiles: Profile[] = [];
  public payments: SubscriptionPayment[] = [];
  public mercadoPagoToken: string = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';

  // 6. Automação WhatsApp & Logs
  public whatsappConfigs: Record<string, WhatsAppAutomationConfig> = {};
  public whatsappDispatchLogs: WhatsAppDispatchLog[] = [];

  // 7. Link Promocional / Lojinha Online (Global para todos os painéis e módulos)
  public externalLinkConfig: ExternalLinkConfig = { ...DEFAULT_EXTERNAL_LINK_CONFIG };

  // 8. WhatsApp de Suporte do Sistema (Botão Flutuante)
  public supportWhatsAppConfig: SupportWhatsAppConfig = { ...DEFAULT_SUPPORT_WHATSAPP_CONFIG };

  constructor() {
    const loaded = this.loadFromDisk();
    if (!loaded || this.tenants.length === 0) {
      this.initDefaultData();
      this.persist();
    }

    // Purga cadastros duplicados e tenant-master-admin fantasma
    const beforeTenantCount = this.tenants.length;
    this.tenants = this.tenants.filter((t) => t.id !== 'tenant-master-admin');
    this.profiles = this.profiles.filter((p) => p.id !== 'user-master-admin');
    if (this.tenants.length !== beforeTenantCount) {
      this.saveFile(FILE_TENANTS, this.tenants);
      this.saveFile(FILE_PROFILES, this.profiles);
    }

    if (isSupabaseConfigured()) {
      this.loadFromSupabase().catch((err) => {
        console.warn('[Supabase Initial Load]', err);
      });
    }
  }

  private saveFile(filePath: string, data: any) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Erro ao salvar arquivo isolado ${filePath}:`, err);
    }
  }

  private loadFile<T>(filePath: string): T[] | null {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error(`Erro ao ler arquivo isolado ${filePath}:`, err);
    }
    return null;
  }

  private loadObjectFile<T>(filePath: string): T | null {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error(`Erro ao ler arquivo ${filePath}:`, err);
    }
    return null;
  }

  public persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // 1. Grava no Módulo IPTV separadamente
      this.saveFile(FILE_IPTV_SUBSCRIBERS, this.iptvSubscribers);
      this.saveFile(FILE_IPTV_PLANS, this.iptvPlans);
      this.saveFile(FILE_IPTV_APPS, this.iptvApps);

      // 2. Grava no Módulo Negócios & Empresas separadamente
      this.saveFile(FILE_BUSINESS_CUSTOMERS, this.customers);
      this.saveFile(FILE_BUSINESS_PRODUCTS, this.products);
      this.saveFile(FILE_BUSINESS_SALES, this.charges);

      // 3. Grava no Módulo Assinaturas separadamente
      this.saveFile(FILE_SUBSCRIPTION_CUSTOMERS, this.subscriptionCustomers);
      this.saveFile(FILE_SUBSCRIPTION_PLANS, this.subscriptionPlans);
      this.saveFile(FILE_SUBSCRIPTION_SALES, this.subscriptionSales);

      // 4. Grava no Módulo Empréstimos separadamente
      this.saveFile(FILE_LOANS, this.loans);

      // 5. Grava Sistema & Tenants separadamente
      this.saveFile(FILE_TENANTS, this.tenants);
      this.saveFile(FILE_PROFILES, this.profiles);
      this.saveFile(FILE_PAYMENTS, this.payments);
      this.saveFile(FILE_GLOBAL_PLANS, this.globalPlanPrices);
      this.saveFile(FILE_USER_PASSWORDS, this.userPasswords);

      // 6. Grava Automação WhatsApp & Logs separadamente
      this.saveFile(FILE_WHATSAPP_CONFIGS, this.whatsappConfigs);
      this.saveFile(FILE_WHATSAPP_LOGS, this.whatsappDispatchLogs);

      // 7. Grava Link Promocional / Lojinha e WhatsApp de Suporte separadamente
      this.saveFile(FILE_EXTERNAL_LINK, this.externalLinkConfig);
      this.saveFile(FILE_SUPPORT_WHATSAPP, this.supportWhatsAppConfig);

      // 6. Também mantém backup consolidado em database.json
      const dataToSave = {
        tenants: this.tenants,
        profiles: this.profiles,
        customers: this.customers,
        charges: this.charges,
        products: this.products,
        payments: this.payments,
        iptvSubscribers: this.iptvSubscribers,
        iptvPlans: this.iptvPlans,
        iptvApps: this.iptvApps,
        subscriptionCustomers: this.subscriptionCustomers,
        subscriptionPlans: this.subscriptionPlans,
        subscriptionSales: this.subscriptionSales,
        loans: this.loans,
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');

      // Se Supabase estiver configurado, sincroniza assincronamente no PostgreSQL
      if (isSupabaseConfigured()) {
        this.syncAllToSupabase().catch(() => {});
      }
    } catch (err) {
      console.error('Failed to persist database to disk:', err);
    }
  }

  private loadFromDisk(): boolean {
    try {
      // Prioridade 1: Carrega de arquivos isolados se existirem
      const savedIptvSubs = this.loadFile<IPTVSubscriber>(FILE_IPTV_SUBSCRIBERS);
      const savedIptvPlans = this.loadFile<IPTVPlan>(FILE_IPTV_PLANS);
      const savedIptvApps = this.loadFile<IPTVApp>(FILE_IPTV_APPS);

      const savedCusts = this.loadFile<Customer>(FILE_BUSINESS_CUSTOMERS);
      const savedProds = this.loadFile<Product>(FILE_BUSINESS_PRODUCTS);
      const savedCharges = this.loadFile<Charge>(FILE_BUSINESS_SALES);

      const savedSubCusts = this.loadFile<SubscriptionCustomer>(FILE_SUBSCRIPTION_CUSTOMERS);
      const savedSubPlans = this.loadFile<SubscriptionPlan>(FILE_SUBSCRIPTION_PLANS);
      const savedSubSales = this.loadFile<SubscriptionSale>(FILE_SUBSCRIPTION_SALES);

      const savedLoans = this.loadFile<Loan>(FILE_LOANS);

      const savedTenants = this.loadFile<Tenant>(FILE_TENANTS);
      const savedProfiles = this.loadFile<Profile>(FILE_PROFILES);
      const savedPayments = this.loadFile<SubscriptionPayment>(FILE_PAYMENTS);

      let foundAnyIsolated = false;

      if (savedIptvSubs) { this.iptvSubscribers = savedIptvSubs; foundAnyIsolated = true; }
      if (savedIptvPlans) { this.iptvPlans = savedIptvPlans; foundAnyIsolated = true; }
      if (savedIptvApps) { this.iptvApps = savedIptvApps; foundAnyIsolated = true; }

      if (savedCusts) { this.customers = savedCusts; foundAnyIsolated = true; }
      if (savedProds) { this.products = savedProds; foundAnyIsolated = true; }
      if (savedCharges) { this.charges = savedCharges; foundAnyIsolated = true; }

      if (savedSubCusts) { this.subscriptionCustomers = savedSubCusts; foundAnyIsolated = true; }
      if (savedSubPlans) { this.subscriptionPlans = savedSubPlans; foundAnyIsolated = true; }
      if (savedSubSales) { this.subscriptionSales = savedSubSales; foundAnyIsolated = true; }

      if (savedLoans) { this.loans = savedLoans; foundAnyIsolated = true; }

      if (savedTenants && savedTenants.length > 0) {
        const seen = new Set<string>();
        const hasOfficialAdmin = savedTenants.some(
          (t) => t.id === '2caa686e-9c14-439b-8e9d-9b25cfbac345' || (t.email?.toLowerCase().trim() === 'betaof10@hotmail.com' && t.id !== 'tenant-master-admin')
        );
        this.tenants = savedTenants.filter((t) => {
          if (!t.id || seen.has(t.id)) return false;
          if (t.id === 'tenant-master-admin' && hasOfficialAdmin) return false;
          seen.add(t.id);
          return true;
        });
        foundAnyIsolated = true;
      }
      if (savedProfiles && savedProfiles.length > 0) {
        this.profiles = savedProfiles.filter((p) => p.id !== 'user-master-admin');
        foundAnyIsolated = true;
      }
      if (savedPayments) { this.payments = savedPayments; foundAnyIsolated = true; }

      const savedWaConfigs = this.loadObjectFile<Record<string, WhatsAppAutomationConfig>>(FILE_WHATSAPP_CONFIGS);
      if (savedWaConfigs && typeof savedWaConfigs === 'object') {
        this.whatsappConfigs = savedWaConfigs;
        foundAnyIsolated = true;
      }
      const savedWaLogs = this.loadFile<WhatsAppDispatchLog>(FILE_WHATSAPP_LOGS);
      if (savedWaLogs && Array.isArray(savedWaLogs)) {
        this.whatsappDispatchLogs = savedWaLogs;
        foundAnyIsolated = true;
      }

      const savedExtLink = this.loadObjectFile<ExternalLinkConfig>(FILE_EXTERNAL_LINK);
      if (savedExtLink && typeof savedExtLink === 'object') {
        let desc = savedExtLink.description || DEFAULT_EXTERNAL_LINK_CONFIG.description;
        if (desc && desc.includes('produtos e serviços')) {
          desc = 'Conheça nossos produtos exclusivos';
        }
        this.externalLinkConfig = {
          enabled: savedExtLink.enabled !== undefined ? Boolean(savedExtLink.enabled) : true,
          button_text: savedExtLink.button_text || DEFAULT_EXTERNAL_LINK_CONFIG.button_text,
          url: savedExtLink.url || '',
          description: desc,
          updated_at: savedExtLink.updated_at,
        };
        foundAnyIsolated = true;
      }

      const savedSupport = this.loadObjectFile<SupportWhatsAppConfig>(FILE_SUPPORT_WHATSAPP);
      if (savedSupport && typeof savedSupport === 'object') {
        this.supportWhatsAppConfig = {
          phone: savedSupport.phone || DEFAULT_SUPPORT_WHATSAPP_CONFIG.phone,
          default_message: savedSupport.default_message || DEFAULT_SUPPORT_WHATSAPP_CONFIG.default_message,
          enabled: savedSupport.enabled !== undefined ? Boolean(savedSupport.enabled) : true,
          updated_at: savedSupport.updated_at,
        };
        foundAnyIsolated = true;
      }

      if (fs.existsSync(FILE_GLOBAL_PLANS)) {
        try {
          const rawPlans = fs.readFileSync(FILE_GLOBAL_PLANS, 'utf-8');
          const parsed = JSON.parse(rawPlans);
          if (parsed && typeof parsed === 'object') {
            this.globalPlanPrices = {
              module_1: Number(parsed.module_1) || DEFAULT_PLAN_PRICES.module_1,
              module_2: Number(parsed.module_2) || DEFAULT_PLAN_PRICES.module_2,
              module_3: Number(parsed.module_3) || DEFAULT_PLAN_PRICES.module_3,
              module_4: Number(parsed.module_4) || DEFAULT_PLAN_PRICES.module_4,
            };
            foundAnyIsolated = true;
          }
        } catch {}
      }

      if (fs.existsSync(FILE_USER_PASSWORDS)) {
        try {
          const rawPass = fs.readFileSync(FILE_USER_PASSWORDS, 'utf-8');
          const parsed = JSON.parse(rawPass);
          if (parsed && typeof parsed === 'object') {
            this.userPasswords = { ...this.userPasswords, ...parsed };
            foundAnyIsolated = true;
          }
        } catch {}
      }

      if (fs.existsSync(FILE_SYSTEM_SETTINGS)) {
        try {
          const rawSettings = fs.readFileSync(FILE_SYSTEM_SETTINGS, 'utf-8');
          const parsed = JSON.parse(rawSettings);
          if (parsed && typeof parsed === 'object') {
            if (parsed.mercadopago_config?.access_token) {
              this.mercadoPagoToken = parsed.mercadopago_config.access_token;
              process.env.MERCADO_PAGO_ACCESS_TOKEN = this.mercadoPagoToken;
              foundAnyIsolated = true;
            }
          }
        } catch {}
      }

      // Se encontrou dados isolados e temos tenants, está carregado
      if (foundAnyIsolated && this.tenants.length > 0) {
        return true;
      }

      // Prioridade 2: Migração inicial a partir de database.json antigo se existir
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.tenants) && parsed.tenants.length > 0) this.tenants = parsed.tenants;
          if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) this.profiles = parsed.profiles;
          if (Array.isArray(parsed.customers)) this.customers = parsed.customers;
          if (Array.isArray(parsed.charges)) this.charges = parsed.charges;
          if (Array.isArray(parsed.products)) this.products = parsed.products;
          if (Array.isArray(parsed.payments)) this.payments = parsed.payments;
          if (Array.isArray(parsed.iptvSubscribers)) this.iptvSubscribers = parsed.iptvSubscribers;
          if (Array.isArray(parsed.iptvPlans)) this.iptvPlans = parsed.iptvPlans;
          if (Array.isArray(parsed.iptvApps)) this.iptvApps = parsed.iptvApps;
          if (Array.isArray(parsed.subscriptionCustomers)) this.subscriptionCustomers = parsed.subscriptionCustomers;
          if (Array.isArray(parsed.subscriptionPlans)) this.subscriptionPlans = parsed.subscriptionPlans;
          if (Array.isArray(parsed.subscriptionSales)) this.subscriptionSales = parsed.subscriptionSales;

          // Imediatamente separa nos arquivos dedicados
          this.persist();
          return true;
        }
      }
    } catch (err) {
      console.error('Failed to load database from disk:', err);
    }
    return false;
  }

  private initDefaultData() {
    const now = new Date();
    const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    // Default Demo Tenant
    const defaultTenant: Tenant = {
      id: 'tenant-default',
      name: 'DL Informática & Tecnologia',
      trade_name: 'DL Soluções Digitais',
      document: '28.456.789/0001-34',
      phone: '(11) 3245-8900',
      whatsapp: '5511987654321',
      email: 'dlinformatica3137@gmail.com',
      address_street: 'Av. Paulista',
      address_number: '1200',
      address_neighborhood: 'Bela Vista',
      address_city: 'São Paulo',
      address_state: 'SP',
      address_zip: '01310-100',
      pix_key: 'dlinformatica3137@gmail.com',
      pix_key_type: 'email',
      logo_url: '/multigestor.png',
      subscription_status: 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: twoDaysLater.toISOString(),
      subscription_expires_at: twoDaysLater.toISOString(),
      created_at: new Date(now.getTime() - 86400000).toISOString(),
      updated_at: now.toISOString(),
    };

    // Master Admin Tenant (Oficial: Ativações e vendas)
    const adminTenant: Tenant = {
      id: '2caa686e-9c14-439b-8e9d-9b25cfbac345',
      name: 'Ativações e vendas',
      trade_name: 'Ativações e vendas',
      document: '02922901793',
      email: 'betaof10@hotmail.com',
      whatsapp: '219899850026',
      phone: '219899850026',
      pix_key: '02922901793',
      pix_key_type: 'cpf',
      subscription_status: 'lifetime',
      trial_started_at: '2026-10-03T14:44:43.536Z',
      trial_ends_at: '2099-12-31T23:59:59.000Z',
      subscription_expires_at: '2099-12-31T23:59:59.000Z',
      selected_modules: ['loans', 'iptv', 'business', 'subscriptions'],
      plan_monthly_price: 89,
      created_at: '2026-10-03T14:44:43.536Z',
      updated_at: now.toISOString(),
      owner_user_id: '83552109-d4f2-4fb0-9282-241c02a195ea',
    };

    this.tenants = [defaultTenant, adminTenant];

    // Default Profiles
    this.profiles = [
      {
        id: 'user-default',
        email: 'dlinformatica3137@gmail.com',
        full_name: 'DL Informática',
        phone: '(11) 98765-4321',
        role: 'owner',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: '83552109-d4f2-4fb0-9282-241c02a195ea',
        email: 'betaof10@hotmail.com',
        full_name: 'Humberto Queiroz',
        phone: '219899850026',
        tenant_id: '2caa686e-9c14-439b-8e9d-9b25cfbac345',
        role: 'master_admin',
        created_at: '2026-10-03T14:44:44.101Z',
        updated_at: now.toISOString(),
      },
      {
        id: 'user-master-wesley',
        email: 'wesleyamarah@gmail.com',
        full_name: 'Wesley Amarah (Master Admin)',
        phone: '(11) 98888-0000',
        role: 'master_admin',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: now.toISOString(),
      },
    ];

    this.customers = [];

    this.charges = [];
    this.products = [];
    this.iptvSubscribers = [];
    this.iptvPlans = [];
    this.iptvApps = [];
    this.subscriptionCustomers = [];
    this.subscriptionPlans = [];
    this.subscriptionSales = [];
    this.loans = [];
  }

  // Tenant Operations
  public checkAndUpdateTenantStatus(tenant?: Tenant): Tenant | undefined {
    if (!tenant) return tenant;

    // betaof10@hotmail.com é o ÚNICO vitalício do sistema que NUNCA pode ser removido pelo sistema
    if (tenant.email?.toLowerCase().trim() === 'betaof10@hotmail.com') {
      if (tenant.subscription_status !== 'lifetime') {
        tenant.subscription_status = 'lifetime';
        tenant.subscription_expires_at = '2099-12-31T23:59:59.000Z';
        this.persist();
      }
      return tenant;
    }

    if (tenant.subscription_status === 'lifetime') return tenant;


    const now = Date.now();
    let expiryTime: number | null = null;

    if (tenant.subscription_status === 'active') {
      expiryTime = tenant.subscription_expires_at ? new Date(tenant.subscription_expires_at).getTime() : null;
    } else if (tenant.subscription_status === 'trial') {
      expiryTime = tenant.trial_ends_at ? new Date(tenant.trial_ends_at).getTime() : null;
    }

    if (expiryTime && expiryTime <= now) {
      if (tenant.subscription_status !== 'expired') {
        tenant.subscription_status = 'expired';
        tenant.updated_at = new Date().toISOString();
        this.persist();
      }
    }

    return tenant;
  }

  public updateTenant(id: string, updates: Partial<Tenant>): Tenant {
    const index = this.tenants.findIndex((t) => t.id === id);
    let targetTenant: Tenant;
    if (index === -1) {
      const newTenant: Tenant = {
        id,
        name: updates.name || 'Nova Empresa',
        subscription_status: updates.subscription_status || 'trial',
        trial_started_at: updates.trial_started_at || new Date().toISOString(),
        trial_ends_at: updates.trial_ends_at || new Date(Date.now() + 2 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...updates,
      };
      this.tenants.push(newTenant);
      targetTenant = newTenant;
    } else {
      this.tenants[index] = {
        ...this.tenants[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      if (updates.has_custom_price !== undefined) {
        this.tenants[index].has_custom_price = updates.has_custom_price;
      } else if (updates.plan_monthly_price !== undefined) {
        this.tenants[index].has_custom_price = typeof updates.plan_monthly_price === 'number' && updates.plan_monthly_price > 0;
      }
      if (updates.selected_modules && !this.tenants[index].has_custom_price && updates.plan_monthly_price === undefined) {
        this.tenants[index].plan_monthly_price = calculatePlanPrice(this.tenants[index].selected_modules?.length || 1, this.globalPlanPrices);
      }
      // betaof10@hotmail.com é o ÚNICO vitalício do sistema que NUNCA pode ser removido do vitalício
      if (
        this.tenants[index].email?.toLowerCase().trim() === 'betaof10@hotmail.com' ||
        this.tenants[index].id === '2caa686e-9c14-439b-8e9d-9b25cfbac345'
      ) {
        this.tenants[index].subscription_status = 'lifetime';
        this.tenants[index].subscription_expires_at = '2099-12-31T23:59:59.000Z';
      }
      targetTenant = this.tenants[index];
    }
    this.persist();

    // Sincroniza atualização com o Supabase PostgreSQL em tempo real
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const supabasePayload: any = {
            updated_at: new Date().toISOString(),
          };
          if (updates.name !== undefined) supabasePayload.name = updates.name;
          if (updates.trade_name !== undefined) supabasePayload.trade_name = updates.trade_name;
          if (updates.subscription_status !== undefined) supabasePayload.subscription_status = updates.subscription_status;
          if (updates.subscription_expires_at !== undefined) supabasePayload.subscription_expires_at = updates.subscription_expires_at;
          if (updates.trial_started_at !== undefined) supabasePayload.trial_started_at = updates.trial_started_at;
          if (updates.trial_ends_at !== undefined) supabasePayload.trial_ends_at = updates.trial_ends_at;
          if (updates.is_blocked !== undefined) supabasePayload.is_blocked = updates.is_blocked;
          if (updates.selected_modules !== undefined) supabasePayload.selected_modules = updates.selected_modules;
          if (updates.plan_monthly_price !== undefined) supabasePayload.plan_monthly_price = updates.plan_monthly_price;

          (client
            .from('tenants')
            .update(supabasePayload)
            .eq('id', id) as any)
            .then((res: any) => {
              if (res?.error) console.warn('[Supabase Sync] Erro ao atualizar tenant no Supabase:', res.error.message);
            })
            .catch(() => {});
        }
      } catch (sbErr: any) {
        console.warn('[Supabase Sync] Falha ao sincronizar com Supabase:', sbErr?.message);
      }
    }

    return this.checkAndUpdateTenantStatus(targetTenant)!;
  }

  public getAllTenants(): Tenant[] {
    const diskTenants = this.loadFile<Tenant>(FILE_TENANTS);
    if (diskTenants && Array.isArray(diskTenants)) this.tenants = diskTenants;

    const hasOfficial = this.tenants.some(
      (t) => t.id === '2caa686e-9c14-439b-8e9d-9b25cfbac345' || (t.email?.toLowerCase().trim() === 'betaof10@hotmail.com' && t.id !== 'tenant-master-admin')
    );

    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();
    const uniqueTenants: Tenant[] = [];

    for (const t of this.tenants) {
      if (!t.id || seenIds.has(t.id)) continue;
      if (t.id === 'tenant-default' || t.email === 'dlinformatica3137@gmail.com') continue;
      if (t.id === 'tenant-master-admin' && hasOfficial) continue;

      const em = (t.email || '').toLowerCase().trim();
      if (em) {
        if (seenEmails.has(em)) continue;
        seenEmails.add(em);
      }

      seenIds.add(t.id);
      uniqueTenants.push(t);
    }
    this.tenants = uniqueTenants;
    return this.tenants.map((t) => this.checkAndUpdateTenantStatus(t)!);
  }

  public getTenant(id: string): Tenant | undefined {
    const diskTenants = this.loadFile<Tenant>(FILE_TENANTS);
    if (diskTenants && Array.isArray(diskTenants)) this.tenants = diskTenants;
    const tenant = this.tenants.find((t) => t.id === id);
    return tenant ? this.checkAndUpdateTenantStatus(tenant) : undefined;
  }

  // Preços dos Planos Globais do Sistema
  public getGlobalPlanPrices(): GlobalPlanPrices {
    return { ...this.globalPlanPrices };
  }

  public updateGlobalPlanPrices(updates: Partial<GlobalPlanPrices>): GlobalPlanPrices {
    const parsePrice = (val: any, fallback: number): number => {
      if (typeof val === 'number' && !isNaN(val) && val > 0) return Number(val.toFixed(2));
      if (typeof val === 'string') {
        const cleaned = parseFloat(val.replace(',', '.'));
        if (!isNaN(cleaned) && cleaned > 0) return Number(cleaned.toFixed(2));
      }
      return fallback;
    };

    this.globalPlanPrices = {
      module_1: parsePrice(updates.module_1, this.globalPlanPrices.module_1),
      module_2: parsePrice(updates.module_2, this.globalPlanPrices.module_2),
      module_3: parsePrice(updates.module_3, this.globalPlanPrices.module_3),
      module_4: parsePrice(updates.module_4, this.globalPlanPrices.module_4),
    };

    // Atualiza imediatamente todos os tenants que utilizam a precificação padrão global
    for (const t of this.tenants) {
      if (!t.has_custom_price) {
        const count = t.selected_modules?.length || 1;
        t.plan_monthly_price = calculatePlanPrice(count, this.globalPlanPrices);
      }
    }

    this.persist();

    // Sincroniza imediatamente com a tabela system_settings do Supabase
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        (client.from('system_settings').upsert({
          key: 'global_plan_prices',
          value: this.globalPlanPrices,
          updated_at: new Date().toISOString(),
        }) as any).then(({ error }: any) => {
          if (error) console.error('[Supabase] Erro ao sincronizar global_plan_prices:', error.message);
          else console.log('[Supabase] global_plan_prices sincronizado com sucesso:', this.globalPlanPrices);
        }).catch((err: any) => {
          console.error('[Supabase] Exceção ao atualizar global_plan_prices:', err);
        });
      }
    }

    return { ...this.globalPlanPrices };
  }

  public resetTenantData(tenantId: string): void {
    this.customers = this.customers.filter((c) => c.tenant_id !== tenantId);
    this.charges = this.charges.filter((c) => c.tenant_id !== tenantId);
    this.products = this.products.filter((p) => p.tenant_id !== tenantId);
    this.iptvSubscribers = this.iptvSubscribers.filter((s) => s.tenant_id !== tenantId);
    this.iptvPlans = this.iptvPlans.filter((p) => p.tenant_id !== tenantId);
    this.iptvApps = this.iptvApps.filter((a) => a.tenant_id !== tenantId);
    this.subscriptionCustomers = this.subscriptionCustomers.filter((c) => c.tenant_id !== tenantId);
    this.subscriptionPlans = this.subscriptionPlans.filter((p) => p.tenant_id !== tenantId);
    this.subscriptionSales = this.subscriptionSales.filter((s) => s.tenant_id !== tenantId);
    this.persist();
  }

  public async deleteTenantAsync(tenantId: string): Promise<boolean> {
    if (!tenantId) return false;

    // Garante que os dados mais recentes do disco estejam carregados
    const diskTenants = this.loadFile<Tenant>(FILE_TENANTS);
    if (diskTenants && Array.isArray(diskTenants)) this.tenants = diskTenants;
    const diskProfiles = this.loadFile<Profile>(FILE_PROFILES);
    if (diskProfiles && Array.isArray(diskProfiles)) this.profiles = diskProfiles;
    const diskPasswords = this.loadObjectFile<Record<string, string>>(FILE_USER_PASSWORDS);
    if (diskPasswords) this.userPasswords = diskPasswords;

    const targetTenant = this.tenants.find((t) => t.id === tenantId);
    if (!targetTenant) {
      return false;
    }

    // Proteção absoluta: Apenas a conta principal do Administrador Master (Ativações e vendas) nunca pode ser deletada
    if (targetTenant.id === '2caa686e-9c14-439b-8e9d-9b25cfbac345') {
      throw new Error('A conta principal do Administrador Master (Ativações e vendas) não pode ser excluída.');
    }

    // Coleta todos os e-mails vinculados ao tenant para exclusão de acessos/credenciais
    const emailsToRemove = new Set<string>();
    if (targetTenant.email) {
      emailsToRemove.add(targetTenant.email.toLowerCase().trim());
    }

    const associatedProfiles = this.profiles.filter((p) => p.tenant_id === tenantId);
    for (const p of associatedProfiles) {
      if (p.email) {
        emailsToRemove.add(p.email.toLowerCase().trim());
      }
    }

    // Proteção adicional para garantir que Betão nunca seja afetado
    emailsToRemove.delete('betaof10@hotmail.com');
    emailsToRemove.delete('betoqueiroz@hotmail.com');

    // 1. Remover da lista de tenants
    this.tenants = this.tenants.filter((t) => t.id !== tenantId);

    // 2. Remover perfis de usuário associados
    this.profiles = this.profiles.filter(
      (p) => p.tenant_id !== tenantId && (!p.email || !emailsToRemove.has(p.email.toLowerCase().trim()))
    );

    // 3. Remover senhas de autenticação salvas
    for (const em of emailsToRemove) {
      delete this.userPasswords[em];
    }

    // 4. Remover dados operacionais em todos os módulos
    this.customers = this.customers.filter((c) => c.tenant_id !== tenantId);
    this.charges = this.charges.filter((c) => c.tenant_id !== tenantId);
    this.products = this.products.filter((p) => p.tenant_id !== tenantId);
    this.iptvSubscribers = this.iptvSubscribers.filter((s) => s.tenant_id !== tenantId);
    this.iptvPlans = this.iptvPlans.filter((p) => p.tenant_id !== tenantId);
    this.iptvApps = this.iptvApps.filter((a) => a.tenant_id !== tenantId);
    this.subscriptionCustomers = this.subscriptionCustomers.filter((c) => c.tenant_id !== tenantId);
    this.subscriptionPlans = this.subscriptionPlans.filter((p) => p.tenant_id !== tenantId);
    this.subscriptionSales = this.subscriptionSales.filter((s) => s.tenant_id !== tenantId);
    this.loans = this.loans.filter((l) => l.tenantId !== tenantId);
    this.payments = this.payments.filter((p) => p.tenant_id !== tenantId);
    delete this.whatsappConfigs[tenantId];
    this.whatsappDispatchLogs = this.whatsappDispatchLogs.filter((l) => l.tenant_id !== tenantId);

    // 5. Gravar imediatamente em todos os arquivos de disco
    this.saveFile(FILE_TENANTS, this.tenants);
    this.saveFile(FILE_PROFILES, this.profiles);
    this.saveFile(FILE_USER_PASSWORDS, this.userPasswords);
    this.saveFile(FILE_BUSINESS_CUSTOMERS, this.customers);
    this.saveFile(FILE_BUSINESS_SALES, this.charges);
    this.saveFile(FILE_BUSINESS_PRODUCTS, this.products);
    this.saveFile(FILE_IPTV_SUBSCRIBERS, this.iptvSubscribers);
    this.saveFile(FILE_IPTV_PLANS, this.iptvPlans);
    this.saveFile(FILE_IPTV_APPS, this.iptvApps);
    this.saveFile(FILE_SUBSCRIPTION_CUSTOMERS, this.subscriptionCustomers);
    this.saveFile(FILE_SUBSCRIPTION_PLANS, this.subscriptionPlans);
    this.saveFile(FILE_SUBSCRIPTION_SALES, this.subscriptionSales);
    this.saveFile(FILE_LOANS, this.loans);
    this.saveFile(FILE_PAYMENTS, this.payments);
    this.saveFile(FILE_WHATSAPP_CONFIGS, this.whatsappConfigs);
    this.saveFile(FILE_WHATSAPP_LOGS, this.whatsappDispatchLogs);

    try {
      const dataToSave = {
        tenants: this.tenants,
        profiles: this.profiles,
        customers: this.customers,
        charges: this.charges,
        products: this.products,
        payments: this.payments,
        iptvSubscribers: this.iptvSubscribers,
        iptvPlans: this.iptvPlans,
        iptvApps: this.iptvApps,
        subscriptionCustomers: this.subscriptionCustomers,
        subscriptionPlans: this.subscriptionPlans,
        subscriptionSales: this.subscriptionSales,
        loans: this.loans,
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    } catch {}

    // 6. Desconectar e excluir pastas de sessão de WhatsApp deste tenant
    try {
      const sanitizedName = (targetTenant.name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const candidateInstanceNames = [
        `instancia_${sanitizedName}`,
        `tenant_${tenantId}`,
        `tenant-${tenantId}`,
        tenantId,
      ];
      for (const inst of candidateInstanceNames) {
        await disconnectBaileysInstance(inst).catch(() => {});
      }
    } catch (waErr) {
      console.warn('[WhatsApp Cleanup Warning]:', waErr);
    }

    // 7. Sincronizar exclusão total no banco de dados na nuvem (Supabase)
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await client.from('loans').delete().eq('tenant_id', tenantId);
          await client.from('customers').delete().eq('tenant_id', tenantId);
          await client.from('charges').delete().eq('tenant_id', tenantId);
          await client.from('products').delete().eq('tenant_id', tenantId);
          await client.from('iptv_subscribers').delete().eq('tenant_id', tenantId);
          await client.from('iptv_plans').delete().eq('tenant_id', tenantId);
          await client.from('iptv_apps').delete().eq('tenant_id', tenantId);
          await client.from('subscription_customers').delete().eq('tenant_id', tenantId);
          await client.from('subscription_plans').delete().eq('tenant_id', tenantId);
          await client.from('subscription_sales').delete().eq('tenant_id', tenantId);
          await client.from('whatsapp_automation_config').delete().eq('tenant_id', tenantId);
          await client.from('profiles').delete().eq('tenant_id', tenantId);
          for (const em of emailsToRemove) {
            await client.from('profiles').delete().ilike('email', em);
          }
          await client.from('tenants').delete().eq('id', tenantId);
          await client.from('system_settings').upsert({
            key: 'user_passwords',
            value: this.userPasswords,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (sbErr) {
        console.error('[Supabase Delete Tenant Error]', sbErr);
      }
    }

    console.log(`[Store] Tenant "${targetTenant.name}" (${tenantId}) excluído com sucesso de todo o sistema.`);
    return true;
  }

  // Credenciais de Usuário
  public userPasswords: Record<string, string> = {
    'dlinformatica3137@gmail.com': '123456',
    'betaof10@hotmail.com': '123456',
    'jonjontelaspremium@gmail.com': '123456',
    'jonjotelaspremium@gmail.com': '123456',
  };

  public setPassword(email: string, pass: string): void {
    if (!email || !pass) return;
    const clean = email.trim().toLowerCase();
    this.userPasswords[clean] = pass.trim();
    this.persist();

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        client.from('system_settings').upsert({
          key: 'user_passwords',
          value: this.userPasswords,
          updated_at: new Date().toISOString(),
        }).then(
          () => console.log(`[Store] ✅ Senha de "${clean}" sincronizada com o Supabase!`),
          (err: any) => console.warn('[Store] Aviso ao sincronizar senha com Supabase:', err?.message)
        );
      }
    }
  }

  public verifyPassword(email: string, pass?: string): boolean {
    if (!pass) return true;
    const clean = email.trim().toLowerCase();
    const diskPasswords = this.loadObjectFile<Record<string, string>>(FILE_USER_PASSWORDS);
    if (diskPasswords) this.userPasswords = diskPasswords;

    const stored = this.userPasswords[clean];
    if (!stored) {
      this.userPasswords[clean] = pass.trim();
      this.persist();
      return true;
    }
    return stored === pass.trim();
  }

  // Busca conta existente - NUNCA cria automaticamente se não existir
  public findAccount(email: string): { profile: Profile; tenant: Tenant } | null {
    if (!email || !email.trim()) return null;
    const cleanEmail = email.trim().toLowerCase();

    // Sincroniza sempre com o disco para reconhecer novos cadastros de qualquer dispositivo
    const diskTenants = this.loadFile<Tenant>(FILE_TENANTS);
    if (diskTenants && Array.isArray(diskTenants)) this.tenants = diskTenants;
    const diskProfiles = this.loadFile<Profile>(FILE_PROFILES);
    if (diskProfiles && Array.isArray(diskProfiles)) this.profiles = diskProfiles;
    const diskPasswords = this.loadObjectFile<Record<string, string>>(FILE_USER_PASSWORDS);
    if (diskPasswords) this.userPasswords = diskPasswords;

    const profile = this.profiles.find((p) => p.email && p.email.toLowerCase() === cleanEmail);
    const tenant = this.tenants.find((t) => t.email && t.email.toLowerCase() === cleanEmail);

    if (!profile && !tenant) {
      return null;
    }

    const isMasterAdmin = cleanEmail === 'betaof10@hotmail.com';

    const resolvedProfile = profile || {
      id: `user-${Date.now()}`,
      email: cleanEmail,
      full_name: tenant?.name || cleanEmail.split('@')[0],
      role: isMasterAdmin ? 'master_admin' : 'owner',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let resolvedTenant = tenant;
    if (!resolvedTenant) {
      const now = new Date();
      resolvedTenant = {
        id: `tenant-${Date.now()}`,
        name: `Empresa de ${resolvedProfile.full_name}`,
        email: cleanEmail,
        subscription_status: 'trial',
        trial_started_at: now.toISOString(),
        trial_ends_at: new Date(now.getTime() + 2 * 86400000).toISOString(),
        subscription_expires_at: new Date(now.getTime() + 2 * 86400000).toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      this.tenants.push(resolvedTenant);
      this.persist();
    }

    return { profile: resolvedProfile, tenant: this.checkAndUpdateTenantStatus(resolvedTenant)! };
  }

  // Busca conta existente de forma assíncrona (memória local + Supabase PostgreSQL)
  public async findAccountAsync(email: string): Promise<{ profile: Profile; tenant: Tenant } | null> {
    if (!email || !email.trim()) return null;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Procura na memória local
    const local = this.findAccount(cleanEmail);
    if (local) return local;

    // 2. Se não encontrou na memória, busca no Supabase
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          // Busca em profiles no Supabase
          const { data: pData } = await client.from('profiles').select('*').ilike('email', cleanEmail);
          const foundProfile = pData && pData.length > 0 ? (pData[0] as Profile) : null;

          // Busca em tenants no Supabase
          const { data: tData } = await client.from('tenants').select('*').ilike('email', cleanEmail);
          const foundTenant = tData && tData.length > 0 ? (tData[0] as Tenant) : null;

          if (foundProfile || foundTenant) {
            if (foundProfile && !this.profiles.some(p => p.email.toLowerCase() === cleanEmail)) {
              this.profiles.push(foundProfile);
            }
            if (foundTenant && !this.tenants.some(t => t.email?.toLowerCase() === cleanEmail)) {
              this.tenants.push(foundTenant);
            }
            this.persist();
            return this.findAccount(cleanEmail);
          }
        }
      } catch (err) {
        console.error('[findAccountAsync Supabase Error]', err);
      }
    }

    return null;
  }

  // Cria explicitamente uma nova conta via formulário de cadastro
  public createAccount(params: {
    email: string;
    companyName: string;
    fullName?: string;
    phone?: string;
    modules?: AppModule[];
    password?: string;
  }): { profile: Profile; tenant: Tenant } {
    const cleanEmail = params.email.trim().toLowerCase();

    // Bloqueio rigoroso: Não permite criar contas com e-mails repetidos que já tenham sido criados
    const existingProfile = this.profiles.find((p) => p.email && p.email.toLowerCase() === cleanEmail);
    const existingTenant = this.tenants.find((t) => t.email && t.email.toLowerCase() === cleanEmail);
    if (existingProfile || existingTenant) {
      throw new Error('Já existe uma conta cadastrada com este e-mail. Por favor, acesse pela aba "Entrar" com sua senha.');
    }

    const isMasterAdmin = cleanEmail === 'betaof10@hotmail.com';
    const profile: Profile = {
      id: `user-${Date.now()}`,
      email: cleanEmail,
      full_name: params.fullName?.trim() || cleanEmail.split('@')[0],
      phone: params.phone?.trim() || undefined,
      role: isMasterAdmin ? 'master_admin' : 'owner',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.profiles.push(profile);

    const now = new Date();
    const twoDaysLater = new Date(now.getTime() + 2 * 86400000).toISOString();

    const tenant: Tenant = {
      id: `tenant-${Date.now()}`,
      owner_user_id: profile.id,
      name: params.companyName.trim() || `Empresa de ${profile.full_name}`,
      trade_name: params.companyName.trim() || undefined,
      email: cleanEmail,
      whatsapp: params.phone?.trim() || undefined,
      pix_key: isMasterAdmin ? 'betaof10@hotmail.com' : cleanEmail,
      pix_key_type: 'email',
      logo_url: '/multigestor.png',
      selected_modules: params.modules || ['business'],
      plan_monthly_price: calculatePlanPrice(params.modules?.length || 1, this.globalPlanPrices),
      has_custom_price: false,
      subscription_status: isMasterAdmin ? 'lifetime' : 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: isMasterAdmin ? '2099-12-31T23:59:59.000Z' : twoDaysLater,
      subscription_expires_at: isMasterAdmin ? '2099-12-31T23:59:59.000Z' : twoDaysLater,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    profile.tenant_id = tenant.id;
    this.tenants.push(tenant);

    if (params.password) {
      this.userPasswords[cleanEmail] = params.password.trim();
    }

    this.persist();
    return { profile, tenant: this.checkAndUpdateTenantStatus(tenant)! };
  }

  // Profile & Auto-provisioning
  public getOrCreateProfile(userId: string, email: string): { profile: Profile; tenant: Tenant } {
    const isMasterAdmin = email.toLowerCase().trim() === 'betaof10@hotmail.com';

    let profile = this.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());

    if (!profile) {
      profile = {
        id: userId || `user-${Date.now()}`,
        email,
        full_name: email.split('@')[0],
        role: isMasterAdmin ? 'master_admin' : 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.profiles.push(profile);
      this.persist();
    } else if (isMasterAdmin && profile.role !== 'master_admin') {
      profile.role = 'master_admin';
      this.persist();
    }

    let tenant = this.tenants.find((t) => t.email?.toLowerCase() === email.toLowerCase());

    if (!tenant) {
      const now = new Date();
      tenant = {
        id: isMasterAdmin ? '2caa686e-9c14-439b-8e9d-9b25cfbac345' : `tenant-${Date.now()}`,
        owner_user_id: profile.id,
        name: isMasterAdmin ? 'Ativações e vendas' : `Empresa de ${profile.full_name}`,
        trade_name: isMasterAdmin ? 'Ativações e vendas' : undefined,
        document: isMasterAdmin ? '02922901793' : undefined,
        whatsapp: isMasterAdmin ? '219899850026' : undefined,
        phone: isMasterAdmin ? '219899850026' : undefined,
        email,
        pix_key: isMasterAdmin ? '02922901793' : email,
        pix_key_type: isMasterAdmin ? 'cpf' : 'email',
        selected_modules: isMasterAdmin ? ['loans', 'iptv', 'business', 'subscriptions'] : ['business'],
        subscription_status: isMasterAdmin ? 'lifetime' : 'trial',
        trial_started_at: isMasterAdmin ? '2026-10-03T14:44:43.536Z' : now.toISOString(),
        trial_ends_at: isMasterAdmin
          ? '2099-12-31T23:59:59.000Z'
          : new Date(now.getTime() + 2 * 86400000).toISOString(),
        subscription_expires_at: isMasterAdmin
          ? '2099-12-31T23:59:59.000Z'
          : new Date(now.getTime() + 2 * 86400000).toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      profile.tenant_id = tenant.id;
      this.tenants.push(tenant);
      this.persist();
    } else {
      if (!profile.tenant_id) profile.tenant_id = tenant.id;
      if (!tenant.owner_user_id) tenant.owner_user_id = profile.id;

    }

    return { profile, tenant: this.checkAndUpdateTenantStatus(tenant)! };
  }

  // Customers
  public getCustomers(tenantId: string): Customer[] {
    const diskCusts = this.loadFile<Customer>(FILE_BUSINESS_CUSTOMERS);
    if (diskCusts && Array.isArray(diskCusts)) this.customers = diskCusts;
    const diskCharges = this.loadFile<Charge>(FILE_BUSINESS_SALES);
    if (diskCharges && Array.isArray(diskCharges)) this.charges = diskCharges;

    const tenantCustomers = this.customers.filter((c) => c.tenant_id === tenantId);
    
    // Enrich with calculated debts
    return tenantCustomers.map((cust) => {
      const custCharges = this.charges.filter((chg) => chg.customer_id === cust.id);
      const totalDebt = custCharges
        .filter((c) => c.status === 'pending' || c.status === 'overdue')
        .reduce((sum, c) => sum + Number(c.amount), 0);
      const totalPaid = custCharges
        .filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.amount), 0);

      return {
        ...cust,
        total_debt: totalDebt,
        total_paid: totalPaid,
      };
    });
  }

  public async getCustomersAsync(tenantId: string): Promise<Customer[]> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client.from('customers').select('*').eq('tenant_id', tenantId);
          if (!error && data && data.length > 0) {
            for (const c of data) {
              const mapped: Customer = {
                id: c.id,
                tenant_id: c.tenant_id,
                name: c.name,
                trade_name: c.trade_name || undefined,
                document: c.document || undefined,
                whatsapp: c.whatsapp || c.phone || undefined,
                email: c.email || undefined,
                address_street: c.street || c.address_street || undefined,
                address_number: c.number || c.address_number || undefined,
                address_neighborhood: c.neighborhood || c.address_neighborhood || undefined,
                address_city: c.city || c.address_city || undefined,
                address_state: c.state || c.address_state || undefined,
                notes: c.notes || undefined,
                created_at: c.created_at || new Date().toISOString(),
                updated_at: c.updated_at || new Date().toISOString(),
              };
              const idx = this.customers.findIndex((local) => local.id === mapped.id);
              if (idx >= 0) {
                this.customers[idx] = { ...this.customers[idx], ...mapped };
              } else {
                this.customers.push(mapped);
              }
            }
            this.saveFile(FILE_BUSINESS_CUSTOMERS, this.customers);
          }
        }
      } catch (err) {
        console.warn('[getCustomersAsync warn]', err);
      }
    }
    return this.getCustomers(tenantId);
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customers.find((c) => c.id === id);
  }

  public createCustomer(data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Customer {
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };
    this.customers.push(newCustomer);
    this.persist();
    return newCustomer;
  }

  public async createCustomerAsync(data: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Promise<Customer> {
    const newCustomer = this.createCustomer(data);
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await client.from('customers').upsert([{
            id: newCustomer.id,
            tenant_id: newCustomer.tenant_id || 'tenant-default',
            name: newCustomer.name,
            document: newCustomer.document || null,
            trade_name: newCustomer.trade_name || null,
            whatsapp: newCustomer.whatsapp || null,
            email: newCustomer.email || null,
            street: newCustomer.address_street || null,
            number: newCustomer.address_number || null,
            neighborhood: newCustomer.address_neighborhood || null,
            city: newCustomer.address_city || null,
            state: newCustomer.address_state || null,
            notes: newCustomer.notes || null,
            created_at: newCustomer.created_at,
            updated_at: newCustomer.updated_at,
          }]);
        }
      } catch (err) {
        console.warn('[Direct Supabase Upsert Customer warn]', err);
      }
    }
    return newCustomer;
  }

  public updateCustomer(id: string, updates: Partial<Customer>): Customer | undefined {
    const index = this.customers.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    this.customers[index] = {
      ...this.customers[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    return this.customers[index];
  }

  public async updateCustomerAsync(id: string, updates: Partial<Customer>): Promise<Customer | undefined> {
    const updated = this.updateCustomer(id, updates);
    if (updated && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const payload: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (updates.name !== undefined) payload.name = updates.name.trim();
          if (updates.trade_name !== undefined) payload.trade_name = updates.trade_name;
          if (updates.document !== undefined) payload.document = updates.document;
          if (updates.phone !== undefined || updates.whatsapp !== undefined) {
            payload.phone = updates.phone || updates.whatsapp;
            payload.whatsapp = updates.whatsapp;
          }
          if (updates.email !== undefined) payload.email = updates.email;
          if (updates.address_street !== undefined) payload.street = updates.address_street;
          if (updates.address_number !== undefined) payload.number = updates.address_number;
          if (updates.address_neighborhood !== undefined) payload.neighborhood = updates.address_neighborhood;
          if (updates.address_city !== undefined) payload.city = updates.address_city;
          if (updates.address_state !== undefined) payload.state = updates.address_state;
          if (updates.notes !== undefined) payload.notes = updates.notes;

          await client.from('customers').update(payload).eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Update Customer warn]', err);
      }
    }
    return updated;
  }

  public deleteCustomer(id: string): boolean {
    const initialLen = this.customers.length;
    this.customers = this.customers.filter((c) => c.id !== id);
    // Also remove customer charges
    this.charges = this.charges.filter((ch) => ch.customer_id !== id);
    const deleted = this.customers.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  public async deleteCustomerAsync(id: string): Promise<boolean> {
    const deleted = this.deleteCustomer(id);
    if (deleted && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await client.from('customers').delete().eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Delete Customer warn]', err);
      }
    }
    return deleted;
  }

  // Charges
  public getCharges(tenantId: string, status?: string): Charge[] {
    const diskCharges = this.loadFile<Charge>(FILE_BUSINESS_SALES);
    if (diskCharges && Array.isArray(diskCharges)) this.charges = diskCharges;
    const diskCusts = this.loadFile<Customer>(FILE_BUSINESS_CUSTOMERS);
    if (diskCusts && Array.isArray(diskCusts)) this.customers = diskCusts;

    let result = this.charges.filter((c) => c.tenant_id === tenantId);
    
    // Auto-update overdue status based on current date
    const today = new Date().toISOString().split('T')[0];
    result.forEach((c) => {
      if (c.status === 'pending' && c.due_date < today) {
        c.status = 'overdue';
      }
    });

    if (status && status !== 'all') {
      result = result.filter((c) => c.status === status);
    }

    // Attach customer info
    return result.map((chg) => ({
      ...chg,
      customer: this.customers.find((c) => c.id === chg.customer_id),
    }));
  }

  public getChargeById(id: string): Charge | undefined {
    const chg = this.charges.find((c) => c.id === id);
    if (!chg) return undefined;
    return {
      ...chg,
      customer: this.customers.find((c) => c.id === chg.customer_id),
    };
  }

  public createCharge(data: Omit<Charge, 'id' | 'created_at' | 'updated_at'>): Charge {
    const today = new Date().toISOString().split('T')[0];
    let status = data.status || 'pending';
    if (status === 'pending' && data.due_date < today) {
      status = 'overdue';
    }

    const newCharge: Charge = {
      id: `chg-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
      type: data.type || (data.loan_id?.startsWith('__type:') ? data.loan_id.replace('__type:', '') : (data.loan_id ? 'loan' : 'sale')),
      paid_at: status === 'paid' ? (data.paid_at || new Date().toISOString()) : undefined,
      status,
    };

    // Attach customer info if possible
    newCharge.customer = this.customers.find((c) => c.id === newCharge.customer_id);
    this.charges.unshift(newCharge);
    this.persist();
    return newCharge;
  }

  public async createChargeAsync(data: Omit<Charge, 'id' | 'created_at' | 'updated_at'>): Promise<Charge> {
    const newCharge = this.createCharge(data);
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const cust = this.customers.find((c) => c.id === newCharge.customer_id) || (data as any).customer;
          try {
            if (cust) {
              await client.from('customers').upsert([{
                id: cust.id || newCharge.customer_id,
                tenant_id: newCharge.tenant_id,
                name: cust.name || 'Cliente',
                document: cust.document || null,
                whatsapp: cust.whatsapp || cust.phone || null,
                phone: cust.phone || cust.whatsapp || null,
                created_at: cust.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }]);
            } else if (newCharge.customer_id) {
              await client.from('customers').upsert([{
                id: newCharge.customer_id,
                tenant_id: newCharge.tenant_id,
                name: 'Cliente',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }]);
            }
          } catch {}

          const finalLoanId = (newCharge as any).loan_id || (newCharge.type && newCharge.type !== 'sale' ? `__type:${newCharge.type}` : null);
          await client.from('charges').upsert([{
            id: newCharge.id,
            tenant_id: newCharge.tenant_id,
            customer_id: newCharge.customer_id,
            description: newCharge.description,
            amount: Number(newCharge.amount || 0),
            due_date: newCharge.due_date,
            status: newCharge.status,
            loan_id: finalLoanId,
            payment_method: newCharge.payment_method || 'pix',
            paid_at: newCharge.paid_at || null,
            pix_copy_paste: newCharge.pix_copy_paste || null,
            created_at: newCharge.created_at,
            updated_at: newCharge.updated_at,
          }]);
        }
      } catch (err) {
        console.warn('[Direct Supabase Upsert Charge warn]', err);
      }
    }
    return newCharge;
  }

  public updateCharge(id: string, updates: Partial<Charge>): Charge | undefined {
    const index = this.charges.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    this.charges[index] = {
      ...this.charges[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    return this.charges[index];
  }

  public async updateChargeAsync(id: string, updates: Partial<Charge>): Promise<Charge | undefined> {
    const updated = this.updateCharge(id, updates);
    if (updated && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const payload: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (updates.description !== undefined) payload.description = updates.description.trim();
          if (updates.amount !== undefined) payload.amount = Number(updates.amount);
          if (updates.due_date !== undefined) payload.due_date = updates.due_date;
          if (updates.status !== undefined) payload.status = updates.status;
          if (updates.payment_method !== undefined) payload.payment_method = updates.payment_method;
          if (updates.paid_at !== undefined) payload.paid_at = updates.paid_at;
          if (updates.pix_copy_paste !== undefined) payload.pix_copy_paste = updates.pix_copy_paste;

          if (updates.type !== undefined) {
            payload.loan_id = updates.type !== 'sale' ? `__type:${updates.type}` : null;
          } else if (updates.loan_id !== undefined) {
            payload.loan_id = updates.loan_id;
          }

          await client.from('charges').update(payload).eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Update Charge warn]', err);
      }
    }
    return updated;
  }

  public markChargeAsPaid(id: string, paymentMethod = 'pix'): Charge | undefined {
    const index = this.charges.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    this.charges[index] = {
      ...this.charges[index],
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    return this.charges[index];
  }

  public async markChargeAsPaidAsync(id: string, paymentMethod = 'pix'): Promise<Charge | undefined> {
    const paid = this.markChargeAsPaid(id, paymentMethod);
    if (paid && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await client.from('charges').update({
            status: 'paid',
            paid_at: paid.paid_at || new Date().toISOString(),
            payment_method: paymentMethod || 'pix',
            updated_at: new Date().toISOString(),
          }).eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Mark Paid Charge warn]', err);
      }
    }
    return paid;
  }

  public deleteCharge(id: string): boolean {
    const len = this.charges.length;
    this.charges = this.charges.filter((c) => c.id !== id);
    const deleted = this.charges.length < len;
    if (deleted) this.persist();
    return deleted;
  }

  public async deleteChargeAsync(id: string): Promise<boolean> {
    const deleted = this.deleteCharge(id);
    if (deleted && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await client.from('charges').delete().eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Delete Charge warn]', err);
      }
    }
    return deleted;
  }

  // Products
  public getProducts(tenantId: string): Product[] {
    const diskProds = this.loadFile<Product>(FILE_BUSINESS_PRODUCTS);
    if (diskProds && Array.isArray(diskProds)) this.products = diskProds;
    return this.products.filter((p) => p.tenant_id === tenantId);
  }

  public createProduct(data: Omit<Product, 'id' | 'created_at'>): Product {
    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...data,
    };
    this.products.push(newProduct);
    this.persist();
    return newProduct;
  }

  public updateProduct(id: string, updates: Partial<Product>): Product | undefined {
    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) return undefined;
    this.products[index] = {
      ...this.products[index],
      ...updates,
    };
    this.persist();
    return this.products[index];
  }

  public deleteProduct(id: string): boolean {
    const len = this.products.length;
    this.products = this.products.filter((p) => p.id !== id);
    const deleted = this.products.length < len;
    if (deleted) this.persist();
    return deleted;
  }

  // Subscription Payments & Mercado Pago Orders
  public async createSubscriptionOrder(tenantId: string, userEmail: string): Promise<SubscriptionPayment> {
    const orderId = `MP-ORD-${Date.now()}`;
    const tenant = this.getTenant(tenantId);
    const moduleCount = tenant?.selected_modules && tenant.selected_modules.length > 0 ? tenant.selected_modules.length : 1;
    let amount = calculatePlanPrice(moduleCount, this.globalPlanPrices);
    if (tenant?.has_custom_price && typeof tenant.plan_monthly_price === 'number' && tenant.plan_monthly_price > 0) {
      amount = tenant.plan_monthly_price;
    }
    amount = Number(amount.toFixed(2));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    // Mercado Pago API check
    const mpToken = this.mercadoPagoToken || process.env.MERCADO_PAGO_ACCESS_TOKEN;

    let qrCode = '';
    let qrCodeBase64 = '';
    let pixCopyPaste = '';
    let ticketUrl = '';
    let mpPaymentId = '';

    if (mpToken) {
      try {
        console.log(`[Mercado Pago] Creating real PIX payment for ${userEmail} (R$ ${amount})...`);
        const appUrl = process.env.APP_URL || '';
        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mpToken}`,
            'X-Idempotency-Key': orderId,
          },
          body: JSON.stringify({
            transaction_amount: amount,
            description: `Assinatura Multi Gestor (${tenant?.trade_name || tenant?.name || 'Mensal'}) - 30 Dias`,
            payment_method_id: 'pix',
            external_reference: orderId,
            notification_url: appUrl ? `${appUrl}/api/mercadopago/webhook` : undefined,
            payer: {
              email: userEmail || 'cliente@multigestor.com.br',
              first_name: 'Assinante',
              last_name: 'MultiGestor',
            },
          }),
        });

        if (mpRes.ok) {
          const mpData = await mpRes.json();
          mpPaymentId = String(mpData.id || '');
          pixCopyPaste = mpData.point_of_interaction?.transaction_data?.qr_code || '';
          qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 
            ? `data:image/png;base64,${mpData.point_of_interaction.transaction_data.qr_code_base64}`
            : '';
          ticketUrl = mpData.point_of_interaction?.transaction_data?.ticket_url || '';
        }
      } catch (err) {
        console.error('[Mercado Pago] Error creating payment, falling back to valid BRCode:', err);
      }
    }

    // Fallback or demo valid BRCode
    if (!pixCopyPaste) {
      pixCopyPaste = generatePixPayload({
        pixKey: 'dlinformatica3137@gmail.com', // or system key
        merchantName: 'MULTI GESTOR PRO',
        merchantCity: 'SAO PAULO',
        amount: amount,
        txId: orderId.replace(/[^A-Za-z0-9]/g, '').slice(0, 20),
        description: `Multi Gestor R$ ${amount.toFixed(2)}`,
      });
      qrCodeBase64 = await generateQrCodeDataUrl(pixCopyPaste);
    }

    const newPayment: SubscriptionPayment = {
      id: `sub-pay-${Date.now()}`,
      tenant_id: tenantId,
      amount,
      currency: 'BRL',
      gateway: 'mercadopago',
      gateway_order_id: orderId,
      gateway_payment_id: mpPaymentId || undefined,
      status: 'pending',
      payment_method: 'pix',
      qr_code: pixCopyPaste,
      qr_code_base64: qrCodeBase64,
      pix_copy_paste: pixCopyPaste,
      ticket_url: ticketUrl,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.payments.unshift(newPayment);
    this.persist();
    return newPayment;
  }

  public getSubscriptionPayment(orderId: string): SubscriptionPayment | undefined {
    return this.payments.find((p) => p.gateway_order_id === orderId || p.id === orderId);
  }

  public approveSubscriptionOrder(orderId: string, simulate = false): {
    payment: SubscriptionPayment;
    tenant: Tenant;
  } | undefined {
    const payment = this.getSubscriptionPayment(orderId);
    if (!payment) return undefined;

    payment.status = 'approved';
    payment.paid_at = new Date().toISOString();
    payment.updated_at = new Date().toISOString();

    let tenant = this.getTenant(payment.tenant_id);
    if (!tenant) {
      tenant = this.tenants.find((t) => t.id === payment.tenant_id);
    }
    if (!tenant && payment.tenant_id && payment.tenant_id !== 'tenant-default') {
      tenant = this.updateTenant(payment.tenant_id, {
        id: payment.tenant_id,
        subscription_status: 'active',
      });
    }

    if (tenant) {
      const now = new Date();
      let currentExpiry = tenant.subscription_expires_at
        ? new Date(tenant.subscription_expires_at)
        : (tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null);

      // Rule: se já houver tempo restante (inclusive do trial), soma 30 dias à data final; caso contrário, conta a partir de agora.
      let baseDate = now;
      if (currentExpiry && currentExpiry.getTime() > now.getTime()) {
        baseDate = currentExpiry;
      }

      const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      tenant.subscription_status = 'active';
      tenant.subscription_expires_at = newExpiry.toISOString();
      tenant.updated_at = now.toISOString();

      this.persist();

      // Sincroniza com Supabase PostgreSQL se configurado
      if (isSupabaseConfigured()) {
        try {
          const client = getSupabaseClient();
          if (client) {
            (client
              .from('tenants')
              .update({
                subscription_status: 'active',
                subscription_expires_at: newExpiry.toISOString(),
                updated_at: now.toISOString(),
              })
              .eq('id', tenant.id) as any)
              .then(({ error }: any) => {
                if (error) console.warn('[Supabase Sync Tenant Error]', error.message);
                else console.log(`[Supabase Sync] ✅ Tenant ${tenant?.name} (${tenant?.id}) atualizado no Supabase para 'active' (+30 dias)`);
              })
              .catch((e: any) => console.warn('[Supabase Sync Exception]', e));
          }
        } catch (supaErr) {
          console.warn('[Supabase Sync client error]', supaErr);
        }
      }

      return { payment, tenant };
    }

    this.persist();
    return undefined;
  }

  public async setMercadoPagoToken(token: string): Promise<void> {
    this.mercadoPagoToken = token.trim();
    process.env.MERCADO_PAGO_ACCESS_TOKEN = this.mercadoPagoToken;

    // 1. Salva no arquivo local system_settings.json
    try {
      const current = fs.existsSync(FILE_SYSTEM_SETTINGS)
        ? JSON.parse(fs.readFileSync(FILE_SYSTEM_SETTINGS, 'utf-8'))
        : {};
      current.mercadopago_config = {
        access_token: this.mercadoPagoToken,
        updated_at: new Date().toISOString(),
      };
      fs.writeFileSync(FILE_SYSTEM_SETTINGS, JSON.stringify(current, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Store] Erro ao salvar system_settings.json local:', e);
    }

    // 2. Atualiza arquivo .env se existir
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf-8');
        const regex = new RegExp(`^MERCADO_PAGO_ACCESS_TOKEN=.*$`, 'm');
        const newLine = `MERCADO_PAGO_ACCESS_TOKEN="${this.mercadoPagoToken}"`;
        if (regex.test(content)) {
          content = content.replace(regex, newLine);
        } else {
          content = `${content}\n${newLine}`;
        }
        fs.writeFileSync(envPath, content, 'utf-8');
      }
    } catch (e) {
      console.error('[Error updating .env with Mercado Pago token]', e);
    }

    // 3. Salva no Supabase PostgreSQL de forma definitiva
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        try {
          const { error } = await client.from('system_settings').upsert({
            key: 'mercadopago_config',
            value: { access_token: this.mercadoPagoToken, updated_at: new Date().toISOString() },
            updated_at: new Date().toISOString(),
          });
          if (error) {
            console.warn('[Store] Erro ao persistir mercadopago_config no Supabase:', error.message);
          } else {
            console.log('[Store] ✅ Token do Mercado Pago persistido com sucesso no Supabase PostgreSQL!');
          }
        } catch (sbErr: any) {
          console.warn('[Store] Falha ao persistir mercadopago_config no Supabase:', sbErr?.message);
        }
      }
    }
  }

  // System Stats
  public getSystemStats(tenantId?: string): SystemStats {
    const diskCharges = this.loadFile<Charge>(FILE_BUSINESS_SALES);
    if (diskCharges && Array.isArray(diskCharges)) this.charges = diskCharges;
    const diskCusts = this.loadFile<Customer>(FILE_BUSINESS_CUSTOMERS);
    if (diskCusts && Array.isArray(diskCusts)) this.customers = diskCusts;

    const activeCharges = tenantId
      ? this.charges.filter((c) => c.tenant_id === tenantId)
      : this.charges;

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7); // YYYY-MM

    let totalPendingAmount = 0;
    let totalPaidAmount = 0;
    let totalOverdueAmount = 0;
    let paidThisMonth = 0;

    activeCharges.forEach((c) => {
      const amt = Number(c.amount) || 0;
      if (c.status === 'paid') {
        totalPaidAmount += amt;
        if (c.paid_at && c.paid_at.startsWith(currentMonth)) {
          paidThisMonth += amt;
        }
      } else if (c.status === 'overdue' || (c.status === 'pending' && c.due_date < today)) {
        totalOverdueAmount += amt;
      } else if (c.status === 'pending') {
        totalPendingAmount += amt;
      }
    });

    const activeCustomers = tenantId
      ? this.customers.filter((c) => c.tenant_id === tenantId).length
      : this.customers.length;

    const activeProducts = tenantId
      ? this.products.filter((p) => p.tenant_id === tenantId).length
      : this.products.length;

    return {
      totalCustomers: activeCustomers,
      totalCharges: activeCharges.length,
      totalProducts: activeProducts,
      totalPendingAmount,
      totalPaidAmount,
      totalOverdueAmount,
      paidThisMonth,
      activeTenants: this.tenants.length,
      mpConnected: Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN),
      supabaseConnected: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    };
  }

  // Integração com Supabase PostgreSQL
  public async syncAllToSupabase(): Promise<{ success: boolean; message: string; counts?: any; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'Supabase não configurado no .env (SUPABASE_URL e SUPABASE_ANON_KEY)' };
    }
    const client = getSupabaseClient();
    if (!client) return { success: false, message: 'Cliente Supabase indisponível' };

    try {
      // 1. Tenants
      if (this.tenants.length > 0) {
        const mappedTenants = this.tenants.map((t) => ({
          id: t.id,
          name: t.name,
          trade_name: t.trade_name || null,
          document: t.document || null,
          email: t.email || null,
          phone: t.whatsapp || t.phone || null,
          pix_key: t.pix_key || null,
          pix_key_type: t.pix_key_type || null,
          logo_url: t.logo_url || null,
          subscription_status: t.subscription_status || 'trial',
          trial_started_at: t.trial_started_at || new Date().toISOString(),
          trial_ends_at: t.trial_ends_at || new Date().toISOString(),
          subscription_expires_at: t.subscription_expires_at || null,
          selected_modules: t.selected_modules || ['loans', 'iptv', 'business', 'subscriptions'],
          plan_monthly_price: t.plan_monthly_price || 24.9,
          is_blocked: Boolean(t.is_blocked),
          blocked_reason: t.blocked_reason || null,
          created_at: t.created_at || new Date().toISOString(),
          updated_at: t.updated_at || new Date().toISOString(),
        }));
        await client.from('tenants').upsert(mappedTenants);
      }

      // 2. Profiles
      if (this.profiles.length > 0) {
        const mappedProfiles = this.profiles.map((p: any) => ({
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          phone: p.phone || null,
          tenant_id: p.tenant_id || (this.tenants.find((t) => t.email?.toLowerCase() === p.email?.toLowerCase())?.id || 'tenant-default'),
          role: p.role || 'user',
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
        }));
        await client.from('profiles').upsert(mappedProfiles);
      }

      // 3. Customers
      if (this.customers.length > 0) {
        const mappedCustomers = this.customers.map((c: any) => ({
          id: c.id,
          tenant_id: c.tenant_id || 'tenant-default',
          name: c.name,
          document: c.document || null,
          trade_name: c.trade_name || null,
          phone: c.phone || null,
          whatsapp: c.whatsapp || null,
          email: c.email || null,
          street: c.street || c.address_street || null,
          number: c.number || c.address_number || null,
          neighborhood: c.neighborhood || c.address_neighborhood || null,
          city: c.city || c.address_city || null,
          state: c.state || c.address_state || null,
          notes: c.notes || null,
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
        }));
        await client.from('customers').upsert(mappedCustomers);
      }

      // 4. Products
      if (this.products.length > 0) {
        const mappedProducts = this.products.map((p: any) => ({
          id: p.id,
          tenant_id: p.tenant_id || 'tenant-default',
          name: p.name,
          description: p.description || null,
          price: Number(p.price) || 0,
          category: p.category || null,
          stock_quantity: Number(p.stock_quantity) || 0,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
        }));
        await client.from('products').upsert(mappedProducts);
      }

      // 5. Charges
      if (this.charges.length > 0) {
        const fallbackCustomerId = this.customers[0]?.id || 'cust-default';
        const mappedCharges = this.charges.map((c: any) => ({
          id: c.id,
          tenant_id: c.tenant_id || 'tenant-default',
          customer_id: c.customer_id || fallbackCustomerId,
          amount: Number(c.amount) || 0,
          due_date: c.due_date || new Date().toISOString(),
          status: c.status || 'pending',
          description: c.description || null,
          payment_method: c.payment_method || 'pix',
          paid_at: c.paid_at || null,
          pix_copy_paste: c.pix_copy_paste || null,
          pix_qr_code: c.pix_qr_code || null,
          loan_id: c.loan_id || (c.type && c.type !== 'sale' ? `__type:${c.type}` : null),
          installment_number: c.installment_number || null,
          total_installments: c.total_installments || null,
          interest_amount: Number(c.interest_amount) || 0,
          fine_amount: Number(c.fine_amount) || 0,
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
        }));
        await client.from('charges').upsert(mappedCharges);
      }

      // 6. IPTV Subscribers
      if (this.iptvSubscribers.length > 0) {
        const mappedIptvSubs = this.iptvSubscribers.map((s: any) => ({
          id: s.id,
          tenant_id: s.tenant_id || 'tenant-default',
          name: s.customer_name || s.name || 'Assinante',
          whatsapp: s.whatsapp || null,
          email: s.email || null,
          server_name: s.server_name || null,
          username: s.username_or_mac || s.username || s.external_link || null,
          password: s.password || null,
          mac_address: s.mac_address || null,
          device_type: s.device_type || null,
          app_name: s.app_name || null,
          plan_name: s.plan_name || null,
          plan_price: Number(s.price || s.plan_price || 30.0),
          screens_count: Number(s.screens || s.screens_count || 1),
          expires_at: s.expiration_date || s.expires_at || new Date().toISOString(),
          status: s.status || 'active',
          notes: s.external_link
            ? s.notes
              ? `${s.notes} [Link: ${s.external_link}]`
              : `[Link: ${s.external_link}]`
            : s.notes || null,
          created_at: s.created_at || new Date().toISOString(),
          updated_at: s.updated_at || new Date().toISOString(),
        }));
        await client.from('iptv_subscribers').upsert(mappedIptvSubs);
      }

      // 7. IPTV Plans
      if (this.iptvPlans.length > 0) {
        const mappedIptvPlans = this.iptvPlans.map((p: any) => ({
          id: p.id,
          tenant_id: p.tenant_id || 'tenant-default',
          name: p.name,
          price: Number(p.price) || 0,
          screens: Number(p.screens) || 1,
          duration_days: Number(p.duration_days) || 30,
          description: p.description || null,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
        }));
        await client.from('iptv_plans').upsert(mappedIptvPlans);
      }

      // 8. IPTV Apps
      if (this.iptvApps.length > 0) {
        const mappedIptvApps = this.iptvApps.map((a: any) => ({
          id: a.id,
          tenant_id: a.tenant_id || 'tenant-default',
          name: a.name,
          platform: a.platform || null,
          download_url: a.download_url || null,
          activation_instructions: a.activation_instructions || a.activation_type || null,
          created_at: a.created_at || new Date().toISOString(),
          updated_at: a.updated_at || new Date().toISOString(),
        }));
        await client.from('iptv_apps').upsert(mappedIptvApps);
      }

      // 9. Subscription Customers
      if (this.subscriptionCustomers.length > 0) {
        const mappedSubCusts = this.subscriptionCustomers.map((c: any) => {
          let extra: Record<string, any> = {};
          if (c.notes && typeof c.notes === 'string' && c.notes.trim().startsWith('{')) {
            try { extra = JSON.parse(c.notes.trim()); } catch {}
          }
          if (c.plan_id !== undefined) extra.plan_id = c.plan_id;
          if (c.plan_name !== undefined) extra.plan_name = c.plan_name;
          if (c.price !== undefined) extra.price = Number(c.price);
          if (c.billing_cycle !== undefined) extra.billing_cycle = c.billing_cycle;
          if (c.start_date !== undefined) extra.start_date = c.start_date;
          if (c.next_due_date !== undefined) extra.next_due_date = c.next_due_date;
          if (c.status !== undefined) extra.status = c.status;
          if (c.document !== undefined) extra.document = c.document;

          const notesPayload = Object.keys(extra).length > 0 ? JSON.stringify(extra) : (c.notes || null);

          return {
            id: c.id,
            tenant_id: c.tenant_id || 'tenant-default',
            name: c.customer_name || c.name || 'Assinante',
            whatsapp: c.whatsapp || null,
            email: c.email || null,
            notes: notesPayload,
            created_at: c.created_at || new Date().toISOString(),
            updated_at: c.updated_at || new Date().toISOString(),
          };
        });
        await client.from('subscription_customers').upsert(mappedSubCusts);
      }

      // 10. Subscription Plans
      if (this.subscriptionPlans.length > 0) {
        const mappedSubPlans = this.subscriptionPlans.map((p: any) => ({
          id: p.id,
          tenant_id: p.tenant_id || 'tenant-default',
          service_name: p.service_name || p.name || 'Serviço',
          plan_title: p.plan_title || p.title || p.name || 'Plano',
          monthly_price: Number(p.monthly_price || p.price || 0),
          duration_days: Number(p.duration_days) || 30,
          screens: Number(p.screens) || 1,
          description: p.description || null,
          color: p.color || null,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
        }));
        await client.from('subscription_plans').upsert(mappedSubPlans);
      }

      // 11. Subscription Sales
      if (this.subscriptionSales.length > 0) {
        const mappedSubSales = this.subscriptionSales.map((s: any) => ({
          id: s.id,
          tenant_id: s.tenant_id || 'tenant-default',
          customer_id: s.customer_id,
          plan_id: s.plan_id,
          start_date: s.start_date || new Date().toISOString(),
          due_date: s.due_date || new Date().toISOString(),
          amount: Number(s.amount) || 0,
          status: s.status || 'active',
          account_email: s.account_email || null,
          account_password: s.account_password || null,
          pin_code: s.pin_code || s.pin || null,
          profile_name: s.profile_name || null,
          notes: s.notes || null,
          created_at: s.created_at || new Date().toISOString(),
          updated_at: s.updated_at || new Date().toISOString(),
        }));
        await client.from('subscription_sales').upsert(mappedSubSales);
      }

      // 12. Loans
      if (this.loans.length > 0) {
        try {
          const mappedLoans = this.loans.map((l) => ({
            id: l.id,
            tenant_id: l.tenantId,
            customer_name: l.customerName,
            customer_phone: l.customerPhone || null,
            description: l.description || null,
            principal_amount: l.principalAmount,
            due_date: l.dueDate,
            is_recurring_or_installment: Boolean(l.isRecurringOrInstallment),
            billing_type: l.billingType || 'single',
            installments_count: l.installmentsCount || 1,
            frequency: l.frequency || 'monthly',
            payment_method: l.paymentMethod || 'pix',
            instructions: l.instructions || null,
            status: l.status || 'active',
            total_to_receive: l.totalToReceive || l.principalAmount,
            installments: l.installments || [],
            created_at: l.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          await client.from('loans').upsert(mappedLoans);
        } catch (loanErr) {
          console.warn('[Supabase Sync loans warn]', loanErr);
        }
      }

      // 13. System Settings (Planos & Senhas de Usuários)
      await client.from('system_settings').upsert([
        {
          key: 'global_plan_prices',
          value: this.globalPlanPrices,
          updated_at: new Date().toISOString(),
        },
        {
          key: 'user_passwords',
          value: this.userPasswords,
          updated_at: new Date().toISOString(),
        },
      ]);

      return {
        success: true,
        message: 'Todos os cadastros e dados foram sincronizados com sucesso no Supabase PostgreSQL!',
        counts: {
          tenants: this.tenants.length,
          profiles: this.profiles.length,
          customers: this.customers.length,
          products: this.products.length,
          charges: this.charges.length,
          iptvSubscribers: this.iptvSubscribers.length,
          subscriptionCustomers: this.subscriptionCustomers.length,
          subscriptionSales: this.subscriptionSales.length,
          loans: this.loans.length,
        },
      };
    } catch (err: any) {
      console.error('[Supabase Sync Error]', err);
      return { success: false, message: `Erro ao sincronizar com Supabase: ${err?.message}`, error: err?.message };
    }
  }

  public async loadFromSupabase(): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const [
        tenantsRes,
        profilesRes,
        custRes,
        prodRes,
        chargesRes,
        iptvSubsRes,
        iptvPlansRes,
        iptvAppsRes,
        subCustRes,
        subPlansRes,
        subSalesRes,
        settingsRes,
      ] = await Promise.all([
        client.from('tenants').select('*'),
        client.from('profiles').select('*'),
        client.from('customers').select('*'),
        client.from('products').select('*'),
        client.from('charges').select('*'),
        client.from('iptv_subscribers').select('*'),
        client.from('iptv_plans').select('*'),
        client.from('iptv_apps').select('*'),
        client.from('subscription_customers').select('*'),
        client.from('subscription_plans').select('*'),
        client.from('subscription_sales').select('*'),
        client.from('system_settings').select('*').eq('key', 'global_plan_prices').single(),
      ]);

      if (tenantsRes.data && tenantsRes.data.length > 0) {
        for (const t of tenantsRes.data) {
          const idx = this.tenants.findIndex(
            (existing) => existing.id === t.id || (t.email && existing.email?.toLowerCase() === t.email.toLowerCase())
          );
          if (idx >= 0) {
            this.tenants[idx] = { ...this.tenants[idx], ...t, whatsapp: t.phone || this.tenants[idx].whatsapp };
          } else {
            this.tenants.push({ ...t, whatsapp: t.phone } as Tenant);
          }
        }
      }

      if (profilesRes.data && profilesRes.data.length > 0) {
        for (const p of profilesRes.data) {
          const cleanEmail = p.email?.toLowerCase();
          if (!cleanEmail) continue;
          const idx = this.profiles.findIndex((existing) => existing.id === p.id || existing.email.toLowerCase() === cleanEmail);
          if (idx >= 0) {
            this.profiles[idx] = { ...this.profiles[idx], ...p };
          } else {
            this.profiles.push(p as Profile);
          }

          // Garante que todo profile tenha um tenant correspondente na memória
          let tenant = this.tenants.find((t) => t.email?.toLowerCase() === cleanEmail);
          if (!tenant) {
            const isMaster = cleanEmail === 'betaof10@hotmail.com';
            const now = new Date();
            tenant = {
              id: `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: p.full_name || `Empresa de ${cleanEmail.split('@')[0]}`,
              trade_name: p.full_name || `Empresa de ${cleanEmail.split('@')[0]}`,
              email: cleanEmail,
              subscription_status: isMaster ? 'lifetime' : 'trial',
              trial_started_at: now.toISOString(),
              trial_ends_at: isMaster ? '2099-12-31T23:59:59.000Z' : new Date(now.getTime() + 2 * 86400000).toISOString(),
              subscription_expires_at: isMaster ? '2099-12-31T23:59:59.000Z' : new Date(now.getTime() + 2 * 86400000).toISOString(),
              created_at: p.created_at || now.toISOString(),
              updated_at: p.updated_at || now.toISOString(),
            };
            this.tenants.push(tenant);
          }
        }
      }

      if (custRes.data && custRes.data.length > 0) {
        this.customers = custRes.data.map((c: any) => ({
          ...c,
          address_street: c.street || c.address_street || '',
          address_number: c.number || c.address_number || '',
          address_neighborhood: c.neighborhood || c.address_neighborhood || '',
          address_city: c.city || c.address_city || '',
          address_state: c.state || c.address_state || '',
        }));
      }

      if (prodRes.data && prodRes.data.length > 0) this.products = prodRes.data as Product[];
      if (chargesRes.data && chargesRes.data.length > 0) {
        this.charges = chargesRes.data.map((c: any) => ({
          ...c,
          type: c.type || (c.loan_id?.startsWith('__type:') ? c.loan_id.replace('__type:', '') : (c.loan_id ? 'loan' : 'sale')),
        }));
      }

      if (iptvSubsRes.data && iptvSubsRes.data.length > 0) {
        this.iptvSubscribers = iptvSubsRes.data.map((s: any) => {
          let external_link = s.external_link || '';
          let notes = s.notes || '';
          if (!external_link && notes && notes.includes('[Link: ')) {
            const match = notes.match(/\[Link:\s*([^\]]+)\]/);
            if (match && match[1]) external_link = match[1].trim();
          } else if (!external_link && (s.username?.startsWith('http://') || s.username?.startsWith('https://'))) {
            external_link = s.username;
          }
          return {
            ...s,
            customer_name: s.name || s.customer_name || 'Assinante',
            username_or_mac: s.username || s.username_or_mac || s.mac_address || '',
            price: Number(s.plan_price || s.price || 30.0),
            screens: Number(s.screens_count || s.screens || 1),
            expiration_date: s.expires_at ? s.expires_at.slice(0, 10) : (s.expiration_date || new Date().toISOString().slice(0, 10)),
            external_link,
            notes,
          };
        });
      }

      if (iptvPlansRes.data && iptvPlansRes.data.length > 0) this.iptvPlans = iptvPlansRes.data as IPTVPlan[];
      if (iptvAppsRes.data && iptvAppsRes.data.length > 0) this.iptvApps = iptvAppsRes.data as IPTVApp[];
      if (subCustRes.data && subCustRes.data.length > 0) {
        this.subscriptionCustomers = subCustRes.data.map((row: any) => {
          let extra: any = {};
          if (row.notes && typeof row.notes === 'string' && row.notes.trim().startsWith('{')) {
            try { extra = JSON.parse(row.notes.trim()); } catch {}
          }
          return {
            id: row.id,
            tenant_id: row.tenant_id,
            name: row.name,
            customer_name: row.name || (row as any).customer_name || 'Assinante',
            whatsapp: row.whatsapp || '',
            email: row.email || undefined,
            document: row.document || extra.document || undefined,
            plan_id: row.plan_id || extra.plan_id || undefined,
            plan_name: extra.plan_name || '',
            price: extra.price !== undefined ? Number(extra.price) : 0,
            billing_cycle: extra.billing_cycle || 'monthly',
            start_date: extra.start_date || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
            next_due_date: extra.next_due_date || new Date().toISOString().split('T')[0],
            status: extra.status || 'active',
            notes: row.notes || undefined,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString(),
          } as SubscriptionCustomer;
        });
      }

      if (subPlansRes.data && subPlansRes.data.length > 0) {
        this.subscriptionPlans = subPlansRes.data.map((p: any) => ({
          ...p,
          name: p.service_name || p.name || 'Serviço',
          title: p.plan_title || p.title || p.name || 'Plano',
          price: Number(p.monthly_price || p.price || 0),
          billing_cycle: 'monthly',
        }));
      }

      if (subSalesRes.data && subSalesRes.data.length > 0) this.subscriptionSales = subSalesRes.data as SubscriptionSale[];

      if (settingsRes.data && settingsRes.data.value) {
        this.globalPlanPrices = { ...DEFAULT_PLAN_PRICES, ...settingsRes.data.value };
      }

      // Carrega senhas de usuários sincronizadas do Supabase
      try {
        const { data: passData } = await client.from('system_settings').select('*').eq('key', 'user_passwords').maybeSingle();
        if (passData && passData.value && typeof passData.value === 'object') {
          this.userPasswords = { ...this.userPasswords, ...passData.value };
        }
      } catch {}

      // Carrega e restaura token do Mercado Pago salvo no Supabase
      try {
        const { data: mpData } = await client.from('system_settings').select('*').eq('key', 'mercadopago_config').maybeSingle();
        if (mpData && mpData.value && mpData.value.access_token) {
          this.mercadoPagoToken = String(mpData.value.access_token).trim();
          process.env.MERCADO_PAGO_ACCESS_TOKEN = this.mercadoPagoToken;
          console.log('[Store] ✅ Token do Mercado Pago restaurado com sucesso do Supabase PostgreSQL!');
        }
      } catch (mpErr: any) {
        console.warn('[Store] Aviso ao carregar mercadopago_config do Supabase:', mpErr?.message);
      }

      // Carrega e restaura link da lojinha salvo no Supabase
      try {
        const { data: extData } = await client.from('system_settings').select('*').eq('key', 'external_link_config').maybeSingle();
        if (extData && extData.value && typeof extData.value === 'object') {
          this.externalLinkConfig = { ...this.externalLinkConfig, ...extData.value };
        }
      } catch {}

      // Carrega e restaura WhatsApp de suporte salvo no Supabase
      try {
        const { data: supData } = await client.from('system_settings').select('*').eq('key', 'support_whatsapp_config').maybeSingle();
        if (supData && supData.value && typeof supData.value === 'object') {
          this.supportWhatsAppConfig = { ...this.supportWhatsAppConfig, ...supData.value };
        }
      } catch {}

      // Carrega e restaura configurações de automação do WhatsApp salvas no Supabase
      try {
        const { data: waData } = await client.from('system_settings').select('*').eq('key', 'whatsapp_configs').maybeSingle();
        if (waData && waData.value && typeof waData.value === 'object') {
          this.whatsappConfigs = { ...this.whatsappConfigs, ...waData.value };
        }
      } catch (waErr: any) {
        console.warn('[Store] Aviso ao carregar whatsapp_configs do Supabase:', waErr?.message);
      }

      // Carrega e restaura histórico de logs do WhatsApp salvos no Supabase
      try {
        const { data: logData } = await client.from('system_settings').select('*').eq('key', 'whatsapp_dispatch_logs').maybeSingle();
        if (logData && logData.value && Array.isArray(logData.value)) {
          this.whatsappDispatchLogs = logData.value;
        }
      } catch {}

      // Tenta carregar os empréstimos do Supabase se a tabela existir
      try {
        const { data: dbLoans } = await client.from('loans').select('*');
        if (dbLoans && dbLoans.length > 0) {
          this.loans = dbLoans.map((l: any) => ({
            id: l.id,
            tenantId: l.tenant_id,
            customerName: l.customer_name,
            customerPhone: l.customer_phone || '',
            description: l.description || '',
            principalAmount: Number(l.principal_amount),
            dueDate: l.due_date,
            isRecurringOrInstallment: Boolean(l.is_recurring_or_installment),
            billingType: l.billing_type || 'single',
            installmentsCount: Number(l.installments_count || 1),
            frequency: l.frequency || 'monthly',
            paymentMethod: l.payment_method || 'pix',
            instructions: l.instructions || '',
            status: l.status || 'active',
            totalToReceive: Number(l.total_to_receive || l.principal_amount),
            installments: Array.isArray(l.installments) ? l.installments : [],
            createdAt: l.created_at,
          }));
        }
      } catch (err) {
        // Tabela loans ainda não criada no Supabase
      }

      this.persist();
      console.log(`[Supabase Store] Hidratado com sucesso do Supabase PostgreSQL (${this.tenants.length} tenants, ${this.customers.length} clientes, ${this.loans.length} empréstimos)!`);
      return true;
    } catch (err) {
      console.warn('[Supabase Store] Não foi possível carregar do Supabase:', err);
      return false;
    }
  }

  // ----------------------------------------------------
  // MÓDULO EMPRÉSTIMOS & COBRANÇAS PARCELADAS (ESPAÇO DEDICADO)
  // ----------------------------------------------------
  public getLoans(tenantId?: string): Loan[] {
    const diskLoans = this.loadFile<Loan>(FILE_LOANS);
    if (diskLoans && Array.isArray(diskLoans)) {
      this.loans = diskLoans;
    }
    if (!tenantId) return this.loans;
    return this.loans.filter((l) => l.tenantId === tenantId);
  }

  public saveLoan(loan: Loan): Loan {
    const existingIndex = this.loans.findIndex((l) => l.id === loan.id);
    if (existingIndex >= 0) {
      this.loans[existingIndex] = loan;
    } else {
      this.loans.unshift(loan);
    }
    this.persist();
    return loan;
  }

  public updateLoan(id: string, updates: Partial<Loan>): Loan | undefined {
    const index = this.loans.findIndex((l) => l.id === id);
    if (index === -1) return undefined;
    this.loans[index] = {
      ...this.loans[index],
      ...updates,
    };
    this.persist();
    return this.loans[index];
  }

  public deleteLoan(id: string): boolean {
    const initialLen = this.loans.length;
    this.loans = this.loans.filter((l) => l.id !== id);
    const deleted = this.loans.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  public syncLoans(tenantId: string, loans: Loan[]): Loan[] {
    const existingServerLoans = this.loans.filter((l) => l.tenantId === tenantId);

    // Proteção: Se o cliente enviou vazio mas o servidor já tem dados, preserva os dados do servidor!
    if ((!loans || loans.length === 0) && existingServerLoans.length > 0) {
      return existingServerLoans;
    }

    // Faz o merge inteligente por ID
    const map = new Map<string, Loan>();
    for (const l of existingServerLoans) {
      map.set(l.id, l);
    }
    for (const l of loans || []) {
      map.set(l.id, l);
    }
    const merged = Array.from(map.values());

    const otherTenantsLoans = this.loans.filter((l) => l.tenantId !== tenantId);
    this.loans = [...merged, ...otherTenantsLoans];
    this.persist();
    return this.getLoans(tenantId);
  }

  // Monthly Report Generator
  public getMonthlyReport(tenantId: string, yearMonth?: string): MonthlyReportData {
    const targetMonth = yearMonth || new Date().toISOString().slice(0, 7);
    const tenantCharges = this.charges.filter((c) => c.tenant_id === tenantId);

    const monthCharges = tenantCharges.filter(
      (c) => c.due_date.startsWith(targetMonth) || (c.paid_at && c.paid_at.startsWith(targetMonth))
    );

    let totalBilled = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    let paidCount = 0;
    let overdueCount = 0;

    // Daily breakdown dictionary
    const daysInMonth = new Date(
      parseInt(targetMonth.split('-')[0]),
      parseInt(targetMonth.split('-')[1]),
      0
    ).getDate();

    const dailyMap: Record<string, { billed: number; received: number }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${targetMonth}-${String(d).padStart(2, '0')}`;
      dailyMap[dayStr] = { billed: 0, received: 0 };
    }

    monthCharges.forEach((c) => {
      const amt = Number(c.amount) || 0;
      totalBilled += amt;

      if (dailyMap[c.due_date]) {
        dailyMap[c.due_date].billed += amt;
      }

      if (c.status === 'paid') {
        totalReceived += amt;
        paidCount++;
        const paidDay = c.paid_at?.slice(0, 10);
        if (paidDay && dailyMap[paidDay]) {
          dailyMap[paidDay].received += amt;
        }
      } else if (c.status === 'overdue') {
        totalOverdue += amt;
        overdueCount++;
      } else {
        totalPending += amt;
      }
    });

    const recoveryRate = totalBilled > 0 ? (totalReceived / totalBilled) * 100 : 0;
    const averageTicket = monthCharges.length > 0 ? totalBilled / monthCharges.length : 0;

    // Top Debtors
    const debtorMap: Record<string, { name: string; amount: number; whatsapp?: string }> = {};
    tenantCharges
      .filter((c) => c.status === 'overdue' || c.status === 'pending')
      .forEach((c) => {
        const cust = this.customers.find((cu) => cu.id === c.customer_id);
        const name = cust?.name || 'Cliente';
        if (!debtorMap[c.customer_id]) {
          debtorMap[c.customer_id] = {
            name,
            amount: 0,
            whatsapp: cust?.whatsapp,
          };
        }
        debtorMap[c.customer_id].amount += Number(c.amount) || 0;
      });

    const topDebtors = Object.entries(debtorMap)
      .map(([customerId, data]) => ({
        customerId,
        customerName: data.name,
        amount: data.amount,
        whatsapp: data.whatsapp,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const [year, month] = targetMonth.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // AI Financial Executive Summary
    const aiAnalysis = `No mês de ${monthName}, o faturamento total acumulado foi de ${totalBilled.toLocaleString(
      'pt-BR',
      { style: 'currency', currency: 'BRL' }
    )}, com taxa de liquidação de ${recoveryRate.toFixed(1)}%. Atualmente há ${totalOverdue.toLocaleString(
      'pt-BR',
      { style: 'currency', currency: 'BRL' }
    )} em cobranças em atraso necessitando de ação de cobrança via WhatsApp. Recomenda-se acionar os devedores prioritários com lembrete cordial antes do fechamento do ciclo.`;

    return {
      month: targetMonth,
      monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      totalBilled,
      totalReceived,
      totalPending,
      totalOverdue,
      recoveryRate,
      averageTicket,
      chargesCount: monthCharges.length,
      paidChargesCount: paidCount,
      overdueChargesCount: overdueCount,
      topDebtors,
      dailyFlow: Object.entries(dailyMap).map(([day, val]) => ({
        day: day.slice(8), // day number
        billed: val.billed,
        received: val.received,
      })),
      aiAnalysis,
    };
  }

  // Automation: Verify and notify charges due tomorrow via WhatsApp
  public getChargesDueTomorrow(tenantId?: string): Charge[] {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    return this.charges
      .filter((c) => {
        const matchesTenant = tenantId ? c.tenant_id === tenantId : true;
        return matchesTenant && c.status === 'pending' && c.due_date === tomorrowStr;
      })
      .map((chg) => ({
        ...chg,
        customer: this.customers.find((c) => c.id === chg.customer_id),
      }));
  }

  public async notifyChargesDueTomorrow(tenantId?: string) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const pendingCharges = this.getChargesDueTomorrow(tenantId);
    const results = [];

    for (const charge of pendingCharges) {
      const customer = charge.customer || this.getCustomerById(charge.customer_id);
      const tenant = this.getTenant(charge.tenant_id) || this.tenants[0];

      if (customer && customer.whatsapp) {
        console.log(`[Auto WhatsApp] Sending tomorrow-due notice to ${customer.name} (${customer.whatsapp}) for charge "${charge.description}"`);
        const sendResult = await sendWhatsAppMessage({
          charge,
          customer,
          tenant,
          templateType: 'due_tomorrow',
        });
        results.push({
          chargeId: charge.id,
          description: charge.description,
          customerName: customer.name,
          whatsapp: customer.whatsapp,
          amount: charge.amount,
          result: sendResult,
        });
      }
    }

    return {
      success: true,
      targetDate: tomorrowStr,
      totalPendingTomorrow: pendingCharges.length,
      notifiedCount: results.length,
      dispatches: results,
    };
  }

  // --- Automação WhatsApp & Notificações Automáticas ---
  public getWhatsAppConfig(tenantId: string): WhatsAppAutomationConfig {
    const tenant = this.getTenant(tenantId);
    const diskConfigs = this.loadObjectFile<Record<string, WhatsAppAutomationConfig>>(FILE_WHATSAPP_CONFIGS);
    if (diskConfigs && typeof diskConfigs === 'object') {
      this.whatsappConfigs = diskConfigs;
    }

    const properInstanceName = generateTenantInstanceName(tenantId, tenant?.name);

    const defaultConf: WhatsAppAutomationConfig = {
      instance_name: properInstanceName,
      server_url: '',
      api_key: '',
      status: 'disconnected',
      connected_phone: '',
      auto_send_enabled: true,
      scheduled_time: '09:00',
      send_on_weekends: true,
      delay_seconds: 25,
      template_tomorrow_enabled: true,
      template_tomorrow_message: `Olá, {primeiro_nome}! Tudo bem? Esperamos que sim! 😊\n\nPassando para te avisar com antecedência que a sua fatura referente ao serviço *{produto}* vence *amanhã*, dia *{data_vencimento}*.\n\n💰 *Valor:* R$ {valor}\n🔑 *Chave PIX:* {chave_pix}\n🏢 *Favorecido:* {empresa}\n\nCaso já tenha efetuado o pagamento, desconsidere este aviso. Muito obrigado pela parceria! 🤝`,
      template_today_enabled: true,
      template_today_message: `⏰ *Aviso de Vencimento Hoje!*\n\nOlá, {cliente}! Bom dia! ☀️\n\nLembramos que a sua fatura referente a *{produto}* vence *hoje*, dia *{data_vencimento}*.\n\n💰 *Valor a pagar:* R$ {valor}\n🔑 *Chave PIX:* {chave_pix}\n🏢 *Favorecido:* {empresa}\n\nApós realizar o pagamento via PIX, por favor nos envie o comprovante por aqui para confirmação imediata. Qualquer dúvida estamos à disposição! 🚀`,
      template_overdue_enabled: true,
      template_overdue_message: `⚠️ *Aviso de Fatura em Atraso*\n\nOlá, {primeiro_nome}! Como vai?\n\nPassando para informar que identificamos a sua fatura referente a *{produto}* no valor de *R$ {valor}* que estava com vencimento em *{data_vencimento}* ainda em aberto.\n\nSabemos que imprevistos acontecem! Para regularizar sua situação de forma simples e rápida, você pode nos pagar via PIX:\n\n🔑 *Chave PIX:* {chave_pix}\n🏢 *Favorecido:* {empresa}\n\nSe já realizou o pagamento, por gentileza nos encaminhe o comprovante por aqui. Qualquer dúvida estamos à disposição! 🙏`,
      overdue_days_limit: 30,
      second_scheduled_time_enabled: false,
      second_scheduled_time: '15:00',
      charge_business_enabled: true,
      charge_iptv_enabled: true,
      charge_loans_enabled: true,
      charge_subscriptions_enabled: true,
    };

    if (tenantId === 'tenant-default') {
      defaultConf.auto_send_enabled = false;
    }

    if (this.whatsappConfigs[tenantId]) {
      const existing = { ...this.whatsappConfigs[tenantId] };

      // PROTEÇÃO CRÍTICA DE ISOLAMENTO:
      // Se um tenant que não é o Betão tiver a instância do administrador ou master_corporation vinculada,
      // corrige imediatamente para sua instância isolada única e reseta o status para 'disconnected'.
      const isMasterAdminTenant =
        tenantId === '2caa686e-9c14-439b-8e9d-9b25cfbac345' ||
        tenant?.email?.toLowerCase().trim() === 'betaof10@hotmail.com';

      if (
        !isMasterAdminTenant &&
        (!existing.instance_name ||
          existing.instance_name === 'instancia_ativacoes_e_vendas' ||
          existing.instance_name === 'instancia_cobrefacil_master_corporation' ||
          existing.instance_name.includes('ativa') ||
          existing.instance_name.startsWith('instancia_') ||
          existing.connected_phone?.includes('219899850026') ||
          existing.connected_phone?.includes('21989850026'))
      ) {
        existing.instance_name = properInstanceName;
        existing.status = 'disconnected';
        existing.connected_phone = '';
        delete existing.connected_at;
        this.saveWhatsAppConfig(tenantId, existing);
      }

      return {
        ...defaultConf,
        ...existing,
        template_tomorrow_message: existing.template_tomorrow_message || defaultConf.template_tomorrow_message,
        template_today_message: existing.template_today_message || defaultConf.template_today_message,
        template_overdue_message: existing.template_overdue_message || defaultConf.template_overdue_message,
        template_tomorrow_enabled: existing.template_tomorrow_enabled ?? defaultConf.template_tomorrow_enabled,
        template_today_enabled: existing.template_today_enabled ?? defaultConf.template_today_enabled,
        template_overdue_enabled: existing.template_overdue_enabled ?? defaultConf.template_overdue_enabled,
        overdue_days_limit: existing.overdue_days_limit ?? defaultConf.overdue_days_limit,
        second_scheduled_time_enabled: existing.second_scheduled_time_enabled ?? defaultConf.second_scheduled_time_enabled,
        second_scheduled_time: existing.second_scheduled_time || defaultConf.second_scheduled_time,
        charge_business_enabled: existing.charge_business_enabled !== false,
        charge_iptv_enabled: existing.charge_iptv_enabled !== false,
        charge_loans_enabled: existing.charge_loans_enabled !== false,
        charge_subscriptions_enabled: existing.charge_subscriptions_enabled !== false,
      };
    }

    return defaultConf;
  }

  public saveWhatsAppConfig(tenantId: string, config: WhatsAppAutomationConfig): WhatsAppAutomationConfig {
    const diskConfigs = this.loadObjectFile<Record<string, WhatsAppAutomationConfig>>(FILE_WHATSAPP_CONFIGS) || {};
    const oldConfig = diskConfigs[tenantId];
    if (oldConfig && (oldConfig.scheduled_time !== config.scheduled_time || oldConfig.second_scheduled_time !== config.second_scheduled_time)) {
      delete (config as any).last_run_schedule;
      delete (config as any).last_run_schedule_second;
      // Ao alterar o horário programado (ex: em teste ou reagendamento), remove os registros de envio automático de hoje para permitir que o novo horário realize o disparo
      const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
      this.whatsappDispatchLogs = (this.whatsappDispatchLogs || []).filter((l) => {
        if (l.tenant_id !== tenantId) return true;
        const logDate = (l.timestamp || '').slice(0, 10);
        return logDate !== todayStr || l.type === 'manual_test';
      });
      this.saveFile(FILE_WHATSAPP_LOGS, this.whatsappDispatchLogs);
    }

    // Garante nome da instância se não fornecido
    if (!config.instance_name) {
      config.instance_name = generateTenantInstanceName(tenantId, this.getTenant(tenantId)?.name);
    }

    diskConfigs[tenantId] = { ...config };
    this.whatsappConfigs = diskConfigs;
    this.saveFile(FILE_WHATSAPP_CONFIGS, diskConfigs);

    // Sincroniza imediatamente com a tabela system_settings do Supabase
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        (client.from('system_settings').upsert({
          key: 'whatsapp_configs',
          value: this.whatsappConfigs,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' }) as any).then(({ error }: any) => {
          if (error) console.error('[Supabase] Erro ao sincronizar whatsapp_configs:', error.message);
        }).catch((err: any) => {
          console.error('[Supabase] Exceção ao atualizar whatsapp_configs:', err);
        });
      }
    }

    return diskConfigs[tenantId];
  }

  public getWhatsAppDispatchLogs(tenantId?: string, limit = 50): WhatsAppDispatchLog[] {
    const diskLogs = this.loadFile<WhatsAppDispatchLog>(FILE_WHATSAPP_LOGS);
    if (diskLogs && Array.isArray(diskLogs)) {
      this.whatsappDispatchLogs = diskLogs;
    }
    return this.whatsappDispatchLogs
      .filter((l) => (tenantId ? l.tenant_id === tenantId : true))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  public clearWhatsAppDispatchLogs(tenantId?: string) {
    if (tenantId) {
      this.whatsappDispatchLogs = (this.whatsappDispatchLogs || []).filter((l) => l.tenant_id !== tenantId);
    } else {
      this.whatsappDispatchLogs = [];
    }
    this.saveFile(FILE_WHATSAPP_LOGS, this.whatsappDispatchLogs);
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        (client.from('system_settings').upsert({
          key: 'whatsapp_dispatch_logs',
          value: this.whatsappDispatchLogs.slice(0, 500),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' }) as any).then(() => {}).catch(() => {});
      }
    }
    return true;
  }

  public addWhatsAppDispatchLog(log: WhatsAppDispatchLog) {
    const diskLogs = this.loadFile<WhatsAppDispatchLog>(FILE_WHATSAPP_LOGS) || [];
    const updated = [log, ...diskLogs].slice(0, 500);
    this.whatsappDispatchLogs = updated;
    this.saveFile(FILE_WHATSAPP_LOGS, updated);

    // Sincroniza histórico de disparos no Supabase
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        (client.from('system_settings').upsert({
          key: 'whatsapp_dispatch_logs',
          value: this.whatsappDispatchLogs.slice(0, 500),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' }) as any).then(() => {}).catch(() => {});
      }
    }
  }

  public getPendingAutomationNotices(tenantId: string, ignoreAlreadySent = false) {
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(now);
    const tomorrowStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(now.getTime() + 86400000));
    const yesterdayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(now.getTime() - 86400000));

    // Carrega logs mais recentes do disco para garantir idempotência e evitar reenvios indevidos
    const diskLogs = this.loadFile<WhatsAppDispatchLog>(FILE_WHATSAPP_LOGS);
    if (diskLogs && Array.isArray(diskLogs)) {
      this.whatsappDispatchLogs = diskLogs;
    }

    const wasNoticeAlreadySent = (
      phone: string,
      noticeType: string,
      dueDate: string,
      prodDesc?: string,
      customerName?: string
    ) => {
      if (ignoreAlreadySent) return false;
      const cleanPhone = phone.replace(/\D/g, '');
      const cleanCust = (customerName || '').trim().toLowerCase();
      const cleanProd = (prodDesc || '').trim().toLowerCase();

      return this.whatsappDispatchLogs.some((l) => {
        if (l.tenant_id !== tenantId) return false;
        if (l.phone?.replace(/\D/g, '') !== cleanPhone) return false;
        if (l.type !== noticeType) return false;
        if (l.status !== 'sent') return false;

        // Se tiver nome do cliente, diferencia cadastros com o mesmo telefone (ex: testes)
        if (cleanCust && l.customer_name) {
          const logCust = l.customer_name.trim().toLowerCase();
          if (logCust !== cleanCust) return false;
        }

        const logDate = (l.timestamp || '').slice(0, 10);
        if (noticeType === 'due_today' && logDate === todayStr) return true;
        if (noticeType === 'due_tomorrow' && logDate === todayStr) return true;
        if (noticeType === 'overdue' && (logDate === todayStr || logDate === yesterdayStr)) return true;
        return false;
      });
    };

    const config = this.getWhatsAppConfig(tenantId);
    const tenant = this.getTenant(tenantId) || this.tenants[0];

    const formatBRLDate = (isoStr: string) => {
      try {
        if (!isoStr || typeof isoStr !== 'string') return '';
        const [y, m, d] = isoStr.split('-');
        return `${d}/${m}/${y}`;
      } catch {
        return String(isoStr || '');
      }
    };

    const pendingToday: Array<{
      id: string;
      source: 'charge' | 'subscription' | 'iptv' | 'loan';
      type: 'due_today';
      customer_name: string;
      phone: string;
      product: string;
      amount: number;
      due_date: string;
      preview_message: string;
    }> = [];

    const pendingTomorrow: Array<{
      id: string;
      source: 'charge' | 'subscription' | 'iptv' | 'loan';
      type: 'due_tomorrow';
      customer_name: string;
      phone: string;
      product: string;
      amount: number;
      due_date: string;
      preview_message: string;
    }> = [];

    const pendingOverdue: Array<{
      id: string;
      source: 'charge' | 'subscription' | 'iptv' | 'loan';
      type: 'overdue';
      customer_name: string;
      phone: string;
      product: string;
      amount: number;
      due_date: string;
      preview_message: string;
    }> = [];

    // 1. Cobranças Normais (Negócios & Empresas)
    if (config.charge_business_enabled !== false) {
      const diskCharges = this.loadFile<Charge>(FILE_BUSINESS_SALES);
      if (diskCharges && Array.isArray(diskCharges)) {
        this.charges = diskCharges;
      }
      const diskCusts = this.loadFile<Customer>(FILE_BUSINESS_CUSTOMERS);
      if (diskCusts && Array.isArray(diskCusts)) {
        this.customers = diskCusts;
      }

      // Fallback para database.json consolidado caso os arquivos individuais estejam vazios
      if ((!this.charges || this.charges.length === 0) && fs.existsSync(DATA_FILE)) {
        try {
          const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
          if (raw.charges && Array.isArray(raw.charges) && raw.charges.length > 0) {
            this.charges = raw.charges;
          }
          if (raw.customers && Array.isArray(raw.customers) && raw.customers.length > 0) {
            this.customers = raw.customers;
          }
        } catch {}
      }

      // Atualiza automaticamente faturas vencidas
      this.charges.forEach((c) => {
        if (c.status === 'pending' && c.due_date && c.due_date < todayStr) {
          c.status = 'overdue';
        }
      });

      const tenantCharges = this.charges.filter(
        (c) => c.tenant_id === tenantId && c.status !== 'paid' && c.status !== 'cancelled'
      );
      for (const c of tenantCharges) {
        const cust = this.customers.find((cust) => cust.id === c.customer_id) || (c as any).customer;
        const rawPhone = cust?.whatsapp || (cust as any)?.phone || (c as any).customer_whatsapp || (c as any).customer_phone || '';
        const phone = rawPhone.replace(/\D/g, '');
        if (!phone) continue;

        const custName = cust?.name || (c as any).customer_name || 'Cliente';
        const prodName = c.description || 'Cobrança';
        const amount = Number(c.amount) || 0;
        const dueDate = (c.due_date || '').slice(0, 10);
        if (!dueDate) continue;

        if (dueDate === todayStr && c.status !== 'overdue') {
          if (!wasNoticeAlreadySent(phone, 'due_today', dueDate, prodName, custName)) {
            pendingToday.push({
              id: c.id,
              source: 'charge',
              type: 'due_today',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_today_message, {
                cliente: custName,
                primeiro_nome: String(custName).split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        } else if (dueDate === tomorrowStr && c.status !== 'overdue') {
          if (!wasNoticeAlreadySent(phone, 'due_tomorrow', dueDate, prodName, custName)) {
            pendingTomorrow.push({
              id: c.id,
              source: 'charge',
              type: 'due_tomorrow',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_tomorrow_message, {
                cliente: custName,
                primeiro_nome: String(custName).split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        } else if (dueDate === yesterdayStr && (c.status === 'overdue' || dueDate < todayStr)) {
          // Dispara cobrança de atraso estritamente no dia seguinte ao vencimento (1 dia após) e apenas se ainda não foi cobrado
          if (!wasNoticeAlreadySent(phone, 'overdue', dueDate, prodName, custName)) {
            pendingOverdue.push({
              id: c.id,
              source: 'charge',
              type: 'overdue',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_overdue_message || '', {
                cliente: custName,
                primeiro_nome: String(custName).split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        }
      }
    }

    // 2. Clientes de Assinaturas (Mensalidades e Vendas)
    if (config.charge_subscriptions_enabled !== false) {
      const diskSubCusts = this.loadFile<SubscriptionCustomer>(FILE_SUBSCRIPTION_CUSTOMERS);
      if (diskSubCusts && Array.isArray(diskSubCusts)) {
        this.subscriptionCustomers = diskSubCusts;
      }
      const tenantSubs = this.subscriptionCustomers.filter(
        (s) => s.tenant_id === tenantId && s.status !== 'cancelled' && (s.whatsapp || (s as any).phone)
      );

      for (const s of tenantSubs) {
        const dueDate = (s.next_due_date || s.start_date || '').slice(0, 10);
        const phone = (s.whatsapp || (s as any).phone || '').replace(/\D/g, '');
        if (!dueDate || !phone) continue;

        const custName = s.customer_name || (s as any).name || 'Cliente';
        const prodName = s.plan_name || 'Assinatura Mensal';
        const amount = Number(s.price) || 0;

        if (dueDate === todayStr && s.status !== 'overdue') {
          if (!wasNoticeAlreadySent(phone, 'due_today', dueDate, prodName, custName)) {
            pendingToday.push({
              id: s.id,
              source: 'subscription',
              type: 'due_today',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_today_message, {
                cliente: custName,
                primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        } else if (dueDate === tomorrowStr && s.status !== 'overdue') {
          if (!wasNoticeAlreadySent(phone, 'due_tomorrow', dueDate, prodName, custName)) {
            pendingTomorrow.push({
              id: s.id,
              source: 'subscription',
              type: 'due_tomorrow',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_tomorrow_message, {
                cliente: custName,
                primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        } else if (dueDate === yesterdayStr && (s.status === 'overdue' || dueDate < todayStr)) {
          if (!wasNoticeAlreadySent(phone, 'overdue', dueDate, prodName, custName)) {
            pendingOverdue.push({
              id: s.id,
              source: 'subscription',
              type: 'overdue',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_overdue_message || '', {
                cliente: custName,
                primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        }
      }

      // Vendas de Assinatura (SubscriptionSale)
      const diskSubSales = this.loadFile<SubscriptionSale>(FILE_SUBSCRIPTION_SALES);
      if (diskSubSales && Array.isArray(diskSubSales)) {
        this.subscriptionSales = diskSubSales;
      }
      const tenantSales = this.subscriptionSales.filter(
        (sale) => sale.tenant_id === tenantId && sale.status !== 'paid' && sale.status !== 'cancelled'
      );
      for (const sale of tenantSales) {
        const dueDate = (sale.due_date || '').slice(0, 10);
        const phone = (sale.whatsapp || '').replace(/\D/g, '');
        if (!dueDate || !phone) continue;

        const custName = sale.customer_name || 'Cliente';
        const prodName = sale.plan_name || 'Venda de Assinatura';
        const amount = Number(sale.amount) || 0;

        if (dueDate === todayStr && sale.status !== 'overdue') {
          if (!wasNoticeAlreadySent(phone, 'due_today', dueDate, prodName, custName)) {
            pendingToday.push({
              id: sale.id,
              source: 'subscription',
              type: 'due_today',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_today_message, {
                cliente: custName,
                primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        } else if (dueDate === tomorrowStr && sale.status !== 'overdue') {
          if (!wasNoticeAlreadySent(phone, 'due_tomorrow', dueDate, prodName, custName)) {
            pendingTomorrow.push({
              id: sale.id,
              source: 'subscription',
              type: 'due_tomorrow',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_tomorrow_message, {
                cliente: custName,
                primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        } else if (dueDate === yesterdayStr && (sale.status === 'overdue' || dueDate < todayStr)) {
          if (!wasNoticeAlreadySent(phone, 'overdue', dueDate, prodName, custName)) {
            pendingOverdue.push({
              id: sale.id,
              source: 'subscription',
              type: 'overdue',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_overdue_message || '', {
                cliente: custName,
                primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        }
      }
    }

    // 3. Clientes IPTV
    if (config.charge_iptv_enabled !== false) {
      const diskIptv = this.loadFile<IPTVSubscriber>(FILE_IPTV_SUBSCRIBERS);
      if (diskIptv && Array.isArray(diskIptv)) {
        this.iptvSubscribers = diskIptv;
      }
      const tenantIptv = this.iptvSubscribers.filter(
        (sub) => sub.tenant_id === tenantId && (sub.whatsapp || (sub as any).phone)
      );

      for (const sub of tenantIptv) {
        const dueDate = (sub.expiration_date || '').slice(0, 10);
        const phone = (sub.whatsapp || (sub as any).phone || '').replace(/\D/g, '');
        if (!dueDate || !phone) continue;

        const custName = sub.customer_name || (sub as any).client_name || 'Cliente IPTV';
        const prodName = sub.plan_name || 'Plano IPTV';
        const amount = Number(sub.price || (sub as any).value) || 0;

        if (dueDate === todayStr && sub.status !== 'expired') {
          if (!wasNoticeAlreadySent(phone, 'due_today', dueDate, prodName, custName)) {
            pendingToday.push({
              id: sub.id,
              source: 'iptv',
              type: 'due_today',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_today_message, {
                cliente: custName,
                primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        } else if (dueDate === tomorrowStr && sub.status !== 'expired') {
          if (!wasNoticeAlreadySent(phone, 'due_tomorrow', dueDate, prodName, custName)) {
            pendingTomorrow.push({
              id: sub.id,
              source: 'iptv',
              type: 'due_tomorrow',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_tomorrow_message, {
                cliente: custName,
                primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        } else if (dueDate === yesterdayStr && (sub.status === 'expired' || dueDate < todayStr)) {
          if (!wasNoticeAlreadySent(phone, 'overdue', dueDate, prodName, custName)) {
            pendingOverdue.push({
              id: sub.id,
              source: 'iptv',
              type: 'overdue',
              customer_name: custName,
              phone,
              product: prodName,
              amount,
              due_date: dueDate,
              preview_message: renderCustomTemplate(config.template_overdue_message || '', {
                cliente: custName,
                primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                produto: prodName,
                valor: amount,
                data_vencimento: formatBRLDate(dueDate),
                chave_pix: tenant?.pix_key,
                empresa: tenant?.trade_name || tenant?.name,
                telefone: phone,
              }),
            });
          }
        }
      }
    }

    // 4. Contratos de Empréstimos e Parcelas
    if (config.charge_loans_enabled !== false) {
      const diskLoans = this.loadFile<Loan>(FILE_LOANS);
      if (diskLoans && Array.isArray(diskLoans)) {
        this.loans = diskLoans;
      }
      const tenantLoans = this.loans.filter(
        (l) => l.tenantId === tenantId && l.status !== 'completed'
      );

      for (const l of tenantLoans) {
        const custName = l.customerName || 'Cliente';
        const phone = (l.customerPhone || '').replace(/\D/g, '');
        if (!phone) continue;

        if (l.installments && Array.isArray(l.installments) && l.installments.length > 0) {
          for (const inst of l.installments) {
            if (inst.status === 'paid') continue;
            const instDueDate = (inst.dueDate || '').slice(0, 10);
            if (!instDueDate) continue;
            const instAmount = Number(inst.amount) || 0;
            const prodName = `${l.description || 'Empréstimo'} (Parcela ${inst.number})`;

            if (instDueDate === todayStr) {
              if (!wasNoticeAlreadySent(phone, 'due_today', instDueDate, prodName, custName)) {
                pendingToday.push({
                  id: `${l.id}-${inst.id}`,
                  source: 'loan',
                  type: 'due_today',
                  customer_name: custName,
                  phone,
                  product: prodName,
                  amount: instAmount,
                  due_date: instDueDate,
                  preview_message: renderCustomTemplate(config.template_today_message, {
                    cliente: custName,
                    primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                    produto: prodName,
                    valor: instAmount,
                    data_vencimento: formatBRLDate(instDueDate),
                    chave_pix: tenant?.pix_key,
                    empresa: tenant?.trade_name || tenant?.name,
                    telefone: phone,
                  }),
                });
              }
            } else if (instDueDate === tomorrowStr) {
              if (!wasNoticeAlreadySent(phone, 'due_tomorrow', instDueDate, prodName, custName)) {
                pendingTomorrow.push({
                  id: `${l.id}-${inst.id}`,
                  source: 'loan',
                  type: 'due_tomorrow',
                  customer_name: custName,
                  phone,
                  product: prodName,
                  amount: instAmount,
                  due_date: instDueDate,
                  preview_message: renderCustomTemplate(config.template_tomorrow_message, {
                    cliente: custName,
                    primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                    produto: prodName,
                    valor: instAmount,
                    data_vencimento: formatBRLDate(instDueDate),
                    chave_pix: tenant?.pix_key,
                    empresa: tenant?.trade_name || tenant?.name,
                    telefone: phone,
                  }),
                });
              }
            } else if (instDueDate === yesterdayStr && (inst.status === 'overdue' || instDueDate < todayStr)) {
              if (!wasNoticeAlreadySent(phone, 'overdue', instDueDate, prodName, custName)) {
                pendingOverdue.push({
                  id: `${l.id}-${inst.id}`,
                  source: 'loan',
                  type: 'overdue',
                  customer_name: custName,
                  phone,
                  product: prodName,
                  amount: instAmount,
                  due_date: instDueDate,
                  preview_message: renderCustomTemplate(config.template_overdue_message || '', {
                    cliente: custName,
                    primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                    produto: prodName,
                    valor: instAmount,
                    data_vencimento: formatBRLDate(instDueDate),
                    chave_pix: tenant?.pix_key,
                    empresa: tenant?.trade_name || tenant?.name,
                    telefone: phone,
                  }),
                });
              }
            }
          }
        } else {
          const dueDate = (l.dueDate || '').slice(0, 10);
          if (!dueDate) continue;
          const amount = Number(l.totalToReceive || l.principalAmount) || 0;
          const prodName = l.description || 'Contrato de Empréstimo';

          if (dueDate === todayStr) {
            if (!wasNoticeAlreadySent(phone, 'due_today', dueDate, prodName, custName)) {
              pendingToday.push({
                id: l.id,
                source: 'loan',
                type: 'due_today',
                customer_name: custName,
                phone,
                product: prodName,
                amount,
                due_date: dueDate,
                preview_message: renderCustomTemplate(config.template_today_message, {
                  cliente: custName,
                  primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                  produto: prodName,
                  valor: amount,
                  data_vencimento: formatBRLDate(dueDate),
                  chave_pix: tenant?.pix_key,
                  empresa: tenant?.trade_name || tenant?.name,
                  telefone: phone,
                }),
              });
            }
          } else if (dueDate === tomorrowStr) {
            if (!wasNoticeAlreadySent(phone, 'due_tomorrow', dueDate, prodName, custName)) {
              pendingTomorrow.push({
                id: l.id,
                source: 'loan',
                type: 'due_tomorrow',
                customer_name: custName,
                phone,
                product: prodName,
                amount,
                due_date: dueDate,
                preview_message: renderCustomTemplate(config.template_tomorrow_message, {
                  cliente: custName,
                  primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                  produto: prodName,
                  valor: amount,
                  data_vencimento: formatBRLDate(dueDate),
                  chave_pix: tenant?.pix_key,
                  empresa: tenant?.trade_name || tenant?.name,
                  telefone: phone,
                }),
              });
            }
          } else if (dueDate === yesterdayStr && (l.status === 'overdue' || dueDate < todayStr)) {
            if (!wasNoticeAlreadySent(phone, 'overdue', dueDate, prodName, custName)) {
              pendingOverdue.push({
                id: l.id,
                source: 'loan',
                type: 'overdue',
                customer_name: custName,
                phone,
                product: prodName,
                amount,
                due_date: dueDate,
                preview_message: renderCustomTemplate(config.template_overdue_message || '', {
                  cliente: custName,
                  primeiro_nome: String(custName || 'Cliente').split(' ')[0],
                  produto: prodName,
                  valor: amount,
                  data_vencimento: formatBRLDate(dueDate),
                  chave_pix: tenant?.pix_key,
                  empresa: tenant?.trade_name || tenant?.name,
                  telefone: phone,
                }),
              });
            }
          }
        }
      }
    }

    return {
      todayDate: todayStr,
      tomorrowDate: tomorrowStr,
      pendingToday,
      pendingTomorrow,
      pendingOverdue,
      totalPending: pendingToday.length + pendingTomorrow.length,
      totalOverdue: pendingOverdue.length,
    };
  }

  public async runAutomatedDispatches(tenantId: string, force = false) {
    if (tenantId === 'tenant-default') {
      return { success: false, skipped: true, reason: 'Disparos automáticos desativados para conta de teste/demonstração.' };
    }

    if (isSupabaseConfigured()) {
      await this.loadFromSupabase().catch(() => {});
    }

    const config = this.getWhatsAppConfig(tenantId);

    if (!config.auto_send_enabled && !force) {
      return { success: false, skipped: true, reason: 'Disparos automáticos desativados nas configurações.' };
    }

    const dayOfWeek = new Date().getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend && !config.send_on_weekends && !force) {
      return { success: false, skipped: true, reason: 'Envio aos finais de semana desativado.' };
    }

    const { pendingToday, pendingTomorrow, pendingOverdue } = this.getPendingAutomationNotices(tenantId, force);
    const noticesToDispatch = [];

    if (config.template_today_enabled || force) {
      noticesToDispatch.push(...pendingToday);
    }
    if (config.template_tomorrow_enabled || force) {
      noticesToDispatch.push(...pendingTomorrow);
    }
    if (config.template_overdue_enabled || force) {
      noticesToDispatch.push(...pendingOverdue);
    }

    console.log(`[Auto WhatsApp Scheduler] Executing ${noticesToDispatch.length} notices for tenant ${tenantId}`);
    const results: WhatsAppDispatchLog[] = [];

    for (const item of noticesToDispatch) {
      const sendRes = await sendDirectWhatsAppTextMessage({
        phone: item.phone,
        message: item.preview_message,
        apiConfig: config,
      });

      const logItem: WhatsAppDispatchLog = {
        id: `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tenant_id: tenantId,
        timestamp: new Date().toISOString(),
        type: item.type,
        customer_name: item.customer_name,
        phone: item.phone,
        amount: item.amount,
        description: item.product,
        status: sendRes.success ? 'sent' : 'fallback_wa',
        method: sendRes.method,
        details: sendRes.success ? 'Mensagem disparada com sucesso' : (sendRes as any).error,
        wa_link: sendRes.waDirectUrl,
      };

      this.addWhatsAppDispatchLog(logItem);
      results.push(logItem);

      // Delay between dispatches (small wait so we don't bombard the gateway)
      const waitMs = Math.min(Math.max((config.delay_seconds || 5) * 100, 200), 2000);
      await new Promise((r) => setTimeout(r, waitMs));
    }

    // Update config metadata with last run
    config.last_run_at = new Date().toISOString();
    config.last_run_count = results.length;
    config.last_run_status = results.length > 0 ? 'Concluído com sucesso' : 'Nenhuma fatura pendente hoje';
    this.saveWhatsAppConfig(tenantId, config);

    return {
      success: true,
      timestamp: config.last_run_at,
      dispatchedCount: results.length,
      dispatches: results,
      message: `${results.length} mensagens processadas com sucesso!`,
    };
  }

  // IPTV Operations
  public getIPTVSubscribers(tenantId: string): IPTVSubscriber[] {
    const diskSubs = this.loadFile<IPTVSubscriber>(FILE_IPTV_SUBSCRIBERS);
    if (diskSubs && Array.isArray(diskSubs)) this.iptvSubscribers = diskSubs;

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    return this.iptvSubscribers
      .filter((sub) => sub.tenant_id === tenantId)
      .map((sub) => {
        // Auto update status based on date
        let status = sub.status;
        if (status !== 'trial') {
          if (sub.expiration_date < today) {
            status = 'expired';
          } else if (sub.expiration_date === today || sub.expiration_date === tomorrow) {
            status = 'expiring_soon';
          } else {
            status = 'active';
          }
        }
        return { ...sub, status };
      });
  }

  public async getIPTVSubscribersAsync(tenantId: string): Promise<IPTVSubscriber[]> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client.from('iptv_subscribers').select('*').eq('tenant_id', tenantId);
          if (!error && data && data.length > 0) {
            for (const s of data) {
              let external_link = s.external_link || '';
              let notes = s.notes || '';
              if (!external_link && notes && notes.includes('[Link: ')) {
                const match = notes.match(/\[Link:\s*([^\]]+)\]/);
                if (match && match[1]) external_link = match[1].trim();
              } else if (!external_link && (s.username?.startsWith('http://') || s.username?.startsWith('https://'))) {
                external_link = s.username;
              }
              const mapped: IPTVSubscriber = {
                id: s.id,
                tenant_id: s.tenant_id,
                customer_name: s.name || s.customer_name || 'Assinante',
                whatsapp: s.whatsapp || '',
                server_name: s.server_name || 'Painel Gold Play 4K',
                username_or_mac: s.username || s.username_or_mac || s.mac_address || '',
                password: s.password || '',
                plan_name: s.plan_name || 'Mensal (1 Tela)',
                app_name: s.app_name || 'IPTV Smarters Pro',
                screens: Number(s.screens_count || s.screens || 1),
                price: Number(s.plan_price || s.price || 30.0),
                expiration_date: s.expires_at ? s.expires_at.slice(0, 10) : (s.expiration_date || new Date().toISOString().slice(0, 10)),
                status: s.status || 'active',
                external_link,
                notes,
                created_at: s.created_at || new Date().toISOString(),
                updated_at: s.updated_at || new Date().toISOString(),
              };
              const idx = this.iptvSubscribers.findIndex((local) => local.id === mapped.id);
              if (idx >= 0) {
                this.iptvSubscribers[idx] = { ...this.iptvSubscribers[idx], ...mapped };
              } else {
                this.iptvSubscribers.unshift(mapped);
              }
            }
            this.saveFile(FILE_IPTV_SUBSCRIBERS, this.iptvSubscribers);
          }
        }
      } catch (err) {
        console.warn('[getIPTVSubscribersAsync warn]', err);
      }
    }
    return this.getIPTVSubscribers(tenantId);
  }

  public createIPTVSubscriber(data: Omit<IPTVSubscriber, 'id' | 'created_at' | 'updated_at'>): IPTVSubscriber {
    const newSub: IPTVSubscriber = {
      id: `iptv-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };
    this.iptvSubscribers.unshift(newSub);
    this.persist();
    return newSub;
  }

  public async createIPTVSubscriberAsync(data: Omit<IPTVSubscriber, 'id' | 'created_at' | 'updated_at'>): Promise<IPTVSubscriber> {
    const newSub = this.createIPTVSubscriber(data);
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await client.from('iptv_subscribers').upsert([{
            id: newSub.id,
            tenant_id: newSub.tenant_id || 'tenant-default',
            name: newSub.customer_name || 'Assinante',
            whatsapp: newSub.whatsapp || null,
            server_name: newSub.server_name || null,
            username: newSub.username_or_mac || newSub.external_link || null,
            password: newSub.password || null,
            app_name: newSub.app_name || null,
            plan_name: newSub.plan_name || null,
            plan_price: Number(newSub.price || 30.0),
            screens_count: Number(newSub.screens || 1),
            expires_at: newSub.expiration_date,
            status: newSub.status || 'active',
            notes: newSub.external_link
              ? newSub.notes
                ? `${newSub.notes} [Link: ${newSub.external_link}]`
                : `[Link: ${newSub.external_link}]`
              : newSub.notes || null,
            created_at: newSub.created_at,
            updated_at: newSub.updated_at,
          }]);
        }
      } catch (err) {
        console.warn('[Direct Supabase Upsert IPTV warn]', err);
      }
    }
    return newSub;
  }

  public updateIPTVSubscriber(id: string, updates: Partial<IPTVSubscriber>): IPTVSubscriber | undefined {
    const index = this.iptvSubscribers.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    this.iptvSubscribers[index] = {
      ...this.iptvSubscribers[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();
    return this.iptvSubscribers[index];
  }

  public async updateIPTVSubscriberAsync(id: string, updates: Partial<IPTVSubscriber>): Promise<IPTVSubscriber | undefined> {
    const updated = this.updateIPTVSubscriber(id, updates);
    if (updated && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const payload: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (updates.customer_name !== undefined) payload.name = updates.customer_name.trim();
          if (updates.whatsapp !== undefined) payload.whatsapp = updates.whatsapp.trim();
          if (updates.server_name !== undefined) payload.server_name = updates.server_name.trim();
          if (updates.username_or_mac !== undefined) payload.username = updates.username_or_mac.trim();
          if (updates.password !== undefined) payload.password = updates.password ? updates.password.trim() : null;
          if (updates.plan_name !== undefined) payload.plan_name = updates.plan_name.trim();
          if (updates.app_name !== undefined) payload.app_name = updates.app_name ? updates.app_name.trim() : null;
          if (updates.price !== undefined) payload.plan_price = Number(updates.price);
          if (updates.screens !== undefined) payload.screens_count = Number(updates.screens);
          if (updates.expiration_date !== undefined) payload.expires_at = updates.expiration_date;
          if (updates.status !== undefined) payload.status = updates.status;
          if (updates.notes !== undefined) payload.notes = updates.notes;

          await client.from('iptv_subscribers').update(payload).eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Update IPTV warn]', err);
      }
    }
    return updated;
  }

  public renewIPTVSubscriber(id: string, days = 30): IPTVSubscriber | undefined {
    const sub = this.iptvSubscribers.find((s) => s.id === id);
    if (!sub) return undefined;

    const today = new Date();
    const currentExp = new Date(sub.expiration_date + 'T12:00:00');
    const base = currentExp.getTime() > today.getTime() ? currentExp : today;
    const newExp = new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);

    sub.expiration_date = newExp;
    sub.status = 'active';
    sub.updated_at = new Date().toISOString();

    // Also record a paid charge in charges table
    this.charges.unshift({
      id: `chg-iptv-${Date.now()}`,
      tenant_id: sub.tenant_id,
      customer_id: 'cust-1',
      description: `Renovação IPTV - ${sub.customer_name} (${sub.plan_name})`,
      amount: sub.price,
      due_date: new Date().toISOString().slice(0, 10),
      status: 'paid',
      type: 'sale',
      paid_at: new Date().toISOString(),
      payment_method: 'pix',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.persist();
    return sub;
  }

  public async renewIPTVSubscriberAsync(id: string, days = 30): Promise<IPTVSubscriber | undefined> {
    const renewed = this.renewIPTVSubscriber(id, days);
    if (renewed && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await client.from('iptv_subscribers').update({
            expires_at: renewed.expiration_date,
            status: 'active',
            updated_at: new Date().toISOString(),
          }).eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Renew IPTV warn]', err);
      }
    }
    return renewed;
  }

  public deleteIPTVSubscriber(id: string): boolean {
    const initialLen = this.iptvSubscribers.length;
    this.iptvSubscribers = this.iptvSubscribers.filter((s) => s.id !== id);
    const deleted = this.iptvSubscribers.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  public async deleteIPTVSubscriberAsync(id: string): Promise<boolean> {
    const deleted = this.deleteIPTVSubscriber(id);
    if (deleted && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await client.from('iptv_subscribers').delete().eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Delete IPTV warn]', err);
      }
    }
    return deleted;
  }

  // IPTV Plans CRUD
  public getIPTVPlans(tenantId: string): IPTVPlan[] {
    const diskPlans = this.loadFile<IPTVPlan>(FILE_IPTV_PLANS);
    if (diskPlans && Array.isArray(diskPlans)) this.iptvPlans = diskPlans;
    return this.iptvPlans.filter((p) => p.tenant_id === tenantId);
  }

  public createIPTVPlan(data: Omit<IPTVPlan, 'id' | 'created_at'>): IPTVPlan {
    const newPlan: IPTVPlan = {
      id: `plan-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...data,
    };
    this.iptvPlans.unshift(newPlan);
    this.persist();
    return newPlan;
  }

  public async createIPTVPlanAsync(data: Omit<IPTVPlan, 'id' | 'created_at'>): Promise<IPTVPlan> {
    const newPlan = this.createIPTVPlan(data);
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          let desc = newPlan.description ? newPlan.description.trim() : '';
          if (newPlan.server_name && newPlan.server_name.trim()) {
            desc = desc ? `Painel: ${newPlan.server_name.trim()} | ${desc}` : `Painel: ${newPlan.server_name.trim()}`;
          }
          await client.from('iptv_plans').upsert([{
            id: newPlan.id,
            tenant_id: newPlan.tenant_id,
            name: newPlan.name,
            screens: Number(newPlan.screens || 1),
            duration_days: Number(newPlan.duration_days || 30),
            price: Number(newPlan.price || 0),
            description: desc || null,
            created_at: newPlan.created_at,
            updated_at: new Date().toISOString(),
          }]);
        }
      } catch (err) {
        console.warn('[Direct Supabase Upsert IPTV Plan warn]', err);
      }
    }
    return newPlan;
  }

  public updateIPTVPlan(id: string, updates: Partial<IPTVPlan>): IPTVPlan | undefined {
    const index = this.iptvPlans.findIndex((p) => p.id === id);
    if (index === -1) return undefined;
    this.iptvPlans[index] = { ...this.iptvPlans[index], ...updates };
    this.persist();
    return this.iptvPlans[index];
  }

  public async updateIPTVPlanAsync(id: string, updates: Partial<IPTVPlan>): Promise<IPTVPlan | undefined> {
    const updated = this.updateIPTVPlan(id, updates);
    if (updated && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const payload: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (updates.name !== undefined) payload.name = updates.name.trim();
          if (updates.screens !== undefined) payload.screens = Number(updates.screens);
          if (updates.duration_days !== undefined) payload.duration_days = Number(updates.duration_days);
          if (updates.price !== undefined) payload.price = Number(updates.price);
          if (updates.description !== undefined || updates.server_name !== undefined) {
            let desc = updates.description ? updates.description.trim() : '';
            if (updates.server_name && updates.server_name.trim()) {
              desc = desc ? `Painel: ${updates.server_name.trim()} | ${desc}` : `Painel: ${updates.server_name.trim()}`;
            }
            payload.description = desc || null;
          }
          await client.from('iptv_plans').update(payload).eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Update IPTV Plan warn]', err);
      }
    }
    return updated;
  }

  public deleteIPTVPlan(id: string): boolean {
    const initialLen = this.iptvPlans.length;
    this.iptvPlans = this.iptvPlans.filter((p) => p.id !== id);
    const deleted = this.iptvPlans.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  public async deleteIPTVPlanAsync(id: string): Promise<boolean> {
    const deleted = this.deleteIPTVPlan(id);
    if (deleted && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await client.from('iptv_plans').delete().eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Delete IPTV Plan warn]', err);
      }
    }
    return deleted;
  }

  // IPTV Apps CRUD
  public getIPTVApps(tenantId: string): IPTVApp[] {
    const diskApps = this.loadFile<IPTVApp>(FILE_IPTV_APPS);
    if (diskApps && Array.isArray(diskApps)) this.iptvApps = diskApps;
    return this.iptvApps.filter((a) => a.tenant_id === tenantId);
  }

  public createIPTVApp(data: Omit<IPTVApp, 'id' | 'created_at'>): IPTVApp {
    const newApp: IPTVApp = {
      id: `app-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...data,
    };
    this.iptvApps.unshift(newApp);
    this.persist();
    return newApp;
  }

  public async createIPTVAppAsync(data: Omit<IPTVApp, 'id' | 'created_at'>): Promise<IPTVApp> {
    const newApp = this.createIPTVApp(data);
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          let actInstructions: string = newApp.activation_type || 'login_password';
          if (newApp.dns_server && newApp.dns_server.trim()) {
            actInstructions = `${actInstructions} | DNS: ${newApp.dns_server.trim()}`;
          }
          if (newApp.instructions && newApp.instructions.trim()) {
            actInstructions = `${actInstructions} | ${newApp.instructions.trim()}`;
          }
          await client.from('iptv_apps').upsert([{
            id: newApp.id,
            tenant_id: newApp.tenant_id,
            name: newApp.name,
            platform: newApp.category || 'smart_tv',
            download_url: newApp.download_url ? newApp.download_url.trim() : null,
            activation_instructions: actInstructions,
            created_at: newApp.created_at,
            updated_at: new Date().toISOString(),
          }]);
        }
      } catch (err) {
        console.warn('[Direct Supabase Upsert IPTV App warn]', err);
      }
    }
    return newApp;
  }

  public updateIPTVApp(id: string, updates: Partial<IPTVApp>): IPTVApp | undefined {
    const index = this.iptvApps.findIndex((a) => a.id === id);
    if (index === -1) return undefined;
    this.iptvApps[index] = { ...this.iptvApps[index], ...updates };
    this.persist();
    return this.iptvApps[index];
  }

  public async updateIPTVAppAsync(id: string, updates: Partial<IPTVApp>): Promise<IPTVApp | undefined> {
    const updated = this.updateIPTVApp(id, updates);
    if (updated && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const payload: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (updates.name !== undefined) payload.name = updates.name.trim();
          if (updates.category !== undefined) payload.platform = updates.category;
          if (updates.download_url !== undefined) payload.download_url = updates.download_url ? updates.download_url.trim() : null;
          if (updates.activation_type !== undefined || updates.dns_server !== undefined || updates.instructions !== undefined) {
            let actInstructions: string = updates.activation_type || 'login_password';
            if (updates.dns_server && updates.dns_server.trim()) {
              actInstructions = `${actInstructions} | DNS: ${updates.dns_server.trim()}`;
            }
            if (updates.instructions && updates.instructions.trim()) {
              actInstructions = `${actInstructions} | ${updates.instructions.trim()}`;
            }
            payload.activation_instructions = actInstructions;
          }
          await client.from('iptv_apps').update(payload).eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Update IPTV App warn]', err);
      }
    }
    return updated;
  }

  public deleteIPTVApp(id: string): boolean {
    const initialLen = this.iptvApps.length;
    this.iptvApps = this.iptvApps.filter((a) => a.id !== id);
    const deleted = this.iptvApps.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  public async deleteIPTVAppAsync(id: string): Promise<boolean> {
    const deleted = this.deleteIPTVApp(id);
    if (deleted && isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          await client.from('iptv_apps').delete().eq('id', id);
        }
      } catch (err) {
        console.warn('[Direct Supabase Delete IPTV App warn]', err);
      }
    }
    return deleted;
  }

  // ==========================================
  // MÓDULO ASSINATURAS (Isolado e Persistente)
  // ==========================================

  // 1. Clientes de Assinaturas
  public getSubscriptionCustomers(tenantId: string): SubscriptionCustomer[] {
    const disk = this.loadFile<SubscriptionCustomer>(FILE_SUBSCRIPTION_CUSTOMERS);
    if (disk && Array.isArray(disk)) this.subscriptionCustomers = disk;
    return this.subscriptionCustomers
      .filter((c) => c.tenant_id === tenantId)
      .map((c: any) => {
        let extra: any = {};
        if (c.notes && typeof c.notes === 'string' && c.notes.trim().startsWith('{')) {
          try { extra = JSON.parse(c.notes.trim()); } catch {}
        }
        return {
          ...c,
          customer_name: c.customer_name || c.name || 'Cliente',
          whatsapp: c.whatsapp || '',
          email: c.email || undefined,
          document: c.document || extra.document || undefined,
          plan_id: c.plan_id || extra.plan_id || undefined,
          plan_name: c.plan_name || extra.plan_name || '',
          price: c.price !== undefined ? Number(c.price) : (extra.price !== undefined ? Number(extra.price) : 0),
          billing_cycle: c.billing_cycle || extra.billing_cycle || 'monthly',
          start_date: c.start_date || extra.start_date || (c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
          next_due_date: c.next_due_date || extra.next_due_date || new Date().toISOString().split('T')[0],
          status: c.status || extra.status || 'active',
        };
      });
  }

  public createSubscriptionCustomer(data: Omit<SubscriptionCustomer, 'id' | 'created_at'>): SubscriptionCustomer {
    const extra: Record<string, any> = {};
    if (data.plan_id !== undefined) extra.plan_id = data.plan_id;
    if (data.plan_name !== undefined) extra.plan_name = data.plan_name;
    if (data.price !== undefined) extra.price = Number(data.price);
    if (data.billing_cycle !== undefined) extra.billing_cycle = data.billing_cycle;
    if (data.start_date !== undefined) extra.start_date = data.start_date;
    if (data.next_due_date !== undefined) extra.next_due_date = data.next_due_date;
    if (data.status !== undefined) extra.status = data.status;

    const newCust: any = {
      id: (data as any).id || `sub-cust-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
      name: data.customer_name || (data as any).name,
      notes: Object.keys(extra).length > 0 ? JSON.stringify(extra) : (data.notes || null),
    };
    this.subscriptionCustomers.unshift(newCust);
    this.persist();

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          client.from('subscription_customers').upsert([{
            id: newCust.id,
            tenant_id: newCust.tenant_id || 'tenant-default',
            name: newCust.name,
            whatsapp: newCust.whatsapp || null,
            email: newCust.email || null,
            notes: newCust.notes || null,
            created_at: newCust.created_at,
            updated_at: newCust.updated_at,
          }]).then(() => {});
        }
      } catch (err) {
        console.warn('[Direct Supabase Insert sub customer warn]', err);
      }
    }

    return newCust;
  }

  public updateSubscriptionCustomer(id: string, updates: Partial<SubscriptionCustomer>): SubscriptionCustomer | undefined {
    const index = this.subscriptionCustomers.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    const existing: any = this.subscriptionCustomers[index];

    let extra: Record<string, any> = {};
    if (existing.notes && typeof existing.notes === 'string' && existing.notes.trim().startsWith('{')) {
      try { extra = JSON.parse(existing.notes.trim()); } catch {}
    }
    if (updates.plan_id !== undefined) extra.plan_id = updates.plan_id;
    if (updates.plan_name !== undefined) extra.plan_name = updates.plan_name;
    if (updates.price !== undefined) extra.price = Number(updates.price);
    if (updates.billing_cycle !== undefined) extra.billing_cycle = updates.billing_cycle;
    if (updates.start_date !== undefined) extra.start_date = updates.start_date;
    if (updates.next_due_date !== undefined) extra.next_due_date = updates.next_due_date;
    if (updates.status !== undefined) extra.status = updates.status;
    if (updates.document !== undefined) extra.document = updates.document;

    const custName = updates.customer_name || (updates as any).name || existing.customer_name || existing.name;

    const updatedCust: any = {
      ...existing,
      ...updates,
      name: custName,
      customer_name: custName,
      whatsapp: updates.whatsapp !== undefined ? updates.whatsapp : existing.whatsapp,
      email: updates.email !== undefined ? updates.email : existing.email,
      notes: Object.keys(extra).length > 0 ? JSON.stringify(extra) : (updates.notes || existing.notes || null),
      updated_at: new Date().toISOString(),
    };

    this.subscriptionCustomers[index] = updatedCust;
    this.persist();

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseClient();
        if (client) {
          const rowPayload: Record<string, any> = {
            name: custName,
            whatsapp: updatedCust.whatsapp ? String(updatedCust.whatsapp).trim() : null,
            email: updatedCust.email ? String(updatedCust.email).trim() : null,
            notes: updatedCust.notes || null,
            updated_at: updatedCust.updated_at,
          };
          client.from('subscription_customers').update(rowPayload).eq('id', id).then(() => {});
        }
      } catch (err) {
        console.warn('[Direct Supabase Update sub customer warn]', err);
      }
    }

    return updatedCust;
  }

  public deleteSubscriptionCustomer(id: string): boolean {
    const initialLen = this.subscriptionCustomers.length;
    this.subscriptionCustomers = this.subscriptionCustomers.filter((c) => c.id !== id);
    const deleted = this.subscriptionCustomers.length < initialLen;
    if (deleted) {
      this.persist();
      if (isSupabaseConfigured()) {
        try {
          const client = getSupabaseClient();
          if (client) {
            client.from('subscription_customers').delete().eq('id', id).then(() => {});
          }
        } catch (err) {
          console.warn('[Direct Supabase Delete sub customer warn]', err);
        }
      }
    }
    return deleted;
  }

  // 2. Planos de Assinaturas
  public getSubscriptionPlans(tenantId: string): SubscriptionPlan[] {
    const disk = this.loadFile<SubscriptionPlan>(FILE_SUBSCRIPTION_PLANS);
    if (disk && Array.isArray(disk)) this.subscriptionPlans = disk;
    return this.subscriptionPlans.filter((p) => p.tenant_id === tenantId);
  }

  public createSubscriptionPlan(data: Omit<SubscriptionPlan, 'id' | 'created_at'>): SubscriptionPlan {
    const newPlan: SubscriptionPlan = {
      id: `plan-sub-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...data,
    };
    this.subscriptionPlans.unshift(newPlan);
    this.persist();
    return newPlan;
  }

  public updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): SubscriptionPlan | undefined {
    const index = this.subscriptionPlans.findIndex((p) => p.id === id);
    if (index === -1) return undefined;
    this.subscriptionPlans[index] = { ...this.subscriptionPlans[index], ...updates };
    this.persist();
    return this.subscriptionPlans[index];
  }

  public deleteSubscriptionPlan(id: string): boolean {
    const initialLen = this.subscriptionPlans.length;
    this.subscriptionPlans = this.subscriptionPlans.filter((p) => p.id !== id);
    const deleted = this.subscriptionPlans.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  // 3. Vendas de Assinatura
  public getSubscriptionSales(tenantId: string): SubscriptionSale[] {
    const disk = this.loadFile<SubscriptionSale>(FILE_SUBSCRIPTION_SALES);
    if (disk && Array.isArray(disk)) this.subscriptionSales = disk;
    return this.subscriptionSales.filter((s) => s.tenant_id === tenantId);
  }

  public createSubscriptionSale(data: Omit<SubscriptionSale, 'id' | 'created_at'>): SubscriptionSale {
    const newSale: SubscriptionSale = {
      id: `sale-sub-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...data,
    };
    this.subscriptionSales.unshift(newSale);
    this.persist();
    return newSale;
  }

  public updateSubscriptionSale(id: string, updates: Partial<SubscriptionSale>): SubscriptionSale | undefined {
    const index = this.subscriptionSales.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    this.subscriptionSales[index] = { ...this.subscriptionSales[index], ...updates };
    this.persist();
    return this.subscriptionSales[index];
  }

  public deleteSubscriptionSale(id: string): boolean {
    const initialLen = this.subscriptionSales.length;
    this.subscriptionSales = this.subscriptionSales.filter((s) => s.id !== id);
    const deleted = this.subscriptionSales.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  // Métodos Globais para Configuração do Link Externo / Lojinha Online
  public getExternalLinkConfig(): ExternalLinkConfig {
    if (this.externalLinkConfig.description?.includes('produtos e serviços')) {
      this.externalLinkConfig.description = 'Conheça nossos produtos exclusivos';
    }
    return { ...this.externalLinkConfig };
  }

  public updateExternalLinkConfig(updates: Partial<ExternalLinkConfig>): ExternalLinkConfig {
    this.externalLinkConfig = {
      ...this.externalLinkConfig,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        (client.from('system_settings').upsert({
          key: 'external_link_config',
          value: this.externalLinkConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' }) as any).then(() => {}).catch(() => {});
      }
    }

    return { ...this.externalLinkConfig };
  }

  // Métodos Globais para Configuração do WhatsApp de Suporte do Sistema
  public getSupportWhatsAppConfig(): SupportWhatsAppConfig {
    return { ...this.supportWhatsAppConfig };
  }

  public updateSupportWhatsAppConfig(updates: Partial<SupportWhatsAppConfig>): SupportWhatsAppConfig {
    this.supportWhatsAppConfig = {
      ...this.supportWhatsAppConfig,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.persist();

    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      if (client) {
        (client.from('system_settings').upsert({
          key: 'support_whatsapp_config',
          value: this.supportWhatsAppConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' }) as any).then(() => {}).catch(() => {});
      }
    }

    return { ...this.supportWhatsAppConfig };
  }
}

export const store = new DataStore();
