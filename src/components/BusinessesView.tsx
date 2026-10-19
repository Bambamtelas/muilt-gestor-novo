import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  CheckCircle2,
  QrCode,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { Tenant } from '../types/index.js';
import { api } from '../lib/api.js';

interface BusinessesViewProps {
  currentTenant: Tenant;
  onSelectTenant: (tenant: Tenant) => void;
  onRefresh: () => void;
}

export const BusinessesView: React.FC<BusinessesViewProps> = ({
  currentTenant,
  onSelectTenant,
  onRefresh,
}) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [document, setDocument] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [addressCity, setAddressCity] = useState('São Paulo');
  const [addressState, setAddressState] = useState('SP');
  const [saving, setSaving] = useState(false);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await api.getTenants();
      const unique = Array.isArray(data)
        ? data.filter((t, index, self) => index === self.findIndex((item) => item.id === t.id))
        : [];
      setTenants(unique);
    } catch (err) {
      console.error('Failed to fetch tenants', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const created = await api.createTenant({
        name: name.trim(),
        trade_name: tradeName.trim() || undefined,
        document: document.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        pix_key: pixKey.trim() || undefined,
        address_city: addressCity.trim() || undefined,
        address_state: addressState.trim() || undefined,
        subscription_status: 'trial',
      });

      setIsAdding(false);
      setName('');
      setTradeName('');
      setDocument('');
      setWhatsapp('');
      setPixKey('');
      await fetchTenants();
      onSelectTenant(created);
    } catch (err) {
      console.error('Failed to create company', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase mb-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>Multi-Empresas &amp; Filiais</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Negócios &amp; Empresas Cadastradas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Gerencie múltiplos negócios, filiais ou empresas com faturamentos e chaves PIX independentes
          </p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00b875] hover:bg-[#00a368] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Empresa / Filial</span>
        </button>
      </div>

      {/* Creation Modal / Form */}
      {isAdding && (
        <div className="p-5 bg-slate-900 border border-blue-500/30 rounded-2xl shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Cadastrar Novo Negócio ou Empresa</span>
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
                Razão Social / Nome da Empresa *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: DL Soluções em Tecnologia Ltda"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Nome Fantasia (Como aparece nas cobranças)
              </label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Ex: DL Games &amp; Streaming"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                CNPJ ou CPF
              </label>
              <input
                type="text"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                WhatsApp Oficial
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(11) 98765-4321"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Chave PIX da Empresa (Recebimentos)
              </label>
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="empresa@banco.com.br ou CNPJ"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-emerald-300 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Cidade / UF
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addressCity}
                  onChange={(e) => setAddressCity(e.target.value)}
                  placeholder="São Paulo"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                />
                <input
                  type="text"
                  value={addressState}
                  maxLength={2}
                  onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                  className="w-16 px-2.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-center uppercase text-slate-200 focus:outline-none focus:border-blue-500/50"
                />
              </div>
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
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-600/30 disabled:opacity-50"
              >
                {saving ? 'Cadastrando...' : 'Salvar Empresa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Companies */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map((t) => {
          const isActive = t.id === currentTenant.id;

          return (
            <div
              key={t.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Empresa Ativa
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium">Secundária</span>
                  )}
                </div>

                <h3 className="text-base font-extrabold text-white">{t.trade_name || t.name}</h3>
                <div className="text-xs text-slate-400 mt-0.5">{t.name}</div>

                <div className="mt-4 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Documento:</span>
                    <span className="font-mono text-slate-300">{t.document || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-500">Chave PIX:</span>
                    <span className="font-mono text-emerald-400 truncate max-w-[170px]">
                      {t.pix_key || 'Não cadastrada'}
                    </span>
                  </div>
                  {t.address_city && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{t.address_city} - {t.address_state || 'SP'}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  {t.subscription_status === 'lifetime'
                    ? 'Acesso Vitalício'
                    : t.subscription_status === 'active'
                    ? 'Assinatura Ativa'
                    : 'Período Trial'}
                </span>

                {!isActive ? (
                  <button
                    onClick={() => {
                      onSelectTenant(t);
                      onRefresh();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold rounded-xl transition-all"
                  >
                    <span>Alternar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-xs text-emerald-400 font-bold">Em uso</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
