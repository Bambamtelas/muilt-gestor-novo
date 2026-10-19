import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShoppingBag,
  Calendar,
  DollarSign,
  User,
  Package,
  CheckCircle2,
  Clock,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  AlertTriangle,
  UserPlus,
  Plus,
  Minus,
  Trash2,
  PackagePlus,
  ShoppingCart,
} from 'lucide-react';
import { Charge, Customer, Product, Tenant, ChargeType, ChargeStatus, IPTVSubscriber } from '../types/index.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import { createChargeInSupabase } from '../lib/supabaseCharges.js';
import { createCustomerInSupabase } from '../lib/supabaseCustomers.js';
import { loadIPTVSubscribersFromSupabase } from '../lib/supabaseIPTV.js';

export interface SaleItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
}

interface NewChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  customers: Customer[];
  products: Product[];
  onCreated: (charge: Charge) => void;
  preselectedCustomerId?: string;
  preselectedProduct?: Product;
}

export const NewChargeModal: React.FC<NewChargeModalProps> = ({
  isOpen,
  onClose,
  tenant,
  customers,
  products,
  onCreated,
  preselectedCustomerId,
  preselectedProduct,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const calcOffsetDate = (baseDateStr: string, days: number) => {
    const d = new Date(baseDateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const [customerId, setCustomerId] = useState(preselectedCustomerId || customers[0]?.id || '');
  const [description, setDescription] = useState(preselectedProduct?.name || '');
  const [amount, setAmount] = useState(preselectedProduct?.price ? String(preselectedProduct.price).replace('.', ',') : '');
  const [type, setType] = useState<ChargeType>('sale');

  // Multi-produtos / Itens da venda
  const [items, setItems] = useState<SaleItem[]>([]);
  const [isManualDescription, setIsManualDescription] = useState(false);

  // Dates and Payment Condition
  const [saleDate, setSaleDate] = useState(todayStr);
  const [paymentCondition, setPaymentCondition] = useState<'cash' | 'term'>('cash');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [termOption, setTermOption] = useState<'1_month' | '15_days' | '7_days' | 'custom'>('custom');
  const [dueDate, setDueDate] = useState(() => todayStr);
  const [installments, setInstallments] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Clientes rápidos / IPTV subscribers
  const [iptvSubs, setIptvSubs] = useState<IPTVSubscriber[]>([]);
  const [isNewCustomerMode, setIsNewCustomerMode] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerWhatsapp, setNewCustomerWhatsapp] = useState('');

  const prevIsOpenRef = useRef(false);

  // Sincroniza seleção de produto e cliente ao abrir modal
  // Importante: Executa a inicialização/limpeza APENAS na transição de fechado para aberto.
  // Isso impede que atualizações em segundo plano (como foco da janela, rolagem ou sync realtime)
  // resetem os campos digitados pelo usuário.
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setFormError(null);
      if (preselectedCustomerId) {
        setCustomerId(preselectedCustomerId);
        setIsNewCustomerMode(false);
      } else if (customers.length > 0) {
        setCustomerId(customers[0].id);
        setIsNewCustomerMode(false);
      } else {
        setCustomerId('');
        setIsNewCustomerMode(true);
      }

      if (preselectedProduct) {
        const initialItem: SaleItem = {
          id: `item-${Date.now()}`,
          productId: preselectedProduct.id,
          name: preselectedProduct.name,
          price: preselectedProduct.price || 0,
          quantity: 1,
        };
        setItems([initialItem]);
        setDescription(preselectedProduct.name);
        setAmount(Number(preselectedProduct.price || 0).toFixed(2).replace('.', ','));
        setIsManualDescription(false);
      } else {
        setItems([]);
        setDescription('');
        setAmount('');
        setIsManualDescription(false);
      }

      setSaleDate(todayStr);
      setType('sale');
      setPaymentCondition('cash');
      setPaymentMethod('pix');
      setTermOption('custom');
      setDueDate(todayStr);
      setInstallments(1);
      setNotes('');
      setNewCustomerName('');
      setNewCustomerWhatsapp('');

      // Carrega assinantes IPTV para dar como opção caso tenant tenha IPTV
      if (isSupabaseConfigured && tenant?.id) {
        loadIPTVSubscribersFromSupabase(tenant.id)
          .then((subs) => {
            if (Array.isArray(subs)) setIptvSubs(subs);
          })
          .catch(() => {});
      }
    }

    // Se o modal já estava aberto e a lista de clientes atualizou em segundo plano,
    // apenas associa o primeiro cliente se o usuário ainda não tiver nenhum selecionado e não estiver cadastrando novo
    if (isOpen && prevIsOpenRef.current) {
      if (!customerId && !isNewCustomerMode && customers.length > 0) {
        setCustomerId(customers[0].id);
      }
    }

    prevIsOpenRef.current = isOpen;
  }, [isOpen, preselectedCustomerId, preselectedProduct]);

  if (!isOpen) return null;

  // Recalcula valor total e descrição a partir da lista de itens
  const recalculateFromItems = (newItems: SaleItem[], forceDescUpdate = false) => {
    if (newItems.length > 0) {
      const total = newItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
      setAmount(total.toFixed(2).replace('.', ','));

      const autoDesc = newItems
        .map((it) => `${it.quantity > 1 ? `${it.quantity}x ` : ''}${it.name}`)
        .join(' + ');

      if (!isManualDescription || forceDescUpdate) {
        setDescription(autoDesc);
      }
    } else {
      setAmount('');
      if (!isManualDescription || forceDescUpdate) {
        setDescription('');
      }
    }
  };

  const handleAddItemFromCatalog = (productId: string) => {
    if (!productId) return;
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.productId === prod.id || it.name === prod.name);
      let updated: SaleItem[];
      if (existingIdx >= 0) {
        updated = prev.map((it, idx) =>
          idx === existingIdx ? { ...it, quantity: it.quantity + 1 } : it
        );
      } else {
        const newItem: SaleItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: prod.id,
          name: prod.name,
          price: prod.price || 0,
          quantity: 1,
        };
        updated = [...prev, newItem];
      }
      recalculateFromItems(updated);
      return updated;
    });
  };

  const handleAddCustomItem = () => {
    const newItem: SaleItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'Item / Serviço Personalizado',
      price: 0,
      quantity: 1,
    };
    setItems((prev) => {
      const updated = [...prev, newItem];
      recalculateFromItems(updated);
      return updated;
    });
  };

  const handleUpdateItemQuantity = (itemId: string, delta: number) => {
    setItems((prev) => {
      const updated = prev
        .map((it) => {
          if (it.id === itemId) {
            const nextQty = it.quantity + delta;
            return nextQty > 0 ? { ...it, quantity: nextQty } : null;
          }
          return it;
        })
        .filter(Boolean) as SaleItem[];
      recalculateFromItems(updated);
      return updated;
    });
  };

  const handleUpdateItemPrice = (itemId: string, newPriceStr: string) => {
    const parsed = parseFloat(newPriceStr.replace(',', '.'));
    const validPrice = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setItems((prev) => {
      const updated = prev.map((it) =>
        it.id === itemId ? { ...it, price: validPrice } : it
      );
      recalculateFromItems(updated);
      return updated;
    });
  };

  const handleUpdateItemName = (itemId: string, newName: string) => {
    setItems((prev) => {
      const updated = prev.map((it) =>
        it.id === itemId ? { ...it, name: newName } : it
      );
      recalculateFromItems(updated);
      return updated;
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => {
      const updated = prev.filter((it) => it.id !== itemId);
      recalculateFromItems(updated);
      return updated;
    });
  };

  const handleSaleDateChange = (newSaleDate: string) => {
    setSaleDate(newSaleDate);
    if (paymentCondition === 'term') {
      if (termOption === '1_month') setDueDate(calcOffsetDate(newSaleDate, 30));
      else if (termOption === '15_days') setDueDate(calcOffsetDate(newSaleDate, 15));
      else if (termOption === '7_days') setDueDate(calcOffsetDate(newSaleDate, 7));
    }
  };

  const selectTerm = (option: '1_month' | '15_days' | '7_days' | 'custom', days?: number) => {
    setTermOption(option);
    if (days !== undefined) {
      setDueDate(calcOffsetDate(saleDate, days));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let finalCustomerId = customerId;

    // Se estiver no modo de novo cliente ou não houver cliente selecionado
    if (isNewCustomerMode || !finalCustomerId) {
      if (!newCustomerName.trim()) {
        setFormError('Por favor, informe o nome do cliente ou selecione um cliente da lista.');
        return;
      }
      setSaving(true);
      try {
        const createdCust = isSupabaseConfigured && tenant?.id
          ? await createCustomerInSupabase(tenant.id, {
              tenant_id: tenant.id,
              name: newCustomerName.trim(),
              whatsapp: newCustomerWhatsapp.trim() || undefined,
            })
          : await api.createCustomer({
              tenant_id: tenant.id,
              name: newCustomerName.trim(),
              whatsapp: newCustomerWhatsapp.trim() || undefined,
            });
        finalCustomerId = createdCust.id;
      } catch (err: any) {
        console.error('Falha ao cadastrar cliente para a venda', err);
        setFormError(err?.message || 'Falha ao cadastrar cliente para a venda.');
        setSaving(false);
        return;
      }
    }

    if (!finalCustomerId) {
      setFormError('Por favor, selecione ou cadastre o cliente para esta venda.');
      return;
    }

    if (!description.trim()) {
      setFormError('Por favor, informe a descrição do produto ou serviço.');
      return;
    }

    const numAmount = parseFloat(amount.replace(',', '.'));
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setFormError('Por favor, informe um valor de venda válido (maior que zero).');
      return;
    }

    setSaving(true);
    try {
      const isPaid = paymentCondition === 'cash';

      // Se houver múltiplos itens ou itens discriminados, gera discriminação detalhada nas observações
      let itemsBreakdown = '';
      if (items.length > 0) {
        itemsBreakdown = `📦 Itens da Venda:\n` + items.map(
          (it) => `• ${it.quantity}x ${it.name} (R$ ${it.price.toFixed(2).replace('.', ',')} un) = R$ ${(it.price * it.quantity).toFixed(2).replace('.', ',')}`
        ).join('\n');
      }

      const combinedNotes = notes.trim()
        ? (itemsBreakdown ? `${notes.trim()}\n\n${itemsBreakdown}` : notes.trim())
        : (itemsBreakdown || undefined);

      const selectedCustomer = customers.find((c) => c.id === finalCustomerId);

      const chargePayload = {
        tenant_id: tenant.id,
        customer_id: finalCustomerId,
        customer: selectedCustomer,
        description: description.trim(),
        amount: numAmount,
        due_date: isPaid ? saleDate : dueDate,
        sale_date: saleDate,
        type: (type || 'sale') as ChargeType,
        status: (isPaid ? 'paid' : (dueDate < todayStr ? 'overdue' : 'pending')) as ChargeStatus,
        paid_at: isPaid ? new Date().toISOString() : undefined,
        payment_method: paymentMethod,
        payment_condition: paymentCondition,
        installments: paymentCondition === 'term' ? installments : 1,
        notes: combinedNotes,
      };

      let created: Charge;
      if (isSupabaseConfigured && tenant?.id) {
        try {
          created = await createChargeInSupabase(tenant.id, chargePayload);
        } catch (sbErr: any) {
          console.warn('[NewChargeModal] Falha no Supabase, salvando via API local:', sbErr);
          created = await api.createCharge(chargePayload);
        }
      } else {
        created = await api.createCharge(chargePayload);
      }

      // Sincronização secundária em background com o Express
      api.createCharge(created).catch(() => {});

      onCreated(created);
      onClose();

      // Reset form
      setItems([]);
      setDescription('');
      setAmount('');
      setType('sale');
      setSaleDate(todayStr);
      setPaymentCondition('cash');
      setPaymentMethod('pix');
      setTermOption('custom');
      setDueDate(todayStr);
      setNotes('');
      setNewCustomerName('');
      setNewCustomerWhatsapp('');
      setIsManualDescription(false);
      setFormError(null);
    } catch (err: any) {
      console.error('Failed to create sale', err);
      setFormError(err?.message || 'Falha ao gravar cobrança no servidor. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto overscroll-contain animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Lançar Nova Venda</h2>
              <p className="text-xs text-slate-400">Registre vendas com recebimento à vista ou a prazo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto overscroll-contain space-y-4">
          {/* Top Error Message if present */}
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Customer Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider block">
                Cliente *
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsNewCustomerMode(!isNewCustomerMode);
                  setFormError(null);
                }}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isNewCustomerMode ? 'Escolher da lista' : '+ Novo Cliente / Balcão'}</span>
              </button>
            </div>

            {isNewCustomerMode ? (
              <div className="space-y-2.5 p-3.5 bg-slate-950/70 border border-blue-500/30 rounded-xl animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300">Novo Cliente para a Venda</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomerName('Cliente Balcão');
                      setNewCustomerWhatsapp('');
                      if (formError) setFormError(null);
                    }}
                    className="px-2.5 py-1 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-colors cursor-pointer"
                  >
                    Usar "Cliente Balcão"
                  </button>
                </div>

                {iptvSubs.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Ou use um Assinante IPTV:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {iptvSubs.map((sub) => {
                        const sName = sub.customer_name || (sub as any).name || 'Assinante';
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => {
                              setNewCustomerName(sName);
                              setNewCustomerWhatsapp(sub.whatsapp || '');
                              if (formError) setFormError(null);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#132247] hover:bg-purple-900/50 text-purple-300 border border-purple-500/40 transition-colors cursor-pointer"
                          >
                            {sName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] uppercase text-slate-400 font-semibold mb-1 block">
                      Nome do Cliente *
                    </label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => {
                        setNewCustomerName(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      placeholder="Ex: João Silva ou Cliente Balcão"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-400 font-semibold mb-1 block">
                      WhatsApp / Telefone (Opcional)
                    </label>
                    <input
                      type="text"
                      value={newCustomerWhatsapp}
                      onChange={(e) => setNewCustomerWhatsapp(e.target.value)}
                      placeholder="Ex: 85999999999"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <select
                  value={customerId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__new__') {
                      setIsNewCustomerMode(true);
                      setNewCustomerName('');
                      setNewCustomerWhatsapp('');
                    } else if (val.startsWith('iptv:')) {
                      const subId = val.replace('iptv:', '');
                      const sub = iptvSubs.find((s) => s.id === subId);
                      if (sub) {
                        setIsNewCustomerMode(true);
                        setNewCustomerName(sub.customer_name || (sub as any).name || 'Assinante');
                        setNewCustomerWhatsapp(sub.whatsapp || '');
                      }
                    } else {
                      setCustomerId(val);
                    }
                    if (formError) setFormError(null);
                  }}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
                >
                  {customers.length === 0 && iptvSubs.length === 0 ? (
                    <option value="">Nenhum cliente encontrado (clique acima em + Novo Cliente)</option>
                  ) : (
                    <>
                      {customers.length > 0 && (
                        <optgroup label="Clientes Cadastrados">
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.whatsapp ? `(${c.whatsapp})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {iptvSubs.length > 0 && (
                        <optgroup label="Assinantes IPTV (Importar para venda)">
                          {iptvSubs.map((sub) => {
                            const sName = sub.customer_name || (sub as any).name || 'Assinante';
                            return (
                              <option key={sub.id} value={`iptv:${sub.id}`}>
                                {sName} {sub.whatsapp ? `(${sub.whatsapp})` : ''}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                      <option value="__new__">+ Cadastrar Novo Cliente no Momento...</option>
                    </>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Multi-Product Selection & Items List */}
          <div className="space-y-3 p-4 bg-[#091124] border border-[#1b2b4f] rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                    Produtos / Itens da Venda
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Adicione um ou múltiplos produtos do catálogo ou itens avulsos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="px-2.5 py-1 text-[11px] font-semibold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Item Avulso</span>
                </button>
              </div>
            </div>

            {/* Selector Dropdown to add products from catalog */}
            {products.length > 0 && (
              <div className="relative">
                <Package className="w-4 h-4 absolute left-3 top-3 text-purple-400" />
                <select
                  value=""
                  onChange={(e) => {
                    handleAddItemFromCatalog(e.target.value);
                  }}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#0e172e] border border-purple-500/30 hover:border-purple-500/60 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-400 cursor-pointer"
                >
                  <option value="">
                    {items.length === 0
                      ? '➕ Escolha um produto para adicionar à venda...'
                      : '➕ Adicionar outro produto ao pedido (2º, 3º produto...)'}
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — R$ {p.price.toFixed(2).replace('.', ',')} {p.category ? `(${p.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* List of Added Items */}
            {items.length > 0 ? (
              <div className="space-y-2 pt-1">
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {items.map((item, index) => {
                    const subtotal = item.price * item.quantity;
                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-[#0d162e] border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                              #{index + 1}
                            </span>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateItemName(item.id, e.target.value)}
                              placeholder="Nome do produto ou serviço"
                              className="text-xs sm:text-sm font-semibold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-purple-500 focus:outline-none w-full"
                            />
                          </div>
                          <div className="flex items-center gap-2 mt-1 pl-7">
                            <span className="text-[10px] text-slate-400 uppercase">Unitário:</span>
                            <div className="relative inline-flex items-center">
                              <span className="text-[10px] text-slate-500 mr-1">R$</span>
                              <input
                                type="text"
                                value={item.price.toFixed(2).replace('.', ',')}
                                onChange={(e) => handleUpdateItemPrice(item.id, e.target.value)}
                                className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-200 bg-slate-950/80 border border-slate-800 rounded focus:outline-none focus:border-purple-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Quantity and Subtotal Controls */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-7 sm:pl-0 pt-2 sm:pt-0 border-t border-slate-800/60 sm:border-0">
                          <div className="flex items-center bg-[#091124] border border-slate-800 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(item.id, -1)}
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Diminuir quantidade"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold font-mono text-white">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQuantity(item.id, 1)}
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Aumentar quantidade"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-right min-w-[80px]">
                            <span className="text-[9px] uppercase font-semibold text-slate-500 block">Subtotal</span>
                            <span className="text-xs sm:text-sm font-bold font-mono text-emerald-400">
                              {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Remover item da venda"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal Footer */}
                <div className="p-3 bg-gradient-to-r from-purple-950/30 to-blue-950/30 border border-purple-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-slate-300">
                      {items.length} {items.length === 1 ? 'produto selecionado' : 'produtos selecionados'} (
                      {items.reduce((acc, it) => acc + it.quantity, 0)} {items.reduce((acc, it) => acc + it.quantity, 0) === 1 ? 'unidade' : 'unidades'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">Total Somado:</span>
                    <span className="text-sm font-black font-mono text-emerald-400">
                      {items.reduce((acc, it) => acc + (it.price * it.quantity), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 border border-dashed border-slate-800 rounded-xl">
                <Package className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                <p className="text-xs text-slate-400">Nenhum produto adicionado ainda.</p>
                <p className="text-[10px] text-slate-500">Selecione no catálogo acima para adicionar produtos ao pedido.</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider block">
                Descrição do Serviço ou Produto *
              </label>
              {items.length > 0 && isManualDescription && (
                <button
                  type="button"
                  onClick={() => {
                    setIsManualDescription(false);
                    recalculateFromItems(items, true);
                  }}
                  className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                >
                  ↺ Restaurar descrição automática dos itens
                </button>
              )}
            </div>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setIsManualDescription(true);
                if (formError) setFormError(null);
              }}
              placeholder="Ex: 2x Formatação de Computador + 1x SSD 480GB..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
            />
          </div>

          {/* Amount & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider block">
                  Valor Total (R$) *
                </label>
                {items.length > 0 && (
                  <span className="text-[10px] text-emerald-400 font-semibold">
                    ✓ Calculado pelos itens
                  </span>
                )}
              </div>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-3 text-emerald-400" />
                <input
                  type="text"
                  required
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-semibold focus:outline-none focus:border-blue-500/60 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Tipo de Lançamento
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ChargeType)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
              >
                <option value="sale">Venda de Mercadoria / Produto</option>
                <option value="service">Prestação de Serviço</option>
                <option value="debt">Dívida / Inadimplência Antiga</option>
              </select>
            </div>
          </div>

          {/* Data da Venda */}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
              Data da Venda *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="date"
                required
                value={saleDate}
                onChange={(e) => handleSaleDateChange(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
              />
            </div>
          </div>

          {/* Condição de Pagamento: À Vista vs A Prazo */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider block">
              Condição de Pagamento *
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentCondition('cash')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentCondition === 'cash'
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 font-bold shadow-lg shadow-emerald-950/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-4 h-4 ${paymentCondition === 'cash' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-sm">À Vista (Pago)</span>
                </div>
                <span className="text-[10px] text-emerald-400/80 font-normal">Entra quitado na gestão</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentCondition('term');
                  selectTerm('1_month', 30);
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentCondition === 'term'
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 font-bold shadow-lg shadow-amber-950/50'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Clock className={`w-4 h-4 ${paymentCondition === 'term' ? 'text-amber-400' : 'text-slate-500'}`} />
                  <span className="text-sm">A Prazo (1 Mês...)</span>
                </div>
                <span className="text-[10px] text-amber-400/80 font-normal">Agenda para receber depois</span>
              </button>
            </div>

            {/* SE FOR À VISTA (PAGO) */}
            {paymentCondition === 'cash' && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-emerald-300 tracking-wider">
                    Forma de Pagamento Recebida
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Quitado
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'pix'
                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-900/40'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>PIX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('dinheiro')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'dinheiro'
                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-900/40'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Dinheiro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cartao_credito')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'cartao_credito'
                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-900/40'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Cartão Crédito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cartao_debito')}
                    className={`py-2 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      paymentMethod === 'cartao_debito'
                        ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-900/40'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Cartão Débito</span>
                  </button>
                </div>

                <div className="text-[11px] text-emerald-300/90 bg-emerald-900/20 p-2 rounded-lg border border-emerald-500/20">
                  ✨ Venda com status <strong>PAGO</strong>. Entra automaticamente no total faturado da gestão e emite recibo instantâneo.
                </div>
              </div>
            )}

            {/* SE FOR A PRAZO (PAGAR COM 1 MÊS, ETC.) */}
            {paymentCondition === 'term' && (
              <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-3.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-amber-300 tracking-wider">
                    Prazo de Pagamento
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => selectTerm('1_month', 30)}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-bold transition-all cursor-pointer ${
                        termOption === '1_month'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      ★ 1 Mês (+30d)
                    </button>
                    <button
                      type="button"
                      onClick={() => selectTerm('15_days', 15)}
                      className={`px-2 py-1 text-xs rounded-lg border font-semibold transition-all cursor-pointer ${
                        termOption === '15_days'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      +15d
                    </button>
                    <button
                      type="button"
                      onClick={() => selectTerm('7_days', 7)}
                      className={`px-2 py-1 text-xs rounded-lg border font-semibold transition-all cursor-pointer ${
                        termOption === '7_days'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      +7d
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                      Data de Vencimento do Pagamento *
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 absolute left-3 top-3 text-amber-400" />
                      <input
                        type="date"
                        required
                        value={dueDate}
                        onChange={(e) => {
                          setDueDate(e.target.value);
                          setTermOption('custom');
                        }}
                        className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-semibold text-amber-200 focus:outline-none focus:border-amber-500/60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                      Forma Prevista / Parcelas
                    </label>
                    <select
                      value={installments > 1 ? `parcelado_${installments}` : paymentMethod}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('parcelado_')) {
                          const n = parseInt(val.split('_')[1], 10);
                          setInstallments(n);
                          setPaymentMethod('cartao_parcelado');
                        } else {
                          setInstallments(1);
                          setPaymentMethod(val);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
                    >
                      <option value="pix">À vista no vencimento (PIX)</option>
                      <option value="dinheiro">À vista no vencimento (Dinheiro)</option>
                      <option value="cartao_credito">Cartão de Crédito (1x no vencimento)</option>
                      <option value="parcelado_2">Cartão Parcelado em 2x</option>
                      <option value="parcelado_3">Cartão Parcelado em 3x</option>
                      <option value="parcelado_4">Cartão Parcelado em 4x</option>
                      <option value="parcelado_5">Cartão Parcelado em 5x</option>
                      <option value="parcelado_6">Cartão Parcelado em 6x</option>
                      <option value="parcelado_10">Cartão Parcelado em 10x</option>
                      <option value="parcelado_12">Cartão Parcelado em 12x</option>
                      <option value="boleto">Boleto / Carnê</option>
                    </select>
                  </div>
                </div>

                <div className="text-[11px] text-amber-300/90 bg-amber-900/20 p-2 rounded-lg border border-amber-500/20">
                  ⏱️ A venda ficará com status <strong>PENDENTE</strong> com vencimento em <strong>{new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong> (daqui a {Math.max(1, Math.round((new Date(dueDate + 'T12:00:00').getTime() - new Date(saleDate + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24)))} dias).
                </div>
              </div>
            )}
          </div>

          {/* Internal Notes */}
          <div>
            <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
              Observações Internas (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Cliente vai retirar na sexta-feira ou pagar via PIX no fim do mês..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 resize-none"
            />
          </div>

          {/* Error Message */}
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Footer Submit */}
          <div className="pt-3 border-t border-slate-800 flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer ${
                paymentCondition === 'cash'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/40 border border-emerald-400/30'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/40 border border-blue-400/30'
              }`}
            >
              {paymentCondition === 'cash' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              <span>
                {saving
                  ? 'Salvando...'
                  : paymentCondition === 'cash'
                  ? 'Salvar Venda (Pago)'
                  : termOption === '1_month'
                  ? 'Salvar Venda (1 Mês)'
                  : 'Salvar Venda'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
