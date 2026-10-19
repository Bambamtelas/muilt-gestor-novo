import React, { useState, useEffect } from 'react';
import {
  Lock,
  CheckCircle2,
  Copy,
  Clock,
  QrCode,
  Zap,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  LogOut,
  MessageCircle,
  AlertCircle,
  ChevronDown,
  HandCoins,
  Tv,
  Building2,
  Repeat,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { SubscriptionPayment, Tenant, calculatePlanPrice, GlobalPlanPrices } from '../types/index.js';
import { MULTI_GESTOR_LOGO } from '../constants/logo.js';

interface SubscriptionExpiredBlockerProps {
  tenant: Tenant;
  userEmail: string;
  onPaymentApproved: (updatedTenant: Tenant) => void;
  onLogout: () => void;
}

export const SubscriptionExpiredBlocker: React.FC<SubscriptionExpiredBlockerProps> = ({
  tenant,
  userEmail,
  onPaymentApproved,
  onLogout,
}) => {
  const [order, setOrder] = useState<SubscriptionPayment | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(900); // 15 minutos
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supportPhone, setSupportPhone] = useState('5521989850026');
  const [globalPrices, setGlobalPrices] = useState<GlobalPlanPrices | null>(null);

  useEffect(() => {
    api.getGlobalPlanPrices()
      .then((prices) => {
        if (prices) setGlobalPrices(prices);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.getSupportWhatsAppConfig().then((cfg) => {
      if (cfg && cfg.phone) {
        let digits = cfg.phone.replace(/\D/g, '');
        if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
        if (digits) setSupportPhone(digits);
      }
    }).catch(() => {});
  }, []);

  // 1. Gera ou carrega a ordem PIX do Mercado Pago ao montar
  const fetchNewOrder = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.createSubscriptionOrder(tenant.id, userEmail);
      setOrder(res);
      setSecondsRemaining(900);
    } catch (err: any) {
      console.error('Falha ao gerar cobrança de assinatura:', err);
      setErrorMsg('Não foi possível gerar a cobrança PIX no momento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewOrder();
  }, [tenant.id, userEmail]);

  // 2. Polling automático a cada 3 segundos para detectar a aprovação do PIX
  useEffect(() => {
    if (!order || isSuccess || order.status === 'approved') return;

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
          setTimeout(() => {
            onPaymentApproved(activeTenant);
          }, 1200);
        }
      } catch (err) {
        // silencioso no polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [order, isSuccess, onPaymentApproved]);

  // 3. Temporizador regressivo de 15 minutos
  useEffect(() => {
    if (isSuccess) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchNewOrder();
          return 900;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSuccess]);

  const handleCopy = () => {
    if (order?.pix_copy_paste) {
      navigator.clipboard.writeText(order.pix_copy_paste);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleManualVerify = async () => {
    if (!order) return;
    setVerifying(true);
    setErrorMsg(null);
    try {
      const res = await api.checkOrderStatus(order.gateway_order_id || order.id, true);
      if (res.status === 'approved') {
        setIsSuccess(true);
        const activeTenant: Tenant = res.tenant || {
          ...tenant,
          subscription_status: 'active',
          subscription_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        };
        setTimeout(() => {
          onPaymentApproved(activeTenant);
        }, 1000);
      } else {
        setErrorMsg('Ainda não identificamos o recebimento do PIX. Aguarde alguns segundos após pagar no app do seu banco.');
      }
    } catch (err: any) {
      setErrorMsg('Falha ao checar confirmação. Tente novamente em instantes.');
    } finally {
      setVerifying(false);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      tabIndex={0}
      className="fixed inset-0 z-50 overflow-y-scroll overflow-x-hidden bg-[#050b1a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#131f42] via-[#070e24] to-[#040814] text-slate-100 select-none custom-scrollbar-rose outline-none"
    >
      <div className="min-h-full w-full max-w-2xl mx-auto flex flex-col items-center justify-start p-3 sm:p-5 pt-3 pb-20">
        
        {/* Top Header / Branding */}
        <div className="w-full flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src={MULTI_GESTOR_LOGO}
              alt="Multi Gestor"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/multigestor.png';
              }}
            />
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
                <span>MULTI GESTOR</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  PRO
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {tenant.trade_name || tenant.name || 'Sua Empresa'} • {userEmail}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 transition-all cursor-pointer shadow-sm shrink-0"
            title="Encerrar sessão e trocar de conta"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Trocar de Conta</span>
            <span className="sm:hidden">Sair</span>
          </button>
        </div>

        {/* Main Locked Card */}
        <div className="w-full bg-[#09132c]/95 border-2 border-rose-500/30 rounded-3xl shadow-2xl shadow-rose-950/40 overflow-hidden flex flex-col backdrop-blur-xl shrink-0">
          
          {/* Banner de Aviso de Bloqueio - Compacto e Bem Proporcionado */}
          <div className="p-4 sm:p-5 bg-gradient-to-b from-rose-950/60 via-rose-950/20 to-transparent border-b border-rose-500/20 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shadow-md shadow-rose-950/50 mb-2 animate-pulse">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>

            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                <Lock className="w-3 h-3 text-rose-400" />
                <span>Acesso Temporariamente Bloqueado</span>
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Sua Assinatura Expirou
            </h2>

            <p className="text-xs text-slate-300 max-w-lg mx-auto mt-1 leading-relaxed">
              O período de acesso ao <strong className="text-white">Multi Gestor</strong> foi encerrado.
              Para desbloquear imediatamente todas as suas ferramentas e clientes, confirme a renovação via PIX.
            </p>

            {/* Módulos Liberados em Linha Compacta */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 flex-wrap text-[11px] font-medium text-slate-300">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/80 border border-slate-800 text-emerald-300">
                <HandCoins className="w-3 h-3 text-emerald-400" /> Empréstimos
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/80 border border-slate-800 text-cyan-300">
                <Tv className="w-3 h-3 text-cyan-400" /> IPTV
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/80 border border-slate-800 text-blue-300">
                <Building2 className="w-3 h-3 text-blue-400" /> Negócios
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/80 border border-slate-800 text-amber-300">
                <Repeat className="w-3 h-3 text-amber-400" /> Planos de Streamings
              </span>
            </div>
          </div>

          {/* Payment Container (CAD de Pagamento Completo) */}
          <div className="p-4 sm:p-6 space-y-4">
            
            {isSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Pagamento Confirmado com Sucesso!
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Seu acesso foi renovado por <strong>+30 dias</strong>. Carregando seu sistema...
                </p>
              </div>
            ) : (
              <>
                {(() => {
                  const currentPlanPrice =
                    order?.amount ||
                    (tenant.has_custom_price && tenant.plan_monthly_price && tenant.plan_monthly_price > 0
                      ? tenant.plan_monthly_price
                      : calculatePlanPrice(tenant.selected_modules?.length || 1, globalPrices || undefined));
                  const formattedPlanPrice = `R$ ${currentPlanPrice.toFixed(2).replace('.', ',')}`;

                  return (
                    <div className="flex items-center justify-between gap-3 p-3 sm:p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Valor da Renovação Mensal
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                            {formattedPlanPrice}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            / 30 dias de acesso ({tenant.selected_modules?.length || 1} módulo{(tenant.selected_modules?.length || 1) > 1 ? 's' : ''})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold shrink-0">
                        <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin-slow shrink-0" />
                        <span>PIX válido por: {formatTimer(secondsRemaining)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* QR Code & Copia e Cola */}
                {loading ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Gerando QR Code PIX oficial...
                    </p>
                  </div>
                ) : order ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    
                    {/* QR Code Image */}
                    <div className="flex flex-col items-center justify-center p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                      <div className="relative p-2 bg-white rounded-xl shadow-lg shadow-black/60">
                        {order.qr_code_base64 ? (
                          <img
                            src={order.qr_code_base64}
                            alt="QR Code PIX Mercado Pago"
                            className="w-36 h-36 sm:w-40 sm:h-40 object-contain"
                          />
                        ) : (
                          <div className="w-36 h-36 sm:w-40 sm:h-40 flex flex-col items-center justify-center text-slate-400 text-xs">
                            <QrCode className="w-10 h-10 text-slate-300 mb-1.5" />
                            <span>QR Code PIX</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 mt-2 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        Aponte a câmera do app do seu banco
                      </span>
                    </div>

                    {/* PIX Copia e Cola */}
                    <div className="space-y-2.5">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Ou pague via PIX Copia e Cola:
                      </label>

                      <div className="relative">
                        <textarea
                          readOnly
                          value={order.pix_copy_paste || ''}
                          rows={3}
                          className="w-full p-2.5 text-[10px] font-mono bg-slate-950 border border-slate-800 rounded-xl text-slate-300 resize-none focus:outline-none focus:border-emerald-500 select-all"
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleCopy}
                        className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                          copied
                            ? 'bg-emerald-600 text-white shadow-emerald-950/60'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 active:scale-[0.99]'
                        }`}
                      >
                        {copied ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            <span>Código PIX Copiado com Sucesso!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copiar Código PIX</span>
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                        A liberação é <strong className="text-emerald-400">automática</strong> assim que você pagar.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Botão de Verificação Manual & Alerta de Erro */}
                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={handleManualVerify}
                    disabled={verifying || loading}
                    className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                    <span>{verifying ? 'Verificando no Mercado Pago...' : 'Já Paguei! Verificar e Liberar Agora'}</span>
                  </button>

                  <a
                    href={`https://wa.me/${supportPhone}?text=${encodeURIComponent(
                      `Olá! Preciso de ajuda para reativar minha conta do Multi Gestor (${tenant.name} - ${userEmail}).`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Suporte WhatsApp</span>
                  </a>
                </div>
              </>
            )}

          </div>

        </div>

        {/* Footer Info */}
        <div className="mt-3 text-center text-[11px] text-slate-500 max-w-md shrink-0">
          Multi Gestor — Pagamento processado com segurança via Mercado Pago PIX.
        </div>

      </div>
    </div>
  );
};
