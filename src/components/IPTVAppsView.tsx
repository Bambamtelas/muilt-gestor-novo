import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Plus,
  Tv,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  X,
  Server,
  Layers,
  HelpCircle,
  Share2,
  Pencil,
  Search,
  Download,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { IPTVApp, Tenant } from '../types/index.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import {
  loadIPTVAppsFromSupabase,
  createIPTVAppInSupabase,
  updateIPTVAppInSupabase,
  deleteIPTVAppInSupabase,
} from '../lib/supabaseIPTV.js';

interface IPTVAppsViewProps {
  tenant: Tenant;
}

export const IPTVAppsView: React.FC<IPTVAppsViewProps> = ({ tenant }) => {
  const [apps, setApps] = useState<IPTVApp[]>(() => {
    if (typeof window !== 'undefined' && tenant?.id) {
      try {
        const cached = localStorage.getItem(`iptv_apps_${tenant.id}`);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingApp, setEditingApp] = useState<IPTVApp | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedDnsId, setCopiedDnsId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [appToDelete, setAppToDelete] = useState<IPTVApp | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'smart_tv' | 'android' | 'firestick' | 'windows' | 'ios' | 'multi'>('smart_tv');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [dnsServer, setDnsServer] = useState('');
  const [activationType, setActivationType] = useState<'login_password' | 'mac_device_key' | 'm3u_link'>('login_password');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchApps = async () => {
    setLoading(true);
    try {
      let data: IPTVApp[] = [];
      if (isSupabaseConfigured && tenant?.id) {
        data = await loadIPTVAppsFromSupabase(tenant.id);
      }
      if (!data || data.length === 0) {
        data = await api.getIPTVApps(tenant.id);
      }
      setApps(data);
      if (tenant?.id && Array.isArray(data)) {
        try {
          localStorage.setItem(`iptv_apps_${tenant.id}`, JSON.stringify(data));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to fetch IPTV apps', err);
      try {
        const cached = localStorage.getItem(`iptv_apps_${tenant.id}`);
        if (cached) setApps(JSON.parse(cached));
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
    const handleFocus = () => fetchApps();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [tenant.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const appPayload = {
        tenant_id: tenant.id,
        name: name.trim(),
        category,
        download_url: downloadUrl.trim() || undefined,
        dns_server: dnsServer.trim() || undefined,
        activation_type: activationType,
        instructions: instructions.trim() || undefined,
      };

      let created: IPTVApp;
      if (isSupabaseConfigured && tenant?.id) {
        created = await createIPTVAppInSupabase(tenant.id, appPayload);
      } else {
        created = await api.createIPTVApp(appPayload);
      }

      api.createIPTVApp(created).catch(() => {});

      setIsAdding(false);
      setName('');
      setDownloadUrl('');
      setDnsServer('');
      setInstructions('');
      await fetchApps();
    } catch (err) {
      console.error('Failed to create app', err);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (app: IPTVApp) => {
    setEditingApp(app);
    setName(app.name || '');
    setCategory(app.category || 'android');
    setDownloadUrl(app.download_url || '');
    setDnsServer(app.dns_server || '');
    setActivationType((app.activation_type as any) || 'login_password');
    setInstructions(app.instructions || '');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp || !name.trim()) return;

    setSaving(true);
    try {
      const updates = {
        name: name.trim(),
        category,
        download_url: downloadUrl.trim() || undefined,
        dns_server: dnsServer.trim() || undefined,
        activation_type: activationType,
        instructions: instructions.trim() || undefined,
      };

      if (isSupabaseConfigured && tenant?.id) {
        await updateIPTVAppInSupabase(tenant.id, editingApp.id, updates);
      }
      api.updateIPTVApp(editingApp.id, updates).catch(() => {});

      setEditingApp(null);
      await fetchApps();
    } catch (err) {
      console.error('Failed to update app', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (isSupabaseConfigured && tenant?.id) {
        await deleteIPTVAppInSupabase(tenant.id, id);
      }
      api.deleteIPTVApp(id).catch(() => {});
      setAppToDelete(null);
      await fetchApps();
    } catch (err) {
      console.error('Failed to delete app', err);
    }
  };

  const handleCopyInstructions = (app: IPTVApp) => {
    const text =
      `📱 *Como Instalar e Configurar o Aplicativo: ${app.name}*\n\n` +
      (app.download_url ? `🔗 *Link para Download:* ${app.download_url}\n` : '') +
      (app.dns_server ? `🌐 *Servidor / DNS / URL:* \`${app.dns_server}\`\n` : '') +
      `🔑 *Tipo de Ativação:* ${
        app.activation_type === 'login_password'
          ? 'Usuário e Senha'
          : app.activation_type === 'mac_device_key'
          ? 'MAC Address & Device Key'
          : 'Lista M3U'
      }\n\n` +
      `📝 *Passo a Passo:*\n${app.instructions || 'Instale o aplicativo na sua TV ou dispositivo e acesse com os dados fornecidos.'}\n\n` +
      `_Dúvidas ou problemas? Responda a esta mensagem para obter ajuda!_`;

    navigator.clipboard.writeText(text);
    setCopiedId(app.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyDns = (dns: string, id: string) => {
    navigator.clipboard.writeText(dns);
    setCopiedDnsId(id);
    setTimeout(() => setCopiedDnsId(null), 2000);
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'smart_tv':
        return 'Smart TV';
      case 'android':
        return 'Android / TV Box';
      case 'firestick':
        return 'Fire Stick';
      case 'windows':
        return 'Windows / PC';
      case 'ios':
        return 'iOS / Apple';
      case 'multi':
      default:
        return 'Multiplataforma';
    }
  };

  const filteredApps = apps.filter((app) => {
    const term = searchTerm.toLowerCase();
    return (
      app.name.toLowerCase().includes(term) ||
      (app.dns_server && app.dns_server.toLowerCase().includes(term)) ||
      getCategoryLabel(app.category).toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase mb-1">
            <Smartphone className="w-3.5 h-3.5" />
            <span>IPTV &bull; Módulo de Aplicativos</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Cadastro e Gestão de Aplicativos IPTV
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Lista completa de players, links oficiais, DNS e tutoriais de instalação para clientes
          </p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-purple-900/40 border border-purple-400/30 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Aplicativo</span>
        </button>
      </div>

      {/* Creation Modal / Form */}
      {isAdding && (
        <div className="p-5 bg-slate-900 border border-purple-500/30 rounded-2xl shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-400" />
              <span>Cadastrar Novo Aplicativo IPTV</span>
            </h3>
            <button
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Nome do Aplicativo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: IPTV Smarters Pro, XCIPTV, IBO Player"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Plataforma / Dispositivo
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value="smart_tv">Smart TV (Samsung/LG)</option>
                <option value="android">Android / TV Box</option>
                <option value="firestick">Amazon Fire Stick</option>
                <option value="multi">Multiplataforma</option>
                <option value="windows">Windows / PC</option>
                <option value="ios">iOS / iPhone</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Tipo de Ativação
              </label>
              <select
                value={activationType}
                onChange={(e) => setActivationType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value="login_password">Login e Senha (Xtream Codes API)</option>
                <option value="mac_device_key">MAC Address &amp; Device Key (Ex: IBO, Bob)</option>
                <option value="m3u_link">URL / Link M3U</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Link de Download / Site Oficial
              </label>
              <input
                type="text"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                DNS / Servidor Recomendado
              </label>
              <input
                type="text"
                value={dnsServer}
                onChange={(e) => setDnsServer(e.target.value)}
                placeholder="http://dns.servidor.tv:8080"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-purple-300 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Instruções de Instalação e Configuração
              </label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ex: 1. Baixe o app na loja da Smart TV. 2. Escolha Login com API. 3. Insira usuário e senha fornecidos."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50 resize-none"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/30 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Cadastrando...' : 'Salvar Aplicativo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit App Modal */}
      {editingApp && (
        <div className="p-5 bg-slate-900 border border-purple-500/50 rounded-2xl shadow-2xl space-y-4 animate-in fade-in duration-200 ring-1 ring-purple-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-purple-400" />
              <span>Editar Aplicativo IPTV: {editingApp.name}</span>
            </h3>
            <button
              onClick={() => setEditingApp(null)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Nome do Aplicativo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: IPTV Smarters Pro"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Plataforma / Dispositivo
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value="smart_tv">Smart TV (Samsung/LG)</option>
                <option value="android">Android / TV Box</option>
                <option value="firestick">Amazon Fire Stick</option>
                <option value="multi">Multiplataforma</option>
                <option value="windows">Windows / PC</option>
                <option value="ios">iOS / iPhone</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Tipo de Ativação
              </label>
              <select
                value={activationType}
                onChange={(e) => setActivationType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              >
                <option value="login_password">Login e Senha (Xtream Codes API)</option>
                <option value="mac_device_key">MAC Address &amp; Device Key (Ex: IBO, Bob)</option>
                <option value="m3u_link">URL / Link M3U</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Link de Download / Site Oficial
              </label>
              <input
                type="text"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                DNS / Servidor Recomendado
              </label>
              <input
                type="text"
                value={dnsServer}
                onChange={(e) => setDnsServer(e.target.value)}
                placeholder="http://dns.servidor.tv:8080"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-purple-300 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Instruções de Instalação e Configuração
              </label>
              <textarea
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ex: 1. Baixe o app na loja da Smart TV. 2. Escolha Login com API. 3. Insira usuário e senha..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/50 resize-none"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingApp(null)}
                className="px-4 py-2.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/30 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Salvando Alterações...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0a1226] p-3 rounded-2xl border border-[#18274d]">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por aplicativo, plataforma ou DNS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#060c1c] border border-[#1e305e] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="text-xs text-slate-400 font-medium">
          {filteredApps.length} de {apps.length} aplicativos cadastrados
        </div>
      </div>

      {/* LIST VIEW (Table / Accordion) */}
      <div className="bg-[#0b142b] border border-[#192a54] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070e21] border-b border-[#192a54] text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Aplicativo</th>
                <th className="py-3.5 px-4">Plataforma</th>
                <th className="py-3.5 px-4">Ativação</th>
                <th className="py-3.5 px-4">DNS / Servidor</th>
                <th className="py-3.5 px-4">Download</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#152345]">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Smartphone className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-sm">Nenhum aplicativo encontrado</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {apps.length === 0
                        ? 'Clique em "Cadastrar Novo Aplicativo" para começar a lista.'
                        : 'Tente outro termo na busca.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <React.Fragment key={app.id}>
                    <tr className="hover:bg-[#0f1d3d]/50 transition-colors">
                      {/* Name & Icon */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 font-bold">
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                              <span>{app.name}</span>
                              {app.instructions && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedAppId(expandedAppId === app.id ? null : app.id)
                                  }
                                  className="text-[10px] text-purple-400 hover:text-purple-300 font-normal inline-flex items-center gap-0.5 ml-1 bg-purple-500/10 px-1.5 py-0.5 rounded cursor-pointer"
                                  title="Ver instruções de instalação"
                                >
                                  <Info className="w-3 h-3" />
                                  <span>Tutorial</span>
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-xs">
                              {app.instructions || 'Sem observações adicionais'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-700/80 text-purple-300">
                          {getCategoryLabel(app.category)}
                        </span>
                      </td>

                      {/* Activation Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs text-slate-300 font-medium">
                          {app.activation_type === 'login_password'
                            ? 'Login & Senha'
                            : app.activation_type === 'mac_device_key'
                            ? 'MAC & Key'
                            : 'Lista M3U'}
                        </span>
                      </td>

                      {/* DNS / Server */}
                      <td className="py-3 px-4">
                        {app.dns_server ? (
                          <div className="inline-flex items-center gap-1 bg-[#060c1a] px-2 py-1 rounded-lg border border-purple-900/40 text-[11px] font-mono text-purple-300 max-w-[200px]">
                            <Server className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">{app.dns_server}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyDns(app.dns_server!, app.id)}
                              className="text-slate-400 hover:text-white p-0.5 ml-1 shrink-0 cursor-pointer"
                              title="Copiar DNS"
                            >
                              {copiedDnsId === app.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Não informado</span>
                        )}
                      </td>

                      {/* Download Link */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {app.download_url ? (
                          <a
                            href={app.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[11px] font-semibold transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            <span>Baixar</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Loja da TV / Direto</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Copy WhatsApp Tutorial */}
                          <button
                            type="button"
                            onClick={() => handleCopyInstructions(app)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all cursor-pointer"
                            title="Copiar tutorial completo para enviar ao cliente no WhatsApp"
                          >
                            {copiedId === app.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">WhatsApp</span>
                              </>
                            )}
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => startEdit(app)}
                            className="p-1.5 rounded-lg bg-[#070e21] text-slate-300 hover:bg-purple-600/20 hover:text-purple-300 border border-[#192a54] transition-colors cursor-pointer"
                            title="Editar aplicativo"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setAppToDelete(app)}
                            className="p-1.5 rounded-lg bg-[#070e21] text-slate-400 hover:bg-rose-950/40 hover:text-rose-400 border border-[#192a54] transition-colors cursor-pointer"
                            title="Excluir aplicativo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable row for tutorial instructions */}
                    {expandedAppId === app.id && app.instructions && (
                      <tr className="bg-[#081024]">
                        <td colSpan={6} className="p-4 border-t border-[#152345]">
                          <div className="p-3 bg-[#050a17] rounded-xl border border-purple-500/20 text-xs text-slate-300 space-y-1">
                            <div className="font-bold text-purple-300 flex items-center gap-1.5">
                              <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                              <span>Passo a Passo de Instalação — {app.name}</span>
                            </div>
                            <p className="whitespace-pre-line text-slate-300 pl-5">
                              {app.instructions}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {appToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Excluir Aplicativo?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deseja realmente remover o aplicativo <strong className="text-white">{appToDelete.name}</strong>?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAppToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(appToDelete.id)}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
