import React, { useEffect, useState } from 'react';
import {
  Ban,
  ShieldAlert,
  MessageCircle,
  LogOut,
  RefreshCw,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Tenant } from '../types/index.js';
import { api } from '../lib/api.js';
import { MULTI_GESTOR_LOGO } from '../constants/logo.js';

interface AdminBlockedScreenProps {
  tenant: Tenant;
  userEmail: string;
  onUnblocked: (updatedTenant: Tenant) => void;
  onLogout: () => void;
}

export const AdminBlockedScreen: React.FC<AdminBlockedScreenProps> = ({
  tenant,
  userEmail,
  onUnblocked,
  onLogout,
}) => {
  const [checking, setChecking] = useState(false);

  // Monitora periodicamente se o Administrador desbloqueou a conta
  useEffect(() => {
    const checkUnblocked = async () => {
      if (document.hidden) return;
      try {
        const tenants = await api.getTenants();
        const current = tenants.find((t) => t.id === tenant.id);
        if (current && !current.is_blocked) {
          onUnblocked(current);
        }
      } catch (err) {
        // silencioso no polling
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) checkUnblocked();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(checkUnblocked, 20000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [tenant.id, onUnblocked]);

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      const tenants = await api.getTenants();
      const current = tenants.find((t) => t.id === tenant.id);
      if (current && !current.is_blocked) {
        onUnblocked(current);
      }
    } catch (err) {
      console.error('Falha ao verificar status de bloqueio', err);
    } finally {
      setTimeout(() => setChecking(false), 500);
    }
  };

  const [supportPhone, setSupportPhone] = useState('5521989850026');

  useEffect(() => {
    api.getSupportWhatsAppConfig().then((cfg) => {
      if (cfg && cfg.phone) {
        let digits = cfg.phone.replace(/\D/g, '');
        if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
        if (digits) setSupportPhone(digits);
      }
    }).catch(() => {});
  }, []);

  const whatsappMessage = encodeURIComponent(
    `Olá Administrador! Minha conta no Multi Gestor (${tenant.trade_name || tenant.name} - ${userEmail}) está com o acesso suspenso. Gostaria de solicitar o desbloqueio.`
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-scroll overflow-x-hidden bg-[#060a17] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#180d19] via-[#090e1f] to-[#04060e] text-slate-100 select-none custom-scrollbar-rose">
      <div className="min-h-full w-full flex flex-col items-center justify-center p-4 sm:p-6 py-8">
        {/* Card Central de Bloqueio */}
        <div className="w-full max-w-lg bg-[#0b1329]/95 border-2 border-rose-500/40 rounded-3xl shadow-2xl shadow-rose-950/40 p-6 sm:p-8 flex flex-col items-center text-center backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
        
        {/* Logo Superior */}
        <div className="mb-4">
          <img
            src={MULTI_GESTOR_LOGO}
            alt="Multi Gestor"
            className="w-12 h-12 object-contain mx-auto drop-shadow"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/multigestor.png';
            }}
          />
        </div>

        {/* Ícone de Bloqueio com Efeito Pulsante */}
        <div className="relative mb-4">
          <div className="absolute -inset-2 bg-rose-500/20 rounded-full blur-md animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-rose-500/15 border-2 border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/60">
            <Ban className="w-8 h-8 text-rose-400" />
          </div>
        </div>

        {/* Badge de Alerta */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 mb-3">
          <Lock className="w-3.5 h-3.5 text-rose-400" />
          <span>Acesso Bloqueado pelo Administrador</span>
        </div>

        {/* Título Principal */}
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Sua Conta Está Suspensa
        </h2>

        {/* Descrição Explicativa */}
        <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed max-w-md">
          O Administrador Master bloqueou temporariamente o seu acesso ao <strong className="text-white">Multi Gestor</strong>.
          Enquanto o bloqueio estiver ativo, você não conseguirá realizar nenhuma ação ou acessar dados de clientes e serviços.
        </p>

        {/* Caixa de Detalhes da Conta */}
        <div className="w-full mt-5 p-3.5 bg-slate-950/80 border border-slate-800/90 rounded-2xl text-left text-xs space-y-1.5">
          <div className="flex justify-between items-center text-slate-400">
            <span>Cliente / Empresa:</span>
            <span className="font-bold text-white text-right truncate max-w-[200px]">
              {tenant.name || 'Empresa'}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>E-mail:</span>
            <span className="font-mono text-slate-200 text-right truncate max-w-[200px]">
              {userEmail}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Status Atual:</span>
            <span className="font-bold text-rose-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Bloqueado pelo Master
            </span>
          </div>
        </div>

        {/* Ações: Falar com Admin & Checar Desbloqueio */}
        <div className="w-full mt-6 space-y-2.5">
          <a
            href={`https://wa.me/${supportPhone}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/50 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-emerald-200" />
            <span>Falar com o Administrador no WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={handleManualCheck}
            disabled={checking}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checando com o servidor...' : 'Verificar se Já Fui Desbloqueado'}</span>
          </button>
        </div>

        {/* Botão Sair da Conta */}
        <div className="w-full mt-4 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>Sair desta conta e entrar com outro e-mail</span>
          </button>
        </div>

      </div>

      <div className="mt-4 text-[11px] text-slate-500 text-center max-w-sm">
        Assim que o Administrador liberar o acesso no Painel Master, sua tela será desbloqueada automaticamente.
      </div>

      </div>
    </div>
  );
};
