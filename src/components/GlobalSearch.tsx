import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Users,
  Receipt,
  Package,
  ArrowRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Tag,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { Customer, Charge, Product } from '../types/index.js';
import { NavigationTab } from './Header.js';

interface GlobalSearchProps {
  customers: Customer[];
  charges: Charge[];
  products: Product[];
  onSelectTab: (tab: NavigationTab) => void;
  onNewChargeForCustomer?: (customerId: string) => void;
  onQuickSellProduct?: (product: Product) => void;
}

type FilterCategory = 'all' | 'customers' | 'charges' | 'products';

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  customers = [],
  charges = [],
  products = [],
  onSelectTab,
  onNewChargeForCustomer,
  onQuickSellProduct,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Format currency
  const formatMoney = (val?: number) =>
    (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Keyboard shortcut listener (Ctrl+K or Cmd+K or '/')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Normalize search query
  const cleanQuery = query.trim().toLowerCase();
  const digitsQuery = query.replace(/\D/g, '');

  // Filter Customers
  const matchedCustomers = cleanQuery
    ? customers.filter((c) => {
        const nameMatch = c.name?.toLowerCase().includes(cleanQuery);
        const tradeMatch = c.trade_name?.toLowerCase().includes(cleanQuery);
        const emailMatch = c.email?.toLowerCase().includes(cleanQuery);
        const docMatch = c.document?.replace(/\D/g, '').includes(digitsQuery) && digitsQuery.length > 2;
        const phoneMatch = c.whatsapp?.replace(/\D/g, '').includes(digitsQuery) && digitsQuery.length > 2;
        const cityMatch = c.address_city?.toLowerCase().includes(cleanQuery);
        return nameMatch || tradeMatch || emailMatch || docMatch || phoneMatch || cityMatch;
      })
    : [];

  // Filter Charges
  const matchedCharges = cleanQuery
    ? charges.filter((ch) => {
        const descMatch = ch.description?.toLowerCase().includes(cleanQuery);
        const custNameMatch = ch.customer?.name?.toLowerCase().includes(cleanQuery);
        const amountMatch =
          ch.amount.toString().includes(cleanQuery) ||
          ch.amount.toFixed(2).replace('.', ',').includes(cleanQuery);
        const statusMatch =
          (cleanQuery === 'pago' && ch.status === 'paid') ||
          (cleanQuery === 'pendente' && ch.status === 'pending') ||
          (cleanQuery === 'atrasado' && ch.status === 'overdue') ||
          (cleanQuery === 'vencido' && ch.status === 'overdue');

        return descMatch || custNameMatch || amountMatch || statusMatch;
      })
    : [];

  // Filter Products
  const matchedProducts = cleanQuery
    ? products.filter((p) => {
        const nameMatch = p.name?.toLowerCase().includes(cleanQuery);
        const catMatch = p.category?.toLowerCase().includes(cleanQuery);
        const descMatch = p.description?.toLowerCase().includes(cleanQuery);
        const priceMatch =
          p.price.toString().includes(cleanQuery) ||
          p.price.toFixed(2).replace('.', ',').includes(cleanQuery);
        return nameMatch || catMatch || descMatch || priceMatch;
      })
    : [];

  const totalResults = matchedCustomers.length + matchedCharges.length + matchedProducts.length;

  const handleSelectCustomer = (customer: Customer) => {
    setIsOpen(false);
    onSelectTab('customers');
  };

  const handleSelectCharge = (charge: Charge) => {
    setIsOpen(false);
    onSelectTab('dashboard');
  };

  const handleSelectProduct = (product: Product) => {
    setIsOpen(false);
    onSelectTab('products');
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-3 sm:left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
          <Search className="w-4 h-4 text-emerald-400/90" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar cliente, pagamento ou produto..."
          className="w-full h-9 sm:h-10 pl-9 sm:pl-10 pr-14 sm:pr-20 bg-[#080e1e] hover:bg-[#0b1328] focus:bg-[#0c1630] border border-[#1d2f59] focus:border-emerald-500/60 rounded-xl sm:rounded-2xl text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
        />

        {/* Right Action Icons (Clear / Shortcut) */}
        <div className="absolute right-2 sm:right-3 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors cursor-pointer"
              title="Limpar pesquisa"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-[#142347] border border-[#203666] rounded-md pointer-events-none select-none">
              <span className="text-[9px]">Ctrl</span>K
            </kbd>
          )}
        </div>
      </div>

      {/* Floating Results Popover Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#091124] border border-[#1e2f57] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden z-50 flex flex-col max-h-[75vh] animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl">
          {/* Header with Category Filter Tabs */}
          {cleanQuery && (
            <div className="p-2 sm:p-2.5 bg-[#0c1630] border-b border-[#1b2b4f] flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#132247]'
                }`}
              >
                Todos ({totalResults})
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('customers')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeFilter === 'customers'
                    ? 'bg-blue-600 text-white font-black shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#132247]'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>Clientes ({matchedCustomers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('charges')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeFilter === 'charges'
                    ? 'bg-emerald-600 text-white font-black shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#132247]'
                }`}
              >
                <Receipt className="w-3 h-3" />
                <span>Cobranças ({matchedCharges.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('products')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeFilter === 'products'
                    ? 'bg-purple-600 text-white font-black shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#132247]'
                }`}
              >
                <Package className="w-3 h-3" />
                <span>Produtos ({matchedProducts.length})</span>
              </button>
            </div>
          )}

          {/* Body Content */}
          <div className="overflow-y-auto divide-y divide-[#172547] max-h-[60vh]">
            {!cleanQuery ? (
              /* Initial State / Help Guide */
              <div className="p-4 sm:p-5 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  Pesquisa Global em Tempo Real
                </div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Digite para localizar rapidamente clientes por nome ou telefone, cobranças por
                  descrição ou valor, e produtos do catálogo.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 text-[10px] text-slate-500">
                  <span className="px-2 py-0.5 rounded-md bg-[#0e1935] border border-[#1b2b4f]">
                    Nome de Cliente
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#0e1935] border border-[#1b2b4f]">
                    WhatsApp com DDD
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#0e1935] border border-[#1b2b4f]">
                    Valor (R$)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#0e1935] border border-[#1b2b4f]">
                    Nome de Produto
                  </span>
                </div>
              </div>
            ) : totalResults === 0 ? (
              /* No Results Found */
              <div className="p-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  Nenhum resultado encontrado
                </div>
                <p className="text-xs text-slate-400">
                  Não encontramos clientes, cobranças ou produtos correspondentes a "{query}".
                </p>
              </div>
            ) : (
              /* Results List */
              <>
                {/* 1. SEÇÃO CLIENTES */}
                {(activeFilter === 'all' || activeFilter === 'customers') &&
                  matchedCustomers.length > 0 && (
                    <div className="p-2 sm:p-3">
                      <div className="flex items-center justify-between px-2 py-1 mb-1 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          <span>Clientes ({matchedCustomers.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onSelectTab('customers');
                          }}
                          className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Ver todos</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        {matchedCustomers.slice(0, 5).map((customer) => (
                          <div
                            key={customer.id}
                            className="group flex items-center justify-between p-2 rounded-xl hover:bg-[#121f3f] transition-all border border-transparent hover:border-[#1e325c] cursor-pointer"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 font-black text-xs flex items-center justify-center shrink-0">
                                {customer.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-300 truncate transition-colors">
                                  {customer.name}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400">
                                  {customer.whatsapp && (
                                    <span className="flex items-center gap-1 font-mono">
                                      <Phone className="w-2.5 h-2.5 text-emerald-400" />
                                      {customer.whatsapp}
                                    </span>
                                  )}
                                  {customer.document && (
                                    <span className="truncate">Doc: {customer.document}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 pl-2">
                              {onNewChargeForCustomer && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(false);
                                    onNewChargeForCustomer(customer.id);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                  title="Nova cobrança para este cliente"
                                >
                                  <Plus className="w-3 h-3 stroke-[3]" />
                                  <span className="hidden xs:inline">Cobrar</span>
                                </button>
                              )}
                              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* 2. SEÇÃO COBRANÇAS */}
                {(activeFilter === 'all' || activeFilter === 'charges') &&
                  matchedCharges.length > 0 && (
                    <div className="p-2 sm:p-3">
                      <div className="flex items-center justify-between px-2 py-1 mb-1 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Cobranças ({matchedCharges.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onSelectTab('dashboard');
                          }}
                          className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Ver todas</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        {matchedCharges.slice(0, 5).map((charge) => {
                          const isPaid = charge.status === 'paid';
                          const isOverdue = charge.status === 'overdue';
                          return (
                            <div
                              key={charge.id}
                              className="group flex items-center justify-between p-2 rounded-xl hover:bg-[#121f3f] transition-all border border-transparent hover:border-[#1e325c] cursor-pointer"
                              onClick={() => handleSelectCharge(charge)}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                    isPaid
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                      : isOverdue
                                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                                      : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                  }`}
                                >
                                  <DollarSign className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 truncate transition-colors">
                                    {charge.description || 'Cobrança Avulsa'}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400">
                                    <span className="truncate text-slate-300 font-medium">
                                      {charge.customer?.name || 'Cliente'}
                                    </span>
                                    <span>•</span>
                                    <span>Venc: {formatDate(charge.due_date)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 pl-2 text-right">
                                <div>
                                  <div className="text-xs sm:text-sm font-black font-mono text-white">
                                    {formatMoney(charge.amount)}
                                  </div>
                                  <span
                                    className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase border ${
                                      isPaid
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                        : isOverdue
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    }`}
                                  >
                                    {isPaid ? 'Pago' : isOverdue ? 'Atrasado' : 'Pendente'}
                                  </span>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* 3. SEÇÃO PRODUTOS */}
                {(activeFilter === 'all' || activeFilter === 'products') &&
                  matchedProducts.length > 0 && (
                    <div className="p-2 sm:p-3">
                      <div className="flex items-center justify-between px-2 py-1 mb-1 text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" />
                          <span>Produtos ({matchedProducts.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onSelectTab('products');
                          }}
                          className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Ver catálogo</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        {matchedProducts.slice(0, 5).map((product) => (
                          <div
                            key={product.id}
                            className="group flex items-center justify-between p-2 rounded-xl hover:bg-[#121f3f] transition-all border border-transparent hover:border-[#1e325c] cursor-pointer"
                            onClick={() => handleSelectProduct(product)}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-white group-hover:text-purple-300 truncate transition-colors">
                                  {product.name}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400">
                                  {product.category && (
                                    <span className="flex items-center gap-0.5 text-purple-300">
                                      <Tag className="w-2.5 h-2.5" />
                                      {product.category}
                                    </span>
                                  )}
                                  {product.description && (
                                    <span className="truncate max-w-[120px] sm:max-w-[180px]">
                                      {product.description}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 pl-2">
                              <div className="text-right">
                                <div className="text-xs sm:text-sm font-black font-mono text-white">
                                  {formatMoney(product.price)}
                                </div>
                                <span className="text-[9px] text-slate-400">Preço unitário</span>
                              </div>

                              {onQuickSellProduct && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(false);
                                    onQuickSellProduct(product);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                  title="Lançar venda deste produto"
                                >
                                  <Plus className="w-3 h-3 stroke-[3]" />
                                  <span className="hidden xs:inline">Vender</span>
                                </button>
                              )}
                              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* Footer Bar */}
          {cleanQuery && totalResults > 0 && (
            <div className="p-2 sm:p-2.5 bg-[#0a1226] border-t border-[#1b2b4f] flex items-center justify-between text-[11px] text-slate-400 px-3">
              <span>
                Mostrando resultados para <strong className="text-white">"{query}"</strong>
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                Pressione <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">ESC</kbd>{' '}
                para fechar
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
