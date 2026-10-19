import React, { useState } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Plus,
  Send,
  CheckCircle,
  AlertTriangle,
  Clock,
  Trash2,
  QrCode,
  DollarSign,
  Copy,
  CheckCircle2,
  Pencil,
  X,
} from 'lucide-react';
import { Charge, ChargeStatus, ChargeType, Customer, Tenant } from '../types/index.js';
import { generatePixPayload } from '../lib/pix.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import { updateChargeInSupabase } from '../lib/supabaseCharges.js';

interface ChargesViewProps {
  charges: Charge[];
  customers: Customer[];
  tenant: Tenant;
  onOpenNewCharge: () => void;
  onOpenWhatsApp: (charge: Charge) => void;
  onMarkAsPaid: (chargeId: string) => void;
  onDeleteCharge: (chargeId: string) => void;
  onRefreshCharges?: () => void;
}

export const ChargesView: React.FC<ChargesViewProps> = ({
  charges,
  customers,
  tenant,
  onOpenNewCharge,
  onOpenWhatsApp,
  onMarkAsPaid,
  onDeleteCharge,
  onRefreshCharges,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
  const [chargeToDelete, setChargeToDelete] = useState<Charge | null>(null);

  // Edit charge states
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editType, setEditType] = useState<ChargeType>('sale');
  const [editStatus, setEditStatus] = useState<ChargeStatus>('pending');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const formatMoney = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleOpenEdit = (charge: Charge) => {
    setEditingCharge(charge);
    setEditDescription(charge.description || '');
    setEditAmount((charge.amount || 0).toString().replace('.', ','));
    setEditDueDate(charge.due_date || new Date().toISOString().split('T')[0]);
    setEditType(charge.type || 'sale');
    setEditStatus(charge.status || 'pending');
    setEditNotes(charge.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCharge || !editDescription.trim() || !editAmount) return;

    setSavingEdit(true);
    try {
      const numAmount = parseFloat(editAmount.replace(',', '.'));
      const updates = {
        description: editDescription.trim(),
        amount: isNaN(numAmount) ? editingCharge.amount : numAmount,
        due_date: editDueDate,
        type: editType,
        status: editStatus,
        notes: editNotes.trim() || undefined,
      };

      if (isSupabaseConfigured && tenant?.id) {
        await updateChargeInSupabase(tenant.id, editingCharge.id, updates);
      }
      await api.updateCharge(editingCharge.id, updates).catch(() => {});

      setEditingCharge(null);
      onRefreshCharges?.();
    } catch (err) {
      console.error('Failed to update charge', err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Filter charges
  const filteredCharges = charges.filter((charge) => {
    const custName = charge.customer?.name || '';
    const desc = charge.description || '';
    const matchesSearch =
      custName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      desc.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || charge.status === statusFilter;
    const matchesType = typeFilter === 'all' || charge.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const totalFilteredAmount = filteredCharges.reduce((acc, c) => acc + Number(c.amount), 0);

  const handleCopyCustomerPix = (charge: Charge) => {
    const pixKey = tenant.pix_key || 'dlinformatica3137@gmail.com';
    const payload = generatePixPayload({
      pixKey,
      merchantName: tenant.name || 'JD GESTOR',
      merchantCity: tenant.address_city || 'SAO PAULO',
      amount: charge.amount,
      txId: charge.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 20),
      description: charge.description.slice(0, 30),
    });

    navigator.clipboard.writeText(payload);
    setCopiedPixId(charge.id);
    setTimeout(() => setCopiedPixId(null), 3000);
  };

  return (
    <div className="space-y-5 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Gestão de Vendas &amp; Faturamento
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Monitore vendas à vista e a prazo, envie comprovantes no WhatsApp e acompanhe recebimentos
          </p>
        </div>

        <button
          onClick={onOpenNewCharge}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-900/40 border border-blue-400/30 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Lançar Nova Venda</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:p-4 bg-[#0f1b38] border border-[#1e2f57] rounded-2xl space-y-3 shadow-xl">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, documento ou descrição..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#091124] border border-[#1b2b4f] rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/60"
            />
          </div>

          {/* Status and Type Filters */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-[#091124] border border-[#1b2b4f] rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500/60"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendentes</option>
              <option value="overdue">Vencidos</option>
              <option value="paid">Pagos / Liquidados</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2.5 bg-[#091124] border border-[#1b2b4f] rounded-xl text-xs text-slate-300 focus:outline-none focus:border-purple-500/60"
            >
              <option value="all">Todos os Tipos</option>
              <option value="sale">Vendas</option>
              <option value="service">Serviços</option>
              <option value="debt">Dívidas Antigas</option>
            </select>
          </div>
        </div>

        {/* Counter Summary */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1b2b4f] text-[11px] sm:text-xs text-slate-400">
          <span>{filteredCharges.length} cobranças</span>
          <span>
            Total: <strong className="text-white font-mono">{formatMoney(totalFilteredAmount)}</strong>
          </span>
        </div>
      </div>

      {/* Charges Display (Mobile Cards + Desktop Table) */}
      <div className="bg-[#0f1b38] border border-[#1e2f57] rounded-2xl overflow-hidden shadow-xl p-3 sm:p-0">
        {/* Mobile View: Cards */}
        <div className="md:hidden space-y-3">
          {filteredCharges.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Nenhuma cobrança encontrada com os filtros selecionados.
            </div>
          ) : (
            filteredCharges.map((charge) => {
              const isPaid = charge.status === 'paid';
              const isOverdue = charge.status === 'overdue';

              return (
                <div
                  key={charge.id}
                  className="p-3.5 rounded-xl bg-[#091124] border border-[#1b2b4f] space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">
                          {charge.customer?.name || 'Cliente Avulso'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase border ${
                          charge.type === 'service'
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : charge.type === 'debt'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : charge.type === 'loan'
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                        }`}>
                          {charge.type === 'service' ? 'Serviço' : charge.type === 'debt' ? 'Dívida' : charge.type === 'loan' ? 'Empréstimo' : 'Venda'}
                        </span>
                      </div>
                      {charge.customer?.whatsapp && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          {charge.customer.whatsapp}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle className="w-3 h-3" />
                          Pago
                        </span>
                      ) : isOverdue ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          Vencido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          Pendente
                        </span>
                      )}

                      <button
                        onClick={() => setChargeToDelete(charge)}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-md transition-colors"
                        title="Excluir cobrança"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300">
                    {charge.description}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#1b2b4f]/60">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Valor:</span>
                      <span className="font-mono font-black text-white text-base">
                        {formatMoney(charge.amount)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Vencimento:</span>
                      <span className="font-mono text-slate-300 font-medium">
                        {new Date(charge.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Actions Bar */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-[#1b2b4f]/60">
                    <button
                      onClick={() => onOpenWhatsApp(charge)}
                      className="py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      title="Cobrar via WhatsApp"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Cobrar</span>
                    </button>

                    <button
                      onClick={() => handleCopyCustomerPix(charge)}
                      className="py-2 rounded-lg bg-[#121f3f] text-slate-200 hover:text-white border border-[#1b2b4f] text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      title="Copiar PIX"
                    >
                      {copiedPixId === charge.id ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <QrCode className="w-3.5 h-3.5" />
                      )}
                      <span>PIX</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(charge)}
                      className="py-2 rounded-lg bg-[#121f3f] text-blue-400 hover:text-blue-300 border border-[#1b2b4f] text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    {!isPaid ? (
                      <button
                        onClick={() => onMarkAsPaid(charge.id)}
                        className="py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-black flex items-center justify-center gap-1 transition-all shadow-md"
                        title="Confirmar Baixa"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Baixar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setChargeToDelete(charge)}
                        className="py-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#091124] border-b border-[#1b2b4f] text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Devedor / Cliente</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações de Cobrança</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b2b4f]/60 text-slate-300">
              {filteredCharges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Nenhuma cobrança encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredCharges.map((charge) => {
                  const isPaid = charge.status === 'paid';
                  const isOverdue = charge.status === 'overdue';

                  return (
                    <tr key={charge.id} className="hover:bg-[#121f3f]/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div>{charge.customer?.name || 'Cliente Avulso'}</div>
                        {charge.customer?.whatsapp && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {charge.customer.whatsapp}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 max-w-xs">
                        <div className="truncate">{charge.description}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                          charge.type === 'service'
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : charge.type === 'debt'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : charge.type === 'loan'
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                        }`}>
                          {charge.type === 'service' ? 'Serviço' : charge.type === 'debt' ? 'Dívida' : charge.type === 'loan' ? 'Empréstimo' : 'Venda'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {formatMoney(charge.amount)}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {new Date(charge.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-4">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3" />
                            Pago
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            Vencido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Editar Venda */}
                          <button
                            onClick={() => handleOpenEdit(charge)}
                            className="p-1.5 rounded-lg bg-[#091124] text-blue-400 hover:bg-blue-600/20 hover:text-blue-300 border border-[#1b2b4f] hover:border-blue-500/40 transition-colors cursor-pointer"
                            title="Editar dados da venda / cobrança"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* WhatsApp Trigger */}
                          <button
                            onClick={() => onOpenWhatsApp(charge)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer"
                            title="Cobrar via WhatsApp"
                          >
                            <Send className="w-3 h-3" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>

                          {/* Copy Direct PIX EMV code */}
                          <button
                            onClick={() => handleCopyCustomerPix(charge)}
                            className="p-1.5 rounded-lg bg-[#091124] text-slate-300 hover:bg-[#1b2b4f] hover:text-white border border-[#1b2b4f] transition-colors cursor-pointer"
                            title="Copiar Código PIX Copia e Cola para este cliente"
                          >
                            {copiedPixId === charge.id ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                            ) : (
                              <QrCode className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Mark as paid */}
                          {!isPaid && (
                            <button
                              onClick={() => onMarkAsPaid(charge.id)}
                              className="p-1.5 rounded-lg bg-purple-600/30 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/30 transition-colors cursor-pointer"
                              title="Confirmar Baixa de Pagamento"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => setChargeToDelete(charge)}
                            className="p-1.5 rounded-lg bg-[#091124] text-slate-400 hover:bg-rose-950/40 hover:text-rose-400 border border-[#1b2b4f] hover:border-rose-500/30 transition-colors cursor-pointer"
                            title="Excluir cobrança"
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

      {/* Edit Charge Modal */}
      {editingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
            <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Editar Venda / Cobrança</h2>
                  <p className="text-xs text-slate-400">
                    Cliente: <span className="text-white font-semibold">{editingCharge.customer?.name || 'Cliente Geral'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingCharge(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Descrição da Venda / Serviço *
                </label>
                <input
                  type="text"
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Ex: Mensalidade de Serviço / Manutenção"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Valor (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    placeholder="150,00"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-blue-500/60"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Tipo do Lançamento
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as ChargeType)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500/60"
                  >
                    <option value="sale">Venda de Mercadoria / Produto</option>
                    <option value="service">Prestação de Serviço</option>
                    <option value="debt">Dívida / Inadimplência Antiga</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Status do Pagamento
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as ChargeStatus)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500/60"
                  >
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="overdue">Vencido</option>
                  </select>
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
                  placeholder="Informações adicionais sobre esta cobrança..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingCharge(null)}
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
      {/* Delete Confirmation Modal */}
      {chargeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Excluir Cobrança?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deseja realmente remover esta cobrança de{' '}
                <strong className="text-white font-mono">{formatMoney(chargeToDelete.amount)}</strong> de{' '}
                <strong className="text-white">{chargeToDelete.customer?.name || 'Cliente'}</strong>?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setChargeToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCharge(chargeToDelete.id);
                  setChargeToDelete(null);
                }}
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
