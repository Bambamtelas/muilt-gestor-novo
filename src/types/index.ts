export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'lifetime';
export type UserRole = 'owner' | 'master_admin';
export type MemberRole = 'owner' | 'admin' | 'member';
export type ChargeStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type ChargeType = 'sale' | 'loan' | 'debt' | 'service';
export type PaymentStatus = 'pending' | 'approved' | 'expired';
export type AppModule = 'loans' | 'iptv' | 'business' | 'subscriptions';

export interface Tenant {
  id: string;
  owner_user_id?: string;
  name: string;
  trade_name?: string;
  document?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  pix_key?: string;
  pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  logo_url?: string;
  subscription_status: SubscriptionStatus;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
  selected_modules?: AppModule[];
  plan_monthly_price?: number;
  has_custom_price?: boolean;
  is_blocked?: boolean;
  blocked_reason?: string;
  last_expiration_warning_sent_at?: string;
}

export interface GlobalPlanPrices {
  module_1: number;
  module_2: number;
  module_3: number;
  module_4: number;
}

export const DEFAULT_PLAN_PRICES: GlobalPlanPrices = {
  module_1: 24.9,
  module_2: 39.9,
  module_3: 49.9,
  module_4: 69.9,
};

export function calculatePlanPrice(modulesCount: number, prices?: GlobalPlanPrices): number {
  const p = prices || DEFAULT_PLAN_PRICES;
  if (modulesCount <= 1) return p.module_1;
  if (modulesCount === 2) return p.module_2;
  if (modulesCount === 3) return p.module_3;
  return p.module_4;
}

export interface Profile {
  id: string;
  auth_user_id?: string;
  tenant_id?: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: MemberRole;
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  trade_name?: string;
  document?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address_street?: string;
  address_number?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  total_debt?: number;
  total_paid?: number;
}

export interface Charge {
  id: string;
  tenant_id: string;
  customer_id: string;
  customer?: Customer;
  description: string;
  amount: number;
  due_date: string;
  sale_date?: string;
  status: ChargeStatus;
  type: ChargeType;
  notes?: string;
  paid_at?: string;
  payment_method?: string;
  payment_condition?: 'cash' | 'term';
  installments?: number;
  pix_copy_paste?: string;
  loan_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  stock_quantity?: number;
  created_at: string;
  updated_at?: string;
}

export interface SubscriptionPayment {
  id: string;
  tenant_id: string;
  amount: number;
  currency: 'BRL';
  gateway: 'mercadopago';
  gateway_order_id?: string;
  gateway_payment_id?: string;
  status: PaymentStatus;
  payment_method: 'pix';
  qr_code?: string;
  qr_code_base64?: string;
  pix_copy_paste?: string;
  ticket_url?: string;
  expires_at: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SystemStats {
  totalCustomers: number;
  totalCharges: number;
  totalProducts: number;
  totalPendingAmount: number;
  totalPaidAmount: number;
  totalOverdueAmount: number;
  paidThisMonth: number;
  activeTenants: number;
  mpConnected: boolean;
  supabaseConnected: boolean;
}

export interface MonthlyReportData {
  month: string; // YYYY-MM
  monthName: string;
  totalBilled: number;
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  recoveryRate: number; // percentage
  averageTicket: number;
  chargesCount: number;
  paidChargesCount: number;
  overdueChargesCount: number;
  topDebtors: Array<{
    customerId: string;
    customerName: string;
    amount: number;
    whatsapp?: string;
  }>;
  dailyFlow: Array<{
    day: string;
    billed: number;
    received: number;
  }>;
  aiAnalysis?: string;
}

export interface IPTVSubscriber {
  id: string;
  tenant_id: string;
  customer_name: string;
  whatsapp: string;
  server_name: string;
  username_or_mac: string;
  password?: string;
  plan_name: string;
  app_name?: string;
  screens: number;
  price: number;
  expiration_date: string;
  status: 'active' | 'expiring_soon' | 'expired' | 'trial';
  notes?: string;
  external_link?: string;
  created_at: string;
  updated_at: string;
}

export interface IPTVPlan {
  id: string;
  tenant_id: string;
  name: string;
  screens: number;
  duration_days: number;
  price: number;
  server_name: string;
  description?: string;
  created_at: string;
}

export interface IPTVApp {
  id: string;
  tenant_id: string;
  name: string;
  category: 'smart_tv' | 'android' | 'firestick' | 'windows' | 'ios' | 'multi';
  download_url?: string;
  dns_server?: string;
  activation_type: 'login_password' | 'mac_device_key' | 'm3u_link';
  instructions?: string;
  created_at: string;
}

export interface WhatsAppAutomationConfig {
  instance_name: string;
  server_url: string;
  api_key: string;
  status: 'disconnected' | 'connecting' | 'connected';
  connected_phone?: string;
  connected_at?: string;
  auto_send_enabled: boolean;
  scheduled_time: string; // Ex: "09:00"
  send_on_weekends: boolean;
  delay_seconds: number;

  // Modelo 1: Amanhã é seu vencimento
  template_tomorrow_enabled: boolean;
  template_tomorrow_message: string;

  // Modelo 2: Hoje é seu vencimento
  template_today_enabled: boolean;
  template_today_message: string;

  // Modelo 3: Fatura vencida (Cobrança de inadimplentes)
  template_overdue_enabled: boolean;
  template_overdue_message: string;
  overdue_days_limit: number; // Só cobra vencidos até X dias atrás (ex: 30 dias)

  // 2º Horário de Disparo Diário (Turno da Tarde / Repescagem de Inadimplentes)
  second_scheduled_time_enabled?: boolean;
  second_scheduled_time?: string; // Ex: "15:00"

  // Períodos de Cobrança Diária: Manhã, Tarde e Noite
  morning_schedule_enabled?: boolean;
  morning_schedule_time?: string; // Ex: "09:00"
  afternoon_schedule_enabled?: boolean;
  afternoon_schedule_time?: string; // Ex: "14:30"
  night_schedule_enabled?: boolean;
  night_schedule_time?: string; // Ex: "19:00"

  // Regras de Módulos para Cobrança Automática
  charge_business_enabled?: boolean; // Negócios & Empresas (Cobranças/Vendas)
  charge_iptv_enabled?: boolean; // IPTV (Assinantes Expirados e a Vencer)
  charge_loans_enabled?: boolean; // Empréstimos (Parcelas e Contratos em Atraso)
  charge_subscriptions_enabled?: boolean; // Assinaturas (Planos, Mensalidades e Vendas)

  last_run_at?: string;
  last_run_count?: number;
  last_run_status?: string;
}

export interface WhatsAppDispatchLog {
  id: string;
  tenant_id: string;
  timestamp: string;
  type: 'due_today' | 'due_tomorrow' | 'overdue' | 'manual_test' | 'direct_charge';
  customer_name: string;
  phone: string;
  amount: number;
  description: string;
  status: 'sent' | 'fallback_wa' | 'failed';
  method: 'evolution_api' | 'direct_whatsapp';
  details?: string;
  wa_link?: string;
}

export interface SubscriptionPlan {
  id: string;
  tenant_id: string;
  name: string;
  billing_cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  price: number;
  description?: string;
  features?: string[];
  created_at: string;
}

export interface SubscriptionCustomer {
  id: string;
  tenant_id: string;
  customer_name: string;
  whatsapp: string;
  email?: string;
  document?: string;
  plan_id?: string;
  plan_name: string;
  price: number;
  billing_cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  start_date: string;
  next_due_date: string;
  status: 'active' | 'overdue' | 'cancelled';
  notes?: string;
  created_at: string;
}

export interface SubscriptionSale {
  id: string;
  tenant_id: string;
  customer_id: string;
  customer_name: string;
  whatsapp: string;
  plan_name: string;
  plan_id?: string;
  amount: number;
  start_date?: string;
  due_date: string;
  paid_at?: string;
  status: 'pending' | 'paid' | 'overdue' | 'active' | 'cancelled';
  payment_method?: 'pix' | 'credit_card' | 'cash';
  account_email?: string;
  account_password?: string;
  pin_code?: string;
  profile_name?: string;
  notes?: string;
  created_at: string;
}

export interface LoanInstallment {
  id: string;
  number: number;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string;
  paidAmount?: number;
}

export interface Loan {
  id: string;
  tenantId: string;
  customerName: string;
  customerPhone: string;
  description: string;
  principalAmount: number;
  dueDate: string;
  isRecurringOrInstallment: boolean;
  billingType: 'single' | 'installment' | 'recurring';
  installmentsCount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  paymentMethod: 'pix' | 'credit_card' | 'cash';
  instructions: string;
  status: 'active' | 'completed' | 'overdue';
  createdAt: string;
  totalToReceive: number;
  installments: LoanInstallment[];
}

export interface ExternalLinkConfig {
  enabled: boolean;
  button_text: string;
  url: string;
  description?: string;
  updated_at?: string;
}

export const DEFAULT_EXTERNAL_LINK_CONFIG: ExternalLinkConfig = {
  enabled: true,
  button_text: 'Acesse nossa lojinha',
  url: '',
  description: 'Conheça nossos produtos exclusivos',
};

export interface SupportWhatsAppConfig {
  phone: string;
  default_message?: string;
  enabled?: boolean;
  updated_at?: string;
}

export const DEFAULT_SUPPORT_WHATSAPP_CONFIG: SupportWhatsAppConfig = {
  phone: '21989850026',
  default_message: 'Olá, preciso de suporte no Multi Gestor',
  enabled: true,
};

