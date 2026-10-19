import React, { useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Trash2,
  Receipt,
  ExternalLink,
  Pencil,
  X,
  CheckCircle2,
  ShoppingBag,
  Eye,
  Clock,
  MessageSquare,
  ArrowUpRight,
} from 'lucide-react';
import { Customer, Tenant, Charge } from '../types/index.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import { updateCustomerInSupabase, deleteCustomerFromSupabase } from '../lib/supabaseCustomers.js';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime.js';

interface CustomersViewProps {
  customers: Customer[];
  charges?: Charge[];
  tenant: Tenant;
  onOpenNewCustomer: () => void;
  onNewChargeForCustomer: (customerId: string) => void;
  onDeleteCustomer: (customerId: string) => void;
  onRefreshCustomers?: () => void;
  onOpenWhatsApp?: (charge: Charge) => void;
  onMarkAsPaid?: (chargeId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  charges = [],
  tenant,
  onOpenNewCustomer,
  onNewChargeForCustomer,
  onDeleteCustomer,
  onRefreshCustomers,
  onOpenWhatsApp,
  onMarkAsPaid,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);

  // Realtime hook para sincronização entre múltiplos dispositivos
  const { broadcastChange } = useSupabaseRealtime<Customer>({
    table: 'customers',
    tenantId: tenant.id,
    enabled: Boolean(tenant?.id),
    onInsert: () => onRefreshCustomers?.(),
    onUpdate: () => onRefreshCustomers?.(),
    onDelete: () => onRefreshCustomers?.(),
    onSyncNeeded: () => onRefreshCustomers?.(),
  });

  // Recarga de segurança ao montar, focar na janela ou alternar abas
  React.useEffect(() => {
    onRefreshCustomers?.();

    const handleFocus = () => {
      onRefreshCustomers?.();
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        onRefreshCustomers?.();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => {
      if (!document.hidden) {
        onRefreshCustomers?.();
      }
    }, 45000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [tenant.id]);

  // Edit form states
  const [editName, setEditName] = useState('');
  const [editTradeName, setEditTradeName] = useState('');
  const [editDocument, setEditDocument] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddressStreet, setEditAddressStreet] = useState('');
  const [editAddressNumber, setEditAddressNumber] = useState('');
  const [editAddressNeighborhood, setEditAddressNeighborhood] = useState('');
  const [editAddressCity, setEditAddressCity] = useState('');
  const [editAddressState, setEditAddressState] = useState('CE');
  const [editNotes, setEditNotes] = useState('');
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const formatMoney = (val?: number) =>
    (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Cruza dinamicamente as cobranças/vendas com o cliente para calcular débitos e total pago em tempo real
  const getCustomerCharges = (cust: Customer): Charge[] => {
    if (!charges || charges.length === 0) return [];
    const cleanCustPhone = (cust.whatsapp || cust.phone || '').replace(/\D/g, '');
    const cleanCustName = (cust.name || '').trim().toLowerCase();

    return charges.filter((c) => {
      // 1. Vínculo direto por ID
      if (c.customer_id === cust.id || (c.customer && c.customer.id === cust.id)) {
        return true;
      }

      // Procura cliente vinculado à cobrança caso c.customer não esteja embutido diretamente no objeto
      const chargeCust = c.customer || customers.find((item) => item.id === c.customer_id);

      // 2. Vínculo por WhatsApp / Telefone se disponível
      if (cleanCustPhone && cleanCustPhone.length >= 8) {
        const cleanChargePhone = (chargeCust?.whatsapp || chargeCust?.phone || '').replace(/\D/g, '');
        if (cleanChargePhone && (cleanChargePhone.endsWith(cleanCustPhone.slice(-8)) || cleanCustPhone.endsWith(cleanChargePhone.slice(-8)))) {
          return true;
        }
      }
      // 3. Vínculo por Nome do cliente
      if (cleanCustName && chargeCust?.name && chargeCust.name.trim().toLowerCase() === cleanCustName) {
        return true;
      }
      return false;
    });
  };

  const getCustomerMetrics = (cust: Customer) => {
    const custCharges = getCustomerCharges(cust);

    if (custCharges.length === 0) {
      return {
        totalDebt: cust.total_debt || 0,
        totalPaid: cust.total_paid || 0,
        chargesCount: 0,
        paidCount: 0,
        pendingCount: 0,
        charges: [],
      };
    }

    const totalDebt = custCharges
      .filter((c) => c.status === 'pending' || c.status === 'overdue')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const totalPaid = custCharges
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const paidCount = custCharges.filter((c) => c.status === 'paid').length;
    const pendingCount = custCharges.filter((c) => c.status === 'pending' || c.status === 'overdue').length;

    return {
      totalDebt,
      totalPaid,
      chargesCount: custCharges.length,
      paidCount,
      pendingCount,
      charges: custCharges,
    };
  };

  const handleOpenEdit = (cust: Customer) => {
    setEditingCustomer(cust);
    setEditName(cust.name || '');
    setEditTradeName(cust.trade_name || '');
    setEditDocument(cust.document || '');
    setEditWhatsapp(cust.whatsapp || '');
    setEditEmail(cust.email || '');
    setEditAddressStreet(cust.address_street || '');
    setEditAddressNumber(cust.address_number || '');
    setEditAddressNeighborhood(cust.address_neighborhood || '');
    setEditAddressCity(cust.address_city || '');
    setEditAddressState(cust.address_state || 'CE');
    setEditNotes(cust.notes || '');
    setErrorMessage(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editName.trim()) return;

    setSavingEdit(true);
    setErrorMessage(null);
    try {
      const updates = {
        name: editName.trim(),
        trade_name: editTradeName.trim() || undefined,
        document: editDocument.trim() || undefined,
        whatsapp: editWhatsapp.trim() || undefined,
        email: editEmail.trim() || undefined,
        address_street: editAddressStreet.trim() || undefined,
        address_number: editAddressNumber.trim() || undefined,
        address_neighborhood: editAddressNeighborhood.trim() || undefined,
        address_city: editAddressCity.trim() || undefined,
        address_state: editAddressState.trim() || undefined,
        notes: editNotes.trim() || undefined,
      };

      if (isSupabaseConfigured && tenant?.id) {
        const updated = await updateCustomerInSupabase(tenant.id, editingCustomer.id, updates);
        broadcastChange('update', updated);
      }
      api.updateCustomer(editingCustomer.id, updates).catch(() => {});

      setEditingCustomer(null);
      setToastMessage('Cliente atualizado com sucesso!');
      setTimeout(() => setToastMessage(null), 3000);
      onRefreshCustomers?.();
    } catch (err: any) {
      console.error('Failed to update customer', err);
      setErrorMessage('Não foi possível sincronizar com o servidor. Verifique sua conexão e tente novamente.');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.trade_name && c.trade_name.toLowerCase().includes(term)) ||
      (c.document && c.document.includes(term)) ||
      (c.whatsapp && c.whatsapp.includes(term)) ||
      (c.address_city && c.address_city.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-5 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Clientes &amp; Devedores (CRM)
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Mantenha o cadastro atualizado com dados para emissão de PIX e alertas no WhatsApp
          </p>
        </div>

        <button
          onClick={onOpenNewCustomer}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-purple-900/40 border border-purple-400/30 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 sm:p-4 bg-[#0f1b38] border border-[#1e2f57] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, documento, WhatsApp ou cidade..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#091124] border border-[#1b2b4f] rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/60"
          />
        </div>
        <div className="text-[11px] sm:text-xs text-slate-400 shrink-0 font-medium self-end sm:self-auto">
          {filteredCustomers.length} clientes encontrados
        </div>
      </div>

      {/* Customers Display (Mobile Cards + Desktop Table) */}
      <div className="bg-[#0f1b38] border border-[#1e2f57] rounded-2xl overflow-hidden shadow-xl p-3 sm:p-0">
        {/* Mobile View: Cards */}
        <div className="md:hidden space-y-3">
          {filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Nenhum cliente encontrado.
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const metrics = getCustomerMetrics(cust);
              const hasDebt = metrics.totalDebt > 0;
              const hasPaid = metrics.totalPaid > 0;
              const cleanPhone = (cust.whatsapp || cust.phone || '').replace(/\D/g, '');

              return (
                <div
                  key={cust.id}
                  className="p-3.5 rounded-xl bg-[#091124] border border-[#1b2b4f] space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerForHistory(cust)}
                      className="text-left min-w-0 flex-1 group cursor-pointer"
                    >
                      <div className="font-bold text-white text-sm truncate group-hover:text-purple-300 flex items-center gap-1.5 transition-colors">
                        <span>{cust.name}</span>
                        <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-300 shrink-0" />
                      </div>
                      {cust.trade_name && (
                        <div className="text-[11px] text-slate-400 font-normal truncate">
                          {cust.trade_name}
                        </div>
                      )}
                      {cust.document && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          Doc: {cust.document}
                        </div>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasDebt ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          ⚠️ Em Aberto
                        </span>
                      ) : hasPaid ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Em Dia (Pago)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          Sem Compras
                        </span>
                      )}

                      {cust.whatsapp && (
                        <a
                          href={`https://wa.me/55${cleanPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold"
                          title="Conversar no WhatsApp"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#1b2b4f]/60 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Em Aberto:</span>
                      <span className={`font-mono font-bold text-sm ${hasDebt ? 'text-rose-400' : 'text-slate-400'}`}>
                        {formatMoney(metrics.totalDebt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Total Pago:</span>
                      <span className={`font-mono font-bold text-sm ${hasPaid ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {formatMoney(metrics.totalPaid)}
                      </span>
                      {hasPaid && (
                        <span className="text-[9px] text-emerald-500/80 block font-medium">
                          ✓ {metrics.paidCount} {metrics.paidCount === 1 ? 'venda paga' : 'vendas pagas'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-[#1b2b4f]/60">
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerForHistory(cust)}
                      className="py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Ver extrato e histórico"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Extrato</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNewChargeForCustomer(cust.id)}
                      className="py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>+ Venda</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(cust)}
                      className="py-1.5 rounded-lg bg-[#121f3f] text-slate-300 hover:text-white border border-[#1b2b4f] text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCustomerToDelete(cust)}
                      className="py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 border border-rose-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
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

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#091124] border-b border-[#1b2b4f] text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Cliente / Razão</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">WhatsApp / Contato</th>
                <th className="py-3 px-4">Cidade / UF</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Em Aberto</th>
                <th className="py-3 px-4">Total Pago</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b2b4f]/60 text-slate-300">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const metrics = getCustomerMetrics(cust);
                  const hasDebt = metrics.totalDebt > 0;
                  const hasPaid = metrics.totalPaid > 0;
                  const cleanPhone = (cust.whatsapp || cust.phone || '').replace(/\D/g, '');

                  return (
                    <tr key={cust.id} className="hover:bg-[#121f3f]/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForHistory(cust)}
                          className="text-left group cursor-pointer"
                          title="Clique para ver extrato e compras deste cliente"
                        >
                          <div className="group-hover:text-purple-300 font-bold transition-colors flex items-center gap-1.5">
                            <span>{cust.name}</span>
                            <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-300 transition-colors" />
                          </div>
                          {cust.trade_name && (
                            <div className="text-[11px] text-slate-400 font-normal">
                              {cust.trade_name}
                            </div>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {cust.document || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        {cust.whatsapp ? (
                          <a
                            href={`https://wa.me/55${cleanPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-mono font-bold"
                          >
                            <span>{cust.whatsapp}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {cust.address_street ? (
                          <div>
                            <div className="text-white text-xs font-medium">
                              {cust.address_street}{cust.address_number ? `, ${cust.address_number}` : ''}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {[cust.address_neighborhood, cust.address_city, cust.address_state].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                        ) : cust.address_city ? (
                          `${cust.address_city} - ${cust.address_state || 'CE'}`
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Status CRM */}
                      <td className="py-3.5 px-4">
                        {hasDebt ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            ⚠️ Em Aberto
                          </span>
                        ) : hasPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Em Dia (Pago)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            Sem Compras
                          </span>
                        )}
                      </td>

                      {/* Em Aberto */}
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span className={hasDebt ? 'text-rose-400 font-bold' : 'text-slate-400 font-medium'}>
                          {formatMoney(metrics.totalDebt)}
                        </span>
                      </td>

                      {/* Total Pago */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className={`font-bold ${hasPaid ? 'text-emerald-400 text-sm' : 'text-slate-500'}`}>
                          {formatMoney(metrics.totalPaid)}
                        </div>
                        {hasPaid && (
                          <div className="text-[10px] text-emerald-500/80 font-sans font-medium flex items-center gap-1">
                            <span>✓ {metrics.paidCount} {metrics.paidCount === 1 ? 'venda paga' : 'vendas pagas'}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Extrato / Histórico */}
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerForHistory(cust)}
                            className="p-1.5 rounded-lg bg-[#091124] text-purple-400 hover:bg-purple-600/20 hover:text-purple-300 border border-[#1b2b4f] hover:border-purple-500/40 transition-colors cursor-pointer"
                            title="Ver histórico de compras e extrato do cliente"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>

                          {/* + Nova Venda */}
                          <button
                            type="button"
                            onClick={() => onNewChargeForCustomer(cust.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#091124] hover:bg-blue-600/30 text-blue-300 border border-[#1b2b4f] hover:border-blue-500/40 text-xs font-semibold transition-all cursor-pointer"
                            title="Lançar nova venda para este cliente"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">+ Venda</span>
                          </button>

                          {/* Editar Cliente */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cust)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#091124] hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 border border-[#1b2b4f] hover:border-blue-500/40 text-xs font-semibold transition-all cursor-pointer"
                            title="Editar dados do cliente"
                          >
                            <Pencil className="w-3.5 h-3.5 text-blue-400" />
                            <span>Editar</span>
                          </button>

                          {/* Excluir */}
                          <button
                            type="button"
                            onClick={() => setCustomerToDelete(cust)}
                            className="p-1.5 rounded-lg bg-[#091124] text-slate-400 hover:bg-rose-950/40 hover:text-rose-400 border border-[#1b2b4f] hover:border-rose-500/30 transition-colors cursor-pointer"
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

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
            {/* Header */}
            <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Editar Cliente / Devedor</h2>
                  <p className="text-xs text-slate-400">Atualize os dados cadastrais e de cobrança</p>
                </div>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4">
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
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Nome Fantasia / Apelido
                  </label>
                  <input
                    type="text"
                    value={editTradeName}
                    onChange={(e) => setEditTradeName(e.target.value)}
                    placeholder="Ex: Carlinhos Barbearia"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    CPF ou CNPJ
                  </label>
                  <input
                    type="text"
                    value={editDocument}
                    onChange={(e) => setEditDocument(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    WhatsApp / Telefone *
                  </label>
                  <input
                    type="text"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    placeholder="11988887777"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
                  />
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
                    value={editAddressStreet}
                    onChange={(e) => setEditAddressStreet(e.target.value)}
                    placeholder="Ex: Av. Santos Dumont, Rua das Flores"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Número
                  </label>
                  <input
                    type="text"
                    value={editAddressNumber}
                    onChange={(e) => setEditAddressNumber(e.target.value)}
                    placeholder="Ex: 123"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
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
                    value={editAddressNeighborhood}
                    onChange={(e) => setEditAddressNeighborhood(e.target.value)}
                    placeholder="Ex: Aldeota, Centro"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={editAddressCity}
                    onChange={(e) => setEditAddressCity(e.target.value)}
                    placeholder="Ex: Fortaleza, São Paulo"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    UF
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={editAddressState}
                    onChange={(e) => setEditAddressState(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="CE"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Observações Internas
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notas adicionais sobre o cliente..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-blue-900/50 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingEdit ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Customer Sales History & Statement Modal */}
      {selectedCustomerForHistory && (() => {
        const histMetrics = getCustomerMetrics(selectedCustomerForHistory);
        const histCharges = histMetrics.charges;
        const cleanPhone = (selectedCustomerForHistory.whatsapp || selectedCustomerForHistory.phone || '').replace(/\D/g, '');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
              {/* Header */}
              <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span>Extrato: {selectedCustomerForHistory.name}</span>
                      {histMetrics.totalDebt === 0 && histMetrics.totalPaid > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ✓ Em Dia
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Histórico completo de compras e pagamentos do cliente
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const c = selectedCustomerForHistory;
                      setSelectedCustomerForHistory(null);
                      handleOpenEdit(c);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Editar dados cadastrais deste cliente"
                  >
                    <Pencil className="w-3.5 h-3.5 text-blue-400" />
                    <span>Editar Cliente</span>
                  </button>
                  <button
                    onClick={() => setSelectedCustomerForHistory(null)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
                {/* Financial Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                    <span className="text-[10px] uppercase font-bold text-emerald-400/80 block">
                      Total Já Pago
                    </span>
                    <span className="text-lg font-bold font-mono text-emerald-400 block mt-0.5">
                      {formatMoney(histMetrics.totalPaid)}
                    </span>
                    <span className="text-[10px] text-emerald-300/70 block mt-0.5 font-medium">
                      ✓ {histMetrics.paidCount} {histMetrics.paidCount === 1 ? 'venda quitada' : 'vendas quitadas'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#091124] border border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Saldo em Aberto (Débito)
                    </span>
                    <span className={`text-lg font-bold font-mono block mt-0.5 ${histMetrics.totalDebt > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {formatMoney(histMetrics.totalDebt)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {histMetrics.pendingCount} {histMetrics.pendingCount === 1 ? 'cobrança pendente' : 'cobranças pendentes'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30">
                    <span className="text-[10px] uppercase font-bold text-blue-400/80 block">
                      Total de Vendas
                    </span>
                    <span className="text-lg font-bold font-mono text-blue-400 block mt-0.5">
                      {formatMoney(histMetrics.totalDebt + histMetrics.totalPaid)}
                    </span>
                    <span className="text-[10px] text-blue-300/70 block mt-0.5 font-medium">
                      {histMetrics.chargesCount} {histMetrics.chargesCount === 1 ? 'venda registrada' : 'vendas registradas'}
                    </span>
                  </div>
                </div>

                {/* Contact info bar */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3 text-slate-300">
                    {selectedCustomerForHistory.whatsapp && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3.5 h-3.5 text-purple-400" />
                        <span>{selectedCustomerForHistory.whatsapp}</span>
                      </span>
                    )}
                    {selectedCustomerForHistory.address_city && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{selectedCustomerForHistory.address_city} - {selectedCustomerForHistory.address_state || 'CE'}</span>
                      </span>
                    )}
                  </div>
                  {cleanPhone && (
                    <a
                      href={`https://wa.me/55${cleanPhone}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Abrir no WhatsApp</span>
                    </a>
                  )}
                </div>

                {/* Charges List */}
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider mb-2.5 flex items-center justify-between">
                    <span>Compras e Cobranças ({histCharges.length})</span>
                    <button
                      type="button"
                      onClick={() => {
                        const custId = selectedCustomerForHistory.id;
                        setSelectedCustomerForHistory(null);
                        onNewChargeForCustomer(custId);
                      }}
                      className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Nova Venda</span>
                    </button>
                  </h3>

                  {histCharges.length === 0 ? (
                    <div className="py-10 text-center border border-dashed border-slate-800 rounded-xl">
                      <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-400 font-semibold">Nenhuma compra ou cobrança encontrada para este cliente.</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Clique em "+ Nova Venda" para registrar a primeira venda deste cliente.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {histCharges.map((chg) => {
                        const isPaid = chg.status === 'paid';
                        const isOverdue = chg.status === 'overdue';
                        const dateFormatted = new Date(chg.sale_date || chg.due_date || chg.created_at).toLocaleDateString('pt-BR');

                        return (
                          <div
                            key={chg.id}
                            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  isPaid
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : isOverdue
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {isPaid ? '✓ PAGO' : isOverdue ? '⚠️ VENCIDO' : '⏳ PENDENTE'}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase border ${
                                  chg.type === 'service'
                                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                    : chg.type === 'debt'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : chg.type === 'loan'
                                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                    : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                }`}>
                                  {chg.type === 'service' ? 'Serviço' : chg.type === 'debt' ? 'Dívida' : chg.type === 'loan' ? 'Empréstimo' : 'Venda'}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {dateFormatted}
                                </span>
                                {chg.payment_method && (
                                  <span className="text-[10px] text-slate-500 uppercase font-mono">
                                    • {chg.payment_method}
                                  </span>
                                )}
                              </div>

                              <div className="font-semibold text-white text-xs sm:text-sm mt-1">
                                {chg.description || 'Venda sem descrição'}
                              </div>

                              {chg.notes && (
                                <div className="text-[11px] text-slate-400 mt-1 whitespace-pre-line line-clamp-2">
                                  {chg.notes}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-0">
                              <div className="text-right">
                                <span className="text-[9px] uppercase font-semibold text-slate-500 block">Valor</span>
                                <span className={`text-sm sm:text-base font-bold font-mono ${isPaid ? 'text-emerald-400' : 'text-white'}`}>
                                  {formatMoney(chg.amount)}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {onOpenWhatsApp && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenWhatsApp(chg)}
                                    className="p-2 rounded-lg bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-500/30 transition-colors cursor-pointer"
                                    title="Enviar comprovante / cobrança pelo WhatsApp"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {!isPaid && onMarkAsPaid && (
                                  <button
                                    type="button"
                                    onClick={() => onMarkAsPaid(chg.id)}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                                    title="Dar baixa e marcar como pago"
                                  >
                                    Dar Baixa
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerForHistory(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Fechar Extrato
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const custId = selectedCustomerForHistory.id;
                    setSelectedCustomerForHistory(null);
                    onNewChargeForCustomer(custId);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-blue-900/40 flex items-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>+ Lançar Nova Venda</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Excluir Cliente?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deseja realmente remover o cliente <strong className="text-white">{customerToDelete.name}</strong>?
                {customerToDelete.total_debt && customerToDelete.total_debt > 0 ? (
                  <span className="block mt-1 text-rose-400 font-bold">
                    Atenção: Este cliente possui {formatMoney(customerToDelete.total_debt)} em aberto!
                  </span>
                ) : null}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const toDeleteId = customerToDelete.id;
                  setCustomerToDelete(null);
                  try {
                    if (isSupabaseConfigured && tenant?.id) {
                      await deleteCustomerFromSupabase(tenant.id, toDeleteId);
                      broadcastChange('delete', { id: toDeleteId, tenantId: tenant.id });
                    }
                    onDeleteCustomer(toDeleteId);
                    setToastMessage('Cliente excluído com sucesso.');
                    setTimeout(() => setToastMessage(null), 3000);
                  } catch (err: any) {
                    console.error('Failed to delete customer', err);
                    setToastMessage('Não foi possível excluir do servidor. Tente novamente.');
                    setTimeout(() => setToastMessage(null), 4500);
                  }
                }}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-2xl shadow-black animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
