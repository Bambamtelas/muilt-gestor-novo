import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  Settings,
  ShieldCheck,
  Crown,
  LogOut,
  ChevronRight,
  ChevronDown,
  Building2,
  Tv,
  Layers,
  Smartphone,
  Clock,
  ShoppingBag,
  Database,
  HandCoins,
  Repeat,
  X,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { NavigationTab } from './Header.js';
import { Tenant, Profile } from '../types/index.js';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  tenant: Tenant;
  profile: Profile;
  onOpenSubscriptionModal: () => void;
  onSwitchUser: (email: string) => void;
  onLogout?: () => void;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
  onOpenAddModuleModal?: () => void;
  isCollapsedOnDesktop?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  tenant,
  profile,
  onOpenSubscriptionModal,
  onSwitchUser,
  onLogout,
  isOpenOnMobile,
  onCloseMobile,
  onOpenAddModuleModal,
  isCollapsedOnDesktop = false,
}) => {
  const isMasterAdminAccount = Boolean(
    profile.email?.toLowerCase().trim() === 'betaof10@hotmail.com' ||
    tenant.email?.toLowerCase().trim() === 'betaof10@hotmail.com'
  );
  const isMasterAdmin = isMasterAdminAccount;

  const isLifetime = tenant.subscription_status === 'lifetime';
  const isTrial = tenant.subscription_status === 'trial';

  const expiryDate = tenant.subscription_expires_at
    ? new Date(tenant.subscription_expires_at)
    : tenant.trial_ends_at
    ? new Date(tenant.trial_ends_at)
    : null;

  let daysRemaining = 0;
  let isExpired = false;

  if (expiryDate && !isLifetime) {
    const diffTime = expiryDate.getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    isExpired = diffTime <= 0;
  }

  const isIptvTab =
    currentTab === 'iptv' ||
    currentTab === 'iptv_customers' ||
    currentTab === 'iptv_plans' ||
    currentTab === 'iptv_apps';

  const isBusinessTab =
    currentTab === 'businesses' ||
    currentTab === 'customers' ||
    currentTab === 'products' ||
    currentTab === 'charges';

  const isSubscriptionsTab =
    currentTab === 'subscriptions' ||
    currentTab === 'subscriptions_customers' ||
    currentTab === 'subscriptions_plans' ||
    currentTab === 'subscriptions_sales';

  // Módulos Ativos do Tenant
  const selectedModules =
    isMasterAdminAccount
      ? ['loans', 'iptv', 'business', 'subscriptions']
      : tenant.selected_modules && tenant.selected_modules.length > 0
      ? tenant.selected_modules
      : ['loans', 'iptv', 'business', 'subscriptions'];

  const hasLoans = selectedModules.includes('loans');
  const hasIptv = selectedModules.includes('iptv');
  const hasBusiness = selectedModules.includes('business');
  const hasSubscriptions = selectedModules.includes('subscriptions');
  const isSingleModule = selectedModules.length === 1;

  const [isBusinessOpen, setIsBusinessOpen] = useState<boolean>(isBusinessTab);
  const [isIptvOpen, setIsIptvOpen] = useState<boolean>(isIptvTab);
  const [isSubscriptionsOpen, setIsSubscriptionsOpen] = useState<boolean>(isSubscriptionsTab);

  const prevTabRef = React.useRef(currentTab);
  React.useEffect(() => {
    if (prevTabRef.current !== currentTab) {
      if (isBusinessTab) setIsBusinessOpen(true);
      if (isIptvTab) setIsIptvOpen(true);
      if (isSubscriptionsTab) setIsSubscriptionsOpen(true);
      prevTabRef.current = currentTab;
    }
  }, [currentTab, isBusinessTab, isIptvTab, isSubscriptionsTab]);

  const handleTabClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    onCloseMobile?.();
  };

  const handleSwitchUserClick = (email: string) => {
    onSwitchUser(email);
    onCloseMobile?.();
  };

  const handleOpenPlanClick = () => {
    onOpenSubscriptionModal();
    onCloseMobile?.();
  };

  const renderContent = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full">
      {/* Mobile Drawer Top Bar with Close button (no duplicate logo) */}
      {isMobile && (
        <div className="p-3.5 border-b border-[#172547] flex items-center justify-between">
          <span className="text-xs font-black text-slate-300 tracking-wider uppercase">
            Menu de Navegação
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Subscription / Plan Container Box */}
      <div className="p-3 border-b border-[#172547]/50">
        <div className="px-3 py-2 bg-[#091224] border border-[#1b2b4f] rounded-xl flex items-center justify-between text-xs shadow-inner">
          <div className="flex items-center gap-2 text-slate-200 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              isLifetime
                ? 'bg-emerald-400 animate-pulse'
                : isExpired
                ? 'bg-rose-400 animate-ping'
                : isTrial
                ? 'bg-amber-400 animate-pulse'
                : 'bg-emerald-400 animate-pulse'
            }`}></span>
            <div className="truncate">
              <span className="text-xs font-bold text-white block truncate">
                {isLifetime
                  ? 'Acesso Vitalício'
                  : isExpired
                  ? 'Assinatura Expirada'
                  : isTrial
                  ? (daysRemaining > 0 ? `Teste Grátis: ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}` : 'Teste Grátis: 2 dias')
                  : (daysRemaining > 0 ? `Plano Ativo: ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}` : 'Plano Ativo (30 dias)')}
              </span>
            </div>
          </div>
          {isMasterAdminAccount ? (
            <span
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 select-none shrink-0"
              title="Conta Master Admin (Acesso Vitalício Permanente)"
            >
              Master
            </span>
          ) : (
            <button
              onClick={handleOpenPlanClick}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                isLifetime
                  ? 'bg-[#0f1d38] hover:bg-[#15274d] text-emerald-400 border border-emerald-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black shadow-sm'
              }`}
            >
              {isLifetime ? 'Plano' : 'Renovar'}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 px-3 py-3 space-y-2 overflow-y-auto">
        {/* CATEGORY: VISÃO GERAL */}
        <div className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-1">
          VISÃO GERAL
        </div>

        {/* 1. DASHBOARD */}
        <button
          onClick={() => handleTabClick('dashboard')}
          className={`w-full group flex items-center justify-between p-2.5 rounded-2xl border transition-all text-left cursor-pointer ${
            currentTab === 'dashboard'
              ? 'bg-gradient-to-r from-[#00b875] to-[#059669] border-emerald-400/50 text-white shadow-lg shadow-emerald-950/40'
              : 'bg-[#0e1834]/80 hover:bg-[#132247] border-[#1a2c54] text-slate-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                currentTab === 'dashboard'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">Dashboard</div>
              <div className="text-xs text-white truncate">Visão geral e métricas</div>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 shrink-0 transition-transform ${
              currentTab === 'dashboard' ? 'text-white translate-x-0.5' : 'text-slate-500 group-hover:text-slate-300'
            }`}
          />
        </button>

        {/* 2. EMPRÉSTIMOS */}
        {hasLoans && (
          <button
            onClick={() => handleTabClick('loans')}
            className={`w-full group flex items-center justify-between p-2.5 rounded-2xl border transition-all text-left cursor-pointer ${
              currentTab === 'loans'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 border-emerald-400/50 text-white shadow-lg shadow-emerald-900/40'
                : 'bg-[#0e1834]/80 hover:bg-[#132247] border-[#1a2c54] text-slate-300 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                  currentTab === 'loans'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                <HandCoins className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white truncate">Empréstimos</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                    R$
                  </span>
                </div>
                <div className="text-xs text-white truncate">Contratos &amp; parcelas</div>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 shrink-0 transition-transform ${
                currentTab === 'loans' ? 'text-white translate-x-0.5' : 'text-slate-500 group-hover:text-slate-300'
              }`}
            />
          </button>
        )}

        {/* 3. IPTV (Com Submenus: Clientes, Planos & Aplicativos) */}
        {hasIptv && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                const nextOpen = !isIptvOpen;
                setIsIptvOpen(nextOpen);
                if (nextOpen && !isIptvTab) {
                  handleTabClick('iptv_customers');
                }
              }}
              className={`w-full group flex items-center justify-between p-2.5 rounded-2xl border transition-all text-left cursor-pointer ${
                isIptvTab
                  ? 'bg-gradient-to-r from-[#9333ea] to-[#6b21a8] border-purple-400/50 text-white shadow-lg shadow-purple-900/40'
                  : 'bg-[#0e1834]/80 hover:bg-[#132247] border-[#1a2c54] text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                    isIptvTab
                      ? 'bg-white/20 text-white'
                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  }`}
                >
                  <Tv className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white truncate">IPTV</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-purple-500/40 text-purple-100 border border-purple-300/30">
                      4K
                    </span>
                  </div>
                  <div className="text-xs text-white truncate">
                    {isIptvOpen ? '3 Submenus ativos' : 'Clientes, Planos & Apps'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ChevronDown
                  className={`w-4 h-4 text-purple-300 transition-transform duration-200 ${
                    isIptvOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {isIptvOpen && (
              <div className="pl-3 py-1 space-y-1.5 border-l-2 border-purple-500/30 ml-4 animate-in slide-in-from-top-1 duration-150">
                {/* Submenu 1: Clientes IPTV */}
                <button
                  type="button"
                  onClick={() => handleTabClick('iptv_customers')}
                  className={`w-full group flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                    currentTab === 'iptv_customers' || currentTab === 'iptv'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40 border-purple-400/40'
                      : 'bg-[#0a1226] hover:bg-[#121f3f] border-[#18274d] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        currentTab === 'iptv_customers' || currentTab === 'iptv'
                          ? 'bg-white/20 text-white'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">Clientes IPTV</div>
                      <div className="text-[11px] text-white truncate">Assinaturas &amp; Telas</div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                </button>

                {/* Submenu 2: Planos IPTV */}
                <button
                  type="button"
                  onClick={() => handleTabClick('iptv_plans')}
                  className={`w-full group flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                    currentTab === 'iptv_plans'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40 border-purple-400/40'
                      : 'bg-[#0a1226] hover:bg-[#121f3f] border-[#18274d] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        currentTab === 'iptv_plans'
                          ? 'bg-white/20 text-white'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">Planos IPTV</div>
                      <div className="text-[11px] text-white truncate">Telas &amp; Duração</div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                </button>

                {/* Submenu 3: Aplicativos */}
                <button
                  type="button"
                  onClick={() => handleTabClick('iptv_apps')}
                  className={`w-full group flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                    currentTab === 'iptv_apps'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40 border-purple-400/40'
                      : 'bg-[#0a1226] hover:bg-[#121f3f] border-[#18274d] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        currentTab === 'iptv_apps'
                          ? 'bg-white/20 text-white'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">Aplicativos</div>
                      <div className="text-[11px] text-white truncate">Downloads &amp; DNS</div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. NEGÓCIOS / EMPRESAS (Com Submenus: Clientes, Produtos/Serviços e Vendas) */}
        {hasBusiness && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                const nextOpen = !isBusinessOpen;
                setIsBusinessOpen(nextOpen);
                if (nextOpen && !isBusinessTab) {
                  handleTabClick('customers');
                }
              }}
              className={`w-full group flex items-center justify-between p-2.5 rounded-2xl border transition-all text-left cursor-pointer ${
                isBusinessTab
                  ? 'bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] border-blue-400/50 text-white shadow-lg shadow-blue-900/40'
                  : 'bg-[#0e1834]/80 hover:bg-[#132247] border-[#1a2c54] text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                    isBusinessTab
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white truncate">Negócios / Empresas</span>
                  </div>
                  <div className="text-xs text-white truncate">
                    {isBusinessOpen ? 'Submenus ativos' : 'Clientes, Produtos & Vendas'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ChevronDown
                  className={`w-4 h-4 text-blue-300 transition-transform duration-200 ${
                    isBusinessOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {isBusinessOpen && (
              <div className="pl-3 py-1 space-y-1.5 border-l-2 border-blue-500/30 ml-4 animate-in slide-in-from-top-1 duration-150">
                {/* Submenu 1: Clientes */}
                <button
                  type="button"
                  onClick={() => handleTabClick('customers')}
                  className={`w-full group flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                    currentTab === 'customers'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border-blue-400/40'
                      : 'bg-[#0a1226] hover:bg-[#121f3f] border-[#18274d] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        currentTab === 'customers'
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">Clientes</div>
                      <div className="text-[11px] text-white truncate">Cadastros &amp; CRM</div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                </button>

                {/* Submenu 2: Produto/Serviços */}
                <button
                  type="button"
                  onClick={() => handleTabClick('products')}
                  className={`w-full group flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                    currentTab === 'products'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border-blue-400/40'
                      : 'bg-[#0a1226] hover:bg-[#121f3f] border-[#18274d] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        currentTab === 'products'
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">Produtos / Serviços</div>
                      <div className="text-[11px] text-white truncate">Catálogo de Vendas</div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                </button>

                {/* Submenu 3: Vendas */}
                <button
                  type="button"
                  onClick={() => handleTabClick('charges')}
                  className={`w-full group flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                    currentTab === 'charges'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40 border-blue-400/40'
                      : 'bg-[#0a1226] hover:bg-[#121f3f] border-[#18274d] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        currentTab === 'charges'
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">Vendas</div>
                      <div className="text-[11px] text-white truncate">Cobranças &amp; Histórico</div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* 5. ASSINATURAS (Com Submenus: Clientes e Planos) */}
        {hasSubscriptions && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                const nextOpen = !isSubscriptionsOpen;
                setIsSubscriptionsOpen(nextOpen);
                if (nextOpen && !isSubscriptionsTab) {
                  handleTabClick('subscriptions_customers');
                }
              }}
              className={`w-full group flex items-center justify-between p-2.5 rounded-2xl border transition-all text-left cursor-pointer ${
                isSubscriptionsTab
                  ? 'bg-gradient-to-r from-[#6366f1] to-[#4f46e5] border-indigo-400/50 text-white shadow-lg shadow-indigo-950/40'
                  : 'bg-[#0e1834]/80 hover:bg-[#132247] border-[#1a2c54] text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                    isSubscriptionsTab
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  }`}
                >
                  <Repeat className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-bold text-white whitespace-nowrap shrink-0">Assinaturas</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 uppercase tracking-tight shrink-0">
                      STREAMING
                    </span>
                  </div>
                  <div className="text-xs text-white truncate">
                    {isSubscriptionsOpen ? '2 Submenus ativos' : 'Planos de Streamings'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ChevronDown
                  className={`w-4 h-4 text-indigo-300 transition-transform duration-200 ${
                    isSubscriptionsOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {isSubscriptionsOpen && (
              <div className="pl-3 py-1 space-y-1.5 border-l-2 border-indigo-500/40 ml-4 animate-in slide-in-from-top-1 duration-150">
                {/* Submenu 1: Clientes */}
                <button
                  type="button"
                  onClick={() => handleTabClick('subscriptions_customers')}
                  className={`w-full group flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                    currentTab === 'subscriptions_customers' || currentTab === 'subscriptions'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40 border-indigo-400/40'
                      : 'bg-[#0a1226] hover:bg-[#121f3f] border-[#18274d] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        currentTab === 'subscriptions_customers' || currentTab === 'subscriptions'
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-500/20 text-indigo-300'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">Clientes</div>
                      <div className="text-[11px] text-white truncate">Assinantes &amp; Contratos</div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                </button>

                {/* Submenu 2: Planos */}
                <button
                  type="button"
                  onClick={() => handleTabClick('subscriptions_plans')}
                  className={`w-full group flex items-center justify-between p-2 rounded-xl border transition-all text-left cursor-pointer ${
                    currentTab === 'subscriptions_plans'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40 border-indigo-400/40'
                      : 'bg-[#0a1226] hover:bg-[#121f3f] border-[#18274d] text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        currentTab === 'subscriptions_plans'
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-500/20 text-indigo-300'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">Planos</div>
                      <div className="text-[11px] text-white truncate">Mensal, Anual &amp; Pacotes</div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* BOTÃO EXPANDIR / ADICIONAR NOVO MÓDULO */}
        {selectedModules.length < 4 && onOpenAddModuleModal && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onOpenAddModuleModal}
              className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 hover:text-emerald-300 transition-all text-left cursor-pointer group shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-emerald-500/30">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                    Adicionar Módulo
                  </div>
                  <div className="text-[10px] text-white truncate">
                    IPTV, Empréstimo, Assinaturas...
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                + Expandir
              </span>
            </button>
          </div>
        )}

        {/* CATEGORY: SISTEMA */}
        <div className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">
          SISTEMA
        </div>

        {/* 5.1 AUTOMAÇÃO WHATSAPP */}
        <button
          onClick={() => handleTabClick('whatsapp')}
          className={`w-full group flex items-center justify-between p-2.5 rounded-2xl border transition-all text-left cursor-pointer ${
            currentTab === 'whatsapp'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400/50 text-white shadow-lg shadow-emerald-900/40'
              : 'bg-[#0e1834]/80 hover:bg-[#132247] border-[#1a2c54] text-slate-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                currentTab === 'whatsapp'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white truncate">Automação WhatsApp</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <div className="text-xs text-white truncate">Lembretes &amp; Vencimentos PIX</div>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 shrink-0 transition-transform ${
              currentTab === 'whatsapp' ? 'text-white translate-x-0.5' : 'text-slate-500 group-hover:text-slate-300'
            }`}
          />
        </button>

        {/* 6. CONFIGURAÇÕES */}
        <button
          onClick={() => handleTabClick('settings')}
          className={`w-full group flex items-center justify-between p-2.5 rounded-2xl border transition-all text-left cursor-pointer ${
            currentTab === 'settings'
              ? 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] border-purple-400/50 text-white shadow-lg shadow-purple-900/40'
              : 'bg-[#0e1834]/80 hover:bg-[#132247] border-[#1a2c54] text-slate-300 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                currentTab === 'settings'
                  ? 'bg-white/20 text-white'
                  : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              }`}
            >
              <Settings className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">Configurações</div>
              <div className="text-xs text-white truncate">Mercado Pago &amp; WhatsApp</div>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 shrink-0 transition-transform ${
              currentTab === 'settings' ? 'text-white translate-x-0.5' : 'text-slate-500 group-hover:text-slate-300'
            }`}
          />
        </button>

        {/* 7. MASTER ADMIN - Apenas para a conta John John Telas Premium */}
        {isMasterAdminAccount && (
          <button
            onClick={() => handleTabClick('master_admin')}
            className={`w-full group flex items-center justify-between p-2.5 rounded-2xl border transition-all text-left cursor-pointer ${
              currentTab === 'master_admin'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 border-amber-400/50 text-white shadow-lg shadow-amber-900/40'
                : 'bg-[#181510]/80 hover:bg-[#261f14] border-amber-500/20 text-amber-300/80 hover:text-amber-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                  currentTab === 'master_admin'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">Master Admin</div>
                <div className="text-xs text-amber-400/70 truncate">Painel SaaS &amp; Gestão</div>
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 shrink-0 transition-transform ${
                currentTab === 'master_admin' ? 'text-white translate-x-0.5' : 'text-amber-500 group-hover:text-amber-300'
              }`}
            />
          </button>
        )}
      </div>

      {/* Footer / Database Status & Logout */}
      <div className="p-3 border-t border-[#172547] space-y-2">
        <div className="px-3 py-2 bg-[#0e1935] border border-[#1b2b4f] rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-bold text-slate-300">Banco de Dados</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Conectado
          </span>
        </div>

        <button
          onClick={() => {
            if (onLogout) {
              onLogout();
            } else {
              handleSwitchUserClick(
                profile.email === 'dlinformatica3137@gmail.com'
                  ? 'betaof10@hotmail.com'
                  : 'dlinformatica3137@gmail.com'
              );
            }
            onCloseMobile?.();
          }}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-rose-300/90 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/25 hover:border-rose-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-rose-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Sair da conta</span>
          </div>
          <span className="text-[11px] font-bold text-slate-400 px-2 py-0.5 rounded-lg bg-black/40">
            {profile.full_name?.split(' ')[0] || 'Edvan'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Sidebar */}
      <aside
        className={`hidden lg:flex ${
          isCollapsedOnDesktop ? 'w-0 border-r-0 overflow-hidden' : 'w-64 xl:w-72'
        } bg-[#091124] border-r border-[#172547] flex-col shrink-0 h-full overflow-y-auto text-slate-300 select-none transition-all duration-200`}
      >
        <div className={isCollapsedOnDesktop ? 'hidden' : 'h-full w-64 xl:w-72 flex flex-col'}>
          {renderContent(false)}
        </div>
      </aside>

      {/* 2. Mobile Drawer Overlay */}
      {isOpenOnMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />
          {/* Slide-in panel */}
          <aside className="relative w-80 max-w-[85vw] bg-[#091124] border-r border-[#172547] h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200 text-slate-300 select-none">
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
