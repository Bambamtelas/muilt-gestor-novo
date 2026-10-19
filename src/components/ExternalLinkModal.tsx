import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Store,
  ShoppingBag,
  Sparkles,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  Globe,
  Link as LinkIcon,
  Eye,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { ExternalLinkConfig, DEFAULT_EXTERNAL_LINK_CONFIG } from '../types/index.js';

interface ExternalLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const ExternalLinkModal: React.FC<ExternalLinkModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buttonText, setButtonText] = useState('Acesse nossa lojinha');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('Conheça nossos produtos exclusivos');
  const [enabled, setEnabled] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const data = await api.getExternalLinkConfig();
      if (data) {
        setButtonText(data.button_text || DEFAULT_EXTERNAL_LINK_CONFIG.button_text);
        setUrl(data.url || '');
        setDescription(data.description || DEFAULT_EXTERNAL_LINK_CONFIG.description || '');
        setEnabled(data.enabled !== undefined ? data.enabled : true);
      }
    } catch (err: any) {
      console.error('Erro ao carregar link externo:', err);
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
    try {
      const cleanUrl = url.trim();
      const updated = await api.updateExternalLinkConfig({
        button_text: buttonText.trim() || 'Acesse nossa lojinha',
        url: cleanUrl,
        description: description.trim(),
        enabled: enabled,
      });

      setFeedback({
        type: 'success',
        message: 'Configuração do link da lojinha salva com sucesso! Visível em tempo real em todos os painéis.',
      });

      if (onUpdated) {
        onUpdated();
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Erro ao salvar link externo:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Falha ao salvar configuração. Tente novamente.',
      });
    } finally {
      setSaving(false);
    }
  };

  const formattedPreviewUrl = url.trim().startsWith('http://') || url.trim().startsWith('https://')
    ? url.trim()
    : url.trim() ? `https://${url.trim()}` : '#';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0b1329] border border-emerald-500/30 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Store className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">Atualizar Links e Lojinha</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  Global
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Configure o botão e o link externo exibidos na Dashboard de todos os módulos do sistema
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
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
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs">Carregando configuração atual...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Toggle Ativo / Inativo */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-white block">Status de Exibição</span>
                  <span className="text-[11px] text-slate-400">
                    {enabled ? 'Link e banner ativos e visíveis para todos os clientes' : 'Oculto temporariamente nos painéis'}
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Texto do Botão */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Texto do Botão / Chamada</span>
                <span className="text-[10px] text-emerald-400 font-normal">Padrão: Acesse nossa lojinha</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="Acesse nossa lojinha"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs font-medium placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors pl-9"
                />
                <ShoppingBag className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
              <p className="text-[11px] text-slate-400">
                Texto que aparecerá no botão clicável dentro da Dashboard de qualquer módulo.
              </p>
            </div>

            {/* URL / Link Externo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Link Externo da Loja (URL)</span>
                <span className="text-[10px] text-slate-400 font-normal">Abre em nova aba</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://sua-loja-online.com.br ou https://wa.me/55..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors pl-9"
                />
                <LinkIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
              <p className="text-[11px] text-slate-400">
                Ao clicar no botão, o cliente será redirecionado para este endereço externo.
              </p>
            </div>

            {/* Frase / Subtítulo Promocional (Opcional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Texto de Apoio / Descrição Promocional (Opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Conheça nossos produtos exclusivos"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs font-medium placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <p className="text-[11px] text-slate-400">
                Frase descritiva que aparece ao lado do botão para incentivar o clique.
              </p>
            </div>

            {/* Pré-visualização em Tempo Real (Preview ao Vivo) */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <Eye className="w-3.5 h-3.5" />
                <span>Pré-visualização em Tempo Real (Como o cliente verá no painel)</span>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-inner">
                    <ShoppingBag className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white tracking-wide">
                        {buttonText.trim() || 'Acesse nossa lojinha'}
                      </span>
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Loja Oficial
                      </span>
                    </div>
                    {description.trim() && (
                      <p className="text-xs text-slate-300 truncate mt-0.5">
                        {description.trim()}
                      </p>
                    )}
                  </div>
                </div>

                <a
                  href={formattedPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!url.trim()) {
                      e.preventDefault();
                      alert('Insira uma URL válida para testar o redirecionamento.');
                    }
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-emerald-950/50 hover:from-emerald-400 hover:to-teal-400 transition-all shrink-0 cursor-pointer"
                >
                  <span>{buttonText.trim() || 'Acesse nossa lojinha'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 gap-3">
              <div>
                {url.trim() && (
                  <a
                    href={formattedPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Testar Link Agora</span>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando Alterações...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar Configurações</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
