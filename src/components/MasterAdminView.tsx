import React, { useState, useEffect } from 'react';
import {
  Crown,
  ShieldCheck,
  Server,
  Users,
  Clock,
  CheckCircle,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Zap,
  RotateCcw,
  Calendar,
  X,
  AlertTriangle,
  Check,
  Ban,
  Unlock,
  DollarSign,
  Edit3,
  Tag,
  Bell,
  Mail,
  Database,
  CreditCard,
  Trash2,
  ExternalLink,
  KeyRound,
  MessageCircle,
  Pencil,
  Phone,
  Building,
  Layers,
} from 'lucide-react';
import { Tenant, calculatePlanPrice, GlobalPlanPrices, DEFAULT_PLAN_PRICES, AppModule } from '../types/index.js';
import { api } from '../lib/api.js';
import { SupabaseModal } from './SupabaseModal.js';
import { MercadoPagoModal } from './MercadoPagoModal.js';
import { ExternalLinkModal } from './ExternalLinkModal.js';
import { ChangeMasterPasswordModal } from './ChangeMasterPasswordModal.js';
import { SupportWhatsAppModal } from './SupportWhatsAppModal.js';
import { ModuleAutomationDiagnostic } from './ModuleAutomationDiagnostic.js';

interface MasterAdminViewProps {
  onTenantUpdated?: () => void;
}

export const MasterAdminView: React.FC<MasterAdminViewProps> = ({ onTenantUpdated }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Valores Globais dos Planos
  const [globalPrices, setGlobalPrices] = useState<GlobalPlanPrices>(DEFAULT_PLAN_PRICES);
  const [editPrices, setEditPrices] = useState<GlobalPlanPrices>(DEFAULT_PLAN_PRICES);
  const [savingPrices, setSavingPrices] = useState(false);
  const [priceSuccessMsg, setPriceSuccessMsg] = useState<string | null>(null);

  // Modal para editar preço individual de um cliente
  const [tenantForPriceEdit, setTenantForPriceEdit] = useState<Tenant | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState<string>('');
  const [savingTenantPrice, setSavingTenantPrice] = useState(false);

  // Alertas Preventivos de Expiração (3 Dias)
  const [checkingPreventiveAlerts, setCheckingPreventiveAlerts] = useState(false);
  const [sendingAlertTenantId, setSendingAlertTenantId] = useState<string | null>(null);
  const [preventiveAlertFeedback, setPreventiveAlertFeedback] = useState<string | null>(null);

  // Modal Supabase & Mercado Pago
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isMercadoPagoModalOpen, setIsMercadoPagoModalOpen] = useState(false);

  // Modal de Alteração de Assinatura (Remover Vitalício, Definir Trial ou Dias Restantes)
  const [selectedTenantForRemoval, setSelectedTenantForRemoval] = useState<Tenant | null>(null);
  const [targetMode, setTargetMode] = useState<'trial' | 'days'>('trial');
  const [trialDays, setTrialDays] = useState<number>(2);
  const [activeDays, setActiveDays] = useState<number>(30);
  const [isSavingChange, setIsSavingChange] = useState<boolean>(false);

  // Modal e Estado para Bloqueio de Cliente
  const [tenantToBlock, setTenantToBlock] = useState<Tenant | null>(null);
  const [isBlocking, setIsBlocking] = useState<boolean>(false);

  // Modal para Atualizar Links e Lojinha Online
  const [isExternalLinkModalOpen, setIsExternalLinkModalOpen] = useState<boolean>(false);

  // Modal para WhatsApp de Suporte (Botão Flutuante)
  const [isSupportWhatsAppModalOpen, setIsSupportWhatsAppModalOpen] = useState<boolean>(false);

  // Modal para Alteração de Senha do Admin Master
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState<boolean>(false);

  // Modal e Estado para Exclusão Definitiva de Cliente / Tenant
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [isDeletingTenant, setIsDeletingTenant] = useState<boolean>(false);
  const [deleteTenantError, setDeleteTenantError] = useState<string | null>(null);

  // Modal e Estado para Edição Completa de Dados do Cliente / Tenant
  const [tenantToEdit, setTenantToEdit] = useState<Tenant | null>(null);
  const [editTenantName, setEditTenantName] = useState('');
  const [editTenantTradeName, setEditTenantTradeName] = useState('');
  const [editTenantEmail, setEditTenantEmail] = useState('');
  const [editTenantPhone, setEditTenantPhone] = useState('');
  const [editTenantDocument, setEditTenantDocument] = useState('');
  const [editTenantPixKey, setEditTenantPixKey] = useState('');
  const [editTenantPixKeyType, setEditTenantPixKeyType] = useState<'cpf' | 'cnpj' | 'email' | 'phone' | 'random'>('email');
  const [editTenantModules, setEditTenantModules] = useState<AppModule[]>([]);
  const [editTenantMonthlyPrice, setEditTenantMonthlyPrice] = useState<string>('');
  const [savingTenantEdit, setSavingTenantEdit] = useState(false);
  const [editTenantError, setEditTenantError] = useState<string | null>(null);

  const handleOpenEditTenant = (t: Tenant) => {
    setTenantToEdit(t);
    setEditTenantName(t.name || '');
    setEditTenantTradeName(t.trade_name || '');
    setEditTenantEmail(t.email || '');
    setEditTenantPhone(t.whatsapp || t.phone || '');
    setEditTenantDocument(t.document || '');
    setEditTenantPixKey(t.pix_key || '');
    setEditTenantPixKeyType(t.pix_key_type || 'email');
    setEditTenantModules(t.selected_modules && t.selected_modules.length > 0 ? [...t.selected_modules] : ['business']);
    setEditTenantMonthlyPrice(t.plan_monthly_price ? t.plan_monthly_price.toFixed(2) : '');
    setEditTenantError(null);
  };

  const toggleEditTenantModule = (mod: AppModule) => {
    setEditTenantModules((prev) => {
      if (prev.includes(mod)) {
        if (prev.length <= 1) return prev; // Mantém pelo menos 1 módulo ativo
        return prev.filter((m) => m !== mod);
      }
      return [...prev, mod];
    });
  };

  const handleSaveTenantEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantToEdit || !editTenantName.trim()) return;
    setSavingTenantEdit(true);
    setEditTenantError(null);
    try {
      const parsedPrice = parseFloat(editTenantMonthlyPrice.replace(',', '.'));
      const hasCustom = !isNaN(parsedPrice) && parsedPrice > 0;
      await api.updateTenant(tenantToEdit.id, {
        name: editTenantName.trim(),
        trade_name: editTenantTradeName.trim() || undefined,
        email: editTenantEmail.trim() || undefined,
        whatsapp: editTenantPhone.trim() || undefined,
        phone: editTenantPhone.trim() || undefined,
        document: editTenantDocument.trim() || undefined,
        pix_key: editTenantPixKey.trim() || undefined,
        pix_key_type: editTenantPixKeyType,
        selected_modules: editTenantModules.length > 0 ? editTenantModules : ['business'],
        plan_monthly_price: hasCustom ? parsedPrice : calculatePlanPrice(editTenantModules.length, globalPrices),
        has_custom_price: hasCustom,
      });
      await fetchAdminData();
      if (onTenantUpdated) onTenantUpdated();
      setTenantToEdit(null);
    } catch (err: any) {
      console.error('Erro ao atualizar cliente:', err);
      setEditTenantError(err?.message || 'Falha ao salvar as alterações do cliente.');
    } finally {
      setSavingTenantEdit(false);
    }
  };

  const handleDeleteTenantConfirm = async () => {
    if (!tenantToDelete) return;
    setIsDeletingTenant(true);
    setDeleteTenantError(null);
    try {
      await api.deleteTenant(tenantToDelete.id);
      setTenantToDelete(null);
      await fetchAdminData();
      if (onTenantUpdated) onTenantUpdated();
    } catch (err: any) {
      console.error('Erro ao excluir tenant:', err);
      setDeleteTenantError(err?.message || 'Falha ao excluir o cliente do banco de dados.');
    } finally {
      setIsDeletingTenant(false);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [tList, hData, pData] = await Promise.all([
        api.getTenants(),
        api.getHealth(),
        api.getGlobalPlanPrices(),
      ]);
      const uniqueTenants = Array.isArray(tList)
        ? tList.filter((t, index, self) => index === self.findIndex((item) => item.id === t.id))
        : [];
      setTenants(uniqueTenants);
      setHealth(hData);
      if (pData) {
        setGlobalPrices(pData);
        setEditPrices(pData);
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlanPrices = async () => {
    setSavingPrices(true);
    setPriceSuccessMsg(null);
    try {
      const payload: GlobalPlanPrices = {
        module_1: Number(editPrices.module_1) || DEFAULT_PLAN_PRICES.module_1,
        module_2: Number(editPrices.module_2) || DEFAULT_PLAN_PRICES.module_2,
        module_3: Number(editPrices.module_3) || DEFAULT_PLAN_PRICES.module_3,
        module_4: Number(editPrices.module_4) || DEFAULT_PLAN_PRICES.module_4,
      };
      const updated = await api.updateGlobalPlanPrices(payload);
      setGlobalPrices(updated);
      setEditPrices(updated);
      setPriceSuccessMsg('Valores dos planos atualizados com sucesso no sistema!');
      await fetchAdminData();
      setTimeout(() => setPriceSuccessMsg(null), 4000);
      if (onTenantUpdated) onTenantUpdated();
    } catch (err) {
      console.error('Erro ao salvar preços dos planos:', err);
    } finally {
      setSavingPrices(false);
    }
  };

  const handleResetPlanPricesToDefault = () => {
    setEditPrices({ ...DEFAULT_PLAN_PRICES });
  };

  const handleOpenEditTenantPrice = (t: Tenant) => {
    setTenantForPriceEdit(t);
    const initialPrice =
      t.plan_monthly_price ||
      (t.selected_modules && t.selected_modules.length > 0
        ? calculatePlanPrice(t.selected_modules.length, globalPrices)
        : globalPrices.module_1);
    setCustomPriceInput(initialPrice.toFixed(2));
  };

  const handleSaveTenantCustomPrice = async () => {
    if (!tenantForPriceEdit) return;
    setSavingTenantPrice(true);
    try {
      const val = parseFloat(customPriceInput.replace(',', '.'));
      const hasCustom = !isNaN(val) && val > 0;
      await api.updateTenant(tenantForPriceEdit.id, {
        plan_monthly_price: hasCustom ? val : undefined,
        has_custom_price: hasCustom,
      });
      await fetchAdminData();
      if (onTenantUpdated) onTenantUpdated();
      setTenantForPriceEdit(null);
    } catch (err) {
      console.error('Erro ao salvar preço do cliente:', err);
    } finally {
      setSavingTenantPrice(false);
    }
  };

  const handleResetTenantToDefaultPrice = async () => {
    if (!tenantForPriceEdit) return;
    setSavingTenantPrice(true);
    try {
      await api.updateTenant(tenantForPriceEdit.id, {
        plan_monthly_price: undefined,
        has_custom_price: false,
      });
      await fetchAdminData();
      if (onTenantUpdated) onTenantUpdated();
      setTenantForPriceEdit(null);
    } catch (err) {
      console.error('Erro ao resetar preço do cliente:', err);
    } finally {
      setSavingTenantPrice(false);
    }
  };

  const handleTriggerPreventiveAlerts = async () => {
    setCheckingPreventiveAlerts(true);
    setPreventiveAlertFeedback(null);
    try {
      const res = await api.checkPreventiveAlerts();
      if (res.alertedCount > 0) {
        setPreventiveAlertFeedback(`✅ Sucesso! ${res.alertedCount} cliente(s) com expiração em até 3 dias foram alertados via e-mail e WhatsApp!`);
      } else {
        setPreventiveAlertFeedback(`ℹ️ Nenhum cliente com expiração nos próximos 3 dias precisando de alerta no momento.`);
      }
      setTimeout(() => setPreventiveAlertFeedback(null), 6000);
      await fetchAdminData();
    } catch (err) {
      console.error('Erro ao disparar alertas preventivos:', err);
    } finally {
      setCheckingPreventiveAlerts(false);
    }
  };

  const handleSendSinglePreventiveAlert = async (tenantId: string) => {
    setSendingAlertTenantId(tenantId);
    try {
      const res = await api.sendPreventiveAlert(tenantId);
      setPreventiveAlertFeedback(`✅ Alerta preventivo de ${res.daysRemaining} dias enviado com sucesso para ${res.email}!`);
      setTimeout(() => setPreventiveAlertFeedback(null), 6000);
      await fetchAdminData();
    } catch (err) {
      console.error('Erro ao enviar alerta preventivo:', err);
    } finally {
      setSendingAlertTenantId(null);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleExtendSubscription = async (tenantId: string, days = 30) => {
    setUpdatingId(tenantId);
    try {
      const current = tenants.find((t) => t.id === tenantId);
      const base = current?.subscription_expires_at && new Date(current.subscription_expires_at).getTime() > Date.now()
        ? new Date(current.subscription_expires_at)
        : new Date();

      const newExpiry = new Date(base.getTime() + days * 86400000).toISOString();

      await api.updateTenant(tenantId, {
        subscription_status: 'active',
        subscription_expires_at: newExpiry,
      });

      await fetchAdminData();
      if (onTenantUpdated) onTenantUpdated();
    } catch (err) {
      console.error('Failed to extend subscription', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMakeLifetime = async (tenantId: string) => {
    setUpdatingId(tenantId);
    try {
      await api.updateTenant(tenantId, {
        subscription_status: 'lifetime',
        subscription_expires_at: '2099-12-31T23:59:59.000Z',
      });
      await fetchAdminData();
      if (onTenantUpdated) onTenantUpdated();
    } catch (err) {
      console.error('Failed to make lifetime', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenManageSubscription = (tenant: Tenant) => {
    setSelectedTenantForRemoval(tenant);
    setTargetMode('trial');
    setTrialDays(2);
    setActiveDays(30);
  };

  const handleApplySubscriptionChange = async () => {
    if (!selectedTenantForRemoval) return;
    setIsSavingChange(true);
    try {
      const now = new Date();
      if (targetMode === 'trial') {
        const days = Math.max(1, trialDays || 2);
        const expiry = new Date(now.getTime() + days * 86400000).toISOString();
        await api.updateTenant(selectedTenantForRemoval.id, {
          subscription_status: 'trial',
          trial_started_at: now.toISOString(),
          trial_ends_at: expiry,
          subscription_expires_at: expiry,
        });
      } else {
        const days = Math.max(1, activeDays || 30);
        const expiry = new Date(now.getTime() + days * 86400000).toISOString();
        await api.updateTenant(selectedTenantForRemoval.id, {
          subscription_status: 'active',
          subscription_expires_at: expiry,
        });
      }

      await fetchAdminData();
      if (onTenantUpdated) onTenantUpdated();
      setSelectedTenantForRemoval(null);
    } catch (err) {
      console.error('Failed to update tenant subscription', err);
    } finally {
      setIsSavingChange(false);
    }
  };

  // Bloquear acesso do cliente
  const handleConfirmBlock = async () => {
    if (!tenantToBlock) return;
    setIsBlocking(true);
    setUpdatingId(tenantToBlock.id);
    try {
      await api.updateTenant(tenantToBlock.id, {
        is_blocked: true,
      });
      await fetchAdminData();
      if (onTenantUpdated) onTenantUpdated();
      setTenantToBlock(null);
    } catch (err) {
      console.error('Failed to block tenant', err);
    } finally {
      setIsBlocking(false);
      setUpdatingId(null);
    }
  };

  // Desbloquear acesso do cliente
  const handleUnblockTenant = async (tenantId: string) => {
    setUpdatingId(tenantId);
    try {
      await api.updateTenant(tenantId, {
        is_blocked: false,
      });
      await fetchAdminData();
      if (onTenantUpdated) onTenantUpdated();
    } catch (err) {
      console.error('Failed to unblock tenant', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">Painel Master Admin</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                Acesso Restrito
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Controle global de empresas, conversões de assinaturas PIX e integridade dos serviços
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => setIsMercadoPagoModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-950/80 hover:bg-sky-900/80 text-sky-300 text-xs font-bold rounded-xl border border-sky-500/40 shadow-md shadow-sky-950/40 transition-all cursor-pointer"
            title="Vincular Conta Mercado Pago (Liberação Automática de 30 Dias)"
          >
            <CreditCard className="w-3.5 h-3.5 text-sky-400" />
            <span>Vincular Mercado Pago</span>
          </button>

          <button
            onClick={() => setIsSupabaseModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-950/80 hover:bg-teal-900/80 text-teal-300 text-xs font-bold rounded-xl border border-teal-500/40 shadow-md shadow-teal-950/40 transition-all cursor-pointer"
            title="Gerenciar Banco de Dados Supabase (PostgreSQL)"
          >
            <Database className="w-3.5 h-3.5 text-teal-400" />
            <span>Banco Supabase</span>
          </button>

          <button
            onClick={handleTriggerPreventiveAlerts}
            disabled={checkingPreventiveAlerts}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-950/50 transition-all cursor-pointer disabled:opacity-50"
            title="Disparar notificações preventivas para clientes com <= 3 dias restantes"
          >
            {checkingPreventiveAlerts ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            <span>{checkingPreventiveAlerts ? 'Verificando...' : '🔔 Disparar Alertas (3 Dias)'}</span>
          </button>

          <button
            onClick={() => setIsExternalLinkModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/40 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
            title="Atualizar Links e Lojinha Online dos Painéis"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            <span>Atualizar Links</span>
          </button>

          <button
            onClick={() => setIsSupportWhatsAppModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/40 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
            title="Alterar Número de WhatsApp do Suporte (Botão Flutuante)"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp Suporte</span>
          </button>

          <button
            onClick={() => setIsChangePasswordModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-950/80 hover:bg-purple-900/80 text-purple-300 text-xs font-bold rounded-xl border border-purple-500/40 shadow-md shadow-purple-950/40 transition-all cursor-pointer"
            title="Alterar Senha do Administrador Master"
          >
            <KeyRound className="w-3.5 h-3.5 text-purple-400" />
            <span>Trocar Senha Master</span>
          </button>

          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Dados</span>
          </button>
        </div>
      </div>

      {preventiveAlertFeedback && (
        <div className="p-3.5 bg-slate-900 border border-amber-500/50 rounded-2xl text-xs font-semibold text-amber-200 flex items-center justify-between gap-3 shadow-lg shadow-amber-950/40 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{preventiveAlertFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setPreventiveAlertFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Services Health Status Bar */}
      {health && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Mercado Pago PIX</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-white capitalize">
              {health.services.mercadoPago.mode.replace('_', ' ')}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Checkout transparente R$ {globalPrices.module_1.toFixed(2).replace('.', ',')}
            </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl relative group">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Banco de Dados</span>
              <Server className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-sm font-bold text-white capitalize flex items-center justify-between">
              <span>{health.services.supabase.mode.replace('_', ' ')}</span>
              <button
                type="button"
                onClick={() => setIsSupabaseModalOpen(true)}
                className="text-[10px] text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 rounded-lg border border-teal-500/30 transition-all cursor-pointer"
              >
                Gerenciar
              </button>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">PostgreSQL / Supabase Store</div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>WhatsApp Evolution API</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-white capitalize">
              {health.services.whatsappEvolution.mode.replace('_', ' ')}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Disparos de cobrança e lembretes</div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Alertas Transacionais (SMTP)</span>
              <CheckCircle className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-sm font-bold text-white">
              betaof10@ &amp; wesleyamarah@
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">E-mails de novos clientes</div>
          </div>
        </div>
      )}

      {/* 2. Centro de Diagnóstico e Teste de Automação (4 Módulos) */}
      {(() => {
        const masterTenant =
          tenants.find(
            (t) =>
              t.id === '2caa686e-9c14-439b-8e9d-9b25cfbac345' ||
              t.email?.toLowerCase().includes('betao') ||
              t.email?.toLowerCase().includes('jonjon')
          ) || tenants[0];

        return masterTenant ? (
          <ModuleAutomationDiagnostic tenant={masterTenant} onRefreshParent={fetchAdminData} />
        ) : null;
      })()}

      {/* 3. Painel de Configuração de Valores dos Planos (Admin Master) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Configuração de Valores dos Planos
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                RECORRÊNCIA MENSAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Defina os valores cobrados em cada plano do sistema. As alterações têm efeito imediato na tela de cadastro e no PIX de renovação.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetPlanPricesToDefault}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>
            <button
              type="button"
              onClick={handleSavePlanPrices}
              disabled={savingPrices}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {savingPrices ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{savingPrices ? 'Salvando...' : 'Salvar Novos Valores'}</span>
            </button>
          </div>
        </div>

        {priceSuccessMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{priceSuccessMsg}</span>
          </div>
        )}

        {/* 4 Cards de Preço */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* 1 Módulo */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">1 Módulo (Individual)</span>
              <span className="text-[10px] text-slate-500 font-semibold">Base</span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400">R$</span>
              <input
                type="number"
                step="0.10"
                min="1"
                value={editPrices.module_1}
                onChange={(e) => setEditPrices({ ...editPrices, module_1: parseFloat(e.target.value) || 0 })}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-400">Empréstimo, IPTV, Negócios ou Assinaturas</p>
          </div>

          {/* 2 Módulos */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Combo 2 Módulos</span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Combo Duplo
              </span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400">R$</span>
              <input
                type="number"
                step="0.10"
                min="1"
                value={editPrices.module_2}
                onChange={(e) => setEditPrices({ ...editPrices, module_2: parseFloat(e.target.value) || 0 })}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-400">Escolha de 2 módulos integrados</p>
          </div>

          {/* 3 Módulos */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Combo 3 Módulos</span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Combo Trio
              </span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400">R$</span>
              <input
                type="number"
                step="0.10"
                min="1"
                value={editPrices.module_3}
                onChange={(e) => setEditPrices({ ...editPrices, module_3: parseFloat(e.target.value) || 0 })}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-400">Escolha de 3 módulos integrados</p>
          </div>

          {/* 4 Módulos */}
          <div className="p-3.5 bg-slate-950/80 border border-emerald-500/40 rounded-xl space-y-2 bg-emerald-950/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">4 Módulos (Master)</span>
              <span className="text-[10px] text-emerald-400 font-black bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                COMPLETO
              </span>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400">R$</span>
              <input
                type="number"
                step="0.10"
                min="1"
                value={editPrices.module_4}
                onChange={(e) => setEditPrices({ ...editPrices, module_4: parseFloat(e.target.value) || 0 })}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-emerald-500/50 rounded-lg text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-400">Acesso total aos 4 sistemas</p>
          </div>
        </div>
      </div>

      {/* Tenants Global Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Clientes Cadastrados</h3>
            <p className="text-xs text-slate-400">Total de {tenants.length} clientes na base</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Cliente Cadastrado</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Chave PIX</th>
                <th className="py-3 px-4">Plano / Status</th>
                <th className="py-3 px-4">Expiração</th>
                <th className="py-3 px-4 text-right">Ações Master</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {tenants.map((t) => {
                const isLifetime = t.subscription_status === 'lifetime';
                const isTrial = t.subscription_status === 'trial';
                const isActive = t.subscription_status === 'active';
                const isExpired = t.subscription_status === 'expired';
                const isBlocked = Boolean(t.is_blocked);

                return (
                  <tr
                    key={t.id}
                    className={`transition-colors ${
                      isBlocked ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        {isBlocked && (
                          <span title="Acesso bloqueado pelo Master">
                            <Ban className="w-4 h-4 text-rose-400 shrink-0" />
                          </span>
                        )}
                        <span>{t.name}</span>
                      </div>
                      {t.trade_name && <div className="text-[11px] text-slate-400">{t.trade_name}</div>}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {t.email || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400">
                      {t.pix_key || 'Não cadastrada'}
                    </td>
                    <td className="py-3.5 px-4">
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/50">
                          <Ban className="w-3 h-3 text-rose-400" />
                          Bloqueado pelo Admin
                        </span>
                      ) : isLifetime ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                          <Crown className="w-3 h-3 text-purple-400" />
                          Vitalício VIP
                        </span>
                      ) : isActive ? (() => {
                        const tPrice =
                          t.plan_monthly_price ||
                          (t.selected_modules && t.selected_modules.length > 0
                            ? calculatePlanPrice(t.selected_modules.length, globalPrices)
                            : globalPrices.module_1);
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle className="w-3 h-3" />
                              Ativo (R$ {tPrice.toFixed(2).replace('.', ',')})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditTenantPrice(t)}
                              title="Alterar valor mensal deste cliente"
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })() : isTrial ? (() => {
                        const tPrice =
                          t.plan_monthly_price ||
                          (t.selected_modules && t.selected_modules.length > 0
                            ? calculatePlanPrice(t.selected_modules.length, globalPrices)
                            : globalPrices.module_1);
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              Trial (R$ {tPrice.toFixed(2).replace('.', ',')})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditTenantPrice(t)}
                              title="Alterar valor mensal deste cliente"
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })() : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            Expirado
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditTenantPrice(t)}
                            title="Alterar valor mensal deste cliente"
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      <div>
                        {isLifetime
                          ? 'Vitalício (2099)'
                          : t.subscription_expires_at
                          ? new Date(t.subscription_expires_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </div>
                      {!isLifetime && !isExpired && (() => {
                        const expDate = t.subscription_expires_at
                          ? new Date(t.subscription_expires_at).getTime()
                          : new Date(t.trial_ends_at).getTime();
                        const diff = expDate - Date.now();
                        const dRem = Math.ceil(diff / (1000 * 60 * 60 * 24));
                        if (diff > 0 && dRem <= 3) {
                          return (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              <Bell className="w-3 h-3 text-amber-400 animate-pulse" />
                              ⚠️ Vence em {dRem}d
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                        
                        {/* Botão Editar Dados do Cliente */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditTenant(t)}
                          className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                          title="Editar dados cadastrais deste cliente"
                        >
                          <Pencil className="w-3 h-3 text-blue-400" />
                          <span>Editar</span>
                        </button>

                        {/* Botão Enviar Alerta Preventivo de 3 Dias */}
                        {!isLifetime && !isExpired && (
                          <button
                            type="button"
                            onClick={() => handleSendSinglePreventiveAlert(t.id)}
                            disabled={sendingAlertTenantId === t.id}
                            className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Disparar notificação preventiva de 3 dias para este cliente via e-mail e WhatsApp"
                          >
                            <Bell className={`w-3 h-3 ${sendingAlertTenantId === t.id ? 'animate-spin text-white' : 'text-amber-400'}`} />
                            <span className="hidden xl:inline">Avisar (3D)</span>
                          </button>
                        )}
                        
                        {/* Opção Bloquear / Desbloquear */}
                        {isBlocked ? (
                          <button
                            onClick={() => handleUnblockTenant(t.id)}
                            disabled={updatingId === t.id}
                            className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                            title="Desbloquear acesso deste cliente"
                          >
                            <Unlock className="w-3 h-3 text-emerald-400" />
                            <span>Desbloquear</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setTenantToBlock(t)}
                            disabled={updatingId === t.id}
                            className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                            title="Bloquear acesso total deste cliente"
                          >
                            <Ban className="w-3 h-3 text-rose-400" />
                            <span>Bloquear</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleExtendSubscription(t.id, 30)}
                          disabled={updatingId === t.id}
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                          title="Adicionar +30 dias de acesso"
                        >
                          +30 Dias
                        </button>

                        {isLifetime ? (
                          t.email === 'betaof10@hotmail.com' ? (
                            <span
                              className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-semibold select-none"
                              title="Vitalício Permanente Oficial (Não pode ser removido do vitalício)"
                            >
                              Vitalício Master
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenManageSubscription(t)}
                              disabled={updatingId === t.id}
                              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                              title="Tirar o vitalício e definir Trial ou dias restantes"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-400" />
                              <span>Tirar Vitalício</span>
                            </button>
                          )
                        ) : (
                          <>
                            <button
                              onClick={() => handleMakeLifetime(t.id)}
                              disabled={updatingId === t.id}
                              className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                              title="Tornar vitalício sem expiração"
                            >
                              Tornar Vitalício
                            </button>
                            <button
                              onClick={() => handleOpenManageSubscription(t)}
                              disabled={updatingId === t.id}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition-all disabled:opacity-50 cursor-pointer"
                              title="Definir Trial ou quantidade exata de dias"
                            >
                              Ajustar Dias
                            </button>
                          </>
                        )}

                        {/* Botão Excluir Cliente (Exceto Conta Principal do Master Admin) */}
                        {t.id === '2caa686e-9c14-439b-8e9d-9b25cfbac345' ? (
                          <span
                            className="px-2 py-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg select-none"
                            title="Conta Master Admin Principal (Protegida)"
                          >
                            Master
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setTenantToDelete(t);
                              setDeleteTenantError(null);
                            }}
                            disabled={updatingId === t.id || isDeletingTenant}
                            className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                            title="Excluir este cliente definitivamente do sistema e do banco de dados"
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                            <span>Excluir</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Remover Vitalício / Ajustar Assinatura */}
      {selectedTenantForRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain bg-[#0c162e] border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl text-white">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedTenantForRemoval.subscription_status === 'lifetime'
                      ? 'Tirar Acesso Vitalício'
                      : 'Ajustar Período de Assinatura'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cliente: <strong className="text-slate-200">{selectedTenantForRemoval.name}</strong> ({selectedTenantForRemoval.email || 'sem email'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTenantForRemoval(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Options */}
            <div className="py-5 space-y-4">
              <p className="text-xs text-slate-300">
                Selecione como deseja redefinir o acesso deste cliente:
              </p>

              {/* Card 1: Voltar para Trial */}
              <div
                onClick={() => setTargetMode('trial')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  targetMode === 'trial'
                    ? 'bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-950/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">
                        Deixar como Período Trial (Teste Grátis)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        O cliente volta para o status de degustação
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    targetMode === 'trial' ? 'border-amber-400 bg-amber-500 text-slate-950' : 'border-slate-600'
                  }`}>
                    {targetMode === 'trial' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {targetMode === 'trial' && (
                  <div className="mt-3 pt-3 border-t border-amber-500/20 animate-in fade-in duration-150">
                    <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                      Duração do Trial:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[1, 2, 3, 5, 7].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTrialDays(d);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            trialDays === d
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {d} {d === 1 ? 'Dia' : 'Dias'}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-amber-300/90 mt-2">
                      Expiração calculada: <strong>{new Date(Date.now() + trialDays * 86400000).toLocaleDateString('pt-BR')}</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Card 2: Definir Dias Restantes (Ativo com X dias) */}
              <div
                onClick={() => setTargetMode('days')}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  targetMode === 'days'
                    ? 'bg-emerald-950/20 border-emerald-500/50 shadow-md shadow-emerald-950/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">
                        Definir Dias Faltando / Dias Restantes
                      </span>
                      <span className="text-[11px] text-slate-400">
                        O cliente fica Ativo com a quantidade exata de dias escolhida
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    targetMode === 'days' ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-slate-600'
                  }`}>
                    {targetMode === 'days' && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {targetMode === 'days' && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/20 animate-in fade-in duration-150 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-300 block">
                      Escolha os dias que estão faltando:
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {[7, 15, 30, 45, 60, 90].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDays(d);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeDays === d
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {d} Dias
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-slate-400">Ou digite:</span>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={activeDays}
                        onChange={(e) => setActiveDays(parseInt(e.target.value, 10) || 1)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-20 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-emerald-400"
                      />
                      <span className="text-xs text-slate-400">dias corridos</span>
                    </div>

                    <p className="text-[11px] text-emerald-300/90 mt-1">
                      Expiração calculada: <strong>{new Date(Date.now() + activeDays * 86400000).toLocaleDateString('pt-BR')}</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTenantForRemoval(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingChange}
                onClick={handleApplySubscriptionChange}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-950/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSavingChange ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Aplicar Alteração</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Bloqueio de Cliente */}
      {tenantToBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-md my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain bg-[#0c162e] border-2 border-rose-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-white">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <Ban className="w-6 h-6" />
                <h4 className="font-bold text-base text-white">Bloquear Acesso do Cliente</h4>
              </div>
              <button
                onClick={() => setTenantToBlock(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-sm text-slate-300">
              <p>
                Deseja realmente suspender o acesso do cliente{' '}
                <strong className="text-white">{tenantToBlock.trade_name || tenantToBlock.name}</strong> ({tenantToBlock.email || 'sem e-mail'})?
              </p>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed">
                ⚠️ <strong>Atenção:</strong> Ao bloquear, o cliente terá sua tela totalmente travada e não conseguirá fazer nada até que você clique em <strong>Desbloquear</strong>.
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTenantToBlock(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                disabled={isBlocking}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                <Ban className="w-4 h-4" />
                <span>{isBlocking ? 'Bloqueando...' : 'Sim, Bloquear Acesso'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Alterar Valor Mensal Específico do Cliente */}
      {tenantForPriceEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-md my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain bg-[#0c162e] border border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-white">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <Tag className="w-6 h-6" />
                <div>
                  <h4 className="font-bold text-base text-white">Alterar Valor Mensal do Cliente</h4>
                  <p className="text-xs text-slate-400">{tenantForPriceEdit.trade_name || tenantForPriceEdit.name}</p>
                </div>
              </div>
              <button
                onClick={() => setTenantForPriceEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Valor Fixo Mensal deste Cliente (R$)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.10"
                    min="1"
                    value={customPriceInput}
                    onChange={(e) => setCustomPriceInput(e.target.value)}
                    placeholder="Ex: 24.90"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-base focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Este valor será cobrado no PIX de renovação de 30 dias deste cliente.
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 text-xs">
                <div className="text-slate-400">Módulos ativos deste cliente:</div>
                <div className="text-white font-semibold">
                  {tenantForPriceEdit.selected_modules && tenantForPriceEdit.selected_modules.length > 0
                    ? `${tenantForPriceEdit.selected_modules.length} Módulo(s) (${tenantForPriceEdit.selected_modules.join(', ')})`
                    : '1 Módulo padrão'}
                </div>
                <div className="text-slate-400 mt-1">
                  Preço padrão do sistema para {tenantForPriceEdit.selected_modules?.length || 1} módulo(s):{' '}
                  <strong className="text-emerald-400">
                    R${' '}
                    {calculatePlanPrice(
                      tenantForPriceEdit.selected_modules?.length || 1,
                      globalPrices
                    )
                      .toFixed(2)
                      .replace('.', ',')}
                  </strong>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleResetTenantToDefaultPrice}
                disabled={savingTenantPrice}
                className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Usar Preço Padrão
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTenantForPriceEdit(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTenantCustomPrice}
                  disabled={savingTenantPrice}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{savingTenantPrice ? 'Salvando...' : 'Salvar Preço'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Dados Completos do Cliente / Tenant */}
      {tenantToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain bg-[#0c162e] border border-blue-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-white">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-white">Editar Dados do Cliente</h4>
                  <p className="text-xs text-slate-400">{tenantToEdit.name} (ID: {tenantToEdit.id.slice(0, 8)}...)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTenantToEdit(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTenantEdit} className="py-4 space-y-4">
              {editTenantError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editTenantError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Nome da Empresa / Razão Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTenantName}
                    onChange={(e) => setEditTenantName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                    placeholder="Ex: Bambam Telas LTDA"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={editTenantTradeName}
                    onChange={(e) => setEditTenantTradeName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                    placeholder="Ex: Bambam Telas"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    E-mail do Cliente (Login)
                  </label>
                  <input
                    type="email"
                    value={editTenantEmail}
                    onChange={(e) => setEditTenantEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="cliente@email.com"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    WhatsApp / Telefone
                  </label>
                  <input
                    type="text"
                    value={editTenantPhone}
                    onChange={(e) => setEditTenantPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                    placeholder="Ex: 5585999999999"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    CPF / CNPJ
                  </label>
                  <input
                    type="text"
                    value={editTenantDocument}
                    onChange={(e) => setEditTenantDocument(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Valor Mensal Personalizado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    min="1"
                    value={editTenantMonthlyPrice}
                    onChange={(e) => setEditTenantMonthlyPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-blue-500"
                    placeholder="Deixe em branco para automático"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Chave PIX do Cliente
                  </label>
                  <input
                    type="text"
                    value={editTenantPixKey}
                    onChange={(e) => setEditTenantPixKey(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                    placeholder="Chave PIX da empresa"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Tipo de Chave
                  </label>
                  <select
                    value={editTenantPixKeyType}
                    onChange={(e: any) => setEditTenantPixKeyType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
                  >
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="random">Aleatória</option>
                  </select>
                </div>
              </div>

              {/* Módulos Ativos */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Módulos Contratados / Ativos:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    editTenantModules.includes('loans')
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-white font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={editTenantModules.includes('loans')}
                      onChange={() => toggleEditTenantModule('loans')}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <span>Empréstimos</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    editTenantModules.includes('iptv')
                      ? 'bg-purple-950/40 border-purple-500/50 text-white font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={editTenantModules.includes('iptv')}
                      onChange={() => toggleEditTenantModule('iptv')}
                      className="rounded border-slate-700 text-purple-500 focus:ring-0"
                    />
                    <span>IPTV & Streaming</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    editTenantModules.includes('business')
                      ? 'bg-blue-950/40 border-blue-500/50 text-white font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={editTenantModules.includes('business')}
                      onChange={() => toggleEditTenantModule('business')}
                      className="rounded border-slate-700 text-blue-500 focus:ring-0"
                    />
                    <span>Negócios & Vendas</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    editTenantModules.includes('subscriptions')
                      ? 'bg-teal-950/40 border-teal-500/50 text-white font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={editTenantModules.includes('subscriptions')}
                      onChange={() => toggleEditTenantModule('subscriptions')}
                      className="rounded border-slate-700 text-teal-500 focus:ring-0"
                    />
                    <span>Assinaturas</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTenantToEdit(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTenantEdit}
                  className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-950/50 disabled:opacity-50"
                >
                  {savingTenantEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  <span>{savingTenantEdit ? 'Salvando...' : 'Salvar Alterações do Cliente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Exclusão Definitiva de Cliente */}
      {tenantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-md my-auto bg-[#0c162e] border border-red-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-white">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Excluir Cliente</h3>
                  <p className="text-xs text-slate-400">Exclusão permanente do banco de dados</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingTenant) setTenantToDelete(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">Atenção! Esta ação é irreversível.</p>
                  <p className="text-red-300/90 leading-relaxed">
                    O cliente <strong className="text-white">{tenantToDelete.name}</strong> ({tenantToDelete.email || 'sem e-mail'}) 
                    será excluído por completo de todo o banco de dados (clientes, cobranças, produtos, dados de WhatsApp e credenciais de login).
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Para que este cliente consiga acessar o sistema novamente no futuro, ele terá obrigatoriamente que fazer um <strong>novo cadastro</strong>.
              </p>

              {deleteTenantError && (
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-lg text-xs text-rose-300">
                  {deleteTenantError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTenantToDelete(null)}
                disabled={isDeletingTenant}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteTenantConfirm}
                disabled={isDeletingTenant}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-600/30 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isDeletingTenant ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo do Banco...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Excluir Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento do Supabase */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => {
          setIsSupabaseModalOpen(false);
          fetchAdminData();
        }}
      />

      {/* Modal de Vinculação do Mercado Pago */}
      <MercadoPagoModal
        isOpen={isMercadoPagoModalOpen}
        onClose={() => {
          setIsMercadoPagoModalOpen(false);
          fetchAdminData();
        }}
        onUpdated={fetchAdminData}
      />

      {/* Modal de Atualização de Links / Lojinha Online */}
      <ExternalLinkModal
        isOpen={isExternalLinkModalOpen}
        onClose={() => {
          setIsExternalLinkModalOpen(false);
          fetchAdminData();
        }}
        onUpdated={() => {
          fetchAdminData();
          if (onTenantUpdated) onTenantUpdated();
        }}
      />

      {/* Modal de Configuração do WhatsApp de Suporte (Botão Flutuante) */}
      <SupportWhatsAppModal
        isOpen={isSupportWhatsAppModalOpen}
        onClose={() => {
          setIsSupportWhatsAppModalOpen(false);
          fetchAdminData();
        }}
        onUpdated={() => {
          fetchAdminData();
          if (onTenantUpdated) onTenantUpdated();
        }}
      />

      {/* Modal de Alteração de Senha do Admin Master */}
      <ChangeMasterPasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
};
