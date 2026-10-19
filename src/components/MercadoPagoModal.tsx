import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  Lock,
  Eye,
  EyeOff,
  Radio,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api.js';

interface MercadoPagoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const MercadoPagoModal: React.FC<MercadoPagoModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<{
    configured: boolean;
    valid: boolean;
    maskedToken: string;
    webhookUrl: string;
    accountInfo?: {
      id: number;
      nickname: string;
      first_name?: string;
      last_name?: string;
      email: string;
      site_id: string;
    } | null;
  } | null>(null);

  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const data = await api.getMercadoPagoConfig();
      setConfig(data);
    } catch (err) {
      console.error('Erro ao carregar configuração do Mercado Pago', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      setTokenInput('');
      setFeedback(null);
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setFeedback({ type: 'error', message: 'Por favor, informe o Access Token do Mercado Pago.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.saveMercadoPagoConfig(tokenInput.trim());
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Conectado com sucesso! Conta: ${res.account?.name || res.account?.nickname || 'Mercado Pago'} (${res.account?.email || ''})`,
        });
        setTokenInput('');
        await fetchConfig();
        if (onUpdated) onUpdated();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Credencial inválida no Mercado Pago.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Falha ao conectar com a API do Mercado Pago.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWebhook = () => {
    if (!config?.webhookUrl) return;
    navigator.clipboard.writeText(config.webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-sky-500/30 rounded-2xl w-full max-w-2xl my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col shadow-2xl shadow-sky-950/60 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-inner">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Vincular Conta Mercado Pago
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Liberação Automática PIX
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Reconhecimento instantâneo de pagamentos e renovação de +30 dias aos clientes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-200 text-sm">
          {/* Status Banner */}
          <div className="p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-950/70 border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-full ${
                  config?.configured && config?.valid
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {config?.configured && config?.valid ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">
                    {config?.configured && config?.valid
                      ? 'Conectado à API do Mercado Pago'
                      : 'Nenhuma Conta Vinculada (Modo Demonstração)'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      config?.configured && config?.valid
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {config?.configured && config?.valid ? 'PRODUÇÃO ATIVA' : 'PENDENTE'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {config?.configured && config?.valid
                    ? `Titular: ${config.accountInfo?.nickname || config.accountInfo?.first_name || 'Conta Vendedor'} • ${config.accountInfo?.email || ''}`
                    : 'Insira seu Access Token abaixo para receber pagamentos reais na sua conta'}
                </p>
              </div>
            </div>

            <button
              onClick={fetchConfig}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-end sm:self-center disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Testar Status</span>
            </button>
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 animate-in fade-in duration-200 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{feedback.message}</div>
            </div>
          )}

          {/* Form: Access Token Input */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Access Token de Produção do Mercado Pago</span>
                </label>
                <a
                  href="https://www.mercadopago.com.br/developers/panel/app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <span>Onde encontrar meu token?</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={
                    config?.maskedToken
                      ? `Token atual configurado: ${config.maskedToken}`
                      : 'Cole aqui: APP_USR-xxxxxxxxxxxxxxxxxxxx'
                  }
                  className="w-full pl-3.5 pr-24 py-2.5 bg-slate-950 border border-slate-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl text-xs text-white placeholder-slate-500 font-mono transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title={showToken ? 'Ocultar' : 'Exibir'}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                No portal do Mercado Pago Developers, acesse <strong>Suas Aplicações &gt; Credenciais de Produção</strong> e copie o campo <strong>Access Token</strong> (inicia com <code className="text-sky-300 font-mono">APP_USR-</code>).
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !tokenInput.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-950/60 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Validando e Conectando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Salvar e Vincular Conta</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Webhook Configuration Guide */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-white text-xs">
                Como Funciona a Liberação Automática de 30 Dias:
              </h3>
            </div>

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>O cliente clica em assinar/renovar e o sistema gera o <strong>PIX Oficial</strong> diretamente na sua conta do Mercado Pago.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Assim que o cliente paga no banco dele, o Mercado Pago envia uma notificação para o Webhook abaixo em <strong>tempo real</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>O sistema reconhece o pagamento, marca como <strong>Aprovado</strong> e adiciona automaticamente <strong>+30 dias</strong> de acesso!</span>
              </div>
            </div>

            <div className="pt-2">
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                URL do Webhook do seu Sistema (para cadastrar no Mercado Pago):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={config?.webhookUrl || `${window.location.origin}/api/mercadopago/webhook`}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 selection:bg-sky-500 selection:text-white"
                />
                <button
                  type="button"
                  onClick={handleCopyWebhook}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWebhook ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Cadastre essa URL em <strong>Mercado Pago Developers &gt; Suas Aplicações &gt; Webhooks &gt; Pagamentos (Payment)</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Status: {config?.configured && config?.valid ? '🟢 100% Operacional' : '🟡 Modo Demonstração'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
