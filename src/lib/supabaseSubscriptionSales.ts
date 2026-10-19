import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { SubscriptionSale } from '../types/index.js';

/**
 * Converte uma linha do Supabase (public.subscription_sales) para a interface SubscriptionSale do frontend
 */
export function mapSupabaseRowToSubscriptionSale(
  row: any,
  customersLookup?: Map<string, { customer_name: string; whatsapp: string }>,
  plansLookup?: Map<string, { name: string; price: number }>
): SubscriptionSale {
  const customer = row.customer || customersLookup?.get(row.customer_id);
  const plan = row.plan || plansLookup?.get(row.plan_id);

  const customerName =
    customer?.customer_name ||
    customer?.name ||
    row.customer_name ||
    'Cliente';

  const whatsapp = customer?.whatsapp || row.whatsapp || '';

  const planName =
    plan?.plan_title ||
    plan?.service_name ||
    plan?.name ||
    row.plan_name ||
    'Plano';

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    customer_name: customerName,
    whatsapp: whatsapp,
    plan_name: planName,
    plan_id: row.plan_id,
    amount: Number(row.amount || 0),
    start_date: row.start_date ? row.start_date.split('T')[0] : undefined,
    due_date: row.due_date ? row.due_date.split('T')[0] : '',
    status: row.status || 'pending',
    paid_at: row.paid_at || undefined,
    payment_method: row.payment_method || undefined,
    account_email: row.account_email || undefined,
    account_password: row.account_password || undefined,
    pin_code: row.pin_code || undefined,
    profile_name: row.profile_name || undefined,
    notes: row.notes || undefined,
    created_at: row.created_at || new Date().toISOString(),
  };
}

/**
 * Converte dados de SubscriptionSale do frontend para as colunas reais da tabela public.subscription_sales
 */
export function mapSubscriptionSaleToSupabaseRow(
  sale: Partial<SubscriptionSale>,
  tenantId: string
): Record<string, any> {
  const row: Record<string, any> = {
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  };

  if (sale.id) row.id = sale.id;
  if (sale.customer_id) row.customer_id = sale.customer_id;
  if (sale.plan_id) row.plan_id = sale.plan_id;
  if (sale.amount !== undefined) {
    const numAmount = Number(sale.amount);
    row.amount = isNaN(numAmount) ? 0 : numAmount;
  }
  if (sale.start_date) {
    row.start_date = sale.start_date.includes('T') ? sale.start_date : `${sale.start_date}T00:00:00Z`;
  }
  if (sale.due_date) {
    row.due_date = sale.due_date.includes('T') ? sale.due_date : `${sale.due_date}T23:59:59Z`;
  }
  if (sale.status) {
    row.status = sale.status;
  }
  if (sale.paid_at !== undefined) {
    row.paid_at = sale.paid_at;
  }
  if (sale.payment_method !== undefined) {
    row.payment_method = sale.payment_method;
  }
  if (sale.account_email !== undefined) {
    row.account_email = sale.account_email ? sale.account_email.trim() : null;
  }
  if (sale.account_password !== undefined) {
    row.account_password = sale.account_password ? sale.account_password.trim() : null;
  }
  if (sale.pin_code !== undefined) {
    row.pin_code = sale.pin_code ? sale.pin_code.trim() : null;
  }
  if (sale.profile_name !== undefined) {
    row.profile_name = sale.profile_name ? sale.profile_name.trim() : null;
  }
  if (sale.notes !== undefined) {
    row.notes = sale.notes ? sale.notes.trim() : null;
  }

  return row;
}

/**
 * Consulta oficial no Supabase PostgreSQL de todas as vendas de assinatura do tenant atual
 */
export async function loadSubscriptionSalesFromSupabase(
  tenantId: string
): Promise<SubscriptionSale[]> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { data, error } = await supabase
    .from('subscription_sales')
    .select(`
      *,
      customer:subscription_customers(id, name, whatsapp),
      plan:subscription_plans(id, service_name, plan_title, monthly_price)
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[supabaseSubscriptionSales] Erro ao carregar vendas:', error.message);
    throw error;
  }

  if (!Array.isArray(data)) return [];
  return data.map((row) => mapSupabaseRowToSubscriptionSale(row));
}

/**
 * Cria uma nova fatura/venda de assinatura diretamente no Supabase PostgreSQL
 */
export async function createSubscriptionSaleInSupabase(
  tenantId: string,
  data: Omit<SubscriptionSale, 'id' | 'created_at'> & { id?: string }
): Promise<SubscriptionSale> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  if (!data.customer_id) {
    throw new Error('Cliente é obrigatório para registrar a venda.');
  }

  if (!data.plan_id) {
    throw new Error('Plano de assinatura é obrigatório para registrar a venda.');
  }

  const saleId = data.id || `sale-${Date.now()}`;
  const now = new Date().toISOString();

  const row = mapSubscriptionSaleToSupabaseRow(data, tenantId);
  row.id = saleId;
  row.created_at = now;
  row.updated_at = now;
  if (!row.start_date) row.start_date = now;
  if (!row.due_date) row.due_date = now;
  if (!row.status) row.status = 'pending';

  const { data: created, error } = await supabase
    .from('subscription_sales')
    .insert([row])
    .select(`
      *,
      customer:subscription_customers(id, name, whatsapp),
      plan:subscription_plans(id, service_name, plan_title, monthly_price)
    `)
    .single();

  if (error) {
    console.error('[supabaseSubscriptionSales] Erro ao inserir venda:', error.message);
    throw error;
  }

  return mapSupabaseRowToSubscriptionSale(created);
}

/**
 * Atualiza uma venda existente no Supabase PostgreSQL com isolamento estrito por tenant_id
 */
export async function updateSubscriptionSaleInSupabase(
  tenantId: string,
  saleId: string,
  updates: Partial<SubscriptionSale>
): Promise<SubscriptionSale> {
  if (!isSupabaseConfigured || !tenantId || !saleId) {
    throw new Error('Parâmetros inválidos para atualização de venda.');
  }

  const row = mapSubscriptionSaleToSupabaseRow(updates, tenantId);
  delete row.id;
  delete row.tenant_id;
  delete row.created_at;

  const { data: updated, error } = await supabase
    .from('subscription_sales')
    .update(row)
    .eq('id', saleId)
    .eq('tenant_id', tenantId)
    .select(`
      *,
      customer:subscription_customers(id, name, whatsapp),
      plan:subscription_plans(id, service_name, plan_title, monthly_price)
    `)
    .single();

  if (error) {
    console.error('[supabaseSubscriptionSales] Erro ao atualizar venda:', error.message);
    throw error;
  }

  return mapSupabaseRowToSubscriptionSale(updated);
}

/**
 * Exclui uma venda do Supabase PostgreSQL com isolamento estrito por tenant_id
 */
export async function deleteSubscriptionSaleFromSupabase(
  tenantId: string,
  saleId: string
): Promise<void> {
  if (!isSupabaseConfigured || !tenantId || !saleId) {
    throw new Error('Parâmetros inválidos para exclusão de venda.');
  }

  const { error } = await supabase
    .from('subscription_sales')
    .delete()
    .eq('id', saleId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[supabaseSubscriptionSales] Erro ao excluir venda:', error.message);
    throw error;
  }
}
