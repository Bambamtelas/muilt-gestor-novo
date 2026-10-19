import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { IPTVSubscriber, IPTVPlan, IPTVApp } from '../types/index.js';

/**
 * Converte uma linha da tabela public.iptv_subscribers para a interface IPTVSubscriber
 */
export function mapSupabaseRowToIPTVSubscriber(row: any): IPTVSubscriber {
  let external_link: string | undefined = undefined;
  const notes = row.notes || '';
  if (notes.includes('[Link:')) {
    const match = notes.match(/\[Link:\s*([^\]]+)\]/);
    if (match && match[1]) external_link = match[1].trim();
  } else if (row.username && (row.username.startsWith('http://') || row.username.startsWith('https://'))) {
    external_link = row.username;
  }

  let expDate = new Date().toISOString().slice(0, 10);
  if (row.expires_at) {
    expDate = typeof row.expires_at === 'string'
      ? row.expires_at.slice(0, 10)
      : new Date(row.expires_at).toISOString().slice(0, 10);
  }

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_name: row.name || 'Assinante',
    whatsapp: row.whatsapp || '',
    server_name: row.server_name || 'Painel Gold Play 4K',
    username_or_mac: row.username || row.mac_address || external_link || '',
    password: row.password || undefined,
    plan_name: row.plan_name || 'Mensal (1 Tela)',
    app_name: row.app_name || 'IPTV Smarters Pro',
    screens: Number(row.screens_count || 1),
    price: Number(row.plan_price || 30.0),
    expiration_date: expDate,
    status: (row.status || 'active') as 'active' | 'expiring_soon' | 'expired' | 'trial',
    external_link,
    notes: row.notes || undefined,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Converte a interface IPTVSubscriber para as colunas reais da tabela public.iptv_subscribers
 */
export function mapIPTVSubscriberToSupabaseRow(
  sub: Partial<IPTVSubscriber>,
  tenantId: string
): Record<string, any> {
  const row: Record<string, any> = {
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  };

  if (sub.id) row.id = sub.id;
  if (sub.customer_name !== undefined) row.name = sub.customer_name.trim();
  if (sub.whatsapp !== undefined) row.whatsapp = sub.whatsapp.trim();
  if (sub.server_name !== undefined) row.server_name = sub.server_name.trim();
  if (sub.username_or_mac !== undefined) row.username = sub.username_or_mac.trim();
  if (sub.password !== undefined) row.password = sub.password ? sub.password.trim() : null;
  if (sub.app_name !== undefined) row.app_name = sub.app_name ? sub.app_name.trim() : null;
  if (sub.plan_name !== undefined) row.plan_name = sub.plan_name.trim();
  if (sub.price !== undefined) row.plan_price = Number(sub.price);
  if (sub.screens !== undefined) row.screens_count = Number(sub.screens);
  if (sub.expiration_date !== undefined) row.expires_at = sub.expiration_date;
  if (sub.status !== undefined) row.status = sub.status;

  if (sub.notes !== undefined || sub.external_link !== undefined) {
    let finalNotes = sub.notes ? sub.notes.trim() : '';
    if (sub.external_link && sub.external_link.trim()) {
      const linkClean = sub.external_link.trim();
      if (!finalNotes.includes(linkClean)) {
        finalNotes = finalNotes ? `${finalNotes} [Link: ${linkClean}]` : `[Link: ${linkClean}]`;
      }
    }
    row.notes = finalNotes || null;
  }

  return row;
}

/**
 * Consulta oficial de todos os assinantes IPTV pertencentes ao tenant
 */
export async function loadIPTVSubscribersFromSupabase(tenantId: string): Promise<IPTVSubscriber[]> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { data, error } = await supabase
    .from('iptv_subscribers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Falha ao consultar assinantes IPTV: ${error.message}`);
  }

  if (!Array.isArray(data)) return [];
  return data.map(mapSupabaseRowToIPTVSubscriber);
}

/**
 * Cria um novo assinante IPTV diretamente no Supabase PostgreSQL
 */
export async function createIPTVSubscriberInSupabase(
  tenantId: string,
  data: Omit<IPTVSubscriber, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<IPTVSubscriber> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  if (!data.customer_name || !data.customer_name.trim()) {
    throw new Error('Nome do assinante é obrigatório.');
  }

  const id = data.id || `iptv-${Date.now()}`;
  const now = new Date().toISOString();

  let finalNotes = data.notes ? data.notes.trim() : '';
  if (data.external_link && data.external_link.trim()) {
    const linkClean = data.external_link.trim();
    if (!finalNotes.includes(linkClean)) {
      finalNotes = finalNotes ? `${finalNotes} [Link: ${linkClean}]` : `[Link: ${linkClean}]`;
    }
  }

  const payload: Record<string, any> = {
    id,
    tenant_id: tenantId,
    name: data.customer_name.trim(),
    whatsapp: data.whatsapp ? data.whatsapp.trim() : null,
    server_name: data.server_name ? data.server_name.trim() : 'Painel Gold Play 4K',
    username: data.username_or_mac ? data.username_or_mac.trim() : data.external_link ? data.external_link.trim() : null,
    password: data.password ? data.password.trim() : null,
    app_name: data.app_name ? data.app_name.trim() : null,
    plan_name: data.plan_name ? data.plan_name.trim() : 'Mensal (1 Tela)',
    plan_price: Number(data.price || 30.0),
    screens_count: Number(data.screens || 1),
    expires_at: data.expiration_date,
    status: data.status || 'active',
    notes: finalNotes || null,
    created_at: now,
    updated_at: now,
  };

  const { data: created, error } = await supabase
    .from('iptv_subscribers')
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(`Não foi possível salvar o assinante IPTV no servidor: ${error.message}`);
  }

  return mapSupabaseRowToIPTVSubscriber(created);
}

/**
 * Atualiza um assinante IPTV no Supabase PostgreSQL garantindo id AND tenant_id
 */
export async function updateIPTVSubscriberInSupabase(
  tenantId: string,
  subscriberId: string,
  updates: Partial<IPTVSubscriber>
): Promise<IPTVSubscriber> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const payload = mapIPTVSubscriberToSupabaseRow(updates, tenantId);
  delete payload.id; // Chave primária imutável
  delete payload.tenant_id; // Chave de segurança imutável

  const { data, error } = await supabase
    .from('iptv_subscribers')
    .update(payload)
    .eq('id', subscriberId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    throw new Error(`Não foi possível atualizar o assinante IPTV no servidor: ${error.message}`);
  }

  return mapSupabaseRowToIPTVSubscriber(data);
}

/**
 * Renova a assinatura IPTV de um assinante no Supabase PostgreSQL por X dias
 */
export async function renewIPTVSubscriberInSupabase(
  tenantId: string,
  subscriberId: string,
  days = 30
): Promise<{ updatedSubscriber: IPTVSubscriber; oldExpiration: string; newExpiration: string }> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  // 1. Obtém assinante atual do Supabase
  const { data: current, error: getErr } = await supabase
    .from('iptv_subscribers')
    .select('*')
    .eq('id', subscriberId)
    .eq('tenant_id', tenantId)
    .single();

  if (getErr || !current) {
    throw new Error('Assinante não encontrado para renovação.');
  }

  const oldExpiration = current.expires_at
    ? String(current.expires_at).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const today = new Date();
  const currentExp = new Date(oldExpiration + 'T12:00:00');
  const base = currentExp.getTime() > today.getTime() ? currentExp : today;
  const newExpiration = new Date(base.getTime() + days * 86400000).toISOString().slice(0, 10);

  // 2. Grava a nova data de vencimento e ativação no banco
  const { data: updated, error: updErr } = await supabase
    .from('iptv_subscribers')
    .update({
      expires_at: newExpiration,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriberId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (updErr || !updated) {
    throw new Error(`Falha ao registrar renovação no servidor: ${updErr?.message}`);
  }

  return {
    updatedSubscriber: mapSupabaseRowToIPTVSubscriber(updated),
    oldExpiration,
    newExpiration,
  };
}

/**
 * Exclui um assinante IPTV no Supabase PostgreSQL garantindo id AND tenant_id
 */
export async function deleteIPTVSubscriberFromSupabase(
  tenantId: string,
  subscriberId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { error } = await supabase
    .from('iptv_subscribers')
    .delete()
    .eq('id', subscriberId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Não foi possível excluir o assinante IPTV do servidor: ${error.message}`);
  }

  return true;
}

/**
 * Extrai de forma inteligente o nome do Servidor / Painel de um plano cadastrado
 */
export function extractServerNameFromPlan(plan: { name: string; server_name?: string; description?: string }): string {
  // 1. Se o plano já tem server_name explícito e não é o placeholder padrão genérico
  if (plan.server_name && plan.server_name.trim() && plan.server_name.trim() !== 'Painel Gold Play 4K') {
    return plan.server_name.trim();
  }

  // 2. Extrai de Painel: ou Servidor: dentro da descrição se houver
  const desc = plan.description || '';
  if (desc.includes('Painel:')) {
    const m = desc.match(/Painel:\s*([^|]+)/i);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  if (desc.includes('Servidor:')) {
    const m = desc.match(/Servidor:\s*([^|]+)/i);
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }

  // 3. Se a descrição for diretamente o nome do painel
  if (desc.toLowerCase().startsWith('painel ') && desc.length < 50) {
    return desc.trim();
  }

  // 4. Extrai do nome do plano (ex: "P2 Imperial", "Blinder", "iptv gold", "Iptv Triplo X")
  const rawName = plan.name || '';
  const clean = rawName
    .replace(/\b(plano|iptv|mensal|trimestral|semestral|anual|teste|gratis|grátis|vip|\d+\s*tela[s]?|\d+\s*m[eê]s(es)?)\b/gi, '')
    .trim();

  if (clean.length >= 2) {
    return clean;
  }

  if (plan.server_name && plan.server_name.trim()) {
    return plan.server_name.trim();
  }

  return rawName.trim() || 'Painel Principal';
}

/**
 * Consulta planos IPTV cadastrados no Supabase
 */
export async function loadIPTVPlansFromSupabase(tenantId: string): Promise<IPTVPlan[]> {
  if (!isSupabaseConfigured || !tenantId) return [];

  const { data, error } = await supabase
    .from('iptv_plans')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('price', { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return data.map((p) => {
    let server_name = '';
    let desc = p.description || '';
    if (desc.includes('Painel:')) {
      const m = desc.match(/Painel:\s*([^|]+)/);
      if (m && m[1]) server_name = m[1].trim();
      desc = desc.replace(/Painel:\s*[^|]+/, '').replace(/^\|\s*/, '').trim();
    } else if (desc.toLowerCase().startsWith('painel')) {
      server_name = desc;
    }

    if (!server_name) {
      server_name = extractServerNameFromPlan({ name: p.name, description: desc });
    }

    return {
      id: p.id,
      tenant_id: p.tenant_id,
      name: p.name,
      screens: Number(p.screens || 1),
      duration_days: Number(p.duration_days || 30),
      price: Number(p.price || 0),
      server_name,
      description: desc || undefined,
      created_at: p.created_at || new Date().toISOString(),
    };
  });
}

/**
 * Cria um novo plano IPTV diretamente no Supabase PostgreSQL
 */
export async function createIPTVPlanInSupabase(
  tenantId: string,
  plan: Omit<IPTVPlan, 'id' | 'created_at'> & { id?: string }
): Promise<IPTVPlan> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const id = plan.id || `plan-${Date.now()}`;
  const now = new Date().toISOString();
  let desc = plan.description ? plan.description.trim() : '';
  if (plan.server_name && plan.server_name.trim()) {
    desc = desc ? `Painel: ${plan.server_name.trim()} | ${desc}` : `Painel: ${plan.server_name.trim()}`;
  }

  const payload = {
    id,
    tenant_id: tenantId,
    name: plan.name.trim(),
    screens: Number(plan.screens || 1),
    duration_days: Number(plan.duration_days || 30),
    price: Number(plan.price || 0),
    description: desc || null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('iptv_plans')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    throw new Error(`Falha ao salvar plano IPTV no servidor: ${error.message}`);
  }

  return {
    id: data.id,
    tenant_id: data.tenant_id,
    name: data.name,
    screens: Number(data.screens || 1),
    duration_days: Number(data.duration_days || 30),
    price: Number(data.price || 0),
    server_name: plan.server_name || 'Painel Gold Play 4K',
    description: plan.description,
    created_at: data.created_at,
  };
}

/**
 * Atualiza um plano IPTV no Supabase PostgreSQL
 */
export async function updateIPTVPlanInSupabase(
  tenantId: string,
  planId: string,
  updates: Partial<IPTVPlan>
): Promise<IPTVPlan> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const now = new Date().toISOString();
  const payload: Record<string, any> = {
    updated_at: now,
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

  const { data, error } = await supabase
    .from('iptv_plans')
    .update(payload)
    .eq('id', planId)
    .eq('tenant_id', tenantId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Falha ao atualizar plano IPTV no servidor: ${error.message}`);
  }

  return {
    id: data.id,
    tenant_id: data.tenant_id,
    name: data.name,
    screens: Number(data.screens || 1),
    duration_days: Number(data.duration_days || 30),
    price: Number(data.price || 0),
    server_name: updates.server_name || 'Painel Gold Play 4K',
    description: updates.description,
    created_at: data.created_at,
  };
}

/**
 * Exclui um plano IPTV no Supabase PostgreSQL
 */
export async function deleteIPTVPlanInSupabase(
  tenantId: string,
  planId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { error } = await supabase
    .from('iptv_plans')
    .delete()
    .eq('id', planId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Falha ao excluir plano IPTV do servidor: ${error.message}`);
  }

  return true;
}

/**
 * Consulta aplicativos IPTV cadastrados no Supabase
 */
export async function loadIPTVAppsFromSupabase(tenantId: string): Promise<IPTVApp[]> {
  if (!isSupabaseConfigured || !tenantId) return [];

  const { data, error } = await supabase
    .from('iptv_apps')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return data.map((a) => {
    let activation_type: any = 'login_password';
    let dns_server: string | undefined = undefined;
    let instructions: string | undefined = undefined;

    const rawAct = a.activation_instructions || '';
    if (rawAct.includes('m3u_link')) activation_type = 'm3u_link';
    else if (rawAct.includes('mac_device_key')) activation_type = 'mac_device_key';
    else if (rawAct.includes('login_password')) activation_type = 'login_password';

    if (rawAct.includes('DNS:')) {
      const dnsMatch = rawAct.match(/DNS:\s*([^\s|]+)/);
      if (dnsMatch && dnsMatch[1]) dns_server = dnsMatch[1].trim();
    }

    const cleanInst = rawAct
      .replace(/(login_password|mac_device_key|m3u_link)/g, '')
      .replace(/DNS:\s*[^\s|]+/g, '')
      .replace(/\|/g, '')
      .trim();
    if (cleanInst) instructions = cleanInst;

    return {
      id: a.id,
      tenant_id: a.tenant_id,
      name: a.name,
      category: (a.platform || a.category || 'smart_tv') as any,
      download_url: a.download_url || undefined,
      dns_server,
      activation_type,
      instructions,
      created_at: a.created_at || new Date().toISOString(),
    };
  });
}

/**
 * Cria um novo aplicativo IPTV diretamente no Supabase PostgreSQL
 */
export async function createIPTVAppInSupabase(
  tenantId: string,
  app: Omit<IPTVApp, 'id' | 'created_at'> & { id?: string }
): Promise<IPTVApp> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const id = app.id || `app-${Date.now()}`;
  const now = new Date().toISOString();

  let actInstructions: string = app.activation_type || 'login_password';
  if (app.dns_server && app.dns_server.trim()) {
    actInstructions = `${actInstructions} | DNS: ${app.dns_server.trim()}`;
  }
  if (app.instructions && app.instructions.trim()) {
    actInstructions = `${actInstructions} | ${app.instructions.trim()}`;
  }

  const payload = {
    id,
    tenant_id: tenantId,
    name: app.name.trim(),
    platform: app.category || 'smart_tv',
    download_url: app.download_url ? app.download_url.trim() : null,
    activation_instructions: actInstructions,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('iptv_apps')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    throw new Error(`Falha ao salvar aplicativo IPTV no servidor: ${error.message}`);
  }

  return {
    id: data.id,
    tenant_id: data.tenant_id,
    name: data.name,
    category: app.category,
    download_url: app.download_url,
    dns_server: app.dns_server,
    activation_type: app.activation_type,
    instructions: app.instructions,
    created_at: data.created_at,
  };
}

/**
 * Atualiza um aplicativo IPTV no Supabase PostgreSQL
 */
export async function updateIPTVAppInSupabase(
  tenantId: string,
  appId: string,
  updates: Partial<IPTVApp>
): Promise<IPTVApp> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const now = new Date().toISOString();
  const payload: Record<string, any> = {
    updated_at: now,
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

  const { data, error } = await supabase
    .from('iptv_apps')
    .update(payload)
    .eq('id', appId)
    .eq('tenant_id', tenantId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Falha ao atualizar aplicativo IPTV no servidor: ${error.message}`);
  }

  return {
    id: data.id,
    tenant_id: data.tenant_id,
    name: data.name,
    category: (data.platform || updates.category || 'smart_tv') as any,
    download_url: data.download_url,
    dns_server: updates.dns_server,
    activation_type: updates.activation_type || 'login_password',
    instructions: updates.instructions,
    created_at: data.created_at,
  };
}

/**
 * Exclui um aplicativo IPTV no Supabase PostgreSQL
 */
export async function deleteIPTVAppInSupabase(
  tenantId: string,
  appId: string
): Promise<boolean> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { error } = await supabase
    .from('iptv_apps')
    .delete()
    .eq('id', appId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Falha ao excluir aplicativo IPTV do servidor: ${error.message}`);
  }

  return true;
}
