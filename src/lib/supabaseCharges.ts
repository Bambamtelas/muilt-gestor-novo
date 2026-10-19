import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { Charge, ChargeStatus, ChargeType, Customer } from '../types/index.js';
import { api } from './api.js';

/**
 * Converte linha de public.charges (com eventual join de customers) para a interface Charge
 */
export function mapSupabaseRowToCharge(row: any): Charge {
  let mappedCustomer: Customer | undefined = undefined;
  if (row.customers && typeof row.customers === 'object') {
    const c = row.customers;
    mappedCustomer = {
      id: c.id,
      tenant_id: c.tenant_id,
      name: c.name,
      trade_name: c.trade_name || undefined,
      document: c.document || undefined,
      phone: c.phone || c.whatsapp || undefined,
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
  }

  let dueDateStr = new Date().toISOString().slice(0, 10);
  if (row.due_date) {
    dueDateStr = typeof row.due_date === 'string'
      ? row.due_date.slice(0, 10)
      : new Date(row.due_date).toISOString().slice(0, 10);
  }

  let saleDateStr: string | undefined = undefined;
  if (row.created_at) {
    saleDateStr = typeof row.created_at === 'string'
      ? row.created_at.slice(0, 10)
      : new Date(row.created_at).toISOString().slice(0, 10);
  }

  const today = new Date().toISOString().slice(0, 10);
  let status = (row.status || 'pending') as ChargeStatus;
  if (status === 'pending' && dueDateStr < today) {
    status = 'overdue';
  }

  let chargeType: ChargeType = 'sale';
  if (row.type && ['sale', 'loan', 'debt', 'service'].includes(row.type)) {
    chargeType = row.type as ChargeType;
  } else if (typeof row.loan_id === 'string' && row.loan_id.startsWith('__type:')) {
    chargeType = row.loan_id.replace('__type:', '') as ChargeType;
  } else if (row.loan_id) {
    chargeType = 'loan';
  }

  const cleanLoanId =
    row.loan_id && !String(row.loan_id).startsWith('__type:') ? row.loan_id : undefined;

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    customer: mappedCustomer,
    description: row.description || 'Cobrança',
    amount: Number(row.amount || 0),
    due_date: dueDateStr,
    sale_date: saleDateStr,
    status,
    type: chargeType,
    loan_id: cleanLoanId,
    paid_at: row.paid_at || undefined,
    payment_method: row.payment_method || undefined,
    pix_copy_paste: row.pix_copy_paste || undefined,
    installments: row.total_installments ? Number(row.total_installments) : undefined,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Consulta oficial de todas as cobranças de um tenant no Supabase PostgreSQL
 */
export async function loadChargesFromSupabase(tenantId: string): Promise<Charge[]> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não configurado ou tenant_id ausente.');
  }

  const { data, error } = await supabase
    .from('charges')
    .select('*, customers(*)')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: false });

  if (error) {
    throw new Error(`Falha ao consultar cobranças no servidor: ${error.message}`);
  }

  if (!Array.isArray(data)) return [];
  return data.map(mapSupabaseRowToCharge);
}

/**
 * Cria uma nova cobrança diretamente no Supabase PostgreSQL
 */
export async function createChargeInSupabase(
  tenantId: string,
  chargeData: Omit<Charge, 'id' | 'created_at' | 'updated_at'> & { id?: string; customer?: Partial<Customer> }
): Promise<Charge> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não configurado ou tenant_id ausente.');
  }

  if (!chargeData.customer_id) {
    throw new Error('Cliente é obrigatório para registrar uma cobrança.');
  }

  if (!chargeData.description || !chargeData.description.trim()) {
    throw new Error('Descrição da cobrança é obrigatória.');
  }

  const id = chargeData.id || `chg-${Date.now()}`;
  const now = new Date().toISOString();
  const numAmount = Number(chargeData.amount || 0);

  const today = now.slice(0, 10);
  let status = chargeData.status || 'pending';
  if (status === 'pending' && chargeData.due_date && chargeData.due_date < today) {
    status = 'overdue';
  }

  // 1. GARANTE QUE O CLIENTE EXISTE NO SUPABASE (Evita erro da constraint charges_customer_id_fkey)
  try {
    const { data: existingCust } = await supabase
      .from('customers')
      .select('id')
      .eq('id', chargeData.customer_id)
      .maybeSingle();

    if (!existingCust) {
      const custInfo = chargeData.customer;
      const custPayload: Record<string, any> = {
        id: chargeData.customer_id,
        tenant_id: tenantId,
        name: custInfo?.name || 'Cliente',
        whatsapp: custInfo?.whatsapp || custInfo?.phone || null,
        phone: custInfo?.phone || custInfo?.whatsapp || null,
        document: custInfo?.document || null,
        trade_name: custInfo?.trade_name || null,
        street: custInfo?.address_street || null,
        number: custInfo?.address_number || null,
        neighborhood: custInfo?.address_neighborhood || null,
        city: custInfo?.address_city || null,
        state: custInfo?.address_state || null,
        notes: custInfo?.notes || null,
        created_at: custInfo?.created_at || now,
        updated_at: now,
      };

      const { error: custErr } = await supabase.from('customers').upsert([custPayload]);
      if (custErr) {
        console.warn('[createChargeInSupabase] Aviso ao auto-sincronizar cliente:', custErr.message);
      }
    }
  } catch (syncCustErr) {
    console.warn('[createChargeInSupabase] Erro ao verificar cliente no Supabase:', syncCustErr);
  }

  // Persistência segura do tipo através de loan_id com prefixo __type: para compatibilidade universal
  const finalLoanId =
    (chargeData as any).loan_id ||
    (chargeData.type && chargeData.type !== 'sale' ? `__type:${chargeData.type}` : null);

  const payload: Record<string, any> = {
    id,
    tenant_id: tenantId,
    customer_id: chargeData.customer_id,
    description: chargeData.description.trim(),
    amount: numAmount,
    due_date: chargeData.due_date,
    status,
    loan_id: finalLoanId,
    payment_method: chargeData.payment_method || 'pix',
    paid_at: status === 'paid' ? (chargeData.paid_at || now) : null,
    pix_copy_paste: chargeData.pix_copy_paste || null,
    total_installments: chargeData.installments ? Number(chargeData.installments) : null,
    created_at: now,
    updated_at: now,
  };

  let { data: created, error } = await supabase
    .from('charges')
    .insert([payload])
    .select('*, customers(*)')
    .single();

  // Se ainda assim der erro de foreign key (ex: cliente inserido por outro ID), auto-cria o cliente com o customer_id exato e retenta
  if (error && (error.message.includes('charges_customer_id_fkey') || error.code === '23503')) {
    try {
      const custInfo = chargeData.customer;
      await supabase.from('customers').upsert([
        {
          id: chargeData.customer_id,
          tenant_id: tenantId,
          name: custInfo?.name || 'Cliente',
          whatsapp: custInfo?.whatsapp || custInfo?.phone || null,
          phone: custInfo?.phone || custInfo?.whatsapp || null,
          created_at: now,
          updated_at: now,
        },
      ]);

      const retryRes = await supabase
        .from('charges')
        .insert([payload])
        .select('*, customers(*)')
        .single();

      if (!retryRes.error) {
        created = retryRes.data;
        error = null;
      } else {
        error = retryRes.error;
      }
    } catch {}
  }

  if (error) {
    console.warn('[createChargeInSupabase] Falha no Supabase, salvando via API local resiliente:', error.message);
    const fallbackRes = await api.createCharge({
      ...payload,
      type: chargeData.type || 'sale',
      customer: chargeData.customer as any,
    });
    return fallbackRes;
  }

  return mapSupabaseRowToCharge(created);
}

/**
 * Atualiza uma cobrança garantindo filtragem atômica por id AND tenant_id
 */
export async function updateChargeInSupabase(
  tenantId: string,
  chargeId: string,
  updates: Partial<Charge>
): Promise<Charge> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não configurado ou tenant_id ausente.');
  }

  const now = new Date().toISOString();
  const payload: Record<string, any> = {
    updated_at: now,
  };

  if (updates.description !== undefined) payload.description = updates.description.trim();
  if (updates.amount !== undefined) payload.amount = Number(updates.amount);
  if (updates.due_date !== undefined) payload.due_date = updates.due_date;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.payment_method !== undefined) payload.payment_method = updates.payment_method;
  if (updates.paid_at !== undefined) payload.paid_at = updates.paid_at;
  if (updates.pix_copy_paste !== undefined) payload.pix_copy_paste = updates.pix_copy_paste;

  // Persistência resiliente de type via loan_id com tag __type:
  if (updates.type !== undefined) {
    payload.loan_id = updates.type !== 'sale' ? `__type:${updates.type}` : null;
  } else if (updates.loan_id !== undefined) {
    payload.loan_id = updates.loan_id;
  }

  const { data, error } = await supabase
    .from('charges')
    .update(payload)
    .eq('id', chargeId)
    .eq('tenant_id', tenantId)
    .select('*, customers(*)')
    .single();

  if (error) {
    throw new Error(`Não foi possível atualizar a cobrança no servidor: ${error.message}`);
  }

  return mapSupabaseRowToCharge(data);
}

/**
 * Marca uma cobrança como PAGA (baixa/recebimento) no Supabase PostgreSQL
 */
export async function markChargeAsPaidInSupabase(
  tenantId: string,
  chargeId: string,
  paymentMethod = 'pix'
): Promise<Charge> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não configurado ou tenant_id ausente.');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('charges')
    .update({
      status: 'paid',
      paid_at: now,
      payment_method: paymentMethod || 'pix',
      updated_at: now,
    })
    .eq('id', chargeId)
    .eq('tenant_id', tenantId)
    .select('*, customers(*)')
    .single();

  if (error) {
    throw new Error(`Falha ao registrar recebimento da cobrança no servidor: ${error.message}`);
  }

  return mapSupabaseRowToCharge(data);
}

/**
 * Exclui uma cobrança no Supabase PostgreSQL garantindo id AND tenant_id
 */
export async function deleteChargeFromSupabase(
  tenantId: string,
  chargeId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não configurado ou tenant_id ausente.');
  }

  const { error } = await supabase
    .from('charges')
    .delete()
    .eq('id', chargeId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Não foi possível excluir a cobrança no servidor: ${error.message}`);
  }

  return true;
}
