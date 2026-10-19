import React, { useState } from 'react';
import { X, UserPlus, Building, Phone, Mail, MapPin, FileText, CheckCircle2 } from 'lucide-react';
import { Customer, Tenant } from '../types/index.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import { createCustomerInSupabase } from '../lib/supabaseCustomers.js';

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  onCreated: (customer: Customer) => void;
}

export const NewCustomerModal: React.FC<NewCustomerModalProps> = ({
  isOpen,
  onClose,
  tenant,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [document, setDocument] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('CE');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setErrorMessage(null);
    try {
      const customerData = {
        tenant_id: tenant.id,
        name: name.trim(),
        trade_name: tradeName.trim() || undefined,
        document: document.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        address_street: addressStreet.trim() || undefined,
        address_number: addressNumber.trim() || undefined,
        address_neighborhood: addressNeighborhood.trim() || undefined,
        address_city: addressCity.trim() || undefined,
        address_state: addressState.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      let created: Customer;
      if (isSupabaseConfigured && tenant?.id) {
        created = await createCustomerInSupabase(tenant.id, customerData);
      } else {
        created = await api.createCustomer(customerData);
      }

      // Backup sync silencioso para servidor Express
      api.createCustomer(created).catch(() => {});

      onCreated(created);
      onClose();
      // Reset form
      setName('');
      setTradeName('');
      setDocument('');
      setWhatsapp('');
      setEmail('');
      setAddressStreet('');
      setAddressNumber('');
      setAddressNeighborhood('');
      setAddressCity('');
      setAddressState('CE');
      setNotes('');
    } catch (err: any) {
      console.error('Failed to create customer', err);
      setErrorMessage('Não foi possível salvar o cliente no servidor. Verifique sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Cadastrar Novo Cliente / Devedor</h2>
              <p className="text-xs text-slate-400">Preencha os dados de contato para emissão e cobranças</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl font-medium">
              {errorMessage}
            </div>
          )}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
              Nome Completo / Razão Social *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Eduardo de Oliveira"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Nome Fantasia (Opcional)
              </label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Ex: Oficina Mecânica Silva"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                CPF ou CNPJ
              </label>
              <input
                type="text"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                WhatsApp / Telefone *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          </div>

          {/* Endereço: Rua e Número */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Rua / Logradouro
              </label>
              <input
                type="text"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
                placeholder="Ex: Av. Santos Dumont, Rua das Flores"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Número
              </label>
              <input
                type="text"
                value={addressNumber}
                onChange={(e) => setAddressNumber(e.target.value)}
                placeholder="Ex: 123"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Bairro, Cidade e UF */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Bairro
              </label>
              <input
                type="text"
                value={addressNeighborhood}
                onChange={(e) => setAddressNeighborhood(e.target.value)}
                placeholder="Ex: Aldeota, Centro"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Cidade
              </label>
              <input
                type="text"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                placeholder="Ex: Fortaleza, São Paulo"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                UF
              </label>
              <input
                type="text"
                value={addressState}
                onChange={(e) => setAddressState(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                placeholder="CE"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 uppercase focus:outline-none focus:border-emerald-500/50 font-bold text-center"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
              Observações Internas (Histórico do Devedor)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Prefere receber cobrança no WhatsApp após o dia 10..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-800 flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-purple-900/40 border border-purple-400/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Cadastrando...' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
