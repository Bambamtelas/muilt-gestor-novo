import React from 'react';
import {
  Wallet,
  LayoutDashboard,
  Receipt,
  Users,
  Package,
  BarChart3,
  Settings,
  ShieldAlert,
  Sparkles,
  Zap,
  Clock,
  CheckCircle,
  Crown,
  ChevronDown,
  UserCheck,
} from 'lucide-react';
import { Tenant, Profile, SubscriptionStatus, calculatePlanPrice } from '../types/index.js';

export type NavigationTab =
  | 'dashboard'
  | 'charges'
  | 'customers'
  | 'products'
  | 'reports'
  | 'settings'
  | 'master_admin'
  | 'businesses'
  | 'loans'
  | 'iptv'
  | 'iptv_customers'
  | 'iptv_plans'
  | 'iptv_apps'
  | 'subscriptions'
  | 'subscriptions_customers'
  | 'subscriptions_plans'
  | 'subscriptions_sales'
  | 'whatsapp';

interface HeaderProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  tenant: Tenant;
  profile: Profile;
  onOpenSubscriptionModal: () => void;
  onSwitchUser: (email: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  tenant,
  profile,
  onOpenSubscriptionModal,
  onSwitchUser,
}) => {
  const isMasterAdminAccount = Boolean(
    profile.email?.toLowerCase().trim() === 'betaof10@hotmail.com' ||
    tenant.email?.toLowerCase().trim() === 'betaof10@hotmail.com'
  );

  const getSubscriptionBadge = () => {
    switch (tenant.subscription_status) {
      case 'lifetime':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold rounded-full shadow-sm">
            <Crown className="w-3.5 h-3.5 text-purple-400" />
            <span>Acesso Vitalício Master</span>
          </div>
        );
      case 'active':
        const expiresDate = tenant.subscription_expires_at
          ? new Date(tenant.subscription_expires_at).toLocaleDateString('pt-BR')
          : '30 dias';
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full shadow-sm">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Ativo até {expiresDate}</span>
          </div>
        );
      case 'trial':
        const now = new Date().getTime();
        const end = new Date(tenant.trial_ends_at).getTime();
        const diffHours = Math.max(0, Math.round((end - now) / (1000 * 60 * 60)));
        const days = Math.floor(diffHours / 24);
        const hours = diffHours % 24;

        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-full shadow-sm">
            <Clock className="w-3.5 h-3.5 animate-pulse text-amber-400" />
            <span>
              Teste Grátis: {days > 0 ? `${days}d ` : ''}
              {hours}h restantes
            </span>
          </div>
        );
      case 'expired':
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-full shadow-sm">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Período Expirado</span>
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Company */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-600/20 group-hover:scale-105 transition-transform">
                <Wallet className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black text-white tracking-tight">Cobre</span>
                  <span className="text-xl font-black text-emerald-400 tracking-tight">Fácil</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    PIX
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium truncate max-w-[160px] sm:max-w-xs">
                  {tenant.trade_name || tenant.name}
                </div>
              </div>
            </div>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-3">
            {/* Subscription status pill */}
            <div className="hidden sm:flex items-center">
              {getSubscriptionBadge()}
            </div>

            {/* Subscribe / Renew Button */}
            {tenant.subscription_status !== 'lifetime' && (() => {
              const currentPrice =
                tenant.plan_monthly_price ||
                (tenant.selected_modules && tenant.selected_modules.length > 0
                  ? calculatePlanPrice(tenant.selected_modules.length)
                  : 24.9);
              return (
                <button
                  onClick={onOpenSubscriptionModal}
                  className="relative inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden xs:inline">Assinar PIX</span>
                  <span>R$ {currentPrice.toFixed(2).replace('.', ',')}</span>
                </button>
              );
            })()}

            {/* Profile & Switcher */}
            <div className="relative group">
              <button className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all text-left">
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                  {profile.full_name?.slice(0, 2) || 'CF'}
                </div>
                <div className="hidden md:block">
                  <div className="text-xs font-semibold text-slate-200 leading-tight">
                    {profile.full_name}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {isMasterAdminAccount ? 'Master Admin' : 'Lojista'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {/* User switcher dropdown on hover/focus */}
              <div className="absolute right-0 mt-1 w-64 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Alternar Perfil para Testes
                </div>
                <button
                  type="button"
                  onClick={() => onSwitchUser('dlinformatica3137@gmail.com')}
                  className={`w-full px-2.5 py-2 rounded-lg text-left text-xs transition-colors flex items-center justify-between ${
                    profile.email === 'dlinformatica3137@gmail.com'
                      ? 'bg-emerald-500/10 text-emerald-300 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div>DL Informática (Lojista)</div>
                    <div className="text-[10px] text-slate-500">dlinformatica3137@gmail.com</div>
                  </div>
                  {profile.email === 'dlinformatica3137@gmail.com' && (
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onSwitchUser('betaof10@hotmail.com')}
                  className={`w-full px-2.5 py-2 rounded-lg text-left text-xs transition-colors flex items-center justify-between ${
                    profile.email === 'betaof10@hotmail.com'
                      ? 'bg-purple-500/10 text-purple-300 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div>Admin Master (Vitalício)</div>
                    <div className="text-[10px] text-slate-500">betaof10@hotmail.com</div>
                  </div>
                  {profile.email === 'betaof10@hotmail.com' && (
                    <Crown className="w-4 h-4 text-purple-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onSwitchUser('betoqueiroz@hotmail.com')}
                  className={`w-full px-2.5 py-2 rounded-lg text-left text-xs transition-colors flex items-center justify-between ${
                    profile.email === 'betoqueiroz@hotmail.com'
                      ? 'bg-emerald-500/10 text-emerald-300 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div>Beto Queiroz</div>
                    <div className="text-[10px] text-slate-500">betoqueiroz@hotmail.com</div>
                  </div>
                  {profile.email === 'betoqueiroz@hotmail.com' && (
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60 text-xs">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              currentTab === 'dashboard'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => onSelectTab('charges')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              currentTab === 'charges'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Cobranças & Devedores</span>
          </button>

          <button
            onClick={() => onSelectTab('customers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              currentTab === 'customers'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Clientes</span>
          </button>

          <button
            onClick={() => onSelectTab('products')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              currentTab === 'products'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Produtos & Serviços</span>
          </button>

          <button
            onClick={() => onSelectTab('reports')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              currentTab === 'reports'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Relatórios Mensais</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-bold">
              IA
            </span>
          </button>

          <button
            onClick={() => onSelectTab('settings')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              currentTab === 'settings'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Configurações</span>
          </button>

          {isMasterAdminAccount && (
            <button
              onClick={() => onSelectTab('master_admin')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                currentTab === 'master_admin'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                  : 'text-purple-400/80 hover:text-purple-300 hover:bg-purple-950/30'
              }`}
            >
              <Crown className="w-4 h-4 text-purple-400" />
              <span>Painel Master Admin</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
