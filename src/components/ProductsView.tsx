import React, { useState, useEffect } from 'react';
import { Package, Plus, DollarSign, Tag, Trash2, ArrowRight, Zap, X, Pencil, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Product, Tenant } from '../types/index.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import {
  createProductInSupabase,
  updateProductInSupabase,
  deleteProductFromSupabase,
} from '../lib/supabaseProducts.js';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime.js';

interface ProductsViewProps {
  products: Product[];
  tenant: Tenant;
  onRefreshProducts: () => void;
  onQuickSellProduct: (product: Product) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  tenant,
  onRefreshProducts,
  onQuickSellProduct,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Serviços');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('Serviços');
  const [savingEdit, setSavingEdit] = useState(false);

  // Realtime hook para sincronização de produtos entre dispositivos
  const { broadcastChange } = useSupabaseRealtime<Product>({
    table: 'products',
    tenantId: tenant.id,
    enabled: Boolean(tenant?.id),
    onInsert: () => onRefreshProducts(),
    onUpdate: () => onRefreshProducts(),
    onDelete: () => onRefreshProducts(),
    onSyncNeeded: () => onRefreshProducts(),
  });

  // Recarga de segurança ao focar na janela ou alternar abas
  useEffect(() => {
    const handleFocus = () => {
      onRefreshProducts();
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        onRefreshProducts();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => {
      if (!document.hidden) {
        onRefreshProducts();
      }
    }, 45000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [tenant.id, onRefreshProducts]);

  const formatMoney = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;

    setSaving(true);
    setErrorMessage(null);
    try {
      const numPrice = parseFloat(price.replace(',', '.'));
      const productPayload = {
        tenant_id: tenant.id,
        name: name.trim(),
        description: description.trim() || undefined,
        price: isNaN(numPrice) ? 0 : numPrice,
        category: category || 'Geral',
      };

      let created: Product;
      if (isSupabaseConfigured && tenant?.id) {
        created = await createProductInSupabase(tenant.id, productPayload);
        broadcastChange('insert', created);
      } else {
        created = await api.createProduct(productPayload);
      }

      // Atualiza cache local oficial de produtos
      if (tenant?.id) {
        try {
          const currentCached = localStorage.getItem(`products_${tenant.id}`);
          const list = currentCached ? JSON.parse(currentCached) : products;
          const next = [created, ...list.filter((p: Product) => p.id !== created.id)];
          localStorage.setItem(`products_${tenant.id}`, JSON.stringify(next));
        } catch {}
      }

      // Sincronização secundária em background com o Express
      api.createProduct(created).catch(() => {});

      setIsAdding(false);
      setName('');
      setDescription('');
      setPrice('');
      onRefreshProducts();
    } catch (err: any) {
      console.error('Failed to create product in Supabase', err);
      setErrorMessage(err?.message || 'Falha ao salvar produto no servidor. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setEditName(prod.name || '');
    setEditDescription(prod.description || '');
    setEditPrice((prod.price || 0).toString().replace('.', ','));
    setEditCategory(prod.category || 'Serviços');
    setErrorMessage(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !editName.trim() || !editPrice) return;

    setSavingEdit(true);
    setErrorMessage(null);
    try {
      const numPrice = parseFloat(editPrice.replace(',', '.'));
      const updates = {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        price: isNaN(numPrice) ? 0 : numPrice,
        category: editCategory || 'Geral',
      };

      let updated: Product;
      if (isSupabaseConfigured && tenant?.id) {
        updated = await updateProductInSupabase(tenant.id, editingProduct.id, updates);
        broadcastChange('update', updated);
      } else {
        updated = await api.updateProduct(editingProduct.id, updates);
      }

      // Atualiza cache local oficial de produtos
      if (tenant?.id) {
        try {
          const currentCached = localStorage.getItem(`products_${tenant.id}`);
          const list = currentCached ? JSON.parse(currentCached) : products;
          const next = list.map((p: Product) => (p.id === updated.id ? updated : p));
          localStorage.setItem(`products_${tenant.id}`, JSON.stringify(next));
        } catch {}
      }

      // Sincronização secundária em background com o Express
      api.updateProduct(editingProduct.id, updated).catch(() => {});

      setEditingProduct(null);
      onRefreshProducts();
    } catch (err: any) {
      console.error('Failed to update product in Supabase', err);
      setErrorMessage(err?.message || 'Falha ao atualizar produto no servidor. Tente novamente.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (isSupabaseConfigured && tenant?.id) {
        await deleteProductFromSupabase(tenant.id, id);
        broadcastChange('delete', { id, tenantId: tenant.id });
      } else {
        await api.deleteProduct(id);
      }

      // Atualiza cache local oficial de produtos
      if (tenant?.id) {
        try {
          const currentCached = localStorage.getItem(`products_${tenant.id}`);
          const list = currentCached ? JSON.parse(currentCached) : products;
          const next = list.filter((p: Product) => p.id !== id);
          localStorage.setItem(`products_${tenant.id}`, JSON.stringify(next));
        } catch {}
      }

      // Sincronização secundária em background com o Express
      api.deleteProduct(id).catch(() => {});

      onRefreshProducts();
    } catch (err: any) {
      console.error('Failed to delete product in Supabase', err);
      setErrorMessage(err?.message || 'Falha ao excluir produto no servidor.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Catálogo de Produtos & Vendas Rápidas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Cadastre e edite seus serviços ou produtos para emissão de cobranças ágeis
          </p>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-purple-900/40 border border-purple-400/30 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Novo Item</span>
        </button>
      </div>

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl font-medium flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Inline Creation Modal/Drawer if open */}
      {isAdding && (
        <div className="p-5 bg-[#0f1b38] border border-purple-500/40 rounded-2xl shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Adicionar Novo Produto ou Serviço</span>
            </h3>
            <button
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Nome do Item *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Formatação de Computador"
                className="w-full px-3.5 py-2.5 bg-[#091124] border border-[#1b2b4f] rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/60"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Valor Base (R$) *
              </label>
              <input
                type="text"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150,00"
                className="w-full px-3.5 py-2.5 bg-[#091124] border border-[#1b2b4f] rounded-xl text-xs sm:text-sm font-mono font-bold text-white focus:outline-none focus:border-purple-500/60"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#091124] border border-[#1b2b4f] rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-purple-500/60"
              >
                <option value="Serviços">Serviços</option>
                <option value="Hardware">Hardware</option>
                <option value="Software">Software</option>
                <option value="Contratos">Contratos</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div className="sm:col-span-4 flex items-center justify-between gap-4 pt-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição curta (opcional)..."
                className="w-full px-3.5 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-xs font-bold rounded-xl shrink-0 transition-all shadow-md shadow-purple-900/40 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Salvar Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Product Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((prod) => (
          <div
            key={prod.id}
            className="p-5 bg-[#0f1b38] border border-[#1e2f57] rounded-2xl flex flex-col justify-between hover:border-purple-500/40 transition-all group shadow-xl"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-[#091124] text-purple-400 border border-[#1b2b4f]">
                  {prod.category || 'Geral'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(prod)}
                    className="p-1 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                    title="Editar produto / serviço"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(prod.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Excluir produto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                {prod.name}
              </h3>
              {prod.description && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{prod.description}</p>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-[#1b2b4f] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">Preço</span>
                <span className="text-lg font-black text-white font-mono">{formatMoney(prod.price)}</span>
              </div>

              <button
                onClick={() => onQuickSellProduct(prod)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-xs font-bold rounded-xl shadow-md shadow-purple-900/40 transition-all active:scale-95 cursor-pointer"
              >
                <span>Vender / Cobrar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-md my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
            <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Editar Produto / Serviço</h2>
                  <p className="text-xs text-slate-400">Modifique nome, valor base ou categoria</p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Nome do Item *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ex: Formatação de Computador"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Valor Base (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="150,00"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-blue-500/60"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Categoria
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-blue-500/60"
                  >
                    <option value="Serviços">Serviços</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                    <option value="Contratos">Contratos</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Descrição (opcional)
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Detalhes adicionais sobre o produto/serviço..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
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
    </div>
  );
};
