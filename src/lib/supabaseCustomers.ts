import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { Customer } from '../types/index.js';

/**
 * Converte uma linha do Supabase (public.customers) para a interface Customer do frontend
 */
export function mapSupabaseRowToCustomer(row: any): Customer {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name || '',
    trade_name: row.trade_name || undefined,
    document: row.document || undefined,
    phone: row.phone || undefined,
    whatsapp: row.whatsapp || row.phone || undefined,
    email: row.email || undefined,
    address_street: row.street || undefined,
    address_number: row.number || undefined,
    address_neighborhood: row.neighborhood || undefined,
    address_city: row.city || undefined,
    address_state: row.state || undefined,
    notes: row.notes || undefined,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Converte dados de Customer do frontend para as colunas reais da tabela public.customers
 */
export function mapCustomerToSupabaseRow(customer: Partial<Customer>, tenantId: string): Record<string, any> {
  const row: Record<string, any> = {
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  };

  if (customer.id) row.id = customer.id;
  if (customer.name !== undefined) row.name = customer.name.trim();
  if (customer.trade_name !== undefined) row.trade_name = customer.trade_name ? customer.trade_name.trim() : null;
  if (customer.document !== undefined) row.document = customer.document ? customer.document.trim() : null;
  if (customer.phone !== undefined) row.phone = customer.phone ? customer.phone.trim() : null;
  if (customer.whatsapp !== undefined) row.whatsapp = customer.whatsapp ? customer.whatsapp.trim() : null;
  if (customer.email !== undefined) row.email = customer.email ? customer.email.trim().toLowerCase() : null;
  if (customer.address_street !== undefined) row.street = customer.address_street ? customer.address_street.trim() : null;
  if (customer.address_number !== undefined) row.number = customer.address_number ? customer.address_number.trim() : null;
  if (customer.address_neighborhood !== undefined) row.neighborhood = customer.address_neighborhood ? customer.address_neighborhood.trim() : null;
  if (customer.address_city !== undefined) row.city = customer.address_city ? customer.address_city.trim() : null;
  if (customer.address_state !== undefined) row.state = customer.address_state ? customer.address_state.trim().toUpperCase() : null;
  if (customer.notes !== undefined) row.notes = customer.notes ? customer.notes.trim() : null;

  return row;
}

/**
 * Consulta oficial no Supabase PostgreSQL de todos os clientes do tenant atual
 */
export async function loadCustomersFromSupabase(tenantId: string): Promise<Customer[]> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Falha ao consultar clientes no Supabase: ${error.message}`);
  }

  if (!Array.isArray(data)) return [];
  return data.map(mapSupabaseRowToCustomer);
}

/**
 * Cria um novo cliente diretamente no Supabase PostgreSQL com validação de tenant_id
 */
export async function createCustomerInSupabase(
  tenantId: string,
  data: Omit<Customer, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<Customer> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  if (!data.name || !data.name.trim()) {
    throw new Error('Nome do cliente é obrigatório.');
  }

  const customerId = data.id || `cust-${Date.now()}`;
  const now = new Date().toISOString();

  const payload: Record<string, any> = {
    id: customerId,
    tenant_id: tenantId,
    name: data.name.trim(),
    trade_name: data.trade_name ? data.trade_name.trim() : null,
    document: data.document ? data.document.trim() : null,
    phone: data.phone ? data.phone.trim() : data.whatsapp ? data.whatsapp.trim() : null,
    whatsapp: data.whatsapp ? data.whatsapp.trim() : null,
    email: data.email ? data.email.trim().toLowerCase() : null,
    street: data.address_street ? data.address_street.trim() : null,
    number: data.address_number ? data.address_number.trim() : null,
    neighborhood: data.address_neighborhood ? data.address_neighborhood.trim() : null,
    city: data.address_city ? data.address_city.trim() : null,
    state: data.address_state ? data.address_state.trim().toUpperCase() : null,
    notes: data.notes ? data.notes.trim() : null,
    created_at: now,
    updated_at: now,
  };

  const { data: created, error } = await supabase
    .from('customers')
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(`Não foi possível salvar o cliente no servidor: ${error.message}`);
  }

  return mapSupabaseRowToCustomer(created);
}

/**
 * Atualiza um cliente existente no Supabase PostgreSQL garantindo id AND tenant_id
 */
export async function updateCustomerInSupabase(
  tenantId: string,
  customerId: string,
  updates: Partial<Customer>
): Promise<Customer> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const payload = mapCustomerToSupabaseRow(updates, tenantId);
  delete payload.id; // Chave primária imutável
  delete payload.tenant_id; // Chave de segurança imutável

  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    throw new Error(`Não foi possível atualizar o cliente no servidor: ${error.message}`);
  }

  return mapSupabaseRowToCustomer(data);
}

/**
 * Exclui um cliente no Supabase PostgreSQL garantindo remoção definitiva
 */
export async function deleteCustomerFromSupabase(
  tenantId: string,
  customerId: string
): Promise<boolean> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase não está configurado.');
  }

  // 1. Remove cobranças vinculadas ao cliente para evitar violações de chave estrangeira
  try {
    await supabase.from('charges').delete().eq('customer_id', customerId);
  } catch {}

  // 2. Exclui o cliente pela chave primária (id)
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId);

  if (error) {
    throw new Error(`Não foi possível excluir o cliente do servidor: ${error.message}`);
  }

  return true;
}
