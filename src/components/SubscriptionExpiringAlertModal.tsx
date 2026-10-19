import React from 'react';
import {
  AlertTriangle,
  Clock,
  Zap,
  X,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Tenant } from '../types/index.js';

interface SubscriptionExpiringAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRenew: () => void;
  tenant: Tenant;
  daysRemaining: number;
  hoursRemaining: number;
  expiryDate: Date;
  planPrice: number;
}

export const SubscriptionExpiringAlertModal: React.FC<SubscriptionExpiringAlertModalProps> = ({
  isOpen,
  onClose,
  onRenew,
  tenant,
  daysRemaining,
  hoursRemaining,
  expiryDate,
  planPrice,
}) => {
  if (!isOpen) return null;

  const formattedPrice = `R$ ${planPrice.toFixed(2).replace('.', ',')}`;
  const formattedExpiry = expiryDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const modulesCount = tenant.selected_modules?.length || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col bg-[#0a1329] border-2 border-amber-500/50 rounded-2xl sm:rounded-3xl shadow-2xl shadow-amber-950/80 text-white overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Glow Header */}
        <div className="relative shrink-0 p-4 sm:p-5 bg-gradient-to-b from-amber-950/40 via-[#0d1b3d] to-transparent border-b border-amber-500/20">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
            title="Lembrar mais tarde"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 sm:gap-3 pr-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/20 animate-pulse">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-1">
                <Clock className="w-3 h-3 text-amber-400" />
                Alerta Preventivo de Renovação
              </div>
              <h3 className="text-base sm:text-lg lg:text-xl font-black text-white leading-tight">
                {daysRemaining <= 1
                  ? 'Sua assinatura expira em menos de 24 horas!'
                  : `Sua assinatura expira em ${daysRemaining} dias!`}
              </h3>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 sm:space-y-4 overscroll-contain">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Olá, <strong className="text-white">{tenant.trade_name || tenant.name}</strong>. Para garantir que suas operações, contratos, cobranças automáticas e clientes permaneçam ativos <strong>sem qualquer interrupção</strong>, renove seu acesso antecipadamente.
          </p>

          {/* Pricing & Expiry Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {/* Box 1: Preço */}
            <div className="p-3 sm:p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl sm:rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Valor da Renovação (30 Dias)
              </span>
              <div className="flex items-baseline gap-1 mt-0.5 sm:mt-1">
                <span className="text-xl sm:text-2xl font-black text-emerald-400">
                  {formattedPrice}
                </span>
                <span className="text-xs text-slate-400">/mês</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 sm:mt-1">
                {modulesCount} módulo{modulesCount > 1 ? 's' : ''} ativo{modulesCount > 1 ? 's' : ''}
              </span>
            </div>

            {/* Box 2: Tempo Restante */}
            <div className="p-3 sm:p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl sm:rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                Tempo Restante
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                <span className="text-base sm:text-lg font-black text-amber-300">
                  {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'} ({hoursRemaining}h)
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 sm:mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                Expira: {formattedExpiry}
              </span>
            </div>
          </div>

          {/* Perks reassurance */}
          <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Vantagens de renovar agora antes do bloqueio:</span>
            </div>
            <ul className="text-[11px] sm:text-xs text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
              <li>Liberação <strong>instantânea</strong> de mais 30 dias via PIX automático.</li>
              <li>Nenhum serviço ou lembrete de cliente interrompido.</li>
              <li>A nova validade de 30 dias é <strong>somada ao seu tempo restante</strong>!</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-between gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 sm:py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-center"
          >
            Lembrar mais tarde
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onRenew();
            }}
            className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-900/50 hover:shadow-emerald-900/70 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Zap className="w-4 h-4 fill-current shrink-0" />
            <span>Renovar Agora via PIX ({formattedPrice})</span>
            <ArrowRight className="w-4 h-4 ml-0.5 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
