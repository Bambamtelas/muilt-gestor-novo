import React from 'react';
import {
  Crown,
  ShieldCheck,
  LogOut,
  Menu,
  Sparkles,
  Clock,
  AlertTriangle,
  CreditCard,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Tenant, Profile } from '../types/index.js';
import { NavigationTab } from './Header.js';
import { MULTI_GESTOR_LOGO } from '../constants/logo.js';

interface TopNavProps {
  tenant: Tenant;
  profile: Profile;
  onOpenSubscriptionModal: () => void;
  onOpenExpiringDetails?: () => void;
  onSelectTab: (tab: NavigationTab) => void;
  onSwitchUser: (email: string) => void;
  onLogout?: () => void;
  onToggleMobileMenu?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  tenant,
  profile,
  onOpenSubscriptionModal,
  onOpenExpiringDetails,
  onSelectTab,
  onSwitchUser,
  onLogout,
  onToggleMobileMenu,
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Erro ao alternar tela inteira:', err);
    }
  };

  const isMasterAdminAccount = Boolean(
    profile.email?.toLowerCase().trim() === 'betaof10@hotmail.com' ||
    tenant.email?.toLowerCase().trim() === 'betaof10@hotmail.com'
  );
  const fullName = profile.full_name || tenant.name || (isMasterAdminAccount ? 'Admin Master' : 'Usuário');
  const email = profile.email || tenant.email || '';

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

  return (
    <header className="h-14 sm:h-16 w-full px-2.5 sm:px-6 border-b border-[#172547] bg-[#091124] backdrop-blur-md flex items-center justify-between sticky top-0 z-30 select-none shrink-0 gap-2 sm:gap-4">
      {/* Left: Mobile Menu Trigger + Principal Brand: Multi Gestor (M fora do quadradinho) */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-[#132247] border border-[#1e2f57] transition-all cursor-pointer shrink-0"
          aria-label="Menu de navegação"
          title="Ocultar / Exibir Menu Lateral"
        >
          <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* ÚNICA Logomarca e ÚNICO Nome Principal: Multi Gestor (M fora do quadradinho) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {/* Logomarca do M limpa, sem fundo branco e sem quadradinho ao redor */}
          <div className="shrink-0 flex items-center justify-center">
            <img
              src={MULTI_GESTOR_LOGO}
              alt="Multi Gestor"
              className="h-8 sm:h-9 w-auto max-w-[36px] sm:max-w-[42px] object-contain select-none drop-shadow-sm"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/multigestor.png';
              }}
            />
          </div>

          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-sm sm:text-lg font-black text-white tracking-tight truncate">
                Multi Gestor
              </span>
              <span className="px-1.5 py-0.2 rounded-md text-[8px] sm:text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                PRO
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-emerald-400/90 font-bold tracking-wider uppercase -mt-0.5 truncate hidden xl:block">
              SISTEMA MULTINEGOCIOS
            </span>
          </div>
        </div>
      </div>

      {/* Right: Botão Tela Cheia + Golden Lifetime Plan / Days Remaining Button + User Pill + Master Admin */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Opção de Abrir a Tela Inteira (Fullscreen) */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#0f1b38] hover:bg-[#162752] border border-[#1e2f57] hover:border-emerald-500/40 text-slate-300 hover:text-white transition-all text-xs font-bold shadow-sm cursor-pointer shrink-0"
          title={isFullscreen ? 'Sair da tela inteira (ESC)' : 'Abrir em tela inteira'}
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline">Tela Normal</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline">Tela Inteira</span>
            </>
          )}
        </button>

        {/* Dynamic Subscription Button / Badge (Vitalício vs Restam 2 dias vs Expirado) */}
        {isLifetime ? (
          isMasterAdminAccount ? (
            /* Conta Administrativa de Humberto Queiroz: Exibe puramente como informação, sem ação de botão para renovar */
            <div
              className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-[#2a1d08] to-[#3a280c] border border-amber-500/50 text-amber-300 text-xs font-black shadow-md shadow-amber-950/40 select-none cursor-default shrink-0"
              title="Acesso Vitalício do Administrador Master (Permanente)"
            >
              <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">ACESSO VITALÍCIO</span>
              <span className="sm:hidden text-[10px]">VIP</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
            </div>
          ) : (
            <button
              onClick={onOpenSubscriptionModal}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-[#2a1d08] to-[#3a280c] border border-amber-500/50 hover:border-amber-400 text-amber-300 hover:text-amber-200 text-xs font-black shadow-md shadow-amber-950/40 transition-all active:scale-95 cursor-pointer shrink-0"
              title="Acesso Vitalício Ativo"
            >
              <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">ACESSO VITALÍCIO</span>
              <span className="sm:hidden text-[10px]">VIP</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            </button>
          )
        ) : isExpired ? (
          <button
            onClick={onOpenSubscriptionModal}
            className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 border border-rose-500 hover:border-rose-400 text-rose-200 text-xs font-black shadow-lg shadow-rose-950/60 transition-all active:scale-95 cursor-pointer shrink-0 animate-pulse"
            title="Sua assinatura expirou. Clique para renovar"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Renovar</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Restam 2 dias badge */}
            <button
              type="button"
              onClick={onOpenExpiringDetails || onOpenSubscriptionModal}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/40 hover:border-amber-400 text-amber-300 text-[11px] sm:text-xs font-bold shadow-sm cursor-pointer transition-all active:scale-95"
              title="Clique para ver os detalhes da expiração"
            >
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
              <span className="text-white font-black whitespace-nowrap">
                <span className="hidden sm:inline">Restam </span>
                {daysRemaining > 0 ? `${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}` : '2 dias'}
              </span>
            </button>

            {/* Botão Renovar */}
            <button
              onClick={onOpenSubscriptionModal}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-[11px] sm:text-xs font-black shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer shrink-0"
              title="Clique para renovar a assinatura"
            >
              <CreditCard className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-950 shrink-0 hidden xs:inline" />
              <span>Renovar</span>
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-950 animate-ping shrink-0"></span>
            </button>
          </div>
        )}

        {/* Master Admin Quick Access - APENAS na conta John John Telas Premium */}
        {isMasterAdminAccount && (
          <button
            onClick={() => onSelectTab('master_admin')}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0"
            title="Painel Master Admin"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Admin Master</span>
          </button>
        )}

        {/* User Card Pill (Apenas no desktop/tablet para evitar quebras em telas pequenas) */}
        <div
          className="hidden md:flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#0f1b38] border border-[#1e2f57] text-left select-none shrink-0"
          title={`Conta conectada: ${email}`}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
            <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="text-xs font-bold text-white truncate max-w-[90px] lg:max-w-[130px]">
                {fullName}
              </span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                isLifetime
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : isExpired
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : isTrial
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {isLifetime
                  ? 'VIP'
                  : isExpired
                  ? 'EXPIRADO'
                  : isTrial
                  ? `TRIAL ${daysRemaining || 2}D`
                  : `ATIVO ${daysRemaining || 30}D`}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate max-w-[110px] lg:max-w-[130px] leading-tight hidden lg:block">
              {email}
            </div>
          </div>
        </div>

        {/* Quick Exit Icon */}
        <button
          onClick={() => {
            onLogout?.();
          }}
          className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-[#1e2f57]/50 hover:border-rose-500/20 transition-all cursor-pointer shrink-0"
          title="Sair da conta"
        >
          <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </header>
  );
};
