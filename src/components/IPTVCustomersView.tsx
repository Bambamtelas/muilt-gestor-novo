import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Tv,
  X,
  Smartphone,
  Layers,
  Lock,
  Pencil,
} from 'lucide-react';
import { IPTVSubscriber, IPTVPlan, IPTVApp, Tenant } from '../types/index.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import {
  loadIPTVSubscribersFromSupabase,
  createIPTVSubscriberInSupabase,
  updateIPTVSubscriberInSupabase,
  renewIPTVSubscriberInSupabase,
  deleteIPTVSubscriberFromSupabase,
  loadIPTVPlansFromSupabase,
  loadIPTVAppsFromSupabase,
  extractServerNameFromPlan,
} from '../lib/supabaseIPTV.js';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime.js';

interface IPTVCustomersViewProps {
  tenant: Tenant;
}

export const IPTVCustomersView: React.FC<IPTVCustomersViewProps> = ({ tenant }) => {
  const [subscribers, setSubscribers] = useState<IPTVSubscriber[]>(() => {
    try {
      const cached = localStorage.getItem(`iptv_subs_${tenant.id}`);
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [plans, setPlans] = useState<IPTVPlan[]>([]);
  const [apps, setApps] = useState<IPTVApp[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<IPTVSubscriber | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [serverName, setServerName] = useState('Painel Gold Play 4K');
  const [usernameOrMac, setUsernameOrMac] = useState('');
  const [password, setPassword] = useState('');
  const [planName, setPlanName] = useState('Mensal (1 Tela)');
  const [appName, setAppName] = useState('IPTV Smarters Pro');
  const [screens, setScreens] = useState(1);
  const [price, setPrice] = useState('35,00');
  const [expirationDate, setExpirationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'active' | 'expiring_soon' | 'expired' | 'trial'>('active');
  const [notes, setNotes] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const formatMoney = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Hook Realtime reutilizável para escutar alterações de outros dispositivos
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
      loadData(false);
    },
  });

  const loadData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner && subscribers.length === 0) setLoading(true);
    try {
      if (isSupabaseConfigured && tenant?.id) {
        const [subsData, plansData, appsData] = await Promise.all([
          loadIPTVSubscribersFromSupabase(tenant.id).catch(() => api.getIPTVSubscribers(tenant.id)),
          loadIPTVPlansFromSupabase(tenant.id).then((p) => p.length > 0 ? p : api.getIPTVPlans(tenant.id)).catch(() => api.getIPTVPlans(tenant.id)),
          loadIPTVAppsFromSupabase(tenant.id).then((a) => a.length > 0 ? a : api.getIPTVApps(tenant.id)).catch(() => api.getIPTVApps(tenant.id)),
        ]);
        setSubscribers(subsData);
        setPlans(plansData);
        setApps(appsData);
        try {
          localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(subsData));
        } catch {}
      } else {
        const [subsData, plansData, appsData] = await Promise.all([
          api.getIPTVSubscribers(tenant.id),
          api.getIPTVPlans(tenant.id),
          api.getIPTVApps(tenant.id),
        ]);
        setSubscribers(subsData);
        setPlans(plansData);
        setApps(appsData);
        try {
          localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(subsData));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load IPTV data', err);
      try {
        const cached = localStorage.getItem(`iptv_subs_${tenant.id}`);
        if (cached) setSubscribers(JSON.parse(cached));
      } catch {}
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(subscribers.length === 0);

    const handleFocus = () => loadData(false);
    const handleVisibility = () => {
      if (!document.hidden) loadData(false);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Polling de segurança de 45 segundos
    const interval = setInterval(() => {
      if (!document.hidden) loadData(false);
    }, 45000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [tenant.id]);

  const handleSelectPlan = (selectedPlanName: string) => {
    setPlanName(selectedPlanName);
    const foundPlan = plans.find((p) => p.name === selectedPlanName || p.id === selectedPlanName);
    if (foundPlan) {
      setPlanName(foundPlan.name);
      setPrice(foundPlan.price.toFixed(2).replace('.', ','));
      setScreens(foundPlan.screens);
      const autoServer = foundPlan.server_name || extractServerNameFromPlan(foundPlan);
      if (autoServer) {
        setServerName(autoServer);
      }
      const d = new Date();
      d.setDate(d.getDate() + (foundPlan.duration_days || 30));
      setExpirationDate(d.toISOString().slice(0, 10));
    }
  };

  const handleOpenAddModal = () => {
    setEditingSubscriber(null);
    setCustomerName('');
    setWhatsapp('');
    setUsernameOrMac('');
    setPassword('');
    setNotes('');
    setExternalLink('');
    setFormError(null);
    setExpirationDate(new Date().toISOString().slice(0, 10));

    if (plans.length > 0) {
      const firstPlan = plans[0];
      setPlanName(firstPlan.name);
      setPrice(firstPlan.price.toFixed(2).replace('.', ','));
      setScreens(firstPlan.screens);
      const autoServer = firstPlan.server_name || extractServerNameFromPlan(firstPlan);
      setServerName(autoServer || 'Painel Principal');
      const d = new Date();
      d.setDate(d.getDate() + (firstPlan.duration_days || 30));
      setExpirationDate(d.toISOString().slice(0, 10));
    } else {
      setPlanName('Mensal (1 Tela)');
      setPrice('35,00');
      setScreens(1);
      setServerName('Painel Gold Play 4K');
    }

    if (apps.length > 0) {
      setAppName(apps[0].name);
    }

    setIsAdding(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!customerName.trim()) {
      setFormError('Por favor, informe ao menos o Nome do Cliente ou Identificação.');
      return;
    }

    setSaving(true);
    try {
      const numPrice = parseFloat(price.replace(',', '.'));
      const subPayload = {
        tenant_id: tenant.id,
        customer_name: customerName.trim(),
        whatsapp: whatsapp.trim() || 'Não informado',
        server_name: serverName.trim() || 'Painel Gold Play 4K',
        username_or_mac: usernameOrMac.trim() || externalLink.trim(),
        password: password.trim() || undefined,
        plan_name: planName,
        app_name: appName,
        screens,
        price: isNaN(numPrice) ? 0 : numPrice,
        expiration_date: expirationDate,
        status: 'active' as const,
        external_link: externalLink.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      let created: IPTVSubscriber;
      if (isSupabaseConfigured && tenant?.id) {
        created = await createIPTVSubscriberInSupabase(tenant.id, subPayload);
        broadcastChange('insert', created);
      } else {
        created = await api.createIPTVSubscriber(subPayload);
      }

      // Sincronização secundária com Express
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
      setExternalLink('');
      setNotes('');
      setFormError(null);
      setToastMessage('Assinante IPTV cadastrado com sucesso!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to create subscriber', err);
      setFormError(err?.message || 'Falha ao cadastrar cliente. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (sub: IPTVSubscriber) => {
    setEditingSubscriber(sub);
    setCustomerName(sub.customer_name || '');
    setWhatsapp(sub.whatsapp || '');
    setServerName(sub.server_name || '');
    setUsernameOrMac(sub.username_or_mac || '');
    setPassword(sub.password || '');
    setPlanName(sub.plan_name || '');
    setAppName(sub.app_name || 'IPTV Smarters Pro');
    setScreens(sub.screens || 1);
    setPrice(sub.price != null ? sub.price.toFixed(2).replace('.', ',') : '35,00');
    setExpirationDate(sub.expiration_date || '');
    setStatus(sub.status || 'active');
    setExternalLink(sub.external_link || '');
    setNotes(sub.notes || '');
    setFormError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!editingSubscriber || !customerName.trim()) {
      setFormError('Informe o Nome do Cliente.');
      return;
    }

    setSaving(true);
    try {
      const numPrice = parseFloat(price.replace(',', '.'));
      const updates = {
        customer_name: customerName.trim(),
        whatsapp: whatsapp.trim() || 'Não informado',
        server_name: serverName.trim() || 'Painel Gold Play 4K',
        username_or_mac: usernameOrMac.trim() || externalLink.trim(),
        password: password.trim() || undefined,
        plan_name: planName,
        app_name: appName,
        screens,
        price: isNaN(numPrice) ? 0 : numPrice,
        expiration_date: expirationDate,
        status,
        external_link: externalLink.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      let updated: IPTVSubscriber;
      if (isSupabaseConfigured && tenant?.id) {
        updated = await updateIPTVSubscriberInSupabase(tenant.id, editingSubscriber.id, updates);
        broadcastChange('update', updated);
      } else {
        updated = await api.updateIPTVSubscriber(editingSubscriber.id, updates);
      }

      // Sincronização secundária com Express
      api.updateIPTVSubscriber(editingSubscriber.id, updates).catch(() => {});

      setSubscribers((prev) => {
        const next = prev.map((s) => (s.id === editingSubscriber.id ? updated : s));
        try { localStorage.setItem(`iptv_subs_${tenant.id}`, JSON.stringify(next)); } catch {}
        return next;
      });

      setEditingSubscriber(null);
      setFormError(null);
      setToastMessage('Assinante IPTV atualizado com sucesso!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to update subscriber', err);
      setFormError(err?.message || 'Falha ao atualizar dados do cliente.');
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
      setToastMessage('Assinatura renovada com sucesso por 30 dias!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to renew', err);
      setToastMessage('Não foi possível renovar no servidor. Tente novamente.');
      setTimeout(() => setToastMessage(null), 4500);
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
      setToastMessage('Assinante excluído com sucesso.');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to delete', err);
      setToastMessage('Não foi possível excluir do servidor. Tente novamente.');
      setTimeout(() => setToastMessage(null), 4500);
    }
  };

  const handleSendWhatsAppRenewal = async (sub: IPTVSubscriber) => {
    const cleanPhone = sub.whatsapp.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const formattedDate = new Date(sub.expiration_date + 'T12:00:00').toLocaleDateString('pt-BR');
    const pixKey = tenant.pix_key || 'dlinformatica3137@gmail.com';
    const tenantName = tenant.trade_name || tenant.name || 'CobreFácil IPTV';

    let creds = `👤 *Usuário / Login / MAC:* \`${sub.username_or_mac || 'Conforme configurado'}\`\n`;
    if (sub.password) {
      creds += `🔑 *Senha / Device Key:* \`${sub.password}\`\n`;
    }
    if (sub.app_name) {
      creds += `📱 *Aplicativo:* ${sub.app_name}\n`;
    }

    const customerDisplayName = sub.customer_name || (sub as any).name || 'Assinante';
    const message =
      `📺 *Lembrete de Renovação IPTV / Streaming*\n\n` +
      `Olá, *${customerDisplayName.split(' ')[0]}*! Tudo bem? 😊\n\n` +
      `Sua assinatura do plano *"${sub.plan_name}"* (${sub.server_name}) tem vencimento programado para *${formattedDate}* no valor de *${formatMoney(
        sub.price
      )}*.\n\n` +
      `🔑 *Chave PIX para renovação imediata:*\n\`${pixKey}\`\nBeneficiário: *${tenantName}*\n\n` +
      `Dados do Acesso:\n` +
      creds +
      `\nApós realizar a transferência via PIX, nos envie o comprovante por aqui para mantermos seu sinal 100% ativo sem quedas! 🚀\n\n` +
      `_— Atendimento | ${tenantName}_`;

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
      window.open(url, '_blank');
    } catch {
      window.open(url, '_blank');
    }
  };

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
            <span>IPTV &bull; Módulo de Clientes</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Cadastro e Gestão de Clientes IPTV
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Cadastre assinantes com login, senha ou MAC, monitore vencimentos e envie lembretes no WhatsApp
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-purple-900/40 border border-purple-400/30 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Cliente IPTV</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          className={`p-4 bg-gradient-to-br from-[#10b981] to-[#059669] text-white rounded-2xl shadow-xl shadow-emerald-950/30 cursor-pointer hover:scale-[1.02] transition-all ${
            statusFilter === 'active' ? 'ring-2 ring-white/90 scale-[1.02]' : ''
          }`}
        >
          <span className="text-[11px] font-black uppercase text-emerald-100">Clientes Ativos</span>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">{activeCount}</div>
          <div className="text-xs text-emerald-100 mt-1">Sinal liberado e operando</div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'expiring_soon' ? 'all' : 'expiring_soon')}
          className={`p-4 bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white rounded-2xl shadow-xl shadow-amber-950/30 cursor-pointer hover:scale-[1.02] transition-all ${
            statusFilter === 'expiring_soon' ? 'ring-2 ring-white/90 scale-[1.02]' : ''
          }`}
        >
          <span className="text-[11px] font-black uppercase text-amber-100">Vencem Hoje ou Amanhã</span>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">{expiringCount}</div>
          <div className="text-xs text-amber-100 mt-1">Necessitam de lembrete WhatsApp</div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
          className={`p-4 bg-gradient-to-br from-[#f43f5e] to-[#be123c] text-white rounded-2xl shadow-xl shadow-rose-950/30 cursor-pointer hover:scale-[1.02] transition-all ${
            statusFilter === 'expired' ? 'ring-2 ring-white/90 scale-[1.02]' : ''
          }`}
        >
          <span className="text-[11px] font-black uppercase text-rose-100">Assinaturas Vencidas</span>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">{expiredCount}</div>
          <div className="text-xs text-rose-100 mt-1">Aguardando renovação PIX</div>
        </div>
      </div>

      {/* Cadastro Form Modal */}
      {isAdding && (
        <div className="p-5 bg-slate-900 border border-purple-500/40 rounded-2xl shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Novo Cadastro de Cliente IPTV</span>
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  Plano IPTV
                </label>
                <span className="text-[10px] text-purple-400/80 font-medium">Define Servidor e Valor</span>
              </div>
              <select
                value={planName}
                onChange={(e) => handleSelectPlan(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                {plans.length > 0 ? (
                  plans.map((p) => {
                    const serv = p.server_name || extractServerNameFromPlan(p);
                    return (
                      <option key={p.id} value={p.name}>
                        {p.name} - {formatMoney(p.price)}{serv ? ` (${serv})` : ''}
                      </option>
                    );
                  })
                ) : (
                  <>
                    <option value="Mensal (1 Tela)">Mensal (1 Tela) - R$ 35,00</option>
                    <option value="Mensal (2 Telas)">Mensal (2 Telas) - R$ 50,00</option>
                    <option value="Trimestral (1 Tela)">Trimestral (1 Tela) - R$ 90,00</option>
                    <option value="Anual VIP">Anual VIP - R$ 280,00</option>
                  </>
                )}
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
                placeholder="Ex: 887766 ou Device Key"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Aplicativo Utilizado
              </label>
              <select
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
                <option value="Outro Aplicativo">Outro Aplicativo</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  Servidor / Painel
                </label>
                <span className="text-[10px] text-emerald-400/90 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Preenchido automático
                </span>
              </div>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Ex: Painel Blinder ou P2 Imperial"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Valor Cobrado (R$)
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
                Vencimento
              </label>
              <input
                type="date"
                required
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block flex items-center justify-between">
                <span>Link Externo / URL M3U / WebPlayer (Opcional)</span>
                <span className="text-[10px] text-purple-400 lowercase font-mono">http:// ou https://</span>
              </label>
              <input
                type="text"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                placeholder="Ex: http://servidor.net:8080/get.php?username=... ou link externo"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-purple-300 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Observações
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Renovação mensal, usa smart tv..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {formError && (
              <div className="sm:col-span-3 p-3 bg-rose-950/80 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            <div className="sm:col-span-3 flex justify-end gap-3 pt-2">
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
                {saving ? 'Cadastrando...' : 'Cadastrar Cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Customer Form Modal */}
      {editingSubscriber && (
        <div className="p-5 bg-slate-900 border border-purple-500/50 rounded-2xl shadow-2xl space-y-4 animate-in fade-in duration-200 ring-1 ring-purple-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-purple-400" />
              <span>Editar Dados do Assinante IPTV: {editingSubscriber.customer_name}</span>
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  Plano IPTV
                </label>
                <span className="text-[10px] text-purple-400/80 font-medium">Define Servidor e Valor</span>
              </div>
              <select
                value={planName}
                onChange={(e) => handleSelectPlan(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                {plans.length > 0 ? (
                  plans.map((p) => {
                    const serv = p.server_name || extractServerNameFromPlan(p);
                    return (
                      <option key={p.id} value={p.name}>
                        {p.name} - {formatMoney(p.price)}{serv ? ` (${serv})` : ''}
                      </option>
                    );
                  })
                ) : (
                  <>
                    <option value="Mensal (1 Tela)">Mensal (1 Tela) - R$ 35,00</option>
                    <option value="Mensal (2 Telas)">Mensal (2 Telas) - R$ 50,00</option>
                    <option value="Trimestral (1 Tela)">Trimestral (1 Tela) - R$ 90,00</option>
                    <option value="Anual VIP">Anual VIP - R$ 280,00</option>
                  </>
                )}
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
                placeholder="Ex: 887766 ou Device Key"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Aplicativo Utilizado
              </label>
              <select
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
                <option value="Outro Aplicativo">Outro Aplicativo</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  Servidor / Painel
                </label>
                <span className="text-[10px] text-emerald-400/90 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Preenchido automático
                </span>
              </div>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Ex: Painel Blinder ou P2 Imperial"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Valor Cobrado (R$)
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
                Status da Assinatura
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value="active">Ativo (Sinal liberado)</option>
                <option value="expiring_soon">Vencendo em breve</option>
                <option value="expired">Vencido (Aguardando renovação)</option>
                <option value="trial">Teste Grátis</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block flex items-center justify-between">
                <span>Link Externo / URL M3U / WebPlayer (Opcional)</span>
                <span className="text-[10px] text-purple-400 lowercase font-mono">http:// ou https://</span>
              </label>
              <input
                type="text"
                value={externalLink}
                onChange={(e) => setExternalLink(e.target.value)}
                placeholder="Ex: http://servidor.net:8080/get.php?username=... ou link externo"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-purple-300 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Observações / Notas Internas
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Cliente tem TV Box no quarto..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {formError && (
              <div className="sm:col-span-3 p-3 bg-rose-950/80 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{formError}</span>
              </div>
            )}

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

      {/* Table & Mobile Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm p-3 sm:p-0">
        {/* Mobile View: Cards */}
        <div className="md:hidden space-y-3">
          {filteredSubscribers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Nenhum cliente IPTV encontrado.
            </div>
          ) : (
            filteredSubscribers.map((sub) => {
              const diff = getDaysUntilExpiration(sub.expiration_date);
              const isDueToday = diff === 0;
              const isDueTomorrow = diff === 1;
              const isExpired = diff < 0 || sub.status === 'expired';
              const isExpiring = isDueToday || isDueTomorrow || sub.status === 'expiring_soon';

              return (
                <div
                  key={sub.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm truncate">
                        {sub.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {sub.whatsapp}
                      </div>
                    </div>
                    {isExpired ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                        Vencido
                      </span>
                    ) : isDueToday ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/50 animate-pulse shrink-0">
                        Vence Hoje
                      </span>
                    ) : isDueTomorrow ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                        Vence Amanhã
                      </span>
                    ) : isExpiring ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
                        Vence em Breve
                      </span>
                    ) : sub.status === 'trial' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">
                        Teste
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                        Ativo
                      </span>
                    )}
                  </div>

                  {/* Access credentials */}
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-[10px] text-slate-500 uppercase font-mono">Login / MAC:</span>
                      <span className="font-mono text-purple-300 font-semibold truncate max-w-[200px]">
                        {sub.username_or_mac || 'Sem login/MAC'}
                      </span>
                    </div>
                    {sub.password && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-[10px] text-slate-500 uppercase font-mono">Senha / Key:</span>
                        <span className="font-mono text-slate-200 font-semibold">{sub.password}</span>
                      </div>
                    )}
                    {sub.external_link && (
                      <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/50">
                        <span className="text-[10px] text-purple-400 uppercase font-mono">Link:</span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[11px] text-purple-300 truncate max-w-[150px]">
                            {sub.external_link}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(sub.external_link || '')}
                            className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] hover:bg-purple-500/30 shrink-0 cursor-pointer"
                            title="Copiar Link"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/50">
                      <span>{sub.plan_name}</span>
                      <span className="text-purple-400">{sub.app_name || 'App padrão'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Mensalidade:</span>
                      <span className="font-mono font-black text-white text-base">
                        {formatMoney(sub.price)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Vencimento:</span>
                      <span className="font-mono text-slate-300 font-medium">
                        {new Date(sub.expiration_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => handleSendWhatsAppRenewal(sub)}
                      className="py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      title="Cobrar via WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Cobrar</span>
                    </button>

                    <button
                      onClick={() => handleRenew(sub.id)}
                      disabled={renewingId === sub.id}
                      className="py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      title="Renovar por mais 30 dias"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>+30d</span>
                    </button>

                    <button
                      onClick={() => startEdit(sub)}
                      className="py-2 rounded-lg bg-slate-900 text-slate-200 hover:text-white border border-slate-800 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="py-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Cliente / WhatsApp</th>
                <th className="py-3 px-4">Acesso (Login / MAC &amp; Senha / Device Key)</th>
                <th className="py-3 px-4">Plano &amp; App</th>
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
                    Nenhum cliente IPTV encontrado.
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
                        <div className="text-white font-medium">{sub.username_or_mac || 'Sem login/MAC'}</div>
                        {sub.password && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Senha / Device Key:{' '}
                            <span className="text-purple-300 font-semibold">{sub.password}</span>
                          </div>
                        )}
                        {sub.external_link && (
                          <div className="text-[10px] text-purple-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span className="truncate max-w-[180px]">{sub.external_link}</span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(sub.external_link || '')}
                              className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-[9px] cursor-pointer shrink-0"
                              title="Copiar Link Externo"
                            >
                              Copiar
                            </button>
                          </div>
                        )}
                        <div className="text-[10px] text-purple-400/80">{sub.server_name}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">{sub.plan_name}</div>
                        <div className="text-[10px] text-slate-400">{sub.app_name || 'App padrão'}</div>
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
                          <button
                            onClick={() => handleSendWhatsAppRenewal(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all"
                            title="Cobrar Renovação via WhatsApp"
                          >
                            <Send className="w-3 h-3" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>

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
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-purple-900/60 hover:text-purple-300 border border-slate-700/60 text-xs font-semibold transition-colors cursor-pointer"
                            title="Editar dados do assinante IPTV"
                          >
                            <Pencil className="w-3.5 h-3.5 text-purple-400" />
                            <span>Editar</span>
                          </button>

                          <button
                            onClick={() => handleDelete(sub.id)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-rose-950 hover:text-rose-400 transition-colors"
                            title="Excluir cliente"
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

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-purple-500/50 text-purple-300 text-xs font-bold shadow-2xl shadow-black animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
