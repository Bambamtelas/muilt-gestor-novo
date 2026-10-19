import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { SubscriptionCustomer } from '../types/index.js';
import { api } from './api.js';

/**
 * Converte uma linha do Supabase (public.subscription_customers) para a interface SubscriptionCustomer do frontend
 */
export function mapSupabaseRowToSubscriptionCustomer(row: any): SubscriptionCustomer {
  let extraData: any = {};
  if (row.notes && typeof row.notes === 'string') {
    try {
      const trimmed = row.notes.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        extraData = JSON.parse(trimmed);
      }
    } catch {
      // Notas em texto comum
    }
  }

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_name: row.name || (row as any).customer_name || 'Assinante',
    whatsapp: row.whatsapp || '',
    email: row.email || undefined,
    document: row.document || extraData.document || undefined,
    plan_id: row.plan_id || extraData.plan_id || undefined,
    plan_name: extraData.plan_name || '',
    price: extraData.price !== undefined ? Number(extraData.price) : 0,
    billing_cycle: extraData.billing_cycle || 'monthly',
    start_date: extraData.start_date || (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    next_due_date: extraData.next_due_date || new Date().toISOString().split('T')[0],
    status: extraData.status || 'active',
    notes: extraData.notes !== undefined ? extraData.notes : (row.notes || undefined),
    created_at: row.created_at || new Date().toISOString(),
  };
}

/**
 * Converte dados de SubscriptionCustomer do frontend para as colunas reais da tabela public.subscription_customers,
 * preservando metadados anteriores de notes caso fornecidos.
 */
export function mapSubscriptionCustomerToSupabaseRow(
  customer: Partial<SubscriptionCustomer>,
  tenantId: string,
  existingNotes?: Record<string, any>
): Record<string, any> {
  const row: Record<string, any> = {
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  };

  if (customer.id) row.id = customer.id;
  const custName = customer.customer_name || (customer as any).name;
  if (custName !== undefined) row.name = custName.trim();
  if (customer.whatsapp !== undefined) row.whatsapp = customer.whatsapp ? customer.whatsapp.trim() : null;
  if (customer.email !== undefined) row.email = customer.email ? customer.email.trim() : null;

  // Empacota atributos de ciclo e plano em notes de forma segura, iniciando com existingNotes se fornecido
  const extra: Record<string, any> = existingNotes ? { ...existingNotes } : {};
  if (customer.plan_id !== undefined) extra.plan_id = customer.plan_id;
  if (customer.plan_name !== undefined) extra.plan_name = customer.plan_name;
  if (customer.price !== undefined) extra.price = Number(customer.price);
  if (customer.billing_cycle !== undefined) extra.billing_cycle = customer.billing_cycle;
  if (customer.start_date !== undefined) extra.start_date = customer.start_date;
  if (customer.next_due_date !== undefined) extra.next_due_date = customer.next_due_date;
  if (customer.status !== undefined) extra.status = customer.status;
  if (customer.document !== undefined) extra.document = customer.document ? customer.document.trim() : null;
  if (customer.notes !== undefined && !customer.notes.trim().startsWith('{')) extra.notes = customer.notes.trim();

  if (Object.keys(extra).length > 0) {
    row.notes = JSON.stringify(extra);
  } else if (customer.notes !== undefined) {
    row.notes = customer.notes ? customer.notes.trim() : null;
  }

  return row;
}

/**
 * Consulta oficial no Supabase PostgreSQL de todos os assinantes do tenant atual
 */
export async function loadSubscriptionCustomersFromSupabase(
  tenantId: string
): Promise<SubscriptionCustomer[]> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { data, error } = await supabase
    .from('subscription_customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[supabaseSubscriptionCustomers] Aviso ao carregar assinantes do Supabase (anon key):', error.message);
    return api.getSubscriptionCustomers(tenantId);
  }

  if (!Array.isArray(data)) return [];
  return data.map(mapSupabaseRowToSubscriptionCustomer);
}

/**
 * Cria um novo assinante diretamente no Supabase PostgreSQL com validação estrita de tenant_id
 */
export async function createSubscriptionCustomerInSupabase(
  tenantId: string,
  data: Omit<SubscriptionCustomer, 'id' | 'created_at'> & { id?: string }
): Promise<SubscriptionCustomer> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const custName = data.customer_name || (data as any).name;
  if (!custName || !custName.trim()) {
    throw new Error('Nome do assinante é obrigatório.');
  }

  const customerId = data.id || `sub-cust-${Date.now()}`;
  const now = new Date().toISOString();

  const row = mapSubscriptionCustomerToSupabaseRow(data, tenantId);
  row.id = customerId;
  row.created_at = now;
  row.updated_at = now;

  const { data: created, error } = await supabase
    .from('subscription_customers')
    .insert([row])
    .select()
    .single();

  if (error) {
    console.warn('[supabaseSubscriptionCustomers] Aviso no INSERT com anon key, acionando fallback Express:', error.message);
    return api.createSubscriptionCustomer({ ...data, id: customerId, tenant_id: tenantId } as any);
  }

  return mapSupabaseRowToSubscriptionCustomer(created);
}

/**
 * Atualiza um assinante existente no Supabase PostgreSQL com isolamento estrito por tenant_id
 */
export async function updateSubscriptionCustomerInSupabase(
  tenantId: string,
  customerId: string,
  updates: Partial<SubscriptionCustomer>
): Promise<SubscriptionCustomer> {
  if (!isSupabaseConfigured || !tenantId || !customerId) {
    throw new Error('Parâmetros inválidos para atualização de assinante.');
  }

  // 1. Buscar o registro atual do cliente para preservar notes existente
  const { data: existingRecord, error: fetchError } = await supabase
    .from('subscription_customers')
    .select('*')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchError) {
    console.warn('[supabaseSubscriptionCustomers] Aviso ao buscar cliente existente antes do update:', fetchError.message);
  }

  // 2. Extrair e parsear o notes existente
  let existingNotes: Record<string, any> = {};
  if (existingRecord?.notes && typeof existingRecord.notes === 'string') {
    try {
      const trimmed = existingRecord.notes.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        existingNotes = JSON.parse(trimmed);
      } else if (trimmed.length > 0) {
        existingNotes.notes = trimmed;
      }
    } catch {
      // Se não for JSON válido, não quebra
    }
  }

  // 3. Fazer o mapeamento mesclando os campos de updates com existingNotes
  const row = mapSubscriptionCustomerToSupabaseRow(updates, tenantId, existingNotes);
  delete row.id;
  delete row.tenant_id;
  delete row.created_at;

  console.log('[SUB_SAVE] Enviando UPDATE para Supabase:', {
    customerId,
    tenantId,
    row: {
      name: row.name,
      whatsapp: row.whatsapp,
      updated_at: row.updated_at,
      notes: row.notes,
    },
  });

  const { data: updated, error } = await supabase
    .from('subscription_customers')
    .update(row)
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    console.warn('[SUB_SAVE] Aviso retornado pelo Supabase (anon key) no UPDATE, acionando fallback Express:', error.message);
    return api.updateSubscriptionCustomer(customerId, updates);
  }

  // 4. Leitura imediatamente posterior para confirmar persistência real no Supabase
  const { data: verifiedRecord, error: verifyErr } = await supabase
    .from('subscription_customers')
    .select('*')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .single();

  console.log('[SUB_SAVE] Leitura de verificação imediata no Supabase:', {
    recordEncontrado: Boolean(verifiedRecord),
    notesNoBanco: verifiedRecord?.notes,
    verifyErr: verifyErr?.message || null,
  });

  const finalCustomer = mapSupabaseRowToSubscriptionCustomer(verifiedRecord || updated);
  console.log('[SUB_SAVE] Cliente normalizado final:', {
    id: finalCustomer.id,
    customer_name: finalCustomer.customer_name,
    plan_id: finalCustomer.plan_id,
    plan_name: finalCustomer.plan_name,
    price: finalCustomer.price,
    billing_cycle: finalCustomer.billing_cycle,
  });

  return finalCustomer;
}

/**
 * Exclui um assinante do Supabase PostgreSQL com isolamento estrito por tenant_id
 */
export async function deleteSubscriptionCustomerFromSupabase(
  tenantId: string,
  customerId: string
): Promise<void> {
  if (!isSupabaseConfigured || !tenantId || !customerId) {
    throw new Error('Parâmetros inválidos para exclusão de assinante.');
  }

  const { error } = await supabase
    .from('subscription_customers')
    .delete()
    .eq('id', customerId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.warn('[supabaseSubscriptionCustomers] Aviso no DELETE com anon key, acionando fallback Express:', error.message);
    await api.deleteSubscriptionCustomer(customerId);
    return;
  }
}
