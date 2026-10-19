import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  TrendingUp,
  Layers,
  FileText,
  DollarSign,
  Plus,
  Search,
  MessageCircle,
  FileSpreadsheet,
  BarChart2,
  PieChart as PieChartIcon,
  ArrowRight,
  ExternalLink,
  CheckCircle,
  CheckCircle2,
  Tv,
  LayoutDashboard,
  HandCoins,
  Building2,
  Smartphone,
  Sparkles,
  Package,
  Store,
  ShoppingBag,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Charge,
  Customer,
  Product,
  SystemStats,
  Tenant,
  ExternalLinkConfig,
  SupportWhatsAppConfig,
  DEFAULT_SUPPORT_WHATSAPP_CONFIG,
} from '../types/index.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import {
  loadIPTVSubscribersFromSupabase,
  loadIPTVPlansFromSupabase,
  loadIPTVAppsFromSupabase,
} from '../lib/supabaseIPTV.js';
import { GlobalSearch } from './GlobalSearch.js';

interface DashboardViewProps {
  stats: SystemStats;
  charges: Charge[];
  customers: Customer[];
  products?: Product[];
  tenant: Tenant;
  onOpenNewCharge: () => void;
  onOpenNewCustomer: () => void;
  onOpenWhatsApp: (charge: Charge) => void;
  onMarkAsPaid: (chargeId: string) => void;
  onOpenSubscriptionModal: () => void;
  onNavigateToReports: () => void;
  onNavigateToTab?: (tab: any) => void;
  onNewChargeForCustomer?: (customerId: string) => void;
  onQuickSellProduct?: (product: Product) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  charges,
  customers,
  products = [],
  tenant,
  onOpenNewCharge,
  onOpenNewCustomer,
  onOpenWhatsApp,
  onMarkAsPaid,
  onOpenSubscriptionModal,
  onNavigateToReports,
  onNavigateToTab,
  onNewChargeForCustomer,
  onQuickSellProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [chartType, setChartType] = useState<'pizza' | 'barras'>('pizza');
  const [chartRange, setChartRange] = useState<'7dias' | '30dias'>('7dias');

  // Módulos Ativos do Tenant
  const selectedModules = useMemo(() => {
    return tenant.selected_modules && tenant.selected_modules.length > 0
      ? tenant.selected_modules
      : ['loans', 'iptv', 'business', 'subscriptions'];
  }, [tenant.selected_modules]);

  const hasLoans = selectedModules.includes('loans');
  const hasIptv = selectedModules.includes('iptv');
  const hasBusiness = selectedModules.includes('business');
  const hasSubscriptions = selectedModules.includes('subscriptions');

  const isOnlyIptv = selectedModules.length === 1 && hasIptv;
  const isOnlyLoans = selectedModules.length === 1 && hasLoans;
  const isOnlyBusiness = selectedModules.length === 1 && hasBusiness;
  const isOnlySubscriptions = selectedModules.length === 1 && hasSubscriptions;

  // Estado dedicado para IPTV
  const [iptvSubscribers, setIptvSubscribers] = useState<any[]>([]);
  const [iptvPlans, setIptvPlans] = useState<any[]>([]);
  const [iptvApps, setIptvApps] = useState<any[]>([]);
  const [iptvLoading, setIptvLoading] = useState(false);

  // Estado dedicado para Empréstimos
  const [serverLoans, setServerLoans] = useState<any[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);

  useEffect(() => {
    if (hasLoans) {
      setLoansLoading(true);
      api
        .getLoans(tenant.id)
        .then((list) => {
          if (Array.isArray(list)) setServerLoans(list);
        })
        .catch(() => {})
        .finally(() => {
          setLoansLoading(false);
        });
    }
  }, [tenant.id, hasLoans]);

  useEffect(() => {
    if (hasIptv) {
      setIptvLoading(true);
      const subsP = isSupabaseConfigured && tenant?.id
        ? loadIPTVSubscribersFromSupabase(tenant.id).catch(() => api.getIPTVSubscribers(tenant.id))
        : api.getIPTVSubscribers(tenant.id);

      const plansP = isSupabaseConfigured && tenant?.id
        ? loadIPTVPlansFromSupabase(tenant.id).catch(() => api.getIPTVPlans(tenant.id))
        : api.getIPTVPlans(tenant.id);

      const appsP = isSupabaseConfigured && tenant?.id
        ? loadIPTVAppsFromSupabase(tenant.id).catch(() => api.getIPTVApps(tenant.id))
        : api.getIPTVApps(tenant.id);

      Promise.all([subsP, plansP, appsP])
        .then(([subs, plans, apps]) => {
          if (Array.isArray(subs)) setIptvSubscribers(subs);
          if (Array.isArray(plans)) setIptvPlans(plans);
          if (Array.isArray(apps)) setIptvApps(apps);
        })
        .finally(() => {
          setIptvLoading(false);
        });
    }
  }, [tenant.id, hasIptv]);

  // Link Externo / Lojinha Online (Configurado pelo Master Admin)
  const [externalLinkConfig, setExternalLinkConfig] = useState<ExternalLinkConfig | null>(null);

  useEffect(() => {
    api
      .getExternalLinkConfig()
      .then((cfg) => {
        if (cfg) setExternalLinkConfig(cfg);
      })
      .catch((err) => console.warn('[ExternalLink load error]', err));
  }, []);

  // WhatsApp de Suporte do Sistema (Configurado pelo Master Admin)
  const [supportWhatsAppConfig, setSupportWhatsAppConfig] = useState<SupportWhatsAppConfig>(DEFAULT_SUPPORT_WHATSAPP_CONFIG);

  useEffect(() => {
    api
      .getSupportWhatsAppConfig()
      .then((cfg) => {
        if (cfg && cfg.phone) setSupportWhatsAppConfig(cfg);
      })
      .catch((err) => console.warn('[SupportWhatsApp load error]', err));
  }, []);

  const supportPhoneClean = useMemo(() => {
    let digits = (supportWhatsAppConfig?.phone || '21989850026').replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) {
      digits = `55${digits}`;
    }
    return digits || '5521989850026';
  }, [supportWhatsAppConfig?.phone]);

  const formatMoney = (val?: number) =>
    (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const firstName = (tenant.trade_name || tenant.name || 'Cliente').split(' ')[0];

  // Datas
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

  // Cálculos para Negócios / Cobranças
  const paidCharges = useMemo(() => charges.filter((c) => c.status === 'paid'), [charges]);
  const todayPaid = useMemo(() => {
    return paidCharges
      .filter((c) => c.paid_at?.startsWith(todayStr))
      .reduce((acc, c) => acc + c.amount, 0);
  }, [paidCharges, todayStr]);

  const todayPaidCount = useMemo(() => {
    return paidCharges.filter((c) => c.paid_at?.startsWith(todayStr)).length;
  }, [paidCharges, todayStr]);

  // Cálculos para IPTV
  const iptvActiveCount = useMemo(() => {
    return iptvSubscribers.filter(
      (s) => s.status === 'active' || s.status === 'expiring_soon'
    ).length;
  }, [iptvSubscribers]);

  const iptvExpiringSoonCount = useMemo(() => {
    return iptvSubscribers.filter(
      (s) =>
        s.status === 'expiring_soon' ||
        s.expiration_date === todayStr ||
        s.expiration_date === tomorrowStr
    ).length;
  }, [iptvSubscribers, todayStr, tomorrowStr]);

  const iptvExpiredCount = useMemo(() => {
    return iptvSubscribers.filter(
      (s) => s.status === 'expired' || (s.expiration_date && s.expiration_date < todayStr)
    ).length;
  }, [iptvSubscribers, todayStr]);

  const iptvTotalMonthlyRevenue = useMemo(() => {
    return iptvSubscribers
      .filter((s) => s.status !== 'expired')
      .reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  }, [iptvSubscribers]);

  // Cálculos para Empréstimos
  const loanStats = useMemo(() => {
    let list = serverLoans;
    if (!list || list.length === 0) {
      try {
        const saved = localStorage.getItem(`loans_${tenant.id || 'default'}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
        }
      } catch {}
    }
    const safeList = list || [];
    const totalLent = safeList.reduce(
      (sum: number, l: any) => sum + (l.principalAmount || 0),
      0
    );
    return { totalLent, count: safeList.length, list: safeList };
  }, [serverLoans, tenant.id]);

  // Filtro de empréstimos para o Dashboard de Empréstimos
  const filteredLoans = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (loanStats.list || []).filter((l: any) => {
      const name = (l.customerName || '').toLowerCase();
      const phone = (l.customerPhone || '').toLowerCase();
      const desc = (l.description || '').toLowerCase();
      return name.includes(term) || phone.includes(term) || desc.includes(term);
    });
  }, [loanStats.list, searchTerm]);

  const handleOpenLoanWhatsApp = async (loan: any) => {
    const rawPhone = (loan.customerPhone || '').replace(/\D/g, '');
    if (!rawPhone) return;
    const phone =
      rawPhone.length <= 11 && !rawPhone.startsWith('55') ? `55${rawPhone}` : rawPhone;
    const message = `Olá ${loan.customerName}! Passando para lembrar do seu contrato referente a ${
      loan.description
    }, no valor de ${formatMoney(loan.principalAmount)}.`;
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    try {
      const res = await api.sendDirectWhatsApp({
        tenantId: tenant.id,
        phone,
        message,
        customerName: loan.customerName,
        description: `Contrato de Empréstimo: ${loan.description}`,
      });
      if (res.success && (res.method === 'evolution_api' || (res as any).sentDirectly)) {
        alert(`✅ Mensagem de cobrança enviada com sucesso para ${loan.customerName} direto pelo WhatsApp do seu aparelho!`);
        return;
      }
      alert(`⚠️ Não foi possível disparar pelo WhatsApp: ${(res as any)?.error || 'Instância desconectada'}. Verifique no menu Automação WhatsApp.`);
    } catch (err: any) {
      alert(`❌ Erro ao enviar mensagem para o WhatsApp.`);
    }
  };

  // Filtro de cobranças de negócios
  const filteredCharges = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return charges.filter((c) => {
      const custName = c.customer?.name || '';
      const phone = c.customer?.whatsapp || '';
      const desc = c.description || '';
      return (
        custName.toLowerCase().includes(term) ||
        phone.includes(term) ||
        desc.toLowerCase().includes(term)
      );
    });
  }, [charges, searchTerm]);

  // Filtro de clientes IPTV
  const filteredIPTVSubscribers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return iptvSubscribers.filter((s) => {
      const name = (s.customer_name || s.name || '').toLowerCase();
      const phone = (s.whatsapp || '').toLowerCase();
      const server = (s.server_name || '').toLowerCase();
      const plan = (s.plan_name || '').toLowerCase();
      const mac = (s.username_or_mac || s.username || '').toLowerCase();
      return (
        name.includes(term) ||
        phone.includes(term) ||
        server.includes(term) ||
        plan.includes(term) ||
        mac.includes(term)
      );
    });
  }, [iptvSubscribers, searchTerm]);

  // Gráfico de IPTV (Status dos Clientes)
  const iptvPieData = useMemo(() => {
    const active = iptvActiveCount;
    const expiring = iptvExpiringSoonCount;
    const expired = iptvExpiredCount;
    const trial = iptvSubscribers.filter((s) => s.status === 'trial').length;

    return [
      { name: 'Ativos', value: active > 0 ? active : 1, color: '#10b981' },
      { name: 'A Vencer', value: expiring > 0 ? expiring : 1, color: '#3b82f6' },
      { name: 'Vencidos', value: expired > 0 ? expired : 1, color: '#f43f5e' },
      { name: 'Em Teste', value: trial > 0 ? trial : 1, color: '#a855f7' },
    ];
  }, [iptvActiveCount, iptvExpiringSoonCount, iptvExpiredCount, iptvSubscribers]);

  // Gráfico de Negócios (Recebido vs A Vencer vs Vencido)
  const businessPieData = useMemo(() => {
    const paidVal = stats.totalPaidAmount || 0;
    const pendingVal = stats.totalPendingAmount || 0;
    const overdueVal = stats.totalOverdueAmount || 0;

    return [
      { name: 'Recebido', value: paidVal > 0 ? paidVal : 1, color: '#10b981' },
      { name: 'A Vencer', value: pendingVal > 0 ? pendingVal : 1, color: '#3b82f6' },
      { name: 'Vencido', value: overdueVal > 0 ? overdueVal : 1, color: '#f43f5e' },
      { name: 'Hoje', value: todayPaid > 0 ? todayPaid : 1, color: '#ea580c' },
    ];
  }, [stats, todayPaid]);

  // Dados diários de vendas
  const chartData = useMemo(() => {
    const days = chartRange === '7dias' ? 7 : 30;
    const data: { name: string; valor: number; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const dayTotal = paidCharges
        .filter((c) => c.paid_at?.startsWith(dayStr))
        .reduce((sum, c) => sum + c.amount, 0);
      const dayCount = paidCharges.filter((c) => c.paid_at?.startsWith(dayStr)).length;
      data.push({ name: label, valor: dayTotal, count: dayCount });
    }
    return data;
  }, [chartRange, paidCharges]);

  // Abertura de WhatsApp para cliente IPTV
  const handleOpenIPTVWhatsApp = async (subscriber: any) => {
    const rawPhone = (subscriber.whatsapp || '').replace(/\D/g, '');
    if (!rawPhone) return;
    const phone =
      rawPhone.length <= 11 && !rawPhone.startsWith('55') ? `55${rawPhone}` : rawPhone;
    const expDate = subscriber.expiration_date
      ? new Date(subscriber.expiration_date + 'T00:00:00').toLocaleDateString('pt-BR')
      : '';
    const message = `Olá ${
      subscriber.customer_name || 'cliente'
    }! Passando para lembrar do seu plano IPTV (${
      subscriber.plan_name || 'Mensal'
    }), com vencimento em ${expDate}. Caso queira renovar, estamos à disposição!`;
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    try {
      const res = await api.sendDirectWhatsApp({
        tenantId: tenant.id,
        phone,
        message,
        customerName: subscriber.customer_name || 'Assinante IPTV',
        description: `Lembrete IPTV: ${subscriber.plan_name || 'Plano'}`,
      });
      if (res.success && (res.method === 'evolution_api' || (res as any).sentDirectly)) {
        alert(`✅ Mensagem IPTV enviada com sucesso para ${subscriber.customer_name} direto pelo WhatsApp!`);
        return;
      }
      alert(`⚠️ Não foi possível disparar pelo WhatsApp: ${(res as any)?.error || 'Instância desconectada'}. Verifique no menu Automação WhatsApp.`);
    } catch {
      alert(`❌ Erro ao enviar mensagem para o WhatsApp.`);
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. HEADER DO DASHBOARD */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-[#0d162e] via-[#091124] to-[#0d162e] p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#1b2b4f] shadow-lg">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Olá, {firstName}!
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              Tempo Real
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {isOnlyIptv
              ? 'Painel do Operador IPTV 4K - Gestão de Assinantes, Vencimentos e Planos'
              : isOnlyLoans
              ? 'Painel de Gestão de Empréstimos e Cobranças Parceladas'
              : isOnlyBusiness
              ? 'Painel de Vendas, Clientes e Cobranças Empresariais'
              : 'Indicadores de faturamento, controle de vencimentos e métricas operacionais'}
          </p>
        </div>

        {/* Barra de Pesquisa */}
        {!isOnlyIptv && (
          <div className="w-full lg:w-[320px] xl:w-[420px] 2xl:w-[460px] shrink-0">
            <GlobalSearch
              customers={customers}
              charges={charges}
              products={products}
              onSelectTab={onNavigateToTab || (() => {})}
              onNewChargeForCustomer={onNewChargeForCustomer}
              onQuickSellProduct={onQuickSellProduct}
            />
          </div>
        )}
      </div>

      {/* BANNER PROMOCIONAL / LOJINHA ONLINE (CONFIGURADO PELO ADMIN MASTER) */}
      {externalLinkConfig?.enabled && (
        <div className="bg-gradient-to-r from-[#0d1e34] via-[#091526] to-[#0d1e34] border border-emerald-500/35 hover:border-emerald-500/60 transition-all rounded-2xl sm:rounded-3xl p-3.5 sm:p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 shadow-xl shadow-emerald-950/20">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-500/15 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-inner">
              <Store className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base sm:text-lg font-black text-white tracking-tight">
                  {externalLinkConfig.button_text || 'Acesse nossa lojinha'}
                </span>
                <span className="text-xs uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Loja Online
                </span>
              </div>
              {externalLinkConfig.description && (
                <p className="text-xs text-white truncate mt-0.5">
                  {externalLinkConfig.description}
                </p>
              )}
            </div>
          </div>

          {externalLinkConfig.url ? (
            <a
              href={
                externalLinkConfig.url.startsWith('http://') || externalLinkConfig.url.startsWith('https://')
                  ? externalLinkConfig.url
                  : `https://${externalLinkConfig.url}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-950/50 hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 cursor-pointer"
            >
              <span>{externalLinkConfig.button_text || 'Acesse nossa lojinha'}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500/60 to-teal-500/60 text-white font-black text-xs sm:text-sm rounded-xl shadow-md opacity-80 shrink-0 select-none">
              <span>{externalLinkConfig.button_text || 'Acesse nossa lojinha'}</span>
              <ExternalLink className="w-4 h-4" />
            </div>
          )}
        </div>
      )}

      {/* 2. OS CARDS PRINCIPAIS CONFORME O MÓDULO CONTRATADO */}

      {/* CASO A: MÓDULO EXCLUSIVO IPTV */}
      {isOnlyIptv ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {/* CARD 1: ASSINANTES IPTV (Lilás Roxo) */}
          <div
            onClick={() => onNavigateToTab && onNavigateToTab('iptv_customers')}
            className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#9333ea] to-[#6b21a8] text-white shadow-xl shadow-purple-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-purple-100">
                ASSINANTES IPTV
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
                {iptvSubscribers.length}
              </div>
              <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-purple-100 font-medium">
                <span className="truncate">
                  {iptvActiveCount} ativos • {iptvExpiringSoonCount} a vencer
                </span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>
          </div>

          {/* CARD 2: FATURAMENTO MENSAL ESTIMADO (Verde) */}
          <div
            onClick={() => onNavigateToTab && onNavigateToTab('iptv_customers')}
            className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-xl shadow-emerald-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-100">
                RECEITA MENSAL
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
                {formatMoney(iptvTotalMonthlyRevenue)}
              </div>
              <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-emerald-100 font-medium">
                <span className="truncate">Estimativa de mensalidades</span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>
          </div>

          {/* CARD 3: PLANOS IPTV (Laranja) */}
          <div
            onClick={() => onNavigateToTab && onNavigateToTab('iptv_plans')}
            className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-xl shadow-orange-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-orange-100">
                PLANOS IPTV
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
                {iptvPlans.length} Planos
              </div>
              <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-orange-100 font-medium">
                <span className="truncate">Planos configurados</span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>
          </div>

          {/* CARD 4: APLICATIVOS (Azul) */}
          <div
            onClick={() => onNavigateToTab && onNavigateToTab('iptv_apps')}
            className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white shadow-xl shadow-blue-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-100">
                APLICATIVOS
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
                {iptvApps.length} Apps
              </div>
              <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-blue-100 font-medium">
                <span className="truncate">Players &amp; Dispositivos</span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>
          </div>
        </div>
      ) : isOnlyLoans ? (
        /* CASO B: MÓDULO EXCLUSIVO EMPRÉSTIMOS */
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
          <div
            onClick={() => onNavigateToTab && onNavigateToTab('loans')}
            className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-xl shadow-emerald-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-100">
                TOTAL EMPRESTADO
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                <HandCoins className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
                R$ {loanStats.totalLent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-emerald-100 font-medium">
                <span className="truncate">{loanStats.count} contratos</span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>
          </div>

          <div
            onClick={() => onNavigateToTab && onNavigateToTab('loans')}
            className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-xl shadow-orange-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-orange-100">
                CONTRATOS ATIVOS
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
                {loanStats.count} Empréstimos
              </div>
              <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-orange-100 font-medium">
                <span className="truncate">Gestão de parcelas</span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>
          </div>

          <div
            onClick={() => onNavigateToTab && onNavigateToTab('customers')}
            className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white shadow-xl shadow-blue-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-100">
                CLIENTES
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
                {customers.length} Clientes
              </div>
              <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-blue-100 font-medium">
                <span className="truncate">Cadastro de tomadores</span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>
          </div>

          <div
            onClick={() => onNavigateToTab && onNavigateToTab('charges')}
            className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] text-white shadow-xl shadow-purple-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-purple-100">
                COBRANÇAS
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
                {charges.length} Parcelas
              </div>
              <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-purple-100 font-medium">
                <span className="truncate">Boletos e PIX</span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CASO C: PADRÃO / NEGÓCIOS / MULTI-MÓDULOS */
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
          <div
            onClick={() =>
              onNavigateToTab ? onNavigateToTab('dashboard') : onNavigateToReports()
            }
            className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-xl shadow-orange-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-orange-100">
                DASHBOARD
              </span>
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
                {formatMoney(todayPaid)}
              </div>
              <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-orange-100 font-medium">
                <span className="truncate">{todayPaidCount} vendas hoje</span>
                <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
              </div>
            </div>
          </div>

          {hasLoans && (
            <div
              onClick={() => onNavigateToTab && onNavigateToTab('loans')}
              className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-xl shadow-emerald-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-100">
                  EMPRÉSTIMOS
                </span>
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                  <HandCoins className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
                  R$ {loanStats.totalLent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-emerald-100 font-medium">
                  <span className="truncate">{loanStats.count} contratos</span>
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
              </div>
            </div>
          )}

          {hasBusiness && (
            <div
              onClick={() => onNavigateToTab && onNavigateToTab('customers')}
              className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white shadow-xl shadow-blue-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-100">
                  NEGÓCIOS
                </span>
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-lg font-black tracking-tight text-white">
                  Clientes &amp; Vendas
                </div>
                <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-blue-100 font-medium">
                  <span className="truncate">CRM e Cobranças</span>
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
              </div>
            </div>
          )}

          {hasIptv && (
            <div
              onClick={() => onNavigateToTab && onNavigateToTab('iptv_customers')}
              className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#9333ea] to-[#6b21a8] text-white shadow-xl shadow-purple-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-purple-100">
                    IPTV
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-black bg-white/20 text-white border border-white/30">
                    4K
                  </span>
                </div>
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
                  <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-lg font-black tracking-tight text-white">
                  {iptvSubscribers.length} Assinantes
                </div>
                <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-purple-100 font-medium">
                  <span className="truncate">Planos &amp; Apps</span>
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. GRÁFICOS INTERATIVOS CONFORME O MÓDULO */}
      <div className="p-5 rounded-2xl bg-[#0f1b38] border border-[#1e2f57] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1b2b4f]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  {isOnlyIptv
                    ? 'Status dos Assinantes IPTV'
                    : isOnlyLoans
                    ? 'Fluxo de Empréstimos'
                    : 'Recebido por Dia'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {chartType === 'pizza' ? 'Gráfico de Pizza' : 'Gráfico de Barras'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isOnlyIptv
                  ? 'Distribuição de assinantes ativos, a vencer, vencidos e testes'
                  : 'Visualização dos indicadores operacionais'}
              </p>
            </div>
          </div>

          {/* Toggle de Controles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="p-1 bg-[#091124] border border-[#1b2b4f] rounded-xl flex items-center gap-1 text-xs">
              <button
                onClick={() => setChartType('pizza')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  chartType === 'pizza'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <PieChartIcon className="w-3.5 h-3.5" />
                <span>Pizza</span>
              </button>
              <button
                onClick={() => setChartType('barras')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  chartType === 'barras'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Barras</span>
              </button>
            </div>

            {!isOnlyIptv && (
              <div className="p-1 bg-[#091124] border border-[#1b2b4f] rounded-xl flex items-center gap-1 text-xs">
                <button
                  onClick={() => setChartRange('7dias')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    chartRange === '7dias'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  7 dias
                </button>
                <button
                  onClick={() => setChartRange('30dias')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    chartRange === '30dias'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  30 dias
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Renderização do Gráfico */}
        <div className="pt-4 h-64 w-full">
          {chartType === 'pizza' ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={isOnlyIptv ? iptvPieData : businessPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }: any) =>
                    `${name} ${((percent || 0) * 100).toFixed(0)}%`
                  }
                >
                  {(isOnlyIptv ? iptvPieData : businessPieData).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [val, isOnlyIptv ? 'Assinantes' : 'Valor']}
                  contentStyle={{
                    backgroundColor: '#091124',
                    borderColor: '#1b2b4f',
                    borderRadius: '12px',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={
                  isOnlyIptv
                    ? iptvPieData.map((d) => ({ name: d.name, valor: d.value }))
                    : chartData
                }
              >
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  formatter={(val: any) => [val, isOnlyIptv ? 'Assinantes' : 'Recebido']}
                  contentStyle={{
                    backgroundColor: '#091124',
                    borderColor: '#1b2b4f',
                    borderRadius: '12px',
                  }}
                />
                <Bar dataKey="valor" fill="#7c3aed" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. TABELA / CARDS DE ITENS RECENTES (EXCLUSIVO POR MÓDULO) */}
      {isOnlyIptv ? (
        /* TABELA DE ASSINANTES IPTV */
        <div className="p-5 rounded-2xl bg-[#0f1b38] border border-[#1e2f57] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar assinante por nome, WhatsApp, servidor ou plano..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#091124] border border-[#1b2b4f] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onNavigateToTab && onNavigateToTab('iptv_customers')}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-purple-950/40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Novo Cliente IPTV</span>
              </button>
              <button
                onClick={() => onNavigateToTab && onNavigateToTab('iptv_plans')}
                className="px-3.5 py-2 rounded-xl bg-[#091124] hover:bg-[#132247] border border-[#1e2f57] text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-orange-400" />
                <span>Planos IPTV</span>
              </button>
              <button
                onClick={() => onNavigateToTab && onNavigateToTab('iptv_apps')}
                className="px-3.5 py-2 rounded-xl bg-[#091124] hover:bg-[#132247] border border-[#1e2f57] text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                <span>Aplicativos</span>
              </button>
            </div>
          </div>

          {/* Lista Mobile para IPTV */}
          <div className="md:hidden space-y-2.5">
            {filteredIPTVSubscribers.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Nenhum assinante IPTV encontrado.
              </div>
            ) : (
              filteredIPTVSubscribers.slice(0, 15).map((sub) => {
                const isExpired =
                  sub.status === 'expired' ||
                  (sub.expiration_date && sub.expiration_date < todayStr);
                const isExpiring =
                  sub.status === 'expiring_soon' ||
                  sub.expiration_date === todayStr ||
                  sub.expiration_date === tomorrowStr;

                return (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl bg-[#091124] border border-[#1e2f57] space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs truncate">
                          {sub.customer_name || sub.name || 'Assinante'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {sub.server_name || 'Painel IPTV'} • {sub.plan_name || 'Plano'}
                        </div>
                      </div>
                      {isExpired ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                          VENCIDO
                        </span>
                      ) : isExpiring ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                          A VENCER
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          ATIVO
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1e2f57]/60">
                      <div className="font-mono font-black text-white text-sm">
                        {formatMoney(Number(sub.price) || 0)}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Venc:{' '}
                        {sub.expiration_date
                          ? new Date(sub.expiration_date + 'T00:00:00').toLocaleDateString(
                              'pt-BR'
                            )
                          : '-'}
                      </div>
                    </div>

                    {sub.whatsapp && (
                      <button
                        onClick={() => handleOpenIPTVWhatsApp(sub)}
                        className="w-full py-1.5 px-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Avisar via WhatsApp</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Tabela Desktop para IPTV */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#091124] text-slate-400 uppercase text-[10px] tracking-wider font-extrabold border-b border-[#1e2f57]">
                <tr>
                  <th className="py-3 px-4">Assinante</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4">Servidor / Painel</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2f57]/50">
                {filteredIPTVSubscribers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Nenhum assinante IPTV cadastrado ou encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredIPTVSubscribers.map((sub) => {
                    const isExpired =
                      sub.status === 'expired' ||
                      (sub.expiration_date && sub.expiration_date < todayStr);
                    const isExpiring =
                      sub.status === 'expiring_soon' ||
                      sub.expiration_date === todayStr ||
                      sub.expiration_date === tomorrowStr;

                    return (
                      <tr key={sub.id} className="hover:bg-[#121f3f]/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">
                          {sub.customer_name || sub.name || 'Assinante'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {sub.whatsapp || '-'}
                        </td>
                        <td className="py-3 px-4 text-purple-300 font-medium">
                          {sub.server_name || '-'}
                        </td>
                        <td className="py-3 px-4">{sub.plan_name || 'Plano'}</td>
                        <td className="py-3 px-4 font-black font-mono text-white">
                          {formatMoney(Number(sub.price) || 0)}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {sub.expiration_date
                            ? new Date(sub.expiration_date + 'T00:00:00').toLocaleDateString(
                                'pt-BR'
                              )
                            : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              VENCIDO
                            </span>
                          ) : isExpiring ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              A VENCER
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ATIVO
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {sub.whatsapp && (
                            <button
                              onClick={() => handleOpenIPTVWhatsApp(sub)}
                              className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/40 transition-colors cursor-pointer"
                              title="Enviar lembrete via WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : isOnlyLoans ? (
        /* TABELA DEDICADA DE EMPRÉSTIMOS */
        <div className="p-5 rounded-2xl bg-[#0f1b38] border border-[#1e2f57] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar contrato por cliente, telefone ou descrição..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#091124] border border-[#1e2f57] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            <button
              onClick={() => onNavigateToTab && onNavigateToTab('loans')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Novo Empréstimo</span>
            </button>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-2.5">
            {filteredLoans.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Nenhum empréstimo cadastrado.
              </div>
            ) : (
              filteredLoans.map((l: any) => (
                <div key={l.id} className="p-3.5 rounded-xl bg-[#091124] border border-[#1e2f57] space-y-2.5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-xs">{l.customerName || 'Cliente'}</div>
                      <div className="text-[11px] text-slate-400">{l.description}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border shrink-0 ${
                      l.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}>
                      {l.status === 'completed' ? 'QUITADO' : 'ATIVO'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1e2f57]/60">
                    <div className="font-mono font-black text-white text-sm">
                      {formatMoney(l.principalAmount)}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Venc: {l.dueDate ? new Date(l.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>
                  {l.customerPhone && (
                    <button
                      onClick={() => handleOpenLoanWhatsApp(l)}
                      className="w-full py-1.5 px-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#091124] text-slate-400 uppercase text-[10px] tracking-wider font-extrabold border-b border-[#1e2f57]">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Valor Principal</th>
                  <th className="py-3 px-4">Parcelas</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2f57]/50">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Nenhum empréstimo cadastrado.
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((l: any) => (
                    <tr key={l.id} className="hover:bg-[#121f3f]/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{l.customerName}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{l.customerPhone || '-'}</td>
                      <td className="py-3 px-4">{l.description}</td>
                      <td className="py-3 px-4 font-black font-mono text-white">{formatMoney(l.principalAmount)}</td>
                      <td className="py-3 px-4 font-mono">{l.installmentsCount || (l.installments?.length || 1)}x</td>
                      <td className="py-3 px-4 font-mono">{l.dueDate ? new Date(l.dueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          l.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {l.status === 'completed' ? 'QUITADO' : 'ATIVO'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {l.customerPhone && (
                          <button
                            onClick={() => handleOpenLoanWhatsApp(l)}
                            className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/40 transition-colors cursor-pointer"
                            title="Cobrar via WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TABELA DE COBRANÇAS / NEGÓCIOS */
        <div className="p-5 rounded-2xl bg-[#0f1b38] border border-[#1e2f57] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente, WhatsApp ou plano..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#091124] border border-[#1b2b4f] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
              />
            </div>

            <div className="flex items-center gap-2">
              {hasIptv && (
                <button
                  onClick={() => onNavigateToTab && onNavigateToTab('iptv_customers')}
                  className="px-3.5 py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Painel IPTV 4K</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile View: Cards */}
          <div className="md:hidden space-y-2.5">
            {filteredCharges.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Nenhuma cobrança encontrada.
              </div>
            ) : (
              filteredCharges.slice(0, 10).map((c) => {
                const isPaid = c.status === 'paid';
                const isOverdue =
                  c.status === 'overdue' || (c.status === 'pending' && c.due_date < todayStr);

                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-[#091124] border border-[#1e2f57] space-y-2 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs truncate">
                          {c.customer?.name || 'Cliente'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {c.description}
                        </div>
                      </div>
                      {isPaid ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          PAGO
                        </span>
                      ) : isOverdue ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                          VENCIDO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                          PENDENTE
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1e2f57]/60">
                      <div className="font-mono font-black text-white text-sm">
                        {formatMoney(c.amount)}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Venc:{' '}
                        {c.due_date
                          ? new Date(c.due_date + 'T00:00:00').toLocaleDateString('pt-BR')
                          : '-'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => onOpenWhatsApp(c)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                      {!isPaid && (
                        <button
                          onClick={() => onMarkAsPaid(c.id)}
                          className="py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
                        >
                          Baixar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#091124] text-slate-400 uppercase text-[10px] tracking-wider font-extrabold border-b border-[#1e2f57]">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2f57]/50">
                {filteredCharges.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Nenhuma cobrança encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredCharges.map((c) => {
                    const isPaid = c.status === 'paid';
                    const isOverdue =
                      c.status === 'overdue' || (c.status === 'pending' && c.due_date < todayStr);

                    return (
                      <tr key={c.id} className="hover:bg-[#121f3f]/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">
                          {c.customer?.name || 'Cliente'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {c.customer?.whatsapp || '-'}
                        </td>
                        <td className="py-3 px-4">{c.description}</td>
                        <td className="py-3 px-4 font-black font-mono text-white">
                          {formatMoney(c.amount)}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {c.due_date
                            ? new Date(c.due_date + 'T00:00:00').toLocaleDateString('pt-BR')
                            : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {isPaid ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              PAGO
                            </span>
                          ) : isOverdue ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              VENCIDO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              PENDENTE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onOpenWhatsApp(c)}
                              className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/40 transition-colors cursor-pointer"
                              title="Cobrar via WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            {!isPaid && (
                              <button
                                onClick={() => onMarkAsPaid(c.id)}
                                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition-colors shadow-sm cursor-pointer"
                              >
                                Baixar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Botão Flutuante do Suporte WhatsApp */}
      {supportWhatsAppConfig?.enabled !== false && (
        <a
          href={`https://wa.me/${supportPhoneClean}?text=${encodeURIComponent(
            supportWhatsAppConfig?.default_message || 'Olá, preciso de suporte no Multi Gestor'
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-20 right-3.5 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 sm:gap-2.5 p-1 sm:p-1.5 pr-3.5 sm:pr-4 rounded-full bg-[#0b162c]/90 hover:bg-[#075E54] border border-[#25D366]/50 text-white font-bold text-xs shadow-2xl shadow-emerald-950/80 transition-all hover:scale-105 active:scale-95 group cursor-pointer backdrop-blur-md"
          title="Falar com o Suporte via WhatsApp"
        >
          <div className="relative flex items-center justify-center shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-60 animate-ping"></span>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-lg shadow-emerald-950/60 shrink-0">
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 sm:w-6.5 sm:h-6.5 fill-white drop-shadow"
              >
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wide leading-none flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse"></span>
              Suporte Online
            </span>
            <span className="text-xs font-black text-white leading-tight mt-0.5">
              WhatsApp
            </span>
          </div>
        </a>
      )}
    </div>
  );
};
