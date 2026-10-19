import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Copy,
  Clock,
  QrCode,
  Zap,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { SubscriptionPayment, Tenant, calculatePlanPrice, GlobalPlanPrices } from '../types/index.js';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  userEmail: string;
  onSuccess: (updatedTenant: Tenant) => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  tenant,
  userEmail,
  onSuccess,
}) => {
  const [order, setOrder] = useState<SubscriptionPayment | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(900); // 15 mins
  const [globalPrices, setGlobalPrices] = useState<GlobalPlanPrices | null>(null);

  useEffect(() => {
    api.getGlobalPlanPrices()
      .then((prices) => {
        if (prices) setGlobalPrices(prices);
      })
      .catch(() => {});
  }, []);

  const currentPlanPrice =
    order?.amount ||
    (tenant.has_custom_price && tenant.plan_monthly_price && tenant.plan_monthly_price > 0
      ? tenant.plan_monthly_price
      : calculatePlanPrice(tenant.selected_modules?.length || 1, globalPrices || undefined));
  const formattedPlanPrice = `R$ ${currentPlanPrice.toFixed(2).replace('.', ',')}`;

  // Load or create order when opened
  useEffect(() => {
    if (!isOpen) {
      setOrder(null);
      setIsSuccess(false);
      return;
    }

    let isMounted = true;
    const createOrder = async () => {
      setLoading(true);
      try {
        const res = await api.createSubscriptionOrder(tenant.id, userEmail);
        if (isMounted) {
          setOrder(res);
          setSecondsRemaining(900);
        }
      } catch (err) {
        console.error('Failed to create order', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    createOrder();

    return () => {
      isMounted = false;
    };
  }, [isOpen, tenant.id, userEmail]);

  // Polling for status check every 3 seconds
  useEffect(() => {
    if (!isOpen || !order || isSuccess || order.status === 'approved') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.checkOrderStatus(order.gateway_order_id || order.id);
        if (res.status === 'approved') {
          setIsSuccess(true);
          const activeTenant: Tenant = res.tenant || {
            ...tenant,
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          };
          onSuccess(activeTenant);
          if (isSupabaseConfigured) {
            try {
              (supabase
                .from('tenants')
                .update({
                  subscription_status: 'active',
                  subscription_expires_at: activeTenant.subscription_expires_at,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', tenant.id) as any)
                .then(() => {})
                .catch(() => {});
            } catch {}
          }
        }
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, order, isSuccess, onSuccess, tenant]);

  // 15-minute countdown timer
  useEffect(() => {
    if (!isOpen || isSuccess) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isSuccess]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (order?.pix_copy_paste) {
      navigator.clipboard.writeText(order.pix_copy_paste);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSimulatePayment = async () => {
    if (!order) return;
    setApproving(true);
    try {
      const res = await api.checkOrderStatus(order.gateway_order_id || order.id, true);
      if (res.status === 'approved') {
        setIsSuccess(true);
        const activeTenant: Tenant = res.tenant || {
          ...tenant,
          subscription_status: 'active',
          subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        };
        onSuccess(activeTenant);
        if (isSupabaseConfigured) {
          try {
            (supabase
              .from('tenants')
              .update({
                subscription_status: 'active',
                subscription_expires_at: activeTenant.subscription_expires_at,
                updated_at: new Date().toISOString(),
              })
              .eq('id', tenant.id) as any)
              .then(() => {})
              .catch(() => {});
          } catch {}
        }
      }
    } catch (err) {
      console.error('Simulation failed', err);
    } finally {
      setApproving(false);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="relative shrink-0 p-4 sm:p-6 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Mercado Pago &bull; Checkout PIX
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
            Assinatura Multi Gestor Pro
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tenha acesso ilimitado a disparos via WhatsApp, relatórios automáticos e gestão multinegócios.
          </p>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-6">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Pagamento Aprovado com Sucesso!</h3>
                <p className="text-slate-300 mt-2 text-sm max-w-md mx-auto">
                  Parabéns! Sua assinatura foi renovada por mais <strong>30 dias</strong>. Seu acesso está 100% ativo para cobranças e automações.
                </p>
              </div>

              <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-4 text-left max-w-md mx-auto space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Valor Pago:</span>
                  <span className="font-bold text-emerald-400">{formattedPlanPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Método:</span>
                  <span>PIX Instantâneo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ID da Transação:</span>
                  <span className="font-mono">{order?.gateway_order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Novo Status:</span>
                  <span className="text-emerald-400 font-semibold uppercase">Ativo (30 Dias)</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  window.location.reload();
                }}
                className="w-full max-w-md px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                Continuar para o Sistema
              </button>
            </div>
          ) : (
            <>
              {/* Pricing Box */}
              <div className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold">Valor do Plano Mensal</div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-3xl font-extrabold text-white">{formattedPlanPrice}</span>
                    <span className="text-xs text-slate-400">/ 30 dias de acesso</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>Expira em {formatTimer(secondsRemaining)}</span>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                  <p className="text-sm">Gerando QR Code PIX Mercado Pago...</p>
                </div>
              ) : (
                <>
                  {/* QR Code and Instructions */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-800/40 rounded-xl border border-slate-800">
                    <div className="relative p-2.5 bg-white rounded-xl shadow-md shrink-0">
                      {order?.qr_code_base64 ? (
                        <img
                          src={order.qr_code_base64}
                          alt="QR Code PIX Mercado Pago"
                          className="w-40 h-40 object-contain"
                        />
                      ) : (
                        <div className="w-40 h-40 flex items-center justify-center bg-slate-100 text-slate-500">
                          <QrCode className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700">
                        PIX
                      </div>
                    </div>

                    <div className="space-y-3 text-sm text-slate-300">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        Como pagar em 3 passos:
                      </div>
                      <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside leading-relaxed">
                        <li>Abra o aplicativo do seu banco ou carteira digital.</li>
                        <li>Escolha pagar via <strong>PIX com QR Code</strong> ou <strong>PIX Copia e Cola</strong>.</li>
                        <li>Confirme o valor de <strong>{formattedPlanPrice}</strong>. A liberação dos 30 dias é instantânea!</li>
                      </ol>
                    </div>
                  </div>

                  {/* Pix Copia e Cola Field */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Código PIX Copia e Cola</span>
                      {copied && <span className="text-emerald-400 normal-case font-medium">Copiado para a área de transferência!</span>}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={order?.pix_copy_paste || ''}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500/50"
                      />
                      <button
                        onClick={handleCopy}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>

                  {/* Polling feedback indicator */}
                  <div className="flex items-center justify-between text-xs text-slate-400 py-1">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>Aguardando confirmação do banco em tempo real...</span>
                    </div>
                    <span className="text-[11px] text-slate-500">ID: {order?.gateway_order_id}</span>
                  </div>

                  {/* Sandbox / Instant Demo Trigger */}
                  <div className="p-3.5 bg-emerald-950/20 border border-emerald-800/30 rounded-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-emerald-300">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>Modo Demonstração / Sandbox do Mercado Pago ativo.</span>
                    </div>
                    <button
                      onClick={handleSimulatePayment}
                      disabled={approving}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all shadow-md shadow-emerald-700/20 disabled:opacity-50 shrink-0"
                    >
                      {approving ? 'Validando...' : '⚡ Simular Aprovação PIX'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isSuccess && (
          <div className="shrink-0 p-4 bg-slate-950/70 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span>Transação protegida e auditada</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
