import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { Product } from '../types/index.js';

/**
 * Converte uma linha do Supabase (public.products) para a interface Product do frontend
 */
export function mapSupabaseRowToProduct(row: any): Product {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name || '',
    description: row.description || undefined,
    price: Number(row.price || 0),
    category: row.category || 'Geral',
    stock_quantity: row.stock_quantity !== undefined && row.stock_quantity !== null ? Number(row.stock_quantity) : 0,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Converte dados de Product do frontend para as colunas reais da tabela public.products
 */
export function mapProductToSupabaseRow(product: Partial<Product>, tenantId: string): Record<string, any> {
  const row: Record<string, any> = {
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  };

  if (product.id) row.id = product.id;
  if (product.name !== undefined) row.name = product.name.trim();
  if (product.description !== undefined) row.description = product.description ? product.description.trim() : null;
  if (product.price !== undefined) row.price = Number(product.price) || 0;
  if (product.category !== undefined) row.category = product.category ? product.category.trim() : 'Geral';
  if (product.stock_quantity !== undefined) row.stock_quantity = Number(product.stock_quantity) || 0;

  return row;
}

/**
 * Consulta oficial no Supabase PostgreSQL de todos os produtos do tenant atual
 */
export async function loadProductsFromSupabase(tenantId: string): Promise<Product[]> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[supabaseProducts] Erro ao carregar produtos:', error);
    throw error;
  }

  if (!Array.isArray(data)) return [];
  return data.map(mapSupabaseRowToProduct);
}

/**
 * Cria um novo produto diretamente no Supabase PostgreSQL com validação de tenant_id
 */
export async function createProductInSupabase(
  tenantId: string,
  data: Omit<Product, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<Product> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  if (!data.name || !data.name.trim()) {
    throw new Error('Nome do item é obrigatório.');
  }

  const productId = data.id || `prod-${Date.now()}`;
  const now = new Date().toISOString();
  const numPrice = Number(data.price || 0);

  const payload: Record<string, any> = {
    id: productId,
    tenant_id: tenantId,
    name: data.name.trim(),
    description: data.description ? data.description.trim() : null,
    price: isNaN(numPrice) ? 0 : numPrice,
    category: data.category ? data.category.trim() : 'Geral',
    stock_quantity: data.stock_quantity !== undefined ? Number(data.stock_quantity) : 0,
    created_at: now,
    updated_at: now,
  };

  const { data: created, error } = await supabase
    .from('products')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('[supabaseProducts] Erro ao inserir produto:', error);
    throw error;
  }

  return mapSupabaseRowToProduct(created);
}

/**
 * Atualiza um produto existente no Supabase PostgreSQL com isolamento estrito por tenant_id
 */
export async function updateProductInSupabase(
  tenantId: string,
  productId: string,
  updates: Partial<Product>
): Promise<Product> {
  if (!isSupabaseConfigured || !tenantId || !productId) {
    throw new Error('Parâmetros inválidos para atualização de produto.');
  }

  const row = mapProductToSupabaseRow(updates, tenantId);
  delete row.id;
  delete row.tenant_id;
  delete row.created_at;

  const { data: updated, error } = await supabase
    .from('products')
    .update(row)
    .eq('id', productId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    console.error('[supabaseProducts] Erro ao atualizar produto:', error);
    throw error;
  }

  return mapSupabaseRowToProduct(updated);
}

/**
 * Exclui um produto do Supabase PostgreSQL com isolamento estrito por tenant_id
 */
export async function deleteProductFromSupabase(
  tenantId: string,
  productId: string
): Promise<void> {
  if (!isSupabaseConfigured || !tenantId || !productId) {
    throw new Error('Parâmetros inválidos para exclusão de produto.');
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[supabaseProducts] Erro ao excluir produto:', error);
    throw error;
  }
}
