import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Tv,
  CheckCircle2,
  Trash2,
  X,
  Clock,
  DollarSign,
  Server,
  Monitor,
  Pencil,
} from 'lucide-react';
import { IPTVPlan, Tenant } from '../types/index.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import {
  loadIPTVPlansFromSupabase,
  createIPTVPlanInSupabase,
  updateIPTVPlanInSupabase,
  deleteIPTVPlanInSupabase,
} from '../lib/supabaseIPTV.js';

interface IPTVPlansViewProps {
  tenant: Tenant;
}

export const IPTVPlansView: React.FC<IPTVPlansViewProps> = ({ tenant }) => {
  const [plans, setPlans] = useState<IPTVPlan[]>(() => {
    if (typeof window !== 'undefined' && tenant?.id) {
      try {
        const cached = localStorage.getItem(`iptv_plans_${tenant.id}`);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPlan, setEditingPlan] = useState<IPTVPlan | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [screens, setScreens] = useState(1);
  const [durationDays, setDurationDays] = useState(30);
  const [price, setPrice] = useState('35,00');
  const [serverName, setServerName] = useState('Painel Gold Play 4K');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const formatMoney = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fetchPlans = async () => {
    setLoading(true);
    try {
      let data: IPTVPlan[] = [];
      if (isSupabaseConfigured && tenant?.id) {
        data = await loadIPTVPlansFromSupabase(tenant.id);
      }
      if (!data || data.length === 0) {
        data = await api.getIPTVPlans(tenant.id);
      }
      setPlans(data);
      if (tenant?.id && Array.isArray(data)) {
        try {
          localStorage.setItem(`iptv_plans_${tenant.id}`, JSON.stringify(data));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to fetch IPTV plans', err);
      try {
        const cached = localStorage.getItem(`iptv_plans_${tenant.id}`);
        if (cached) setPlans(JSON.parse(cached));
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    const handleFocus = () => fetchPlans();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [tenant.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const numPrice = parseFloat(price.replace(',', '.'));
      const planPayload = {
        tenant_id: tenant.id,
        name: name.trim(),
        screens,
        duration_days: durationDays,
        price: isNaN(numPrice) ? 0 : numPrice,
        server_name: serverName.trim(),
        description: description.trim() || undefined,
      };

      let created: IPTVPlan;
      if (isSupabaseConfigured && tenant?.id) {
        created = await createIPTVPlanInSupabase(tenant.id, planPayload);
      } else {
        created = await api.createIPTVPlan(planPayload);
      }

      api.createIPTVPlan(created).catch(() => {});

      setIsAdding(false);
      setName('');
      setDescription('');
      setPrice('35,00');
      await fetchPlans();
    } catch (err) {
      console.error('Failed to create plan', err);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: IPTVPlan) => {
    setEditingPlan(p);
    setName(p.name || '');
    setScreens(p.screens || 1);
    setDurationDays(p.duration_days || 30);
    setPrice(p.price != null ? p.price.toFixed(2).replace('.', ',') : '35,00');
    setServerName(p.server_name || '');
    setDescription(p.description || '');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !name.trim()) return;

    setSaving(true);
    try {
      const numPrice = parseFloat(price.replace(',', '.'));
      const updates = {
        name: name.trim(),
        screens,
        duration_days: durationDays,
        price: isNaN(numPrice) ? 0 : numPrice,
        server_name: serverName.trim(),
        description: description.trim() || undefined,
      };

      if (isSupabaseConfigured && tenant?.id) {
        await updateIPTVPlanInSupabase(tenant.id, editingPlan.id, updates);
      }
      api.updateIPTVPlan(editingPlan.id, updates).catch(() => {});

      setEditingPlan(null);
      await fetchPlans();
    } catch (err) {
      console.error('Failed to update plan', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (isSupabaseConfigured && tenant?.id) {
        await deleteIPTVPlanInSupabase(tenant.id, id);
      }
      api.deleteIPTVPlan(id).catch(() => {});
      await fetchPlans();
    } catch (err) {
      console.error('Failed to delete plan', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>IPTV &bull; Módulo de Planos</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Cadastro e Gestão de Planos IPTV
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Configure pacotes com telas simultâneas, validade, preços e servidores
          </p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-purple-900/40 border border-purple-400/30 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Plano</span>
        </button>
      </div>

      {/* Creation Modal / Form */}
      {isAdding && (
        <div className="p-5 bg-slate-900 border border-purple-500/30 rounded-2xl shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Cadastrar Novo Plano IPTV</span>
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
                Nome do Plano *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Mensal 1 Tela Full HD"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Telas Simultâneas
              </label>
              <select
                value={screens}
                onChange={(e) => setScreens(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value={1}>1 Tela</option>
                <option value={2}>2 Telas</option>
                <option value={3}>3 Telas</option>
                <option value={4}>4 Telas</option>
                <option value={5}>5 Telas</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Duração do Plano
              </label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value={1}>1 Dia (Teste)</option>
                <option value={30}>30 Dias (Mensal)</option>
                <option value={60}>60 Dias (Bimestral)</option>
                <option value={90}>90 Dias (Trimestral)</option>
                <option value={180}>180 Dias (Semestral)</option>
                <option value={365}>365 Dias (Anual)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Preço de Cobrança (R$) *
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
                Servidor / Painel Recomendado
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Ex: Painel Gold Play 4K"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Descrição dos Benefícios
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Canais 4K, filmes, séries e esportes"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

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
                {saving ? 'Cadastrando...' : 'Salvar Plano'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="p-5 bg-slate-900 border border-purple-500/50 rounded-2xl shadow-2xl space-y-4 animate-in fade-in duration-200 ring-1 ring-purple-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-purple-400" />
              <span>Editar Plano IPTV: {editingPlan.name}</span>
            </h3>
            <button
              onClick={() => setEditingPlan(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Nome do Plano *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Mensal 1 Tela Full HD"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Telas Simultâneas
              </label>
              <select
                value={screens}
                onChange={(e) => setScreens(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value={1}>1 Tela</option>
                <option value={2}>2 Telas</option>
                <option value={3}>3 Telas</option>
                <option value={4}>4 Telas</option>
                <option value={5}>5 Telas</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Duração do Plano
              </label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value={1}>1 Dia (Teste)</option>
                <option value={30}>30 Dias (Mensal)</option>
                <option value={60}>60 Dias (Bimestral)</option>
                <option value={90}>90 Dias (Trimestral)</option>
                <option value={180}>180 Dias (Semestral)</option>
                <option value={365}>365 Dias (Anual)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Preço de Cobrança (R$) *
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
                Servidor / Painel Recomendado
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="Ex: Painel Gold Play 4K"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Descrição dos Benefícios
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Canais 4K, filmes, séries e esportes"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
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

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                  <Tv className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {p.screens} {p.screens === 1 ? 'Tela' : 'Telas'}
                </span>
              </div>

              <h3 className="text-base font-extrabold text-white">{p.name}</h3>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                {p.description || 'Acesso total aos canais e conteúdos sob demanda.'}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Validade:</span>
                  <span className="font-semibold text-slate-200">{p.duration_days} dias</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Servidor:</span>
                  <span className="font-semibold text-purple-300">{p.server_name}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Preço</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {formatMoney(p.price)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => startEdit(p)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-purple-900/60 hover:text-purple-300 transition-colors"
                  title="Editar plano"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Excluir plano"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
