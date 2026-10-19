import { supabase, isSupabaseConfigured, validateSupabaseConfig } from './supabaseClient.js';
import { Tenant, Profile, AppModule, calculatePlanPrice, GlobalPlanPrices } from '../types/index.js';
import { api } from './api.js';

export interface SupabaseAuthResult {
  user: any;
  session: any | null;
  profile: Profile;
  tenant: Tenant;
}

/**
 * Cria uma nova conta no Supabase Auth, vinculando tenants.owner_user_id = user.id
 * e profiles.auth_user_id = user.id com profiles.tenant_id = tenants.id.
 * Como "Confirm email" está desativado, o usuário é autenticado imediatamente e entra direto.
 */
export async function signUpWithSupabase(params: {
  email: string;
  password: string;
  companyName: string;
  fullName: string;
  phone?: string;
  modules: AppModule[];
  planPrices?: GlobalPlanPrices;
}): Promise<SupabaseAuthResult> {
  const config = validateSupabaseConfig();
  if (!config.isConfigured) {
    throw new Error(config.errorMessage || 'Supabase não está configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPass = params.password.trim();
  const cleanCompany = params.companyName.trim();
  const cleanFullName = (params.fullName || cleanCompany).trim();
  const cleanPhone = (params.phone || '').trim();

  // 1. Verificação prévia contra e-mails repetidos (no Banco de Dados Supabase e Backend)
  if (isSupabaseConfigured) {
    try {
      const { data: profs } = await supabase.from('profiles').select('id, email').ilike('email', cleanEmail).limit(1);
      if (profs && profs.length > 0) {
        throw new Error('Já existe uma conta cadastrada com este e-mail. Por favor, acesse pela aba "Entrar" com sua senha.');
      }
      const { data: tens } = await supabase.from('tenants').select('id, email').ilike('email', cleanEmail).limit(1);
      if (tens && tens.length > 0) {
        throw new Error('Já existe uma conta cadastrada com este e-mail. Por favor, acesse pela aba "Entrar" com sua senha.');
      }
    } catch (checkErr: any) {
      if (checkErr?.message && checkErr.message.includes('Já existe uma conta')) {
        throw checkErr;
      }
    }
  }

  // 1.1 Verificação no backend local / API
  try {
    const resCheck = await fetch(`/api/auth/check-email?email=${encodeURIComponent(cleanEmail)}`);
    if (resCheck.ok) {
      const jsonCheck = await resCheck.json();
      if (jsonCheck?.exists) {
        throw new Error('Já existe uma conta cadastrada com este e-mail. Por favor, acesse pela aba "Entrar" com sua senha.');
      }
    }
  } catch (apiCheckErr: any) {
    if (apiCheckErr?.message && apiCheckErr.message.includes('Já existe uma conta')) {
      throw apiCheckErr;
    }
  }

  // 2. Criar o usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: cleanEmail,
    password: cleanPass,
    options: {
      data: {
        full_name: cleanFullName,
        phone: cleanPhone,
        company_name: cleanCompany,
      },
    },
  });

  if (authError) {
    throw new Error(authError.message || 'Erro ao criar conta no Supabase Auth.');
  }

  // Se o Supabase Auth retornar identities vazio, significa que o e-mail já existe no sistema de autenticação
  if (authData?.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
    throw new Error('Já existe uma conta cadastrada com este e-mail. Por favor, acesse pela aba "Entrar" com sua senha.');
  }

  const user = authData.user;
  if (!user || !user.id) {
    throw new Error('Supabase Auth não retornou os dados do usuário.');
  }

  // 2. Obter a sessão retornada imediatamente pelo Supabase (Confirm email = OFF)
  let session = authData.session;
  if (!session) {
    // Se a sessão não vier direto no payload de signUp, efetua signInWithPassword imediato
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass,
    });
    if (signInData?.session) {
      session = signInData.session;
    } else if (signInErr?.message?.toLowerCase().includes('email not confirmed')) {
      await supabase.auth.resend({ type: 'signup', email: cleanEmail }).catch(() => {});
      throw new Error(
        'Este e-mail foi cadastrado antes da desativação da confirmação no Supabase e ainda está pendente de confirmação. Reenviamos o link de ativação para sua caixa de entrada, ou confirme este usuário no painel do Supabase.'
      );
    }
  }

  const newTenantId = crypto.randomUUID();
  const now = new Date();
  const trialEnds = new Date(now.getTime() + 2 * 86400000);

  // 3. Registro em tenants com owner_user_id = user.id
  const tenantRecord: Tenant = {
    id: newTenantId,
    owner_user_id: user.id,
    name: cleanCompany,
    trade_name: cleanCompany,
    email: cleanEmail,
    phone: cleanPhone || undefined,
    whatsapp: cleanPhone || undefined,
    subscription_status: 'trial',
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
    subscription_expires_at: trialEnds.toISOString(),
    selected_modules: params.modules,
    plan_monthly_price: calculatePlanPrice(params.modules.length, params.planPrices),
    logo_url: '/multigestor.png',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // 4. Registro correspondente em profiles com auth_user_id = user.id e tenant_id = newTenantId
  const profileRecord: Profile = {
    id: crypto.randomUUID(),
    auth_user_id: user.id,
    tenant_id: newTenantId,
    email: cleanEmail,
    full_name: cleanFullName,
    phone: cleanPhone || undefined,
    role: 'owner',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // 5. Salva direto nas tabelas do Supabase Database sob a sessão autenticada
  try {
    const { error: tErr } = await supabase.from('tenants').insert({
      id: newTenantId,
      owner_user_id: user.id,
      name: cleanCompany,
      trade_name: cleanCompany,
      email: cleanEmail,
      phone: cleanPhone || undefined,
      subscription_status: 'trial',
      selected_modules: params.modules,
    });

    if (tErr) {
      console.warn('[Supabase] Aviso ao inserir tenant:', tErr.message);
    }

    const { error: pErr } = await supabase.from('profiles').insert({
      id: profileRecord.id,
      auth_user_id: user.id,
      tenant_id: newTenantId,
      email: cleanEmail,
      full_name: cleanFullName,
      phone: cleanPhone || undefined,
      role: 'owner',
    });

    if (pErr) {
      console.warn('[Supabase] Aviso ao inserir profile:', pErr.message);
    }
  } catch (dbErr: any) {
    console.warn('[Supabase] Erro ao sincronizar tabelas no banco:', dbErr);
  }

  // Sincroniza localmente com o backend para compatibilidade contínua dos módulos
  try {
    await api.updateTenant(newTenantId, tenantRecord);
  } catch (syncErr) {
    console.warn('[Supabase] Sincronização secundária local:', syncErr);
  }

  return {
    user,
    session,
    profile: profileRecord,
    tenant: tenantRecord,
  };
}

/**
 * Realiza login via Supabase Auth (signInWithPassword),
 * busca o profile por auth_user_id = user.id, obtém tenant_id e carrega o tenant.
 */
export async function signInWithSupabase(params: {
  email: string;
  password: string;
}): Promise<SupabaseAuthResult> {
  const config = validateSupabaseConfig();
  if (!config.isConfigured) {
    throw new Error(config.errorMessage || 'Supabase não está configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPass = params.password.trim();

  // 1. Login no Supabase Auth
  let authResult: any = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPass,
  });

  // Auto-recuperação transparente: se a conta foi registrada antes da desativação da confirmação,
  // aciona signUp com Confirm email = OFF para confirmar e gerar a sessão imediatamente
  if (authResult.error && authResult.error.message.toLowerCase().includes('email not confirmed')) {
    const retrySignUp = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPass,
    });

    if (retrySignUp.data?.session && retrySignUp.data?.user) {
      authResult = { data: retrySignUp.data, error: null };
    } else {
      const retrySignIn = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass,
      });
      if (retrySignIn.data?.session && retrySignIn.data?.user) {
        authResult = retrySignIn;
      }
    }
  }

  if (authResult.error) {
    const rawMsg = authResult.error.message || '';
    if (rawMsg.toLowerCase().includes('invalid login credentials')) {
      throw new Error('E-mail ou senha incorretos no Supabase Auth.');
    }
    throw new Error(rawMsg || 'Falha ao autenticar no Supabase Auth.');
  }

  const user = authResult.data?.user;
  const session = authResult.data?.session;
  if (!user || !user.id) {
    throw new Error('Não foi possível obter dados do usuário autenticado no Supabase.');
  }

  // 2. Localizar profile por auth_user_id = user.id
  let profileData: any = null;
  const { data: pFound, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (pFound) {
    profileData = pFound;
  } else {
    // Fallback: se o perfil existe pelo e-mail mas ainda não tinha auth_user_id vinculado
    const { data: pByEmail } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (pByEmail) {
      profileData = pByEmail;
      // Atualiza o auth_user_id para manter o relacionamento correto
      await supabase
        .from('profiles')
        .update({ auth_user_id: user.id })
        .eq('id', pByEmail.id);
    }
  }

  // 3. Se ainda não existir perfil nem tenant, criar sob a sessão autenticada
  let tenantId = profileData?.tenant_id;
  if (!profileData || !tenantId) {
    tenantId = crypto.randomUUID();
    const fullName = user.user_metadata?.full_name || cleanEmail.split('@')[0];
    const phone = user.user_metadata?.phone || '';

    // Insere tenant com owner_user_id = user.id
    await supabase.from('tenants').insert({
      id: tenantId,
      owner_user_id: user.id,
      name: `Empresa de ${fullName}`,
      trade_name: `Empresa de ${fullName}`,
      email: cleanEmail,
      phone: phone || undefined,
      subscription_status: 'trial',
      selected_modules: ['loans', 'iptv', 'business', 'subscriptions'],
    });

    // Insere profile com auth_user_id = user.id e tenant_id = tenantId
    const newProfile = {
      id: crypto.randomUUID(),
      auth_user_id: user.id,
      tenant_id: tenantId,
      email: cleanEmail,
      full_name: fullName,
      phone: phone || undefined,
      role: 'owner',
    };
    await supabase.from('profiles').insert(newProfile);
    profileData = newProfile;
  }

  // 4. Carregar o tenant correspondente a profiles.tenant_id
  let tenantData: any = null;
  const { data: tFound } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .maybeSingle();

  if (tFound) {
    tenantData = tFound;
  } else {
    // Se não encontrou no banco Supabase, tenta carregar localmente ou gerar fallback seguro
    const now = new Date();
    tenantData = {
      id: tenantId,
      owner_user_id: user.id,
      name: `Empresa de ${profileData.full_name || cleanEmail}`,
      email: cleanEmail,
      subscription_status: 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: new Date(now.getTime() + 2 * 86400000).toISOString(),
      subscription_expires_at: new Date(now.getTime() + 2 * 86400000).toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  // Normalização do objeto Profile
  const profile: Profile = {
    id: profileData.id || `prof-${Date.now()}`,
    auth_user_id: user.id,
    tenant_id: tenantId,
    email: cleanEmail,
    full_name: profileData.full_name || cleanEmail.split('@')[0],
    phone: profileData.phone || undefined,
    role: (profileData.role as any) || 'owner',
    created_at: profileData.created_at || new Date().toISOString(),
    updated_at: profileData.updated_at || new Date().toISOString(),
  };

  // Normalização do objeto Tenant
  const tenant: Tenant = {
    id: tenantData.id || tenantId,
    owner_user_id: user.id,
    name: tenantData.name || `Empresa de ${profile.full_name}`,
    trade_name: tenantData.trade_name || tenantData.name,
    email: tenantData.email || cleanEmail,
    phone: tenantData.phone,
    whatsapp: tenantData.whatsapp || tenantData.phone,
    subscription_status: tenantData.subscription_status || 'trial',
    trial_started_at: tenantData.trial_started_at || new Date().toISOString(),
    trial_ends_at: tenantData.trial_ends_at || new Date(Date.now() + 2 * 86400000).toISOString(),
    subscription_expires_at: tenantData.subscription_expires_at,
    selected_modules: tenantData.selected_modules || ['loans', 'iptv', 'business', 'subscriptions'],
    plan_monthly_price: Number(tenantData.plan_monthly_price) || 24.9,
    logo_url: tenantData.logo_url || '/multigestor.png',
    is_blocked: Boolean(tenantData.is_blocked),
    blocked_reason: tenantData.blocked_reason,
    created_at: tenantData.created_at || new Date().toISOString(),
    updated_at: tenantData.updated_at || new Date().toISOString(),
  };

  // Sincroniza localmente com o backend para manter os módulos funcionando
  try {
    const existing = await api.getTenant(tenant.id).catch(() => null);
    if (existing && (existing.subscription_status === 'active' || existing.subscription_status === 'lifetime')) {
      tenant.subscription_status = existing.subscription_status;
      tenant.subscription_expires_at = existing.subscription_expires_at;
      // Atualiza Supabase para manter alinhado
      await (supabase.from('tenants').update({
        subscription_status: existing.subscription_status,
        subscription_expires_at: existing.subscription_expires_at,
        updated_at: new Date().toISOString(),
      }).eq('id', tenant.id) as any).then(() => {}).catch(() => {});
    } else {
      await api.updateTenant(tenant.id, tenant);
    }
  } catch (syncErr) {
    console.warn('[Supabase] Sincronização com DataStore local:', syncErr);
  }

  return {
    user,
    session: session || authResult.data?.session,
    profile,
    tenant,
  };
}

/**
 * Obtém a sessão ativa oficial do Supabase Auth e carrega profile e tenant.
 */
export async function getCurrentSupabaseAuth(): Promise<SupabaseAuthResult | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData?.session) {
      return null;
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      return null;
    }

    // 1. Busca perfil por auth_user_id = user.id
    let profileData: any = null;
    const { data: pFound } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (pFound) {
      profileData = pFound;
    } else if (user.email) {
      const { data: pByEmail } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email.toLowerCase())
        .maybeSingle();
      if (pByEmail) {
        profileData = pByEmail;
      }
    }

    let tenantId = profileData?.tenant_id;
    if (!profileData || !tenantId) {
      tenantId = crypto.randomUUID();
      const cleanEmail = (user.email || '').toLowerCase();
      const fullName = user.user_metadata?.full_name || cleanEmail.split('@')[0] || 'Usuário';

      profileData = {
        id: crypto.randomUUID(),
        auth_user_id: user.id,
        tenant_id: tenantId,
        email: cleanEmail,
        full_name: fullName,
        role: 'owner',
      };
    }

    // 2. Busca tenant por profiles.tenant_id
    let tenantData: any = null;
    const { data: tFound } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle();

    if (tFound) {
      tenantData = tFound;
    } else {
      const now = new Date();
      tenantData = {
        id: tenantId,
        owner_user_id: user.id,
        name: `Empresa de ${profileData.full_name || user.email}`,
        email: user.email,
        subscription_status: 'trial',
        trial_started_at: now.toISOString(),
        trial_ends_at: new Date(now.getTime() + 2 * 86400000).toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
    }

    const profile: Profile = {
      id: profileData.id || `prof-${Date.now()}`,
      auth_user_id: user.id,
      tenant_id: tenantId,
      email: (user.email || profileData.email || '').toLowerCase(),
      full_name: profileData.full_name || user.email?.split('@')[0] || 'Usuário',
      phone: profileData.phone || undefined,
      role: (profileData.role as any) || 'owner',
      created_at: profileData.created_at || new Date().toISOString(),
      updated_at: profileData.updated_at || new Date().toISOString(),
    };

    const tenant: Tenant = {
      id: tenantData.id || tenantId,
      owner_user_id: user.id,
      name: tenantData.name || `Empresa de ${profile.full_name}`,
      trade_name: tenantData.trade_name || tenantData.name,
      email: tenantData.email || user.email,
      phone: tenantData.phone,
      whatsapp: tenantData.whatsapp || tenantData.phone,
      subscription_status: tenantData.subscription_status || 'trial',
      trial_started_at: tenantData.trial_started_at || new Date().toISOString(),
      trial_ends_at: tenantData.trial_ends_at || new Date(Date.now() + 2 * 86400000).toISOString(),
      subscription_expires_at: tenantData.subscription_expires_at,
      selected_modules: tenantData.selected_modules || ['loans', 'iptv', 'business', 'subscriptions'],
      plan_monthly_price: Number(tenantData.plan_monthly_price) || 24.9,
      logo_url: tenantData.logo_url || '/multigestor.png',
      is_blocked: Boolean(tenantData.is_blocked),
      blocked_reason: tenantData.blocked_reason,
      created_at: tenantData.created_at || new Date().toISOString(),
      updated_at: tenantData.updated_at || new Date().toISOString(),
    };

    // Sincroniza localmente com o backend
    try {
      const existing = await api.getTenant(tenant.id).catch(() => null);
      if (existing && (existing.subscription_status === 'active' || existing.subscription_status === 'lifetime')) {
        tenant.subscription_status = existing.subscription_status;
        tenant.subscription_expires_at = existing.subscription_expires_at;
        // Atualiza Supabase para manter alinhado
        await (supabase.from('tenants').update({
          subscription_status: existing.subscription_status,
          subscription_expires_at: existing.subscription_expires_at,
          updated_at: new Date().toISOString(),
        }).eq('id', tenant.id) as any).then(() => {}).catch(() => {});
      } else {
        await api.updateTenant(tenant.id, tenant);
      }
    } catch (e) {
      // silent
    }

    return {
      user,
      session: sessionData.session,
      profile,
      tenant,
    };
  } catch (err) {
    console.error('[Supabase Auth] Erro ao carregar sessão:', err);
    return null;
  }
}

/**
 * Encerra a sessão no Supabase Auth
 */
export async function signOutWithSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[Supabase Auth] Erro no signOut:', err);
  }
}

/**
 * Solicita recuperação de senha via Supabase Auth
 */
export async function resetPasswordWithSupabase(email: string): Promise<void> {
  const config = validateSupabaseConfig();
  if (!config.isConfigured) {
    throw new Error(config.errorMessage || 'Supabase não está configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  const cleanEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
  if (error) {
    throw new Error(error.message || 'Erro ao enviar e-mail de recuperação de senha.');
  }
}

/**
 * Reenvia o e-mail de confirmação (para contas legadas que foram criadas com confirmação ativa)
 */
export async function resendConfirmationEmail(email: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const cleanEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: cleanEmail,
  });
  if (error) {
    throw new Error(error.message || 'Erro ao reenviar e-mail de confirmação.');
  }
}

/**
 * Altera a senha do usuário atualmente autenticado no Supabase Auth
 */
export async function updatePasswordWithSupabase(newPassword: string): Promise<void> {
  const config = validateSupabaseConfig();
  if (!config.isConfigured) return;
  const { error } = await supabase.auth.updateUser({
    password: newPassword.trim(),
  });
  if (error) {
    throw new Error(error.message || 'Erro ao atualizar senha no Supabase Auth.');
  }
}
