import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  HandCoins,
  Building2,
  Users,
  Tv,
  Menu,
  LogOut,
  Layers,
  Smartphone,
  FileText,
  Package,
  ShoppingBag,
} from 'lucide-react';
import { Sidebar } from './components/Sidebar.js';
import { TopNav } from './components/TopNav.js';
import { NavigationTab } from './components/Header.js';
import { DashboardView } from './components/DashboardView.js';
import { ChargesView } from './components/ChargesView.js';
import { CustomersView } from './components/CustomersView.js';
import { ProductsView } from './components/ProductsView.js';
import { ReportsView } from './components/ReportsView.js';
import { SettingsView } from './components/SettingsView.js';
import { MasterAdminView } from './components/MasterAdminView.js';
import { IPTVView } from './components/IPTVView.js';
import { IPTVCustomersView } from './components/IPTVCustomersView.js';
import { IPTVPlansView } from './components/IPTVPlansView.js';
import { IPTVAppsView } from './components/IPTVAppsView.js';
import { SubscriptionsView } from './components/SubscriptionsView.js';
import { BusinessesView } from './components/BusinessesView.js';
import { LoansView } from './components/LoansView.js';
import { SubscriptionModal } from './components/SubscriptionModal.js';
import { WhatsAppModal } from './components/WhatsAppModal.js';
import { NewChargeModal } from './components/NewChargeModal.js';
import { NewCustomerModal } from './components/NewCustomerModal.js';
import { MasterAdminAuthModal } from './components/MasterAdminAuthModal.js';
import { SubscriptionExpiredBlocker } from './components/SubscriptionExpiredBlocker.js';
import { AdminBlockedScreen } from './components/AdminBlockedScreen.js';
import { AuthView } from './components/AuthView.js';
import { SubscriptionExpiringAlertModal } from './components/SubscriptionExpiringAlertModal.js';
import { AddModuleModal } from './components/AddModuleModal.js';
import { isSupabaseConfigured } from './lib/supabaseClient.js';
import { loadCustomersFromSupabase, deleteCustomerFromSupabase } from './lib/supabaseCustomers.js';
import {
  loadChargesFromSupabase,
  markChargeAsPaidInSupabase,
  deleteChargeFromSupabase,
  mapSupabaseRowToCharge,
} from './lib/supabaseCharges.js';
import { loadProductsFromSupabase } from './lib/supabaseProducts.js';
import { useSupabaseRealtime } from './hooks/useSupabaseRealtime.js';
import { supabase } from './lib/supabaseClient.js';
import { getCurrentSupabaseAuth, signOutWithSupabase } from './lib/supabaseAuth.js';

import { api } from './lib/api.js';
import { Tenant, Profile, Customer, Charge, Product, SystemStats, calculatePlanPrice } from './types/index.js';

export default function App() {
  const [currentEmail, setCurrentEmail] = useState<string>(() => {
    return localStorage.getItem('multigestor_active_email') || '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => {
    try {
      const saved = sessionStorage.getItem('multigestor_active_tab');
      if (saved && saved !== 'master_admin') return saved as NavigationTab;
    } catch {}
    return 'dashboard';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (currentTab && currentTab !== 'master_admin') {
      try {
        sessionStorage.setItem('multigestor_active_tab', currentTab);
      } catch {}
    }
  }, [currentTab]);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isNewChargeModalOpen, setIsNewChargeModalOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [isMasterAuthModalOpen, setIsMasterAuthModalOpen] = useState(false);
  const [isMasterAuthenticated, setIsMasterAuthenticated] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Alerta Preventivo de Expiração (<= 3 Dias)
  const [isExpiringAlertModalOpen, setIsExpiringAlertModalOpen] = useState(false);

  // Expansão e Adição de Módulos
  const [isAddModuleModalOpen, setIsAddModuleModalOpen] = useState(false);

  // Active selections for modals
  const [selectedChargeForWhatsApp, setSelectedChargeForWhatsApp] = useState<Charge | null>(null);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | undefined>(undefined);
  const [preselectedProduct, setPreselectedProduct] = useState<Product | undefined>(undefined);

  const isMasterAdminAccount = Boolean(
    profile?.email?.toLowerCase().trim() === 'betaof10@hotmail.com' ||
    tenant?.email?.toLowerCase().trim() === 'betaof10@hotmail.com'
  );

  const DEFAULT_STATS: SystemStats = {
    totalCustomers: 0,
    totalCharges: 0,
    totalProducts: 0,
    totalPendingAmount: 0,
    totalPaidAmount: 0,
    totalOverdueAmount: 0,
    paidThisMonth: 0,
    activeTenants: 1,
    mpConnected: false,
    supabaseConnected: true,
  };

  // Carrega dados dos módulos para o tenant autenticado
  const loadTenantData = useCallback(async (tenantId: string) => {
    try {
      const statsPromise = api.getStats(tenantId).catch(() => DEFAULT_STATS);
      const customersPromise = isSupabaseConfigured
        ? loadCustomersFromSupabase(tenantId).catch(async () => api.getCustomers(tenantId).catch(() => []))
        : api.getCustomers(tenantId).catch(() => []);

      const chargesPromise = isSupabaseConfigured
        ? loadChargesFromSupabase(tenantId).catch(async () => api.getCharges(tenantId).catch(() => []))
        : api.getCharges(tenantId).catch(() => []);

      const productsPromise = isSupabaseConfigured
        ? loadProductsFromSupabase(tenantId).catch(async () => api.getProducts(tenantId).catch(() => []))
        : api.getProducts(tenantId).catch(() => []);

      const [statsData, chargesData, customersData, productsData] = await Promise.all([
        statsPromise,
        chargesPromise,
        customersPromise,
        productsPromise,
      ]);
      setStats(statsData || DEFAULT_STATS);
      if (Array.isArray(chargesData)) {
        setCharges(chargesData);
        try {
          localStorage.setItem(`charges_${tenantId}`, JSON.stringify(chargesData));
        } catch {}
      }
      if (Array.isArray(customersData)) {
        setCustomers(customersData);
        try {
          localStorage.setItem(`customers_${tenantId}`, JSON.stringify(customersData));
        } catch {}
      }
      if (Array.isArray(productsData)) {
        setProducts(productsData);
        try {
          localStorage.setItem(`products_${tenantId}`, JSON.stringify(productsData));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load tenant data', err);
      setStats(DEFAULT_STATS);
    }
  }, []);

  // Inicialização e Monitoramento Oficial da Sessão via Supabase Auth
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      setLoading(true);
      try {
        const authData = await getCurrentSupabaseAuth();
        if (isMounted) {
          if (authData && authData.session && authData.user) {
            setTenant(authData.tenant);
            setProfile(authData.profile);
            setCurrentEmail(authData.user.email || authData.profile.email);
            setIsAuthenticated(true);
            localStorage.setItem('multigestor_active_email', authData.user.email || authData.profile.email);
            localStorage.setItem('multigestor_session_active', 'true');

            // Carregamento instantâneo do cache local enquanto consulta oficial ao Supabase é realizada
            try {
              const cachedCusts = localStorage.getItem(`customers_${authData.tenant.id}`);
              if (cachedCusts) {
                const parsed = JSON.parse(cachedCusts);
                if (Array.isArray(parsed) && parsed.length > 0) setCustomers(parsed);
              }
              const cachedCharges = localStorage.getItem(`charges_${authData.tenant.id}`);
              if (cachedCharges) {
                const parsed = JSON.parse(cachedCharges);
                if (Array.isArray(parsed) && parsed.length > 0) setCharges(parsed);
              }
              const cachedProducts = localStorage.getItem(`products_${authData.tenant.id}`);
              if (cachedProducts) {
                const parsed = JSON.parse(cachedProducts);
                if (Array.isArray(parsed) && parsed.length > 0) setProducts(parsed);
              }
            } catch {}

            await loadTenantData(authData.tenant.id);
          } else {
            setIsAuthenticated(false);
            setTenant(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('Falha ao restaurar sessão Supabase Auth:', err);
        if (isMounted) setIsAuthenticated(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 4000);

    initSession().finally(() => {
      clearTimeout(safetyTimer);
    });

    // Ouvinte oficial do Supabase Auth para detectar login/logout/recarga
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const authData = await getCurrentSupabaseAuth();
        if (isMounted && authData) {
          setTenant(authData.tenant);
          setProfile(authData.profile);
          setCurrentEmail(authData.user.email || authData.profile.email);
          setIsAuthenticated(true);
          if (event === 'SIGNED_IN') {
            setIsMasterAuthenticated(false);
          }
          try {
            const cachedProducts = localStorage.getItem(`products_${authData.tenant.id}`);
            if (cachedProducts) {
              const parsed = JSON.parse(cachedProducts);
              if (Array.isArray(parsed) && parsed.length > 0) setProducts(parsed);
            }
          } catch {}
          await loadTenantData(authData.tenant.id);
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setIsAuthenticated(false);
          setTenant(null);
          setProfile(null);
          setStats(null);
          setCharges([]);
          setCustomers([]);
          setProducts([]);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadTenantData]);

  // Refresh helper com tratamento resiliente e tolerância a oscilações de rede
  const refreshData = async () => {
    if (!tenant) return;
    try {
      const customersPromise = isSupabaseConfigured
        ? loadCustomersFromSupabase(tenant.id).catch(() => api.getCustomers(tenant.id).catch(() => null))
        : api.getCustomers(tenant.id).catch(() => null);

      const chargesPromise = isSupabaseConfigured
        ? loadChargesFromSupabase(tenant.id).catch(() => api.getCharges(tenant.id).catch(() => null))
        : api.getCharges(tenant.id).catch(() => null);

      const productsPromise = isSupabaseConfigured
        ? loadProductsFromSupabase(tenant.id).catch(() => api.getProducts(tenant.id).catch(() => null))
        : api.getProducts(tenant.id).catch(() => null);

      const [statsData, chargesData, customersData, productsData, updatedTenant] = await Promise.all([
        api.getStats(tenant.id).catch(() => null),
        chargesPromise,
        customersPromise,
        productsPromise,
        api
          .getTenants()
          .then((list) => list.find((t) => t.id === tenant.id) || tenant)
          .catch(() => null),
      ]);
      if (statsData) setStats(statsData);
      if (chargesData && Array.isArray(chargesData)) {
        setCharges((prev) => {
          const nowMs = Date.now();
          const recentLocalCharges = prev.filter(
            (p) =>
              !chargesData.some((c) => c.id === p.id) &&
              p.created_at &&
              nowMs - new Date(p.created_at).getTime() < 20000
          );
          const merged = [...recentLocalCharges, ...chargesData];
          try {
            localStorage.setItem(`charges_${tenant.id}`, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
      if (customersData && Array.isArray(customersData)) {
        setCustomers(customersData);
        try {
          localStorage.setItem(`customers_${tenant.id}`, JSON.stringify(customersData));
        } catch {}
      }
      if (productsData && Array.isArray(productsData)) {
        setProducts(productsData);
        try {
          localStorage.setItem(`products_${tenant.id}`, JSON.stringify(productsData));
        } catch {}
      }
      if (updatedTenant) {
        setTenant((prev) => {
          if (!prev) return updatedTenant;
          // Se o tenant foi retirado do vitalício no servidor, aceita a alteração
          if (prev.subscription_status === 'lifetime' && updatedTenant.subscription_status !== 'lifetime') {
            return updatedTenant;
          }
          // Se o tenant já estiver ativo, impede regressão acidental para trial por oscilação
          if (prev.subscription_status === 'active' && updatedTenant.subscription_status === 'trial') {
            return prev;
          }
          if (
            prev.is_blocked === updatedTenant.is_blocked &&
            prev.subscription_status === updatedTenant.subscription_status &&
            prev.subscription_expires_at === updatedTenant.subscription_expires_at &&
            prev.plan_monthly_price === updatedTenant.plan_monthly_price &&
            JSON.stringify(prev.selected_modules) === JSON.stringify(updatedTenant.selected_modules)
          ) {
            return prev;
          }
          return updatedTenant;
        });
      }
    } catch (err) {
      console.warn('[refreshData] Sincronização em segundo plano postergada:', err);
    }
  };

  // Realtime hook para sincronização de clientes entre abas/dispositivos
  const { broadcastChange: broadcastCustomerChange } = useSupabaseRealtime<Customer>({
    table: 'customers',
    tenantId: tenant?.id || '',
    enabled: Boolean(tenant?.id),
    onInsert: (newCustomer) => {
      setCustomers((prev) => {
        if (prev.some((c) => c.id === newCustomer.id)) return prev;
        const next = [newCustomer, ...prev];
        if (tenant?.id) {
          try {
            localStorage.setItem(`customers_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    onUpdate: (updatedCustomer) => {
      setCustomers((prev) => {
        const next = prev.map((c) => (c.id === updatedCustomer.id ? { ...c, ...updatedCustomer } : c));
        if (tenant?.id) {
          try {
            localStorage.setItem(`customers_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    onDelete: (deletedId) => {
      setCustomers((prev) => {
        const next = prev.filter((c) => c.id !== deletedId);
        if (tenant?.id) {
          try {
            localStorage.setItem(`customers_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    onSyncNeeded: () => {
      if (tenant?.id) {
        if (isSupabaseConfigured) {
          loadCustomersFromSupabase(tenant.id).then(setCustomers).catch(() => {});
        } else {
          api.getCustomers(tenant.id).then(setCustomers).catch(() => {});
        }
      }
    },
  });

  // Realtime hook para sincronização de cobranças entre abas/dispositivos
  const { broadcastChange: broadcastChargeChange } = useSupabaseRealtime<Charge>({
    table: 'charges',
    tenantId: tenant?.id || '',
    enabled: Boolean(tenant?.id),
    onInsert: (rawCharge) => {
      const newCharge = mapSupabaseRowToCharge(rawCharge);
      setCharges((prev) => {
        if (prev.some((c) => c.id === newCharge.id)) return prev;
        const next = [newCharge, ...prev];
        if (tenant?.id) {
          try {
            localStorage.setItem(`charges_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    onUpdate: (rawUpdated) => {
      const updatedCharge = mapSupabaseRowToCharge(rawUpdated);
      setCharges((prev) => {
        const next = prev.map((c) => (c.id === updatedCharge.id ? { ...c, ...updatedCharge } : c));
        if (tenant?.id) {
          try {
            localStorage.setItem(`charges_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    onDelete: (deletedId) => {
      setCharges((prev) => {
        const next = prev.filter((c) => c.id !== deletedId);
        if (tenant?.id) {
          try {
            localStorage.setItem(`charges_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    onSyncNeeded: () => {
      if (tenant?.id) {
        if (isSupabaseConfigured) {
          loadChargesFromSupabase(tenant.id).then((freshCharges) => {
            setCharges((prev) => {
              const nowMs = Date.now();
              const recent = prev.filter(
                (p) =>
                  !freshCharges.some((c) => c.id === p.id) &&
                  p.created_at &&
                  nowMs - new Date(p.created_at).getTime() < 20000
              );
              return [...recent, ...freshCharges];
            });
          }).catch(() => {});
        } else {
          api.getCharges(tenant.id).then(setCharges).catch(() => {});
        }
      }
    },
  });

  // Realtime hook oficial para sincronização de produtos entre abas/dispositivos
  const { broadcastChange: broadcastProductChange } = useSupabaseRealtime<Product>({
    table: 'products',
    tenantId: tenant?.id || '',
    enabled: Boolean(tenant?.id),
    onInsert: (newProduct) => {
      setProducts((prev) => {
        if (prev.some((p) => p.id === newProduct.id)) return prev;
        const next = [newProduct, ...prev];
        if (tenant?.id) {
          try {
            localStorage.setItem(`products_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    onUpdate: (updatedProduct) => {
      setProducts((prev) => {
        const next = prev.map((p) => (p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p));
        if (tenant?.id) {
          try {
            localStorage.setItem(`products_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    onDelete: (deletedId) => {
      setProducts((prev) => {
        const next = prev.filter((p) => p.id !== deletedId);
        if (tenant?.id) {
          try {
            localStorage.setItem(`products_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    onSyncNeeded: () => {
      if (tenant?.id) {
        if (isSupabaseConfigured) {
          loadProductsFromSupabase(tenant.id).then(setProducts).catch(() => {});
        } else {
          api.getProducts(tenant.id).then(setProducts).catch(() => {});
        }
      }
    },
  });

  // Atualiza dados automaticamente ao alternar abas ou quando o usuário volta para a janela/dispositivo
  useEffect(() => {
    if (!tenant) return;
    refreshData();
  }, [currentTab]);

  useEffect(() => {
    if (!tenant) return;
    const handleFocus = () => {
      refreshData();
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        refreshData();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [tenant?.id]);

  // Monitora em tempo real se o Administrador bloqueou ou desbloqueou a conta (otimizado para economia de dados)
  useEffect(() => {
    if (!tenant || isMasterAdminAccount) return;
    const checkBlocked = async () => {
      if (document.hidden) return;
      try {
        const tenants = await api.getTenants();
        const current = tenants.find((t) => t.id === tenant.id);
        if (current && current.is_blocked !== tenant.is_blocked) {
          setTenant(current);
        }
      } catch (e) {
        // silent
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) checkBlocked();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(checkBlocked, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [tenant?.id, tenant?.is_blocked, isMasterAdminAccount]);

  // Redirecionamento dinâmico baseado nos módulos ativos do tenant
  useEffect(() => {
    if (!tenant) return;
    const mods =
      isMasterAdminAccount
        ? ['loans', 'iptv', 'business', 'subscriptions']
        : tenant.selected_modules && tenant.selected_modules.length > 0
        ? tenant.selected_modules
        : ['loans', 'iptv', 'business', 'subscriptions'];

    // Se o usuário selecionou apenas 1 módulo, permite navegar livremente pelo dashboard e suas abas
    if (mods.length === 1) {
      const single = mods[0];
      if (single === 'loans') {
        if (currentTab !== 'dashboard' && currentTab !== 'loans' && currentTab !== 'settings' && currentTab !== 'whatsapp' && currentTab !== 'reports' && currentTab !== 'master_admin') {
          setCurrentTab('loans');
        }
      } else if (single === 'iptv') {
        if (currentTab !== 'dashboard' && !currentTab.startsWith('iptv') && currentTab !== 'settings' && currentTab !== 'whatsapp' && currentTab !== 'reports' && currentTab !== 'master_admin') {
          setCurrentTab('iptv_customers');
        }
      } else if (single === 'business') {
        if (currentTab !== 'dashboard' && !['customers', 'products', 'charges', 'businesses'].includes(currentTab) && currentTab !== 'settings' && currentTab !== 'whatsapp' && currentTab !== 'reports' && currentTab !== 'master_admin') {
          setCurrentTab('customers');
        }
      } else if (single === 'subscriptions') {
        if (currentTab !== 'dashboard' && !currentTab.startsWith('subscriptions') && currentTab !== 'settings' && currentTab !== 'whatsapp' && currentTab !== 'reports' && currentTab !== 'master_admin') {
          setCurrentTab('subscriptions_customers');
        }
      }
    } else {
      // Se há múltiplos módulos, verifica se a aba atual é de um módulo desativado
      const isCurrentTabDisabled = () => {
        if (currentTab === 'loans' && !mods.includes('loans')) return true;
        if (currentTab.startsWith('iptv') && !mods.includes('iptv')) return true;
        if (
          ['customers', 'products', 'charges', 'businesses'].includes(currentTab) &&
          !mods.includes('business')
        )
          return true;
        if (currentTab.startsWith('subscriptions') && !mods.includes('subscriptions'))
          return true;
        return false;
      };

      if (isCurrentTabDisabled()) {
        setCurrentTab('dashboard');
      }
    }
  }, [tenant]);

  // Verificação de expiração de assinatura / trial
  const isLifetime = tenant?.subscription_status === 'lifetime';

  const expiryDate = tenant?.subscription_expires_at
    ? new Date(tenant.subscription_expires_at)
    : tenant?.trial_ends_at
    ? new Date(tenant.trial_ends_at)
    : null;

  const isExpired = Boolean(
    tenant &&
    !isLifetime &&
    (tenant.subscription_status === 'expired' || (expiryDate && expiryDate.getTime() <= Date.now()))
  );

  // Cálculo de Alerta Preventivo (Faltando 3 dias ou menos para a expiração)
  const msRemaining = expiryDate && !isExpired ? expiryDate.getTime() - Date.now() : 0;
  const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60)));
  const isExpiringSoon = Boolean(
    tenant &&
    !isLifetime &&
    !isExpired &&
    expiryDate &&
    msRemaining > 0 &&
    msRemaining <= 3 * 24 * 60 * 60 * 1000 // 3 dias ou menos!
  );

  const currentPlanPrice =
    tenant?.plan_monthly_price ||
    (tenant?.selected_modules && tenant.selected_modules.length > 0
      ? calculatePlanPrice(tenant.selected_modules.length)
      : 24.9);

  // Exibe o pop-up inteligente 1 vez por sessão automaticamente quando estiver nos 3 dias finais
  useEffect(() => {
    if (isExpiringSoon && tenant) {
      const sessionKey = `multigestor_expiring_alert_shown_${tenant.id}`;
      const alreadyShown = sessionStorage.getItem(sessionKey);
      if (!alreadyShown) {
        setIsExpiringAlertModalOpen(true);
        sessionStorage.setItem(sessionKey, 'true');
      }
    }
  }, [isExpiringSoon, tenant?.id]);

  const handleSwitchUser = async (newEmail: string) => {
    setIsMasterAuthenticated(false);
    setCurrentTab('dashboard');
    localStorage.setItem('multigestor_active_email', newEmail);
    setCurrentEmail(newEmail);
    try {
      setLoading(true);
      const auth = await api.login(newEmail);
      if (auth && auth.tenant && auth.profile) {
        setTenant(auth.tenant);
        setProfile(auth.profile);
        setIsAuthenticated(true);
        localStorage.setItem('multigestor_session_active', 'true');
        await loadTenantData(auth.tenant.id);
      }
    } catch (e) {
      console.warn('Erro ao alternar perfil:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    try {
      await signOutWithSupabase();
    } catch (e) {
      console.warn('Erro ao sair do Supabase:', e);
    }
    localStorage.removeItem('multigestor_session_active');
    sessionStorage.removeItem('multigestor_session_active');
    sessionStorage.removeItem('multigestor_active_tab');
    setCurrentTab('dashboard');
    if (tenant) {
      sessionStorage.removeItem(`multigestor_expiring_alert_shown_${tenant.id}`);
    }
    setTenant(null);
    setProfile(null);
    setStats(null);
    setCharges([]);
    setCustomers([]);
    setProducts([]);
    setIsAuthenticated(false);
    setIsLogoutModalOpen(false);
  };

  const handleLoginSuccess = async (email: string, newTenant?: Tenant, newProfile?: Profile) => {
    setCurrentEmail(email);
    setCurrentTab('dashboard');
    sessionStorage.setItem('multigestor_active_tab', 'dashboard');
    setIsMasterAuthenticated(false);
    localStorage.setItem('multigestor_active_email', email);
    localStorage.setItem('multigestor_session_active', 'true');

    if (newTenant && newProfile) {
      setTenant(newTenant);
      setProfile(newProfile);
      setIsAuthenticated(true);
      await loadTenantData(newTenant.id);
    } else {
      const authData = await getCurrentSupabaseAuth();
      if (authData) {
        setTenant(authData.tenant);
        setProfile(authData.profile);
        setIsAuthenticated(true);
        await loadTenantData(authData.tenant.id);
      }
    }
  };

  const handleSelectTab = (tab: NavigationTab) => {
    if (tab === 'master_admin') {
      if (!isMasterAdminAccount) {
        setCurrentTab('dashboard');
        return;
      }
      // Even in the administrator account, always require password to enter!
      setIsMasterAuthModalOpen(true);
      return;
    }
    setCurrentTab(tab);
  };

  // Charge Actions
  const handleOpenWhatsApp = (charge: Charge) => {
    setSelectedChargeForWhatsApp(charge);
    setIsWhatsAppModalOpen(true);
  };

  const handleMarkAsPaid = async (chargeId: string, paymentMethod = 'pix') => {
    try {
      let updatedCharge: Charge;
      if (isSupabaseConfigured && tenant?.id) {
        updatedCharge = await markChargeAsPaidInSupabase(tenant.id, chargeId, paymentMethod);
        broadcastChargeChange('update', updatedCharge);
      } else {
        updatedCharge = await api.markChargeAsPaid(chargeId, paymentMethod);
      }

      setCharges((prev) => {
        const next = prev.map((c) => (c.id === chargeId ? updatedCharge : c));
        if (tenant?.id) {
          try {
            localStorage.setItem(`charges_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      api.markChargeAsPaid(chargeId, paymentMethod).catch(() => {});
      await refreshData();
    } catch (err) {
      console.error('Failed to mark charge as paid', err);
    }
  };

  const handleDeleteCharge = async (chargeId: string) => {
    try {
      if (isSupabaseConfigured && tenant?.id) {
        await deleteChargeFromSupabase(tenant.id, chargeId);
        broadcastChargeChange('delete', { id: chargeId, tenantId: tenant.id });
      } else {
        await api.deleteCharge(chargeId);
      }

      setCharges((prev) => {
        const next = prev.filter((c) => c.id !== chargeId);
        if (tenant?.id) {
          try {
            localStorage.setItem(`charges_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      api.deleteCharge(chargeId).catch(() => {});
      await refreshData();
    } catch (err) {
      console.error('Failed to delete charge', err);
    }
  };

  // Customer Actions
  const handleDeleteCustomer = async (customerId: string) => {
    try {
      if (isSupabaseConfigured) {
        try {
          await deleteCustomerFromSupabase(tenant?.id || '', customerId);
          if (tenant?.id) {
            broadcastCustomerChange('delete', { id: customerId, tenantId: tenant.id });
          }
        } catch (subErr) {
          console.warn('[handleDeleteCustomer] Aviso ao deletar no Supabase:', subErr);
        }
      }
      await api.deleteCustomer(customerId).catch(() => {});
      setCustomers((prev) => {
        const next = prev.filter((c) => c.id !== customerId);
        if (tenant?.id) {
          try {
            localStorage.setItem(`customers_${tenant.id}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
      await refreshData();
    } catch (err) {
      console.error('Failed to delete customer', err);
    }
  };

  const handleNewChargeForCustomer = (customerId: string) => {
    setPreselectedCustomerId(customerId);
    setPreselectedProduct(undefined);
    setIsNewChargeModalOpen(true);
  };

  // Product Actions
  const handleQuickSellProduct = (product: Product) => {
    setPreselectedProduct(product);
    setPreselectedCustomerId(undefined);
    setIsNewChargeModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#091124] flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs uppercase tracking-wider font-bold text-emerald-400">
          Iniciando Multi Gestor...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || !tenant || !profile) {
    return <AuthView onLoginSuccess={handleLoginSuccess} />;
  }

  // 1. BLOQUEIO MANUAL PELO ADMINISTRADOR MASTER:
  // Quando o adm bloquear, o cliente cadastrado não consegue fazer nada, até o adm desbloquear.
  if (tenant.is_blocked && !isMasterAdminAccount) {
    return (
      <AdminBlockedScreen
        tenant={tenant}
        userEmail={profile.email}
        onUnblocked={(updatedTenant) => {
          setTenant(updatedTenant);
          refreshData();
        }}
        onLogout={handleConfirmLogout}
      />
    );
  }

  // 2. BLOQUEIO TOTAL POR EXPIRAÇÃO: Quando a assinatura expira, bloqueia o acesso e só libera após o pagamento
  if (isExpired) {
    return (
      <SubscriptionExpiredBlocker
        tenant={tenant}
        userEmail={profile.email}
        onPaymentApproved={(updatedTenant) => {
          setTenant(updatedTenant);
          refreshData();
        }}
        onLogout={handleConfirmLogout}
      />
    );
  }

  return (
    <div className="h-full w-full bg-[#091124] text-slate-100 flex flex-col font-sans antialiased overflow-hidden">
      {/* 1. Barra de Menu Unificada no Topo (Com Opção de Tela Inteira) */}
      <TopNav
        tenant={tenant}
        profile={profile}
        onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
        onOpenExpiringDetails={() => setIsExpiringAlertModalOpen(true)}
        onSelectTab={handleSelectTab}
        onSwitchUser={handleSwitchUser}
        onLogout={handleRequestLogout}
        onToggleMobileMenu={() => {
          if (window.innerWidth < 1024) {
            setIsMobileMenuOpen((prev) => !prev);
          } else {
            setIsDesktopSidebarCollapsed((prev) => !prev);
          }
        }}
      />

      {/* 2. Área Inferior: Sidebar à esquerda + Área de Conteúdo à direita */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar (Desktop Fixed + Mobile Slide-over Drawer) */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          tenant={tenant}
          profile={profile}
          onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
          onSwitchUser={handleSwitchUser}
          onLogout={handleRequestLogout}
          isOpenOnMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onOpenAddModuleModal={() => setIsAddModuleModalOpen(true)}
          isCollapsedOnDesktop={isDesktopSidebarCollapsed}
        />

        {/* Área de Conteúdo Rolável */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden">
          <main className="w-full max-w-[1600px] mx-auto p-3 sm:p-4 lg:p-5 xl:p-6 2xl:p-7 pb-36 lg:pb-36">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={stats || DEFAULT_STATS}
              charges={charges}
              customers={customers}
              products={products}
              tenant={tenant}
              onOpenNewCharge={() => {
                setPreselectedCustomerId(undefined);
                setPreselectedProduct(undefined);
                setIsNewChargeModalOpen(true);
              }}
              onOpenNewCustomer={() => setIsNewCustomerModalOpen(true)}
              onOpenWhatsApp={handleOpenWhatsApp}
              onMarkAsPaid={handleMarkAsPaid}
              onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
              onNavigateToReports={() => setCurrentTab('reports')}
              onNavigateToTab={(tab) => setCurrentTab(tab)}
              onNewChargeForCustomer={handleNewChargeForCustomer}
              onQuickSellProduct={handleQuickSellProduct}
            />
          )}

          {currentTab === 'charges' && (
            <ChargesView
              charges={charges}
              customers={customers}
              tenant={tenant}
              onOpenNewCharge={() => {
                setPreselectedCustomerId(undefined);
                setPreselectedProduct(undefined);
                setIsNewChargeModalOpen(true);
              }}
              onOpenWhatsApp={handleOpenWhatsApp}
              onMarkAsPaid={handleMarkAsPaid}
              onDeleteCharge={handleDeleteCharge}
              onRefreshCharges={refreshData}
            />
          )}

          {currentTab === 'customers' && (
            <CustomersView
              customers={customers}
              charges={charges}
              tenant={tenant}
              onOpenNewCustomer={() => setIsNewCustomerModalOpen(true)}
              onNewChargeForCustomer={handleNewChargeForCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onRefreshCustomers={refreshData}
              onOpenWhatsApp={handleOpenWhatsApp}
              onMarkAsPaid={handleMarkAsPaid}
            />
          )}

          {currentTab === 'products' && (
            <ProductsView
              products={products}
              tenant={tenant}
              onRefreshProducts={refreshData}
              onQuickSellProduct={handleQuickSellProduct}
            />
          )}

          {currentTab === 'reports' && <ReportsView tenant={tenant} />}

          {currentTab === 'settings' && (
            <SettingsView
              key={`settings_${tenant.id}`}
              tenant={tenant}
              isAdmin={isMasterAdminAccount}
              onUpdateTenant={(updated) => setTenant(updated)}
              onOpenAddModuleModal={() => setIsAddModuleModalOpen(true)}
            />
          )}

          {currentTab === 'whatsapp' && (
            <SettingsView
              key={`whatsapp_${tenant.id}`}
              tenant={tenant}
              isAdmin={isMasterAdminAccount}
              onUpdateTenant={(updated) => setTenant(updated)}
              initialSubTab="whatsapp"
              onOpenAddModuleModal={() => setIsAddModuleModalOpen(true)}
            />
          )}

          {(currentTab === 'iptv_customers' || currentTab === 'iptv') && (
            <IPTVCustomersView tenant={tenant} />
          )}

          {currentTab === 'iptv_plans' && <IPTVPlansView tenant={tenant} />}

          {currentTab === 'iptv_apps' && <IPTVAppsView tenant={tenant} />}

          {(currentTab === 'subscriptions' ||
            currentTab === 'subscriptions_customers' ||
            currentTab === 'subscriptions_sales') && (
            <SubscriptionsView tenant={tenant} initialSubTab="customers" />
          )}

          {currentTab === 'subscriptions_plans' && (
            <SubscriptionsView tenant={tenant} initialSubTab="plans" />
          )}

          {currentTab === 'businesses' && (
            <BusinessesView
              currentTenant={tenant}
              onSelectTenant={(newTenant) => setTenant(newTenant)}
              onRefresh={refreshData}
            />
          )}

          {currentTab === 'loans' && <LoansView tenant={tenant} />}

          {currentTab === 'master_admin' && isMasterAdminAccount && isMasterAuthenticated && (
            <MasterAdminView onTenantUpdated={refreshData} />
          )}
        </main>
        </div>
      </div>

      {/* Modals */}
      {/* Master Admin Security Password Modal */}
      <MasterAdminAuthModal
        isOpen={isMasterAuthModalOpen}
        onClose={() => setIsMasterAuthModalOpen(false)}
        onSuccess={() => {
          setIsMasterAuthenticated(true);
          setCurrentTab('master_admin');
        }}
        userEmail={profile?.email}
        userName={profile?.full_name || tenant?.name}
      />
      {/* 1. Subscription PIX Modal (Mercado Pago R$ 24,90) */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        tenant={tenant}
        userEmail={profile?.email || currentEmail || tenant?.email || ''}
        onSuccess={(updatedTenant) => {
          setTenant(updatedTenant);
          refreshData();
        }}
      />

      {/* Modal de Expansão / Adição Dinâmica de Módulos */}
      {tenant && (
        <AddModuleModal
          isOpen={isAddModuleModalOpen}
          onClose={() => setIsAddModuleModalOpen(false)}
          tenant={tenant}
          onModuleAdded={(updated) => {
            setTenant(updated);
            refreshData();
          }}
        />
      )}

      {/* Modal / Pop-up de Alerta Preventivo de Expiração (3 Dias) */}
      {isExpiringSoon && expiryDate && (
        <SubscriptionExpiringAlertModal
          isOpen={isExpiringAlertModalOpen}
          onClose={() => setIsExpiringAlertModalOpen(false)}
          onRenew={() => {
            setIsExpiringAlertModalOpen(false);
            setIsSubscriptionModalOpen(true);
          }}
          tenant={tenant}
          daysRemaining={daysRemaining}
          hoursRemaining={hoursRemaining}
          expiryDate={expiryDate}
          planPrice={currentPlanPrice}
        />
      )}

      {/* 2. WhatsApp Charge Modal */}
      {selectedChargeForWhatsApp && (
        <WhatsAppModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => {
            setIsWhatsAppModalOpen(false);
            setSelectedChargeForWhatsApp(null);
          }}
          charge={selectedChargeForWhatsApp}
          customer={
            selectedChargeForWhatsApp.customer ||
            customers.find((c) => c.id === selectedChargeForWhatsApp.customer_id) || {
              id: 'temp',
              tenant_id: tenant.id,
              name: 'Cliente',
              whatsapp: '',
              created_at: '',
              updated_at: '',
            }
          }
          tenant={tenant}
        />
      )}

      {/* 3. New Charge Modal */}
      <NewChargeModal
        isOpen={isNewChargeModalOpen}
        onClose={() => setIsNewChargeModalOpen(false)}
        tenant={tenant}
        customers={customers}
        products={products}
        onCreated={(created) => {
          setCharges((prev) => {
            const next = [created, ...prev.filter((c) => c.id !== created.id)];
            if (tenant?.id) {
              try {
                localStorage.setItem(`charges_${tenant.id}`, JSON.stringify(next));
              } catch {}
            }
            return next;
          });
          broadcastChargeChange('insert', created);
          refreshData();
        }}
        preselectedCustomerId={preselectedCustomerId}
        preselectedProduct={preselectedProduct}
      />

      {/* 4. New Customer Modal */}
      <NewCustomerModal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        tenant={tenant}
        onCreated={() => refreshData()}
      />

      {/* 5. Modal de Confirmação para Sair da Conta */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0b1633] border border-[#1d2d54] rounded-2xl max-w-sm w-full my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:p-6 shadow-2xl shadow-black/80 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 shadow-lg shadow-rose-950/40">
              <LogOut className="w-7 h-7" />
            </div>
            
            <h3 className="text-lg font-black text-white tracking-tight mb-1.5">
              Deseja realmente sair?
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Você será desconectado da sua conta <strong className="text-slate-200">{profile.email}</strong>. Para acessar o Multi Gestor novamente será necessário fazer login.
            </p>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-black shadow-lg shadow-rose-950/60 transition-all cursor-pointer active:scale-95"
              >
                Sim, Sair da Conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Mobile Bottom Navigation Bar (Visible on mobile/tablet < lg screens) */}
      {(() => {
        const userModules =
          isMasterAdminAccount
            ? ['loans', 'iptv', 'business', 'subscriptions']
            : tenant?.selected_modules && tenant.selected_modules.length > 0
            ? tenant.selected_modules
            : ['loans', 'iptv', 'business', 'subscriptions'];

        const hasIptv = userModules.includes('iptv');
        const isOnlyIptv = userModules.length === 1 && hasIptv;
        const isOnlyLoans = userModules.length === 1 && userModules[0] === 'loans';
        const isOnlyBusiness = userModules.length === 1 && userModules[0] === 'business';
        const isOnlySubscriptions = userModules.length === 1 && userModules[0] === 'subscriptions';

        // 1. MÓDULO IPTV (Exclusivo para IPTV ou preferencial se contratado IPTV)
        if (isOnlyIptv || (hasIptv && !isOnlyLoans && !isOnlyBusiness && !isOnlySubscriptions)) {
          return (
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#091124]/95 backdrop-blur-md border-t border-[#1a2c54] px-1 sm:px-2 pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none shadow-2xl">
              {/* Início / Dashboard IPTV */}
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'dashboard'
                    ? 'text-purple-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Início</span>
              </button>

              {/* Cliente IPTV */}
              <button
                onClick={() => setCurrentTab('iptv_customers')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'iptv_customers' || currentTab === 'iptv'
                    ? 'text-purple-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Cliente IPTV</span>
              </button>

              {/* Planos IPTV */}
              <button
                onClick={() => setCurrentTab('iptv_plans')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'iptv_plans'
                    ? 'text-purple-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Planos IPTV</span>
              </button>

              {/* Aplicativos */}
              <button
                onClick={() => setCurrentTab('iptv_apps')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'iptv_apps'
                    ? 'text-purple-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Aplicativos</span>
              </button>

              {/* Menu Geral */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <Menu className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Menu</span>
              </button>
            </div>
          );
        }

        // 2. MÓDULO EMPRÉSTIMOS
        if (isOnlyLoans) {
          return (
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#091124]/95 backdrop-blur-md border-t border-[#1a2c54] px-1 sm:px-2 pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none shadow-2xl">
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'dashboard' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Início</span>
              </button>
              <button
                onClick={() => setCurrentTab('loans')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'loans' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <HandCoins className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Empréstimos</span>
              </button>
              <button
                onClick={() => setCurrentTab('charges')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'charges' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Cobranças</span>
              </button>
              <button
                onClick={() => setCurrentTab('customers')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'customers' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Clientes</span>
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <Menu className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Menu</span>
              </button>
            </div>
          );
        }

        // 3. MÓDULO NEGÓCIOS & EMPRESAS
        if (isOnlyBusiness) {
          return (
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#091124]/95 backdrop-blur-md border-t border-[#1a2c54] px-1 sm:px-2 pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none shadow-2xl">
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'dashboard' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Início</span>
              </button>
              <button
                onClick={() => setCurrentTab('customers')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'customers' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Cliente</span>
              </button>
              <button
                onClick={() => setCurrentTab('products')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'products' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Package className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Produto</span>
              </button>
              <button
                onClick={() => setCurrentTab('charges')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'charges' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Vendas</span>
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <Menu className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Menu</span>
              </button>
            </div>
          );
        }

        // 4. MÓDULO ASSINATURAS
        if (isOnlySubscriptions) {
          return (
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#091124]/95 backdrop-blur-md border-t border-[#1a2c54] px-1 sm:px-2 pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none shadow-2xl">
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'dashboard' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Início</span>
              </button>
              <button
                onClick={() => setCurrentTab('subscriptions_customers')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'subscriptions_customers' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Assinantes</span>
              </button>
              <button
                onClick={() => setCurrentTab('subscriptions_plans')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'subscriptions_plans' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Planos</span>
              </button>
              <button
                onClick={() => setCurrentTab('subscriptions_sales')}
                className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                  currentTab === 'subscriptions_sales' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Vendas</span>
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <Menu className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Menu</span>
              </button>
            </div>
          );
        }

        // Padrão Geral / Multi-módulos
        return (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#091124]/95 backdrop-blur-md border-t border-[#1a2c54] px-1 sm:px-2 pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none shadow-2xl">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                currentTab === 'dashboard' ? 'text-orange-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Início</span>
            </button>
            {hasIptv ? (
              <>
                <button
                  onClick={() => setCurrentTab('iptv_customers')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                    currentTab === 'iptv_customers' || currentTab === 'iptv' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5">Cliente IPTV</span>
                </button>
                <button
                  onClick={() => setCurrentTab('iptv_plans')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                    currentTab === 'iptv_plans' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5">Planos IPTV</span>
                </button>
                <button
                  onClick={() => setCurrentTab('iptv_apps')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                    currentTab === 'iptv_apps' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5">Aplicativos</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentTab('customers')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                    currentTab === 'customers' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5">Cliente</span>
                </button>
                <button
                  onClick={() => setCurrentTab('products')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                    currentTab === 'products' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Package className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5">Produto</span>
                </button>
                <button
                  onClick={() => setCurrentTab('charges')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                    currentTab === 'charges' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span className="text-[10px] mt-0.5">Vendas</span>
                </button>
              </>
            )}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Menu</span>
            </button>
          </div>
        );
      })()}
    </div>
  );
}
