import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { SubscriptionPlan } from '../types/index.js';

/**
 * Converte uma linha do Supabase (public.subscription_plans) para a interface SubscriptionPlan do frontend
 */
export function mapSupabaseRowToSubscriptionPlan(row: any): SubscriptionPlan {
  const days = Number(row.duration_days) || 30;
  let cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual' = 'monthly';
  if (days >= 300) cycle = 'annual';
  else if (days >= 150) cycle = 'semiannual';
  else if (days >= 60) cycle = 'quarterly';

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.plan_title || row.service_name || 'Plano',
    billing_cycle: (row as any).billing_cycle || cycle,
    price: Number(row.monthly_price || 0),
    description: row.description || undefined,
    created_at: row.created_at || new Date().toISOString(),
  };
}

/**
 * Converte dados de SubscriptionPlan do frontend para as colunas reais da tabela public.subscription_plans
 */
export function mapSubscriptionPlanToSupabaseRow(
  plan: Partial<SubscriptionPlan>,
  tenantId: string
): Record<string, any> {
  const row: Record<string, any> = {
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  };

  if (plan.id) row.id = plan.id;
  const planName = plan.name || (plan as any).plan_title || (plan as any).service_name;
  if (planName !== undefined) {
    row.service_name = planName.trim();
    row.plan_title = planName.trim();
  }
  if (plan.price !== undefined) {
    const numPrice = Number(plan.price);
    row.monthly_price = isNaN(numPrice) ? 0 : numPrice;
  }
  if (plan.description !== undefined) {
    row.description = plan.description ? plan.description.trim() : null;
  }
  if (plan.billing_cycle) {
    const cycle = plan.billing_cycle;
    row.duration_days = cycle === 'annual' ? 365 : cycle === 'semiannual' ? 180 : cycle === 'quarterly' ? 90 : 30;
  }

  return row;
}

/**
 * Consulta oficial no Supabase PostgreSQL de todos os planos de assinatura do tenant atual
 */
export async function loadSubscriptionPlansFromSupabase(
  tenantId: string
): Promise<SubscriptionPlan[]> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[supabaseSubscriptionPlans] Erro ao carregar planos:', error);
    throw error;
  }

  if (!Array.isArray(data)) return [];
  return data.map(mapSupabaseRowToSubscriptionPlan);
}

/**
 * Cria um novo plano diretamente no Supabase PostgreSQL com validação estrita de tenant_id
 */
export async function createSubscriptionPlanInSupabase(
  tenantId: string,
  data: Omit<SubscriptionPlan, 'id' | 'created_at'> & { id?: string }
): Promise<SubscriptionPlan> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const planName = data.name || (data as any).plan_title || (data as any).service_name;
  if (!planName || !planName.trim()) {
    throw new Error('Nome do plano é obrigatório.');
  }

  const planId = data.id || `plan-${Date.now()}`;
  const now = new Date().toISOString();

  const row = mapSubscriptionPlanToSupabaseRow(data, tenantId);
  row.id = planId;
  row.created_at = now;
  row.updated_at = now;

  const { data: created, error } = await supabase
    .from('subscription_plans')
    .insert([row])
    .select()
    .single();

  if (error) {
    console.error('[supabaseSubscriptionPlans] Erro ao inserir plano:', error);
    throw error;
  }

  return mapSupabaseRowToSubscriptionPlan(created);
}

/**
 * Atualiza um plano existente no Supabase PostgreSQL com isolamento estrito por tenant_id
 */
export async function updateSubscriptionPlanInSupabase(
  tenantId: string,
  planId: string,
  updates: Partial<SubscriptionPlan>
): Promise<SubscriptionPlan> {
  if (!isSupabaseConfigured || !tenantId || !planId) {
    throw new Error('Parâmetros inválidos para atualização de plano.');
  }

  const row = mapSubscriptionPlanToSupabaseRow(updates, tenantId);
  delete row.id;
  delete row.tenant_id;
  delete row.created_at;

  const { data: updated, error } = await supabase
    .from('subscription_plans')
    .update(row)
    .eq('id', planId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    console.error('[supabaseSubscriptionPlans] Erro ao atualizar plano:', error);
    throw error;
  }

  return mapSupabaseRowToSubscriptionPlan(updated);
}

/**
 * Exclui um plano do Supabase PostgreSQL com isolamento estrito por tenant_id
 */
export async function deleteSubscriptionPlanFromSupabase(
  tenantId: string,
  planId: string
): Promise<void> {
  if (!isSupabaseConfigured || !tenantId || !planId) {
    throw new Error('Parâmetros inválidos para exclusão de plano.');
  }

  const { error } = await supabase
    .from('subscription_plans')
    .delete()
    .eq('id', planId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[supabaseSubscriptionPlans] Erro ao excluir plano:', error);
    throw error;
  }
}
