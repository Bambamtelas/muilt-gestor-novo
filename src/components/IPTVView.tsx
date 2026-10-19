import React, { useState, useEffect } from 'react';
import {
  Tv,
  Plus,
  Search,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  ExternalLink,
  Sparkles,
  Server,
  Zap,
  X,
  Calendar,
  DollarSign,
  User,
  Shield,
  Pencil,
} from 'lucide-react';
import { IPTVSubscriber, Tenant } from '../types/index.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import {
  loadIPTVSubscribersFromSupabase,
  createIPTVSubscriberInSupabase,
  updateIPTVSubscriberInSupabase,
  renewIPTVSubscriberInSupabase,
  deleteIPTVSubscriberFromSupabase,
} from '../lib/supabaseIPTV.js';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime.js';

interface IPTVViewProps {
  tenant: Tenant;
}

export const IPTVView: React.FC<IPTVViewProps> = ({ tenant }) => {
  const [subscribers, setSubscribers] = useState<IPTVSubscriber[]>(() => {
    try {
      const cached = localStorage.getItem(`iptv_subs_${tenant.id}`);
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<IPTVSubscriber | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [serverName, setServerName] = useState('Painel Gold Play 4K');
  const [usernameOrMac, setUsernameOrMac] = useState('');
  const [password, setPassword] = useState('');
  const [planName, setPlanName] = useState('Mensal (1 Tela)');
  const [screens, setScreens] = useState(1);
  const [price, setPrice] = useState('35,00');
  const [expirationDate, setExpirationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'active' | 'expiring_soon' | 'expired' | 'trial'>('active');
  const [saving, setSaving] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const formatMoney = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Hook Realtime
  const { broadcastChange } = useSupabaseRealtime<IPTVSubscriber>({
    table: 'iptv_subscribers',
    tenantId: tenant.id,
    enabled: Boolean(tenant?.id),
    onInsert: (newSub) => {
      setSubscribers((prev) => {
        if (prev.some((s) => s.id === newSub.id)) return prev;
        const next = [newSub, ...prev];
        try { localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(next)); } catch {}
        return next;
      });
    },
    onUpdate: (updatedSub) => {
      setSubscribers((prev) => {
        const next = prev.map((s) => (s.id === updatedSub.id ? updatedSub : s));
        try { localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(next)); } catch {}
        return next;
      });
    },
    onDelete: (deletedId) => {
      setSubscribers((prev) => {
        const next = prev.filter((s) => s.id !== deletedId);
        try { localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(next)); } catch {}
        return next;
      });
    },
    onSyncNeeded: () => {
      fetchSubscribers(false);
    },
  });

  const fetchSubscribers = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner && subscribers.length === 0) setLoading(true);
    try {
      if (isSupabaseConfigured && tenant?.id) {
        const data = await loadIPTVSubscribersFromSupabase(tenant.id).catch(() => api.getIPTVSubscribers(tenant.id));
        setSubscribers(data);
        try { localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(data)); } catch {}
      } else {
        const data = await api.getIPTVSubscribers(tenant.id);
        setSubscribers(data);
        try { localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(data)); } catch {}
      }
    } catch (err) {
      console.error('Failed to fetch IPTV subscribers', err);
      try {
        const cached = localStorage.getItem(`iptv_subs_${tenant.id}`);
        if (cached) setSubscribers(JSON.parse(cached));
      } catch {}
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers(subscribers.length === 0);

    const handleFocus = () => fetchSubscribers(false);
    const handleVisibility = () => {
      if (!document.hidden) fetchSubscribers(false);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => {
      if (!document.hidden) fetchSubscribers(false);
    }, 45000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [tenant.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !whatsapp.trim()) return;

    setSaving(true);
    try {
      const numPrice = parseFloat(price.replace(',', '.'));
      const subPayload = {
        tenant_id: tenant.id,
        customer_name: customerName.trim(),
        whatsapp: whatsapp.trim(),
        server_name: serverName,
        username_or_mac: usernameOrMac.trim(),
        password: password.trim() || undefined,
        plan_name: planName,
        screens,
        price: isNaN(numPrice) ? 0 : numPrice,
        expiration_date: expirationDate,
        status: 'active' as const,
      };

      let created: IPTVSubscriber;
      if (isSupabaseConfigured && tenant?.id) {
        created = await createIPTVSubscriberInSupabase(tenant.id, subPayload);
        broadcastChange('insert', created);
      } else {
        created = await api.createIPTVSubscriber(subPayload);
      }

      api.createIPTVSubscriber(created).catch(() => {});

      setSubscribers((prev) => {
        const next = [created, ...prev.filter((s) => s.id !== created.id)];
        try { localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(next)); } catch {}
        return next;
      });

      setIsAdding(false);
      setCustomerName('');
      setWhatsapp('');
      setUsernameOrMac('');
      setPassword('');
    } catch (err) {
      console.error('Failed to create subscriber', err);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (sub: IPTVSubscriber) => {
    setEditingSubscriber(sub);
    setCustomerName(sub.customer_name);
    setWhatsapp(sub.whatsapp);
    setServerName(sub.server_name);
    setUsernameOrMac(sub.username_or_mac || '');
    setPassword(sub.password || '');
    setPlanName(sub.plan_name);
    setScreens(sub.screens || 1);
    setPrice(sub.price.toFixed(2).replace('.', ','));
    setExpirationDate(sub.expiration_date);
    setStatus(sub.status);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubscriber || !customerName.trim() || !whatsapp.trim()) return;

    setSaving(true);
    try {
      const numPrice = parseFloat(price.replace(',', '.'));
      const updates = {
        customer_name: customerName.trim(),
        whatsapp: whatsapp.trim(),
        server_name: serverName,
        username_or_mac: usernameOrMac.trim(),
        password: password.trim() || undefined,
        plan_name: planName,
        screens,
        price: isNaN(numPrice) ? 0 : numPrice,
        expiration_date: expirationDate,
        status,
      };

      let updated: IPTVSubscriber;
      if (isSupabaseConfigured && tenant?.id) {
        updated = await updateIPTVSubscriberInSupabase(tenant.id, editingSubscriber.id, updates);
        broadcastChange('update', updated);
      } else {
        updated = await api.updateIPTVSubscriber(editingSubscriber.id, updates);
      }

      api.updateIPTVSubscriber(editingSubscriber.id, updates).catch(() => {});

      setSubscribers((prev) => {
        const next = prev.map((s) => (s.id === editingSubscriber.id ? updated : s));
        try { localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(next)); } catch {}
        return next;
      });

      setEditingSubscriber(null);
    } catch (err) {
      console.error('Failed to update subscriber', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRenew = async (id: string) => {
    setRenewingId(id);
    try {
      if (isSupabaseConfigured && tenant?.id) {
        const { updatedSubscriber } = await renewIPTVSubscriberInSupabase(tenant.id, id, 30);
        broadcastChange('update', updatedSubscriber);
        setSubscribers((prev) => {
          const next = prev.map((s) => (s.id === id ? updatedSubscriber : s));
          try { localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(next)); } catch {}
          return next;
        });
      }
      await api.renewIPTVSubscriber(id, 30).catch(() => {});
    } catch (err) {
      console.error('Failed to renew', err);
    } finally {
      setRenewingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (isSupabaseConfigured && tenant?.id) {
        await deleteIPTVSubscriberFromSupabase(tenant.id, id);
        broadcastChange('delete', { id, tenantId: tenant.id });
      }
      setSubscribers((prev) => {
        const next = prev.filter((s) => s.id !== id);
        try { localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(next)); } catch {}
        return next;
      });
      await api.deleteIPTVSubscriber(id).catch(() => {});
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  const handleSendWhatsAppRenewal = async (sub: IPTVSubscriber) => {
    const cleanPhone = sub.whatsapp.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const formattedDate = new Date(sub.expiration_date + 'T12:00:00').toLocaleDateString('pt-BR');
    const pixKey = tenant.pix_key || 'dlinformatica3137@gmail.com';
    const tenantName = tenant.trade_name || tenant.name || 'CobreFácil IPTV';

    const customerDisplayName = sub.customer_name || (sub as any).name || 'Assinante';
    const message = `📺 *Lembrete de Renovação IPTV / Streaming*\n\n` +
      `Olá, *${customerDisplayName.split(' ')[0]}*! Tudo bem? 😊\n\n` +
      `Sua assinatura do plano *"${sub.plan_name}"* (${sub.server_name}) tem vencimento programado para *${formattedDate}* no valor de *${formatMoney(sub.price)}*.\n\n` +
      `🔑 *Chave PIX para renovação imediata:*\n\`${pixKey}\`\nBeneficiário: *${tenantName}*\n\n` +
      `Dados do Acesso:\n` +
      `👤 *Usuário / Login / MAC:* \`${sub.username_or_mac || 'Conforme configurado'}\`\n` +
      (sub.password ? `🔑 *Senha / Device Key:* \`${sub.password}\`\n` : '') +
      `\nApós realizar a transferência via PIX, nos envie o comprovante por aqui para mantermos seu sinal 100% ativo sem quedas! 🚀\n\n` +
      `_— Suporte & Atendimento | ${tenantName}_`;

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

    try {
      const res = await api.sendDirectWhatsApp({
        tenantId: tenant.id,
        phone: formattedPhone,
        message,
        customerName: customerDisplayName,
        description: `Lembrete IPTV: ${sub.plan_name || 'Assinatura'}`,
      });
      if (res.success && (res.method === 'evolution_api' || (res as any).sentDirectly)) {
        alert(`✅ Cobrança enviada com sucesso para ${customerDisplayName} direto pelo WhatsApp!`);
        return;
      }
      alert(`⚠️ Não foi possível disparar pelo WhatsApp: ${(res as any)?.error || 'Instância desconectada'}. Verifique no menu Automação WhatsApp.`);
    } catch {
      alert(`❌ Erro ao enviar mensagem para o WhatsApp.`);
    }
  };

  // Filter subscribers
  const getDaysUntilExpiration = (dateStr?: string) => {
    if (!dateStr) return 999;
    const clean = dateStr.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length !== 3) return 999;
    const expDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expDate.setHours(0, 0, 0, 0);
    return Math.round((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const filteredSubscribers = subscribers.filter((sub) => {
    const term = searchTerm.toLowerCase();
    const name = (sub.customer_name || (sub as any).name || '').toLowerCase();
    const phone = (sub.whatsapp || '').toLowerCase();
    const server = (sub.server_name || '').toLowerCase();
    const mac = (sub.username_or_mac || (sub as any).username || '').toLowerCase();
    const matchesSearch =
      name.includes(term) ||
      phone.includes(term) ||
      server.includes(term) ||
      mac.includes(term);

    let matchesStatus = true;
    if (statusFilter === 'active') {
      const diff = getDaysUntilExpiration(sub.expiration_date);
      matchesStatus = diff >= 0 && sub.status !== 'expired';
    } else if (statusFilter === 'expiring_soon') {
      const diff = getDaysUntilExpiration(sub.expiration_date);
      matchesStatus = (diff === 0 || diff === 1) || sub.status === 'expiring_soon';
    } else if (statusFilter === 'expired') {
      const diff = getDaysUntilExpiration(sub.expiration_date);
      matchesStatus = diff < 0 || sub.status === 'expired';
    } else if (statusFilter !== 'all') {
      matchesStatus = sub.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const totalMonthlyIncome = subscribers
    .filter((s) => {
      const diff = getDaysUntilExpiration(s.expiration_date);
      return diff >= 0 && s.status !== 'expired' && s.status !== 'trial';
    })
    .reduce((acc, s) => acc + Number(s.price), 0);

  const activeCount = subscribers.filter((s) => {
    const diff = getDaysUntilExpiration(s.expiration_date);
    return diff >= 0 && s.status !== 'expired';
  }).length;

  const expiringCount = subscribers.filter((s) => {
    const diff = getDaysUntilExpiration(s.expiration_date);
    return (diff === 0 || diff === 1) || s.status === 'expiring_soon';
  }).length;

  const expiredCount = subscribers.filter((s) => {
    const diff = getDaysUntilExpiration(s.expiration_date);
    return diff < 0 || s.status === 'expired';
  }).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase mb-1">
            <Tv className="w-3.5 h-3.5" />
            <span>Módulo de Streaming &amp; Assinaturas</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Gestão de Assinantes IPTV
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Controle datas de vencimento, servidores, telas e envie cobranças automáticas no WhatsApp
          </p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-purple-900/40 border border-purple-400/30 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Novo Assinante IPTV</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          className={`p-5 bg-gradient-to-br from-[#10b981] to-[#059669] text-white rounded-2xl shadow-xl shadow-emerald-950/30 cursor-pointer hover:scale-[1.02] transition-all ${
            statusFilter === 'active' ? 'ring-2 ring-white/90 scale-[1.02]' : ''
          }`}
        >
          <span className="text-[11px] font-black uppercase text-emerald-100">Assinantes Ativos</span>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">{activeCount}</div>
          <div className="text-xs text-emerald-100 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sinal liberado</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'expiring_soon' ? 'all' : 'expiring_soon')}
          className={`p-5 bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white rounded-2xl shadow-xl shadow-amber-950/30 cursor-pointer hover:scale-[1.02] transition-all ${
            statusFilter === 'expiring_soon' ? 'ring-2 ring-white/90 scale-[1.02]' : ''
          }`}
        >
          <span className="text-[11px] font-black uppercase text-amber-100">Vencem Hoje ou Amanhã</span>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">{expiringCount}</div>
          <div className="text-xs text-amber-100 mt-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Necessitam de lembrete</span>
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
          className={`p-5 bg-gradient-to-br from-[#f43f5e] to-[#be123c] text-white rounded-2xl shadow-xl shadow-rose-950/30 cursor-pointer hover:scale-[1.02] transition-all ${
            statusFilter === 'expired' ? 'ring-2 ring-white/90 scale-[1.02]' : ''
          }`}
        >
          <span className="text-[11px] font-black uppercase text-rose-100">Assinaturas Vencidas</span>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">{expiredCount}</div>
          <div className="text-xs text-rose-100 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Aguardando renovação</span>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] text-white rounded-2xl shadow-xl shadow-purple-950/30">
          <span className="text-[11px] font-black uppercase text-purple-100">Faturamento Mensal IPTV</span>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-mono">
            {formatMoney(totalMonthlyIncome)}
          </div>
          <div className="text-xs text-purple-100 mt-1">Previsão recorrente</div>
        </div>
      </div>

      {/* Creation Modal / Form */}
      {isAdding && (
        <div className="p-5 bg-slate-900 border border-purple-500/30 rounded-2xl shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Tv className="w-4 h-4 text-purple-400" />
              <span>Cadastrar Novo Assinante IPTV</span>
            </h3>
            <button
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Nome do Cliente *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                WhatsApp com DDD *
              </label>
              <input
                type="text"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Servidor / Painel
              </label>
              <select
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value="Painel Gold Play 4K">Painel Gold Play 4K</option>
                <option value="TurboTV Server Ultra">TurboTV Server Ultra</option>
                <option value="MaxStream CDN">MaxStream CDN</option>
                <option value="P2P Ultra Server">P2P Ultra Server</option>
                <option value="Outro Painel">Outro Painel</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Usuário / Login / MAC
              </label>
              <input
                type="text"
                value={usernameOrMac}
                onChange={(e) => setUsernameOrMac(e.target.value)}
                placeholder="Ex: carlos_play4k ou 00:1A:79:XX:XX:XX"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-purple-300 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Senha do Acesso / Device Key
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ex: 887766 ou Device Key do App"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Plano / Periodicidade
              </label>
              <select
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value="Mensal (1 Tela)">Mensal (1 Tela) - R$ 35,00</option>
                <option value="Mensal (2 Telas)">Mensal (2 Telas) - R$ 50,00</option>
                <option value="Trimestral (1 Tela)">Trimestral (1 Tela) - R$ 90,00</option>
                <option value="Semestral (1 Tela)">Semestral (1 Tela) - R$ 160,00</option>
                <option value="Anual Completo">Anual Completo - R$ 280,00</option>
                <option value="Teste Grátis (4 Horas)">Teste Grátis (4 Horas)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Valor do Plano (R$)
              </label>
              <input
                type="text"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="35,00"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono font-bold text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Data do Vencimento
              </label>
              <input
                type="date"
                required
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="sm:col-span-2 flex items-end justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2.5 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/30 disabled:opacity-50"
              >
                {saving ? 'Cadastrando...' : 'Salvar Assinante'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Form Modal */}
      {editingSubscriber && (
        <div className="p-5 bg-slate-900 border border-purple-500/50 rounded-2xl shadow-2xl space-y-4 animate-in fade-in duration-200 ring-1 ring-purple-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-purple-400" />
              <span>Editar Assinante: {editingSubscriber.customer_name}</span>
            </h3>
            <button
              onClick={() => setEditingSubscriber(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Nome do Cliente *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ex: Carlos Eduardo"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                WhatsApp com DDD *
              </label>
              <input
                type="text"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Servidor / Painel
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Painel Gold Play 4K"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Usuário / Login / MAC
              </label>
              <input
                type="text"
                value={usernameOrMac}
                onChange={(e) => setUsernameOrMac(e.target.value)}
                placeholder="Ex: carlos_play4k ou 00:1A:79:XX:XX:XX"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-purple-300 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Senha do Acesso / Device Key
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ex: 887766 ou Device Key do App"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Plano
              </label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Valor do Plano (R$)
              </label>
              <input
                type="text"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="35,00"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono font-bold text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Data do Vencimento
              </label>
              <input
                type="date"
                required
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value="active">Ativo</option>
                <option value="expiring_soon">Vence em Breve</option>
                <option value="expired">Vencido</option>
                <option value="trial">Teste</option>
              </select>
            </div>

            <div className="sm:col-span-3 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingSubscriber(null)}
                className="px-4 py-2.5 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/30 disabled:opacity-50"
              >
                {saving ? 'Salvando Alterações...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, WhatsApp, login ou servidor..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500/50 shrink-0"
        >
          <option value="all">Todos os Status</option>
          <option value="active">Ativos</option>
          <option value="expiring_soon">Vencendo em breve</option>
          <option value="expired">Vencidos</option>
          <option value="trial">Testes</option>
        </select>
      </div>

      {/* Subscribers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Assinante / WhatsApp</th>
                <th className="py-3 px-4">Servidor &amp; Acesso (Login / MAC &amp; Senha / Device Key)</th>
                <th className="py-3 px-4">Plano / Telas</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    Nenhum assinante IPTV encontrado.
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map((sub) => {
                  const diff = getDaysUntilExpiration(sub.expiration_date);
                  const isDueToday = diff === 0;
                  const isDueTomorrow = diff === 1;
                  const isExpired = diff < 0 || sub.status === 'expired';
                  const isExpiring = isDueToday || isDueTomorrow || sub.status === 'expiring_soon';

                  return (
                    <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div>{sub.customer_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{sub.whatsapp}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-white font-medium">{sub.server_name}</div>
                        <div className="text-[11px] text-purple-300 font-mono">
                          {sub.username_or_mac || 'Sem login/MAC'}
                        </div>
                        {sub.password && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Senha / Device Key: <span className="text-purple-300 font-semibold">{sub.password}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {sub.plan_name}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {formatMoney(sub.price)}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        {new Date(sub.expiration_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>

                      <td className="py-3.5 px-4">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Vencido
                          </span>
                        ) : isDueToday ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/50 animate-pulse shadow-sm">
                            Vence Hoje
                          </span>
                        ) : isDueTomorrow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Vence Amanhã
                          </span>
                        ) : isExpiring ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Vence em Breve
                          </span>
                        ) : sub.status === 'trial' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            Teste
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Ativo
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send WhatsApp Renewal */}
                          <button
                            onClick={() => handleSendWhatsAppRenewal(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all"
                            title="Cobrar Renovação via WhatsApp"
                          >
                            <Send className="w-3 h-3" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>

                          {/* Quick Renew +30d */}
                          <button
                            onClick={() => handleRenew(sub.id)}
                            disabled={renewingId === sub.id}
                            className="px-2 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all disabled:opacity-50"
                            title="Renovar por mais 30 dias"
                          >
                            {renewingId === sub.id ? '...' : '+30d'}
                          </button>

                          <button
                            onClick={() => startEdit(sub)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-purple-900/60 hover:text-purple-300 transition-colors"
                            title="Editar assinante"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(sub.id)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-rose-950 hover:text-rose-400 transition-colors"
                            title="Excluir assinante"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
    </div>
  );
};
