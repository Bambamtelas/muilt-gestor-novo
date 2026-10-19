import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Sparkles,
  ExternalLink,
  CheckCheck,
  AlertCircle,
  Copy,
  CheckCircle2,
  Smartphone,
  Radio,
} from 'lucide-react';
import { Charge, Customer, Tenant, WhatsAppAutomationConfig } from '../types/index.js';
import { formatWhatsAppMessage, TemplateType } from '../lib/whatsappTemplates.js';
import { api } from '../lib/api.js';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  charge: Charge;
  customer: Customer;
  tenant: Tenant;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  charge,
  customer,
  tenant,
}) => {
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const defaultTemplate: TemplateType =
    charge.status === 'paid'
      ? 'receipt'
      : charge.status === 'overdue'
      ? 'overdue'
      : new Date().toISOString().slice(0, 10) === charge.due_date
      ? 'due_today'
      : charge.due_date === tomorrowStr
      ? 'due_tomorrow'
      : 'friendly';

  const [template, setTemplate] = useState<TemplateType>(defaultTemplate);
  const [customText, setCustomText] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'warning' | 'info' | 'error';
    text: string;
    waLink?: string;
  } | null>(null);

  const [waConfig, setWaConfig] = useState<WhatsAppAutomationConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const prevIsOpenRef = useRef(false);
  const prevChargeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const isNewlyOpened = !prevIsOpenRef.current || prevChargeIdRef.current !== charge?.id;
      if (isNewlyOpened) {
        setTemplate(defaultTemplate);
        const initialMsg = formatWhatsAppMessage({
          charge,
          customer,
          tenant,
          templateType: defaultTemplate,
        });
        setCustomText(initialMsg);
        setStatusMessage(null);
      }
      prevChargeIdRef.current = charge?.id || null;

      // 1. Tenta carregar do localStorage primeiro
      try {
        const localSaved = localStorage.getItem(`cobre_whatsapp_automation_${tenant.id}`);
        if (localSaved) {
          const parsed = JSON.parse(localSaved);
          if (parsed) setWaConfig(parsed);
        }
      } catch (e) {}

      // 2. Sincroniza com a API do servidor
      setLoadingConfig(true);
      api.getWhatsAppConfig(tenant.id)
        .then((cfg) => {
          if (cfg) {
            setWaConfig(cfg);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingConfig(false));
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, charge?.id, tenant?.id]);

  const handleTemplateChange = (newTemplate: TemplateType) => {
    setTemplate(newTemplate);
    const updated = formatWhatsAppMessage({
      charge,
      customer,
      tenant,
      templateType: newTemplate,
    });
    setCustomText(updated);
  };

  const cleanPhone = (customer.whatsapp || '').replace(/\D/g, '');
  const formattedPhone =
    cleanPhone.length === 10 || cleanPhone.length === 11
      ? `55${cleanPhone}`
      : cleanPhone;
  const clientWaLink = cleanPhone ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(customText)}` : '';

  const handleOpenDirectWhatsApp = () => {
    if (!cleanPhone) {
      alert('O cliente selecionado não possui um número de WhatsApp cadastrado.');
      return;
    }
    window.open(clientWaLink, '_blank');
    setStatusMessage({
      type: 'success',
      text: `🚀 Conversa com ${customer.name} aberta no WhatsApp Web / App com a mensagem pronta para envio!`,
      waLink: clientWaLink,
    });
  };

  const handleSend = async () => {
    setSending(true);
    setStatusMessage(null);
    try {
      const res = await api.sendWhatsAppCharge({
        chargeId: charge.id,
        customerId: customer.id,
        tenantId: tenant.id,
        templateType: template,
        customMessage: customText,
        charge,
        customer,
        phone: customer.whatsapp || customer.phone,
        customerName: customer.name,
        amount: charge.amount,
        dueDate: charge.due_date,
        description: charge.description,
      });

      if (res.sentDirectly) {
        setStatusMessage({
          type: 'success',
          text: `✅ Cobrança enviada com sucesso para ${customer.name} direto pelo WhatsApp conectado da instância (${res.instanceName || waConfig?.instance_name || 'Instância WhatsApp'})! O cliente já recebeu no WhatsApp.`,
        });
      } else {
        const directLink = res.waDirectUrl || clientWaLink;
        setStatusMessage({
          type: 'warning',
          text: `⚠️ Não foi possível enviar diretamente pela instância conectada: ${res.error || 'A instância WhatsApp não está conectada no momento'}. Se desejar enviar manualmente, clique no botão "Abrir no WhatsApp Web" ao lado.`,
          waLink: directLink,
        });
      }
    } catch (err: any) {
      console.error('Failed to send WhatsApp message', err);
      setStatusMessage({
        type: 'error',
        text: `❌ Falha ao comunicar com o servidor da instância WhatsApp: ${err?.message || 'Erro inesperado'}. Se desejar enviar manualmente, clique no botão "Abrir no WhatsApp Web" ao lado.`,
        waLink: clientWaLink,
      });
    } finally {
      setSending(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(customText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  const isInstanceConnected = waConfig?.status === 'connected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white">Cobrança via WhatsApp</h2>
                {isInstanceConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Envio Direto Conectado</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Smartphone className="w-3 h-3 text-emerald-400" />
                    <span>WhatsApp Integrado</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Para <strong>{customer.name}</strong> &bull; {(customer.whatsapp || 'Sem número cadastrado')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Banner */}
        <div className="px-5 py-2.5 border-b text-xs flex items-center justify-between gap-3 flex-wrap bg-emerald-950/40 border-emerald-500/20 text-emerald-300">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              {isInstanceConnected ? (
                <>
                  <b>Disparo Direto Ativo:</b> A mensagem será enviada automaticamente pelo número conectado da sua instância (<b>{waConfig?.connected_phone || waConfig?.instance_name}</b>).
                </>
              ) : (
                <>
                  <b>Envio via WhatsApp:</b> Ao clicar em <b>Enviar Cobrança</b>, o envio será disparado automaticamente ou aberto no seu WhatsApp Web / App pronto para envio.
                </>
              )}
            </span>
          </div>

          {clientWaLink && (
            <button
              type="button"
              onClick={handleOpenDirectWhatsApp}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-all shadow cursor-pointer shrink-0 ml-auto"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir WhatsApp Web</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Template Selector */}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-2 block">
              Escolha o Tipo de Notificação
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => handleTemplateChange('friendly')}
                className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                  template === 'friendly'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold">😊 Amigável</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Lembrete cordial</div>
              </button>

              <button
                type="button"
                onClick={() => handleTemplateChange('due_tomorrow')}
                className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                  template === 'due_tomorrow'
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold">🔔 Vence Amanhã</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Aviso prévio</div>
              </button>

              <button
                type="button"
                onClick={() => handleTemplateChange('due_today')}
                className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                  template === 'due_today'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold">⏰ Vence Hoje</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Alerta do dia</div>
              </button>

              <button
                type="button"
                onClick={() => handleTemplateChange('overdue')}
                className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                  template === 'overdue'
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold">⚠️ Em Atraso</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Aviso de pendência</div>
              </button>

              <button
                type="button"
                onClick={() => handleTemplateChange('receipt')}
                className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer ${
                  template === 'receipt'
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold">✅ Comprovante</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Quitação confirmada</div>
              </button>
            </div>
          </div>

          {/* WhatsApp Message Preview Bubble */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Pré-visualização do Envio
              </label>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>

            {/* Simulated WhatsApp screen */}
            <div className="p-4 bg-[#0b141a] rounded-xl border border-slate-800 relative bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="max-w-md ml-auto bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-none p-3.5 shadow-md text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans relative">
                {customText}
                <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/70 mt-2">
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                </div>
              </div>
            </div>
          </div>

          {/* Editable text field */}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
              Editar Mensagem antes de disparar
            </label>
            <textarea
              rows={4}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 resize-y"
              placeholder="Digite sua mensagem personalizada..."
            />
          </div>

          {statusMessage && (
            <div className={`p-4 rounded-xl text-xs border flex flex-col gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : statusMessage.type === 'info'
                ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            }`}>
              <div className="flex items-start gap-2">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : statusMessage.type === 'info' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                )}
                <span className="leading-relaxed">{statusMessage.text}</span>
              </div>
              {(statusMessage.waLink || (statusMessage.type === 'warning' && clientWaLink)) && (
                <div className="pt-1 flex items-center gap-2 flex-wrap">
                  <a
                    href={statusMessage.waLink || clientWaLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir Conversa no WhatsApp Web / App Agora</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Texto Copiado!' : 'Copiar Mensagem'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-500 w-full sm:w-auto text-center sm:text-left">
            Chave PIX: <span className="font-mono text-slate-300 font-semibold">{tenant.pix_key || (tenant.email?.toLowerCase().trim() === 'betoqueiroz@hotmail.com' || tenant.email?.toLowerCase().trim() === 'betaof10@hotmail.com' ? (tenant.email || 'betoqueiroz@hotmail.com') : 'Não definida')}</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Fechar
            </button>

            {/* Botão de Envio Direto via WhatsApp Web / App */}
            <button
              type="button"
              onClick={handleOpenDirectWhatsApp}
              className="px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
              title="Abre o WhatsApp Web ou o App com o texto pré-preenchido pronto para enviar"
            >
              <ExternalLink className="w-4 h-4 text-emerald-400" />
              <span>Abrir no WhatsApp Web</span>
            </button>

            {/* Botão Principal de Envio da Cobrança */}
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
              title="Dispara automaticamente ou abre o WhatsApp com a mensagem pronta"
            >
              {sending ? (
                <>Enviando...</>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar Cobrança via WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
