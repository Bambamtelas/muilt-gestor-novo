import React from 'react';
import { AlertTriangle, Clock, Zap, X, ArrowRight } from 'lucide-react';
import { Tenant } from '../types/index.js';

interface SubscriptionExpiringBannerProps {
  tenant: Tenant;
  daysRemaining: number;
  hoursRemaining: number;
  expiryDate: Date;
  planPrice: number;
  onRenew: () => void;
  onOpenDetails: () => void;
  onDismiss: () => void;
}

export const SubscriptionExpiringBanner: React.FC<SubscriptionExpiringBannerProps> = ({
  tenant,
  daysRemaining,
  hoursRemaining,
  expiryDate,
  planPrice,
  onRenew,
  onOpenDetails,
  onDismiss,
}) => {
  const formattedPrice = `R$ ${planPrice.toFixed(2).replace('.', ',')}`;
  const formattedExpiry = expiryDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <div className="relative z-30 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 border-b border-amber-500/40 text-white px-4 py-2.5 shadow-md shadow-amber-950/40 animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
        {/* Left message */}
        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0 animate-pulse">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="leading-tight">
            <span className="font-extrabold text-amber-300">
              ⚠️ Atenção: Sua assinatura expira em {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}{' '}
              <span className="text-amber-200/80 font-normal">({hoursRemaining}h restantes até {formattedExpiry})</span>.
            </span>
            <span className="hidden md:inline text-amber-100/90 ml-1.5 text-xs">
              Renove com PIX antes do bloqueio e mantenha seus acessos ativos sem interrupção.
            </span>
          </div>
        </div>

        {/* Right buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={onOpenDetails}
            className="px-2.5 py-1 text-xs text-amber-200 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
          >
            Ver Detalhes
          </button>

          <button
            type="button"
            onClick={onRenew}
            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-950/50 hover:shadow-emerald-950/70 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Renovar PIX ({formattedPrice})</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="p-1 text-amber-300 hover:text-white hover:bg-amber-800/40 rounded-lg transition-colors cursor-pointer ml-1"
            title="Ocultar aviso por enquanto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
