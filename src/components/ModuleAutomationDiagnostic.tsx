import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Send,
  Eye,
  CheckCheck,
  Layers,
  Activity,
  Tv,
  FileSpreadsheet,
  Coins,
  Repeat
} from 'lucide-react';
import { Tenant, WhatsAppAutomationConfig, WhatsAppDispatchLog } from '../types/index.js';
import { api } from '../lib/api.js';

interface ModuleAutomationDiagnosticProps {
  tenant: Tenant;
  onRefreshParent?: () => void;
}

type ModuleKey = 'loan' | 'iptv' | 'charge' | 'subscription';

interface PendingNoticeItem {
  id: string;
  source: 'loan' | 'iptv' | 'charge' | 'subscription';
  type: 'due_today' | 'due_tomorrow' | 'overdue';
  customer_name: string;
  phone: string;
  product: string;
  amount: number;
  due_date: string;
  preview_message: string;
}

export const ModuleAutomationDiagnostic: React.FC<ModuleAutomationDiagnosticProps> = ({
  tenant,
  onRefreshParent,
}) => {
  // Config & Status
  const [config, setConfig] = useState<WhatsAppAutomationConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [instanceStatus, setInstanceStatus] = useState<{
    connected: boolean;
    ownerPhone?: string;
    state?: string;
    instanceName?: string;
  } | null>(null);
  const [checkingInstance, setCheckingInstance] = useState(false);

  // Queue Data
  const [queueData, setQueueData] = useState<{
    todayDate: string;
    tomorrowDate: string;
    pendingToday: PendingNoticeItem[];
    pendingTomorrow: PendingNoticeItem[];
    pendingOverdue: PendingNoticeItem[];
    totalPending: number;
    totalOverdue: number;
  }>({
    todayDate: new Date().toISOString().slice(0, 10),
    tomorrowDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    pendingToday: [],
    pendingTomorrow: [],
    pendingOverdue: [],
    totalPending: 0,
    totalOverdue: 0,
  });
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  // Diagnostic Controls
  const [activeTab, setActiveTab] = useState<'all' | ModuleKey>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [safeTestMode, setSafeTestMode] = useState<boolean>(true);
  const [customTestPhone, setCustomTestPhone] = useState<string>('');
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  // Triggering State
  const [triggeringModule, setTriggeringModule] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<{
    success: boolean;
    targetModule?: string;
    message: string;
    dispatchedCount: number;
    dispatches?: WhatsAppDispatchLog[];
    timestamp: string;
  } | null>(null);

  // Live Brasília Clock
  const [brasiliaTime, setBrasiliaTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      try {
        const timeStr = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date());
        setBrasiliaTime(timeStr);
      } catch {}
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial data
  const loadData = async () => {
    setLoadingConfig(true);
    setLoadingQueue(true);
    setCheckingInstance(true);

    try {
      // 1. WhatsApp Config
      const conf = await api.getWhatsAppConfig(tenant.id);
      if (conf) {
        setConfig(conf);
        if (!customTestPhone && (conf.connected_phone || tenant.whatsapp)) {
          setCustomTestPhone((conf.connected_phone || tenant.whatsapp || '').replace(/\D/g, ''));
        }
      }

      // 2. Instance Status
      if (conf && conf.instance_name) {
        api.getWhatsAppInstanceStatus({
          server_url: conf.server_url,
          api_key: conf.api_key,
          instance_name: conf.instance_name,
        }).then((statusRes) => {
          setInstanceStatus({
            connected: Boolean(statusRes?.connected),
            ownerPhone: (statusRes as any)?.ownerPhone || conf.connected_phone,
            state: statusRes?.state || 'open',
            instanceName: conf.instance_name,
          });
        }).catch(() => {});
      }

      // 3. Pending Queue
      const queue = await api.getPendingAutomationNotices(tenant.id, true);
      if (queue) {
        setQueueData({
          todayDate: queue.todayDate || new Date().toISOString().slice(0, 10),
          tomorrowDate: queue.tomorrowDate || '',
          pendingToday: Array.isArray(queue.pendingToday) ? queue.pendingToday : [],
          pendingTomorrow: Array.isArray(queue.pendingTomorrow) ? queue.pendingTomorrow : [],
          pendingOverdue: Array.isArray(queue.pendingOverdue) ? queue.pendingOverdue : [],
          totalPending: queue.totalPending || 0,
          totalOverdue: queue.totalOverdue || 0,
        });
      }
      setLastRefreshedAt(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      console.warn('[Diagnostic] Erro ao carregar dados:', err);
    } finally {
      setLoadingConfig(false);
      setLoadingQueue(false);
      setCheckingInstance(false);
    }
  };

  useEffect(() => {
    if (tenant?.id) {
      loadData();
    }
  }, [tenant.id]);

  // Combined Queue Items
  const allQueueItems: PendingNoticeItem[] = useMemo(() => {
    return [
      ...queueData.pendingToday,
      ...queueData.pendingTomorrow,
      ...queueData.pendingOverdue,
    ];
  }, [queueData]);

  // Filtered by active tab and search
  const filteredItems = useMemo(() => {
    return allQueueItems.filter((item) => {
      const matchModule = activeTab === 'all' || item.source === activeTab;
      if (!matchModule) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.customer_name?.toLowerCase().includes(term) ||
        item.phone?.includes(term) ||
        item.product?.toLowerCase().includes(term)
      );
    });
  }, [allQueueItems, activeTab, searchTerm]);

  // Counts by module
  const moduleCounts = useMemo(() => {
    const counts = {
      loan: { today: 0, tomorrow: 0, overdue: 0, total: 0, amount: 0 },
      iptv: { today: 0, tomorrow: 0, overdue: 0, total: 0, amount: 0 },
      charge: { today: 0, tomorrow: 0, overdue: 0, total: 0, amount: 0 },
      subscription: { today: 0, tomorrow: 0, overdue: 0, total: 0, amount: 0 },
    };

    allQueueItems.forEach((item) => {
      const mod = item.source as ModuleKey;
      if (counts[mod]) {
        counts[mod].total += 1;
        counts[mod].amount += Number(item.amount) || 0;
        if (item.type === 'due_today') counts[mod].today += 1;
        if (item.type === 'due_tomorrow') counts[mod].tomorrow += 1;
        if (item.type === 'overdue') counts[mod].overdue += 1;
      }
    });

    return counts;
  }, [allQueueItems]);

  // Execute Immediate Trigger
  const handleTriggerModule = async (targetMod: ModuleKey | 'all') => {
    setTriggeringModule(targetMod);
    setTriggerResult(null);

    try {
      const targetPhoneToUse = safeTestMode && customTestPhone ? customTestPhone : undefined;
      const res = await api.runAutomatedDispatches(
        tenant.id,
        true, // force run
        targetMod,
        targetPhoneToUse
      );

      setTriggerResult({
        success: Boolean(res?.success),
        targetModule: targetMod,
        message: res?.message || 'Disparo concluído com sucesso!',
        dispatchedCount: res?.dispatchedCount || 0,
        dispatches: res?.dispatches || [],
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });

      // Refresh queue after dispatch
      await loadData();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      setTriggerResult({
        success: false,
        targetModule: targetMod,
        message: err?.message || 'Falha ao processar disparo de teste.',
        dispatchedCount: 0,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
    } finally {
      setTriggeringModule(null);
    }
  };

  // Modules metadata
  const modulesList: Array<{
    key: ModuleKey;
    title: string;
    shortTitle: string;
    description: string;
    icon: React.ReactNode;
    color: 'amber' | 'purple' | 'blue' | 'emerald';
    badgeColor: string;
    borderColor: string;
    bgColor: string;
    active: boolean;
  }> = [
    {
      key: 'loan',
      title: 'Empréstimos & Parcelas',
      shortTitle: 'Empréstimos',
      description: 'Contratos e parcelas ativas a vencer ou em atraso',
      icon: <Coins className="w-5 h-5 text-amber-400" />,
      color: 'amber',
      badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      borderColor: 'border-amber-500/30',
      bgColor: 'bg-amber-950/15',
      active: config?.charge_loans_enabled !== false,
    },
    {
      key: 'iptv',
      title: 'IPTV & Streaming',
      shortTitle: 'IPTV',
      description: 'Assinantes de listas, acessos e telas expirando',
      icon: <Tv className="w-5 h-5 text-purple-400" />,
      color: 'purple',
      badgeColor: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      borderColor: 'border-purple-500/30',
      bgColor: 'bg-purple-950/15',
      active: config?.charge_iptv_enabled !== false,
    },
    {
      key: 'charge',
      title: 'Negócios de Empresa',
      shortTitle: 'Negócios',
      description: 'Cobranças avulsas, vendas de balcão e notas comerciais',
      icon: <FileSpreadsheet className="w-5 h-5 text-sky-400" />,
      color: 'blue',
      badgeColor: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
      borderColor: 'border-sky-500/30',
      bgColor: 'bg-sky-950/15',
      active: config?.charge_business_enabled !== false,
    },
    {
      key: 'subscription',
      title: 'Assinaturas & Recorrência',
      shortTitle: 'Assinaturas',
      description: 'Mensalidades de planos e vendas de assinatura periódica',
      icon: <Repeat className="w-5 h-5 text-emerald-400" />,
      color: 'emerald',
      badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      borderColor: 'border-emerald-500/30',
      bgColor: 'bg-emerald-950/15',
      active: config?.charge_subscriptions_enabled !== false,
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-5">
      {/* 1. Header com Status Geral e Diagnóstico ao Vivo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Diagnóstico e Gatilho Imediato dos 4 Módulos</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-widest">
                  Live Tester
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Dispare mensagens de teste imediatas por módulo e audite a fila de automação em tempo real.
              </p>
            </div>
          </div>
        </div>

        {/* Status Indicators & Clock */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Relógio Brasília */}
          <div className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 text-[11px]">Brasília:</span>
            <span className="font-mono font-bold text-emerald-400">{brasiliaTime || '--:--:--'}</span>
          </div>

          {/* Status WhatsApp */}
          <div className="px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center gap-2 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                instanceStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            ></span>
            <span className="text-[11px] font-bold text-white">
              {instanceStatus?.connected ? 'WhatsApp Online' : 'Desconectado'}
            </span>
            {instanceStatus?.ownerPhone && (
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                ({instanceStatus.ownerPhone})
              </span>
            )}
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={loadData}
            disabled={loadingQueue || checkingInstance}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Atualizar status da fila em tempo real"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingQueue ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Controle de Teste Seguro (Para não incomodar clientes reais) */}
      <div className="p-3.5 bg-slate-950/80 border border-slate-800/90 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={safeTestMode}
              onChange={(e) => setSafeTestMode(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500 cursor-pointer"
            />
            <span className="font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Modo Teste Seguro (Direcionar para número de teste)</span>
            </span>
          </label>
          <span className="text-[11px] text-slate-400">
            {safeTestMode
              ? 'As mensagens serão disparadas para o número de teste abaixo sem notificar os clientes reais.'
              : '⚠️ Cuidado: As mensagens serão enviadas diretamente para os números reais cadastrados na fila.'}
          </span>
        </div>

        {safeTestMode && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">WhatsApp de Teste:</span>
            <input
              type="tel"
              value={customTestPhone}
              onChange={(e) => setCustomTestPhone(e.target.value)}
              placeholder="Ex: 85996079396"
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg text-xs font-mono font-bold text-white focus:outline-none w-36"
            />
          </div>
        )}
      </div>

      {/* 3. Os 4 Cards de Módulos com Disparo Individual Imediato */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {modulesList.map((m) => {
          const stats = moduleCounts[m.key];
          const isTriggering = triggeringModule === m.key;

          return (
            <div
              key={m.key}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                m.active
                  ? `${m.bgColor} ${m.borderColor} shadow-sm`
                  : 'bg-slate-950/40 border-slate-800/80 opacity-60'
              }`}
            >
              <div className="space-y-3">
                {/* Header do Card */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800">
                      {m.icon}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white leading-snug">{m.shortTitle}</h3>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${m.badgeColor}`}>
                        {m.active ? 'Ativo no Robô' : 'Pausado'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {m.description}
                </p>

                {/* Métricas da Fila em Tempo Real */}
                <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Vencendo Hoje:</span>
                    <span className="font-bold text-emerald-400 font-mono">{stats.today}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Vencendo Amanhã:</span>
                    <span className="font-bold text-blue-400 font-mono">{stats.tomorrow}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Em Atraso:</span>
                    <span className="font-bold text-rose-400 font-mono">{stats.overdue}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between font-bold text-white">
                    <span>Total na Fila:</span>
                    <span className="font-mono text-emerald-400">{stats.total} itens</span>
                  </div>
                </div>
              </div>

              {/* Botão de Disparo Imediato deste Módulo */}
              <div className="pt-3 mt-2 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => handleTriggerModule(m.key)}
                  disabled={isTriggering || triggeringModule !== null}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    m.color === 'amber'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/40'
                      : m.color === 'purple'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-950/40'
                      : m.color === 'blue'
                      ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-950/40'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                  }`}
                >
                  {isTriggering ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Disparando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Testar {m.shortTitle}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Feedback / Resultado do Último Disparo Imediato */}
      {triggerResult && (
        <div
          className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
            triggerResult.success
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {triggerResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Resultado do Disparo ({triggerResult.targetModule?.toUpperCase()}):</span>
                <span className="text-[10px] text-slate-400 font-mono">[{triggerResult.timestamp}]</span>
              </div>
              <p className="text-xs mt-0.5">{triggerResult.message}</p>
              {triggerResult.dispatches && triggerResult.dispatches.length > 0 && (
                <div className="mt-2 space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Registros Enviados:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {triggerResult.dispatches.map((d, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1"
                      >
                        <CheckCheck className="w-3 h-3 text-emerald-400" />
                        <span>{d.customer_name}</span>
                        <span className="text-slate-500">({d.phone})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTriggerResult(null)}
            className="text-xs text-slate-400 hover:text-white cursor-pointer px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 5. Visualizador Detalhado da Fila de Envio em Tempo Real */}
      <div className="pt-3 border-t border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Status da Fila de Envio em Tempo Real</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'itens'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Visualize exatamente quem está na fila para cada módulo antes ou durante a execução automática.
            </p>
          </div>

          {/* Botão de Disparo Geral de Todos os Módulos */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTriggerModule('all')}
              disabled={triggeringModule !== null}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Disparar todos os módulos ativos simultaneamente"
            >
              {triggeringModule === 'all' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Disparando Todos...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Disparar Varredura Geral</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filtros por Módulo e Busca */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Tabs dos 4 Módulos */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({allQueueItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('loan')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'loan'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🏦 Empréstimos ({moduleCounts.loan.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('iptv')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'iptv'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📺 IPTV ({moduleCounts.iptv.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('charge')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'charge'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🏢 Negócios ({moduleCounts.charge.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('subscription')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'subscription'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Assinaturas ({moduleCounts.subscription.total})
            </button>
          </div>

          {/* Campo de Busca */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente ou produto..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Tabela da Fila */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto" />
              <div className="text-xs font-bold text-white">Nenhum aviso pendente na fila para este filtro</div>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Todos os clientes deste módulo estão em dia ou os avisos de hoje já foram disparados com sucesso.
                Use os botões <b>Testar Módulo</b> acima para enviar uma mensagem diagnóstica imediata.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                    <th className="px-3.5 py-2.5">Módulo</th>
                    <th className="px-3.5 py-2.5">Tipo do Aviso</th>
                    <th className="px-3.5 py-2.5">Cliente</th>
                    <th className="px-3.5 py-2.5">WhatsApp</th>
                    <th className="px-3.5 py-2.5">Produto / Parcela</th>
                    <th className="px-3.5 py-2.5">Vencimento</th>
                    <th className="px-3.5 py-2.5 text-right">Valor</th>
                    <th className="px-3.5 py-2.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredItems.map((item) => {
                    const isExpanded = expandedPreviewId === item.id;
                    const moduleBadge =
                      item.source === 'loan'
                        ? { label: 'Empréstimo', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' }
                        : item.source === 'iptv'
                        ? { label: 'IPTV', color: 'bg-purple-500/10 text-purple-300 border-purple-500/20' }
                        : item.source === 'charge'
                        ? { label: 'Negócios', color: 'bg-sky-500/10 text-sky-300 border-sky-500/20' }
                        : { label: 'Assinatura', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' };

                    const typeBadge =
                      item.type === 'due_today'
                        ? { label: 'Hoje', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
                        : item.type === 'due_tomorrow'
                        ? { label: 'Amanhã', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' }
                        : { label: 'Atrasado', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${moduleBadge.color}`}>
                              {moduleBadge.label}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeBadge.color}`}>
                              {typeBadge.label}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-bold text-white whitespace-nowrap">
                            {item.customer_name}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                            {item.phone}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-300 whitespace-nowrap max-w-[180px] truncate">
                            {item.product}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {item.due_date}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
                          </td>
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setExpandedPreviewId(isExpanded ? null : item.id)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-all inline-flex items-center gap-1 cursor-pointer"
                              title="Ver mensagem exata"
                            >
                              <Eye className="w-3 h-3 text-slate-400" />
                              <span>{isExpanded ? 'Ocultar' : 'Ver Texto'}</span>
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-900/70 border-b border-slate-800/80">
                            <td colSpan={8} className="p-3">
                              <div className="bg-[#0b141a] p-3 rounded-xl border border-slate-800/80 space-y-2">
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>Mensagem renderizada para {item.customer_name} ({item.phone}):</span>
                                  <a
                                    href={`https://wa.me/55${item.phone.replace(/\D/g, '')}?text=${encodeURIComponent(item.preview_message)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-400 hover:underline flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Abrir no WhatsApp Web</span>
                                  </a>
                                </div>
                                <div className="text-[11px] text-slate-200 whitespace-pre-line font-mono bg-[#005c4b]/30 p-2.5 rounded-lg border border-[#005c4b]/40">
                                  {item.preview_message}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
