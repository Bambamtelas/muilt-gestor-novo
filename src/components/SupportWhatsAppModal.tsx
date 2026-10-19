import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Phone,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { SupportWhatsAppConfig, DEFAULT_SUPPORT_WHATSAPP_CONFIG } from '../types/index.js';

interface SupportWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const SupportWhatsAppModal: React.FC<SupportWhatsAppModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('21989850026');
  const [defaultMessage, setDefaultMessage] = useState('Olá, preciso de suporte no Multi Gestor');
  const [enabled, setEnabled] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Limpa apenas dígitos do telefone
  const getCleanPhone = (val: string) => {
    let digits = val.replace(/\D/g, '');
    // Se digitou sem DDI (10 ou 11 dígitos, ex 21989850026), coloca 55
    if (digits.length === 10 || digits.length === 11) {
      digits = `55${digits}`;
    }
    return digits;
  };

  const cleanDigits = getCleanPhone(phone);

  const formatDisplayPhone = (raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) return '';
    // Sem DDI (11 dígitos: DDD + 9 dígitos)
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    // Com DDI 55 (13 dígitos)
    if (clean.length === 13 && clean.startsWith('55')) {
      return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    if (clean.length === 12 && clean.startsWith('55')) {
      return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
    }
    return raw;
  };

  const previewLink = `https://wa.me/${cleanDigits || '5521989850026'}?text=${encodeURIComponent(
    defaultMessage.trim() || 'Olá, preciso de suporte no Multi Gestor'
  )}`;

  const fetchConfig = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const data = await api.getSupportWhatsAppConfig();
      if (data) {
        setPhone(data.phone || DEFAULT_SUPPORT_WHATSAPP_CONFIG.phone);
        setDefaultMessage(data.default_message || DEFAULT_SUPPORT_WHATSAPP_CONFIG.default_message || '');
        setEnabled(data.enabled !== undefined ? data.enabled : true);
      }
    } catch (err: any) {
      console.error('Erro ao carregar suporte WhatsApp:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const pureDigits = phone.replace(/\D/g, '');
    if (!pureDigits || pureDigits.length < 8) {
      setFeedback({
        type: 'error',
        message: 'Por favor, informe um número de WhatsApp válido com DDD.',
      });
      setSaving(false);
      return;
    }

    try {
      await api.updateSupportWhatsAppConfig({
        phone: pureDigits,
        default_message: defaultMessage.trim() || 'Olá, preciso de suporte no Multi Gestor',
        enabled: enabled,
      });

      setFeedback({
        type: 'success',
        message: 'Número do WhatsApp de suporte atualizado com sucesso! O botão flutuante já está atualizado em todos os painéis.',
      });

      if (onUpdated) {
        onUpdated();
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Erro ao salvar WhatsApp de suporte:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Falha ao salvar configuração. Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg my-auto bg-[#0a1329] border border-emerald-500/40 rounded-2xl sm:rounded-3xl shadow-2xl shadow-emerald-950/60 overflow-hidden flex flex-col text-slate-100">
        {/* Header com Gradiente Verde WhatsApp */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-r from-emerald-950/60 via-[#0d1f36] to-[#0a1329] border-b border-[#172b4d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#25D366] to-[#128C7E] flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 shrink-0">
              <MessageCircle className="w-6 h-6 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  WhatsApp de Suporte
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Botão Flutuante
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Altere o número para onde os clientes vão ao clicar no suporte
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-5 mt-5 p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500 text-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Form Body */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs">Carregando configuração atual...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 text-xs">
            {/* Campo: Número de WhatsApp */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  Número do WhatsApp de Suporte
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Com DDD (ex: 21989850026)
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 21989850026"
                  className="w-full px-3.5 py-2.5 bg-[#070e1e] border border-[#1d3056] rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 text-sm"
                  required
                />
              </div>
              {phone && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>
                    Formato reconhecido:{' '}
                    <strong className="text-emerald-300 font-mono">
                      {formatDisplayPhone(phone)}
                    </strong>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    DDI: +55 (Brasil)
                  </span>
                </div>
              )}
            </div>

            {/* Campo: Mensagem Padrão */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                Mensagem Padrão Inicial (Pré-preenchida no WhatsApp)
              </label>
              <input
                type="text"
                value={defaultMessage}
                onChange={(e) => setDefaultMessage(e.target.value)}
                placeholder="Ex: Olá, preciso de suporte no Multi Gestor"
                className="w-full px-3.5 py-2.5 bg-[#070e1e] border border-[#1d3056] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50"
              />
              <p className="text-[10px] text-slate-400">
                Esta mensagem já aparecerá digitada quando o cliente clicar no botão para abrir o WhatsApp.
              </p>
            </div>

            {/* Toggle: Visibilidade do Botão */}
            <div className="p-3 bg-[#070e1e] border border-[#1d3056] rounded-xl flex items-center justify-between">
              <div>
                <div className="font-bold text-white text-xs">Exibir Botão Flutuante</div>
                <div className="text-[10px] text-slate-400">
                  Mostra o botão de WhatsApp no canto inferior direito das telas
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((prev) => !prev)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  enabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Prévia do Botão e Link de Teste */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Prévia do Link Gerado
                </span>
                <a
                  href={previewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold transition-all cursor-pointer"
                  title="Abrir no WhatsApp Web/App para testar"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Testar Número</span>
                </a>
              </div>
              <div className="p-2 bg-black/40 rounded-lg text-[10px] font-mono text-slate-300 break-all select-all border border-[#1b2b4f]">
                {previewLink}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-[#172b4d] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-lg shadow-emerald-950/60 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar WhatsApp de Suporte</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
