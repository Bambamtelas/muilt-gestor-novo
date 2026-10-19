import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  X,
  Server,
  ExternalLink,
  Code,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api.js';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'sql' | 'env'>('status');

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [resStatus, resSchema] = await Promise.all([
        api.getSupabaseStatus(),
        api.getSupabaseSchema(),
      ]);
      setStatus(resStatus);
      setSchemaSql(resSchema.sql);
    } catch (err: any) {
      console.error('Erro ao buscar status do Supabase', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setSyncResult(null);
    }
  }, [isOpen]);

  const handleCopySql = () => {
    if (!schemaSql) return;
    navigator.clipboard.writeText(schemaSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSyncData = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.syncToSupabase();
      if (res.success) {
        setSyncResult(`✅ ${res.message}`);
      } else {
        setSyncResult(`❌ ${res.message}`);
      }
      await fetchStatus();
    } catch (err: any) {
      setSyncResult(`❌ Erro ao sincronizar: ${err?.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = Boolean(status?.connected);
  const isConfigured = Boolean(status?.configured);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl my-auto bg-[#091124] border border-teal-500/40 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-teal-950/80 text-white flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
        
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-6 bg-gradient-to-r from-teal-950/60 via-[#0c1836] to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0 shadow-lg shadow-teal-500/10">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Banco de Dados Supabase (PostgreSQL)</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    isConnected
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : isConfigured
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {isConnected ? '🟢 Conectado' : isConfigured ? '🟡 Configurado' : '⚪ Modo Embutido'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Armazenamento relacional PostgreSQL nativo com sincronização contínua
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'status'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Status da Conexão
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sql'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Script SQL (Tabelas)</span>
          </button>
          <button
            onClick={() => setActiveTab('env')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'env'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Como Conectar (.env)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Status Box */}
              <div
                className={`p-4 rounded-2xl border ${
                  isConnected
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                    : isConfigured
                    ? 'bg-amber-950/20 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {isConnected ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {isConnected
                          ? 'Supabase Conectado e Operacional'
                          : isConfigured
                          ? 'Credenciais Detectadas'
                          : 'Operando no Modo Armazenamento Isolado Seguro'}
                      </h4>
                      <p className="text-xs mt-1 leading-relaxed text-slate-300">
                        {status?.message || 'Verificando conexão com o Supabase...'}
                      </p>
                      {status?.latencyMs && (
                        <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 bg-black/40 rounded border border-white/10 text-emerald-400">
                          Latência: {status.latencyMs}ms
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={fetchStatus}
                    disabled={loading}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Testar Conexão</span>
                  </button>
                </div>
              </div>

              {/* URL Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    URL do Projeto Supabase
                  </span>
                  <div className="font-mono text-xs text-white truncate">
                    {status?.url || 'Não configurada (insira SUPABASE_URL no .env)'}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Sincronização Automática
                  </span>
                  <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Ativa em segundo plano</span>
                  </div>
                </div>
              </div>

              {/* Sincronização Manual */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Sincronização Manual com Supabase
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Força o envio de todos os clientes, cobranças, produtos e IPTV para o banco de dados.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSyncData}
                  disabled={syncing || !isConfigured}
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-950/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 ${syncing ? 'animate-bounce' : ''}`} />
                  <span>{syncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                </button>
              </div>

              {syncResult && (
                <div className="p-3 bg-slate-950 rounded-xl border border-teal-500/40 text-xs font-semibold text-teal-300">
                  {syncResult}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Script SQL Completo (PostgreSQL Supabase)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Copia e executa este script no SQL Editor do seu projeto Supabase para criar todas as 13 tabelas e índices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-teal-950/50 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar SQL'}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-teal-200 overflow-x-auto max-h-80 leading-relaxed select-all">
                  {schemaSql || 'Carregando script SQL...'}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'env' && (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-teal-400" />
                  <span>Passo a Passo de Conexão</span>
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 pt-1">
                  <li>
                    Acesse seu painel em{' '}
                    <a
                      href="https://supabase.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      supabase.com <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    e crie ou abra um projeto gratuito.
                  </li>
                  <li>
                    Vá no menu lateral em <strong>SQL Editor</strong>, cole o script da aba{' '}
                    <strong>"Script SQL (Tabelas)"</strong> e clique em <strong>RUN</strong>.
                  </li>
                  <li>
                    Vá em <strong>Project Settings &gt; API</strong> e copie sua <strong>Project URL</strong> e{' '}
                    <strong>anon / public key</strong> (ou service_role key).
                  </li>
                  <li>
                    Insira as variáveis no arquivo <code className="text-teal-300 bg-slate-900 px-1 rounded">.env</code>:
                  </li>
                </ol>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-[11px] text-teal-300 mt-2 space-y-1">
                  <div>SUPABASE_URL="https://seuid.supabase.co"</div>
                  <div>SUPABASE_ANON_KEY="eyJhbGciOi..."</div>
                  <div>SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..." # opcional</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Multi Gestor &bull; Supabase PostgreSQL Integration
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
