import React, { useState, useEffect } from 'react';
import {
  Repeat,
  Users,
  Layers,
  ShoppingBag,
  Plus,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  QrCode,
  Send,
  X,
  Calendar,
  Sparkles,
  Phone,
  DollarSign,
  TrendingUp,
  CreditCard,
  Check,
  Loader2,
} from 'lucide-react';
import {
  Tenant,
  SubscriptionCustomer,
  SubscriptionPlan,
  SubscriptionSale,
} from '../types/index.js';
import { generatePixPayload } from '../lib/pix.js';
import { api } from '../lib/api.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';
import {
  loadSubscriptionCustomersFromSupabase,
  createSubscriptionCustomerInSupabase,
  updateSubscriptionCustomerInSupabase,
  deleteSubscriptionCustomerFromSupabase,
  mapSupabaseRowToSubscriptionCustomer,
} from '../lib/supabaseSubscriptionCustomers.js';
import {
  loadSubscriptionPlansFromSupabase,
  createSubscriptionPlanInSupabase,
  updateSubscriptionPlanInSupabase,
  deleteSubscriptionPlanFromSupabase,
} from '../lib/supabaseSubscriptionPlans.js';
import {
  loadSubscriptionSalesFromSupabase,
  createSubscriptionSaleInSupabase,
  updateSubscriptionSaleInSupabase,
  deleteSubscriptionSaleFromSupabase,
} from '../lib/supabaseSubscriptionSales.js';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime.js';

interface SubscriptionsViewProps {
  tenant: Tenant;
  initialSubTab?: 'customers' | 'plans' | 'sales';
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  tenant,
  initialSubTab = 'customers',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'plans' | 'sales'>(
    initialSubTab === 'plans' ? 'plans' : 'customers'
  );

  useEffect(() => {
    if (initialSubTab === 'plans') {
      setActiveSubTab('plans');
    } else {
      setActiveSubTab('customers');
    }
  }, [initialSubTab]);

  const formatMoney = (val?: number) =>
    (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // 1. PLANS STATE
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => {
    try {
      const stored = localStorage.getItem(`multigestor_sub_plans_${tenant.id}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      // fallback
    }
    return [];
  });

  // 2. CUSTOMERS STATE
  const [customers, setCustomers] = useState<SubscriptionCustomer[]>(() => {
    try {
      const stored = localStorage.getItem(`multigestor_sub_customers_${tenant.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.map((c: any) => ({
            ...c,
            customer_name: c.customer_name || c.name || 'Cliente',
            whatsapp: c.whatsapp || '',
          }));
        }
      }
    } catch (e) {
      // fallback
    }
    return [];
  });

  // 3. SALES STATE
  const [sales, setSales] = useState<SubscriptionSale[]>(() => {
    try {
      const stored = localStorage.getItem(`multigestor_sub_sales_${tenant.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.map((s: any) => ({
            ...s,
            customer_name: s.customer_name || s.name || 'Cliente',
            plan_name: s.plan_name || 'Plano',
            whatsapp: s.whatsapp || '',
          }));
        }
      }
    } catch (e) {
      // fallback
    }
    return [];
  });

  // Load data from Backend / Supabase on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [dbPlans, dbCusts, dbSales] = await Promise.all([
          (isSupabaseConfigured && tenant.id
            ? loadSubscriptionPlansFromSupabase(tenant.id)
            : api.getSubscriptionPlans(tenant.id)
          ).catch(async (err) => {
            console.warn('[SubscriptionsView] Falha ao carregar planos do Supabase, tentando fallback Express:', err);
            return api.getSubscriptionPlans(tenant.id).catch(() => []);
          }),
          (isSupabaseConfigured && tenant.id
            ? loadSubscriptionCustomersFromSupabase(tenant.id)
            : api.getSubscriptionCustomers(tenant.id)
          ).catch(async (err) => {
            console.warn('[SubscriptionsView] Falha ao carregar assinantes do Supabase, tentando fallback Express:', err);
            return api.getSubscriptionCustomers(tenant.id).catch(() => []);
          }),
          (isSupabaseConfigured && tenant.id
            ? loadSubscriptionSalesFromSupabase(tenant.id)
            : api.getSubscriptionSales(tenant.id)
          ).catch(async (err) => {
            console.warn('[SubscriptionsView] Falha ao carregar vendas do Supabase, tentando fallback Express:', err);
            return api.getSubscriptionSales(tenant.id).catch(() => []);
          }),
        ]);
        if (isMounted) {
          if (Array.isArray(dbPlans)) {
            setPlans(dbPlans);
            try {
              localStorage.setItem(`multigestor_sub_plans_${tenant.id}`, JSON.stringify(dbPlans));
            } catch {}
          }
          if (Array.isArray(dbCusts)) {
            const mappedCusts = dbCusts.map((c: any) => {
              // 1. Dados atuais do customer têm prioridade absoluta
              const hasCustPlanId = Boolean(c.plan_id);
              const hasCustPlanName = Boolean(c.plan_name && c.plan_name.trim().length > 0);
              const hasCustPrice = typeof c.price === 'number' && c.price > 0;
              const hasCustPlanData = hasCustPlanId || hasCustPlanName || hasCustPrice;

              // 2. Busca venda em dbSales SOMENTE se faltar TODO dado cadastral essencial do cliente
              const custSale = !hasCustPlanData && Array.isArray(dbSales)
                ? dbSales.find((s: any) => s.customer_id === c.id)
                : undefined;

              const pId = c.plan_id || custSale?.plan_id;
              const pObj = pId && Array.isArray(dbPlans) ? dbPlans.find((p: any) => p.id === pId) : undefined;

              const resolvedPlanName = hasCustPlanName
                ? c.plan_name
                : (pObj?.name || custSale?.plan_name || '');

              const resolvedPrice = hasCustPrice
                ? c.price
                : (pObj?.price !== undefined ? pObj.price : (custSale?.amount !== undefined ? custSale.amount : 0));

              return {
                ...c,
                customer_name: c.customer_name || c.name || 'Cliente',
                whatsapp: c.whatsapp || '',
                plan_id: pId || c.plan_id,
                plan_name: resolvedPlanName,
                price: resolvedPrice,
              };
            });
            setCustomers(mappedCusts);
            try {
              localStorage.setItem(`multigestor_sub_customers_${tenant.id}`, JSON.stringify(mappedCusts));
            } catch {}
          }
          if (Array.isArray(dbSales)) {
            const mappedSales = dbSales.map((s: any) => ({
              ...s,
              customer_name: s.customer_name || s.name || 'Cliente',
              plan_name: s.plan_name || 'Plano',
              whatsapp: s.whatsapp || '',
            }));
            setSales(mappedSales);
            try {
              localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(mappedSales));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar assinaturas:', err);
      }
    }
    loadData();

    const handleSync = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [tenant.id]);

  // Realtime para Planos (public.subscription_plans)
  useSupabaseRealtime<SubscriptionPlan>({
    table: 'subscription_plans',
    tenantId: tenant.id,
    enabled: isSupabaseConfigured && !!tenant.id,
    onInsert: (newPlan) => {
      setPlans((prev) => {
        if (prev.some((p) => p.id === newPlan.id)) return prev;
        const next = [newPlan, ...prev];
        try {
          localStorage.setItem(`multigestor_sub_plans_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    onUpdate: (updatedPlan) => {
      setPlans((prev) => {
        const next = prev.map((p) => (p.id === updatedPlan.id ? { ...p, ...updatedPlan } : p));
        try {
          localStorage.setItem(`multigestor_sub_plans_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    onDelete: (deletedId) => {
      setPlans((prev) => {
        const next = prev.filter((p) => p.id !== deletedId);
        try {
          localStorage.setItem(`multigestor_sub_plans_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    onSyncNeeded: () => {
      if (isSupabaseConfigured && tenant.id) {
        loadSubscriptionPlansFromSupabase(tenant.id)
          .then((fresh) => {
            setPlans(fresh);
            try {
              localStorage.setItem(`multigestor_sub_plans_${tenant.id}`, JSON.stringify(fresh));
            } catch {}
          })
          .catch(console.error);
      }
    },
  });

  // Realtime para Assinantes (public.subscription_customers)
  useSupabaseRealtime<any>({
    table: 'subscription_customers',
    tenantId: tenant.id,
    enabled: isSupabaseConfigured && !!tenant.id,
    onInsert: (newCustRow) => {
      // Normaliza a linha bruta do PostgreSQL (desserializando a coluna notes)
      const normalized = mapSupabaseRowToSubscriptionCustomer(newCustRow);
      setCustomers((prev) => {
        if (prev.some((c) => c.id === normalized.id)) return prev;
        const next = [normalized, ...prev];
        try {
          localStorage.setItem(`multigestor_sub_customers_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    onUpdate: (updatedCustRow) => {
      // Normaliza a linha bruta do PostgreSQL (desserializando a coluna notes)
      const normalized = mapSupabaseRowToSubscriptionCustomer(updatedCustRow);
      setCustomers((prev) => {
        const next = prev.map((c) => (c.id === normalized.id ? { ...c, ...normalized } : c));
        try {
          localStorage.setItem(`multigestor_sub_customers_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    onDelete: (deletedId) => {
      setCustomers((prev) => {
        const next = prev.filter((c) => c.id !== deletedId);
        try {
          localStorage.setItem(`multigestor_sub_customers_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    onSyncNeeded: () => {
      if (isSupabaseConfigured && tenant.id) {
        loadSubscriptionCustomersFromSupabase(tenant.id)
          .then((fresh) => {
            const mapped = fresh.map((c: any) => ({
              ...c,
              customer_name: c.customer_name || c.name || 'Cliente',
              whatsapp: c.whatsapp || '',
            }));
            setCustomers(mapped);
            try {
              localStorage.setItem(`multigestor_sub_customers_${tenant.id}`, JSON.stringify(mapped));
            } catch {}
          })
          .catch(console.error);
      }
    },
  });

  // Realtime para Vendas (public.subscription_sales)
  useSupabaseRealtime<SubscriptionSale>({
    table: 'subscription_sales',
    tenantId: tenant.id,
    enabled: isSupabaseConfigured && !!tenant.id,
    onInsert: (newSale) => {
      setSales((prev) => {
        if (prev.some((s) => s.id === newSale.id)) return prev;
        const cust = customers.find((c) => c.id === newSale.customer_id);
        const pln = plans.find((p) => p.id === newSale.plan_id);
        const normalized: SubscriptionSale = {
          ...newSale,
          customer_name: newSale.customer_name || cust?.customer_name || 'Cliente',
          whatsapp: newSale.whatsapp || cust?.whatsapp || '',
          plan_name: newSale.plan_name || pln?.name || 'Plano',
        };
        const next = [normalized, ...prev];
        try {
          localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    onUpdate: (updatedSale) => {
      setSales((prev) => {
        const cust = customers.find((c) => c.id === updatedSale.customer_id);
        const pln = plans.find((p) => p.id === updatedSale.plan_id);
        const normalized: SubscriptionSale = {
          ...updatedSale,
          customer_name: updatedSale.customer_name || cust?.customer_name || 'Cliente',
          whatsapp: updatedSale.whatsapp || cust?.whatsapp || '',
          plan_name: updatedSale.plan_name || pln?.name || 'Plano',
        };
        const next = prev.map((s) => (s.id === normalized.id ? { ...s, ...normalized } : s));
        try {
          localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    onDelete: (deletedId) => {
      setSales((prev) => {
        const next = prev.filter((s) => s.id !== deletedId);
        try {
          localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    onSyncNeeded: () => {
      if (isSupabaseConfigured && tenant.id) {
        loadSubscriptionSalesFromSupabase(tenant.id)
          .then((fresh) => {
            const mapped = fresh.map((s: any) => ({
              ...s,
              customer_name: s.customer_name || s.name || 'Cliente',
              plan_name: s.plan_name || 'Plano',
              whatsapp: s.whatsapp || '',
            }));
            setSales(mapped);
            try {
              localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(mapped));
            } catch {}
          })
          .catch(console.error);
      }
    },
  });

  // Sync to localStorage as offline cache
  useEffect(() => {
    localStorage.setItem(`multigestor_sub_plans_${tenant.id}`, JSON.stringify(plans));
  }, [plans, tenant.id]);

  useEffect(() => {
    localStorage.setItem(`multigestor_sub_customers_${tenant.id}`, JSON.stringify(customers));
  }, [customers, tenant.id]);

  useEffect(() => {
    localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(sales));
  }, [sales, tenant.id]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState<string | null>(null);
  const [waToast, setWaToast] = useState<{ type: 'success' | 'error' | 'link'; message: string; url?: string } | null>(null);

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<SubscriptionCustomer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<SubscriptionCustomer | null>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [deleteCustomerError, setDeleteCustomerError] = useState<string | null>(null);

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planFormError, setPlanFormError] = useState<string | null>(null);
  const [isDeletingPlan, setIsDeletingPlan] = useState(false);
  const [deletePlanError, setDeletePlanError] = useState<string | null>(null);

  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<SubscriptionSale | null>(null);
  const [isSavingSale, setIsSavingSale] = useState(false);
  const [saleFormError, setSaleFormError] = useState<string | null>(null);
  const [isDeletingSale, setIsDeletingSale] = useState(false);
  const [deleteSaleError, setDeleteSaleError] = useState<string | null>(null);

  // Modal state - Customer Baixa
  const [customerToBaixa, setCustomerToBaixa] = useState<SubscriptionCustomer | null>(null);
  const [baixaAmount, setBaixaAmount] = useState('');
  const [baixaPaymentMethod, setBaixaPaymentMethod] = useState<'pix' | 'credit_card' | 'cash'>('pix');
  const [baixaPaymentDate, setBaixaPaymentDate] = useState('');
  const [baixaAdvanceDueDate, setBaixaAdvanceDueDate] = useState(true);
  const [isProcessingBaixa, setIsProcessingBaixa] = useState(false);
  const [baixaError, setBaixaError] = useState<string | null>(null);
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'overdue'>('all');

  // Form states - Customer
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custPlan, setCustPlan] = useState('');
  const [custPrice, setCustPrice] = useState('');
  const [custCycle, setCustCycle] = useState<'monthly' | 'quarterly' | 'semiannual' | 'annual'>('monthly');
  const [custNextDue, setCustNextDue] = useState('');
  const [custStatus, setCustStatus] = useState<'active' | 'overdue' | 'cancelled'>('active');
  const [custMarkAsPaid, setCustMarkAsPaid] = useState(false);
  const [custPaymentMethod, setCustPaymentMethod] = useState<'pix' | 'credit_card' | 'cash'>('pix');

  // Form states - Plan
  const [planName, setPlanName] = useState('');
  const [planCycle, setPlanCycle] = useState<'monthly' | 'quarterly' | 'semiannual' | 'annual'>('monthly');
  const [planPrice, setPlanPrice] = useState('');
  const [planDesc, setPlanDesc] = useState('');

  // Form states - Sale
  const [saleCustId, setSaleCustId] = useState('');
  const [saleCustName, setSaleCustName] = useState('');
  const [saleCustPhone, setSaleCustPhone] = useState('');
  const [salePlanId, setSalePlanId] = useState('');
  const [salePlanName, setSalePlanName] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [saleDueDate, setSaleDueDate] = useState('');

  // Quick Open Handlers
  const handleOpenNewCustomer = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustPhone('');
    setCustomerFormError(null);
    const defaultPlan = plans[0];
    setCustPlan(defaultPlan ? defaultPlan.name : '');
    setCustPrice(defaultPlan ? defaultPlan.price.toFixed(2).replace('.', ',') : '');
    setCustCycle(defaultPlan ? defaultPlan.billing_cycle : 'monthly');
    setCustNextDue(new Date().toISOString().split('T')[0]);
    setCustStatus('active');
    setCustMarkAsPaid(false);
    setCustPaymentMethod('pix');
    setIsCustomerModalOpen(true);
  };

  const handleEditCustomer = (c: SubscriptionCustomer) => {
    setEditingCustomer(c);
    setCustName(c.customer_name || (c as any).name || '');
    setCustPhone(c.whatsapp || '');
    setCustPlan(c.plan_name || '');
    setCustPrice((c.price || 0).toFixed(2).replace('.', ','));
    setCustCycle(c.billing_cycle || 'monthly');
    setCustNextDue(c.next_due_date || new Date().toISOString().split('T')[0]);
    setCustStatus(c.status || 'active');
    setCustMarkAsPaid(false);
    setCustPaymentMethod('pix');
    setCustomerFormError(null);
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;
    const numPrice = parseFloat(custPrice.replace(',', '.')) || 0;
    setCustomerFormError(null);
    setIsSavingCustomer(true);

    try {
      const selectedPlan = plans.find((p) => p.name === custPlan);

      if (editingCustomer) {
        const updatedData: Partial<SubscriptionCustomer> = {
          customer_name: custName.trim(),
          whatsapp: custPhone.trim(),
          plan_id: selectedPlan?.id || editingCustomer.plan_id,
          plan_name: custPlan,
          price: numPrice,
          billing_cycle: custCycle,
          next_due_date: custNextDue,
          status: custStatus,
        };

        console.log('[SUB_SAVE] Payload a ser enviado para edição:', {
          customerId: editingCustomer.id,
          tenantId: tenant?.id,
          plan_id: updatedData.plan_id,
          plan_name: updatedData.plan_name,
          price: updatedData.price,
          billing_cycle: updatedData.billing_cycle,
        });

        let updatedCust: SubscriptionCustomer;
        if (isSupabaseConfigured && tenant?.id) {
          updatedCust = await updateSubscriptionCustomerInSupabase(
            tenant.id,
            editingCustomer.id,
            updatedData
          );
        } else {
          updatedCust = await api.updateSubscriptionCustomer(editingCustomer.id, updatedData);
        }

        console.log('[SUB_SAVE] Resposta confirmada do salvamento:', {
          id: updatedCust.id,
          customer_name: updatedCust.customer_name,
          plan_id: updatedCust.plan_id,
          plan_name: updatedCust.plan_name,
          price: updatedCust.price,
        });

        setCustomers((prev) => {
          const next = prev.map((item) =>
            item.id === editingCustomer.id ? { ...item, ...updatedCust } : item
          );
          try {
            localStorage.setItem(`multigestor_sub_customers_${tenant.id}`, JSON.stringify(next));
          } catch {}
          return next;
        });

        // Sincronização secundária com o backend Express para manter memória e disco 100% atualizados
        api.updateSubscriptionCustomer(editingCustomer.id, updatedData).catch(() => {});
        setIsCustomerModalOpen(false);
      } else {
        const newCustPayload = {
          tenant_id: tenant.id,
          customer_name: custName.trim(),
          whatsapp: custPhone.trim(),
          plan_id: selectedPlan?.id || '',
          plan_name: custPlan,
          price: numPrice,
          billing_cycle: custCycle,
          start_date: new Date().toISOString().split('T')[0],
          next_due_date: custNextDue,
          status: custStatus,
        };

        let createdCust: SubscriptionCustomer;
        if (isSupabaseConfigured && tenant?.id) {
          createdCust = await createSubscriptionCustomerInSupabase(
            tenant.id,
            newCustPayload
          );
        } else {
          createdCust = await api.createSubscriptionCustomer(newCustPayload as any);
        }

        setCustomers((prev) => {
          const next = [createdCust, ...prev.filter((c) => c.id !== createdCust.id)];
          try {
            localStorage.setItem(`multigestor_sub_customers_${tenant.id}`, JSON.stringify(next));
          } catch {}
          return next;
        });

        // Sincronização secundária de compatibilidade Express
        api.createSubscriptionCustomer(createdCust as any).catch(() => {});

        // Automatically generate first invoice / sale
        const matchedPlan = plans.find((p) => (createdCust.plan_id && p.id === createdCust.plan_id) || p.name === createdCust.plan_name);
        const nowIso = new Date().toISOString();
        const newSalePayload = {
          tenant_id: tenant.id,
          customer_id: createdCust.id,
          customer_name: createdCust.customer_name,
          whatsapp: createdCust.whatsapp,
          plan_id: matchedPlan?.id || createdCust.plan_id || '',
          plan_name: createdCust.plan_name,
          amount: createdCust.price,
          start_date: createdCust.start_date || nowIso.split('T')[0],
          due_date: createdCust.next_due_date,
          status: custMarkAsPaid ? ('paid' as const) : ('pending' as const),
          paid_at: custMarkAsPaid ? nowIso : undefined,
          payment_method: custMarkAsPaid ? custPaymentMethod : undefined,
        };

        if (isSupabaseConfigured && tenant?.id && newSalePayload.plan_id) {
          createSubscriptionSaleInSupabase(tenant.id, newSalePayload)
            .then((createdSale) => {
              setSales((prev) => {
                const next = [createdSale, ...prev.filter((s) => s.id !== createdSale.id)];
                try {
                  localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(next));
                } catch {}
                return next;
              });
              api.createSubscriptionSale(createdSale as any).catch(() => {});
            })
            .catch(console.error);
        } else {
          const newSale: SubscriptionSale = {
            id: `sale-${Date.now()}`,
            ...newSalePayload,
            created_at: new Date().toISOString(),
          };
          setSales((prev) => [newSale, ...prev]);
          api.createSubscriptionSale(newSale).catch(console.error);
        }

        setIsCustomerModalOpen(false);
      }
    } catch (err: any) {
      console.error('[SubscriptionsView] Erro ao salvar assinante:', err);
      setCustomerFormError(err?.message || 'Erro ao comunicar com o PostgreSQL.');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleDeleteCustomerConfirm = async () => {
    if (!customerToDelete) return;
    const idToDelete = customerToDelete.id;
    setDeleteCustomerError(null);
    setIsDeletingCustomer(true);
    try {
      if (isSupabaseConfigured && tenant?.id) {
        try {
          await deleteSubscriptionCustomerFromSupabase(tenant.id, idToDelete);
        } catch (subErr) {
          console.warn('[SubscriptionsView] Falha ao excluir do Supabase:', subErr);
        }
      }
      await api.deleteSubscriptionCustomer(idToDelete);

      setCustomers((prev) => {
        const next = prev.filter((c) => c.id !== idToDelete);
        try {
          localStorage.setItem(`multigestor_sub_customers_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      setSales((prev) => {
        const next = prev.filter((s) => s.customer_id !== idToDelete);
        try {
          localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      setCustomerToDelete(null);
    } catch (err: any) {
      console.error('[SubscriptionsView] Erro ao excluir assinante:', err);
      setDeleteCustomerError(err?.message || 'Erro ao excluir assinante no PostgreSQL.');
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  const calculateNextDueDate = (currentDueDateStr: string, cycle: string): string => {
    const baseDate = currentDueDateStr ? new Date(currentDueDateStr + 'T12:00:00') : new Date();
    if (isNaN(baseDate.getTime())) return new Date().toISOString().split('T')[0];

    if (cycle === 'annual') {
      baseDate.setFullYear(baseDate.getFullYear() + 1);
    } else if (cycle === 'semiannual') {
      baseDate.setMonth(baseDate.getMonth() + 6);
    } else if (cycle === 'quarterly') {
      baseDate.setMonth(baseDate.getMonth() + 3);
    } else {
      // monthly
      baseDate.setMonth(baseDate.getMonth() + 1);
    }
    return baseDate.toISOString().split('T')[0];
  };

  const handleOpenBaixaCustomer = (c: SubscriptionCustomer) => {
    // 1. Localiza venda associada ao cliente para recuperar com 100% de segurança o plan_id e valor caso ausentes
    const customerSale = sales.find((s) => s.customer_id === c.id);
    const targetPlanId = c.plan_id || customerSale?.plan_id;
    const resolvedPlan = targetPlanId
      ? plans.find((p) => p.id === targetPlanId)
      : (c.plan_name ? plans.find((p) => p.name?.toLowerCase() === c.plan_name?.toLowerCase()) : undefined);

    const effectivePlanId = targetPlanId || resolvedPlan?.id || '';
    const effectivePlanName = c.plan_name || resolvedPlan?.name || customerSale?.plan_name || '';
    const effectivePrice = (c.price && c.price > 0)
      ? c.price
      : (resolvedPlan?.price || customerSale?.amount || 0);

    const enrichedCust: SubscriptionCustomer = {
      ...c,
      plan_id: effectivePlanId || c.plan_id,
      plan_name: effectivePlanName,
      price: effectivePrice,
    };

    setCustomerToBaixa(enrichedCust);
    setBaixaAmount(effectivePrice > 0 ? effectivePrice.toFixed(2).replace('.', ',') : (c.price || 0).toFixed(2).replace('.', ','));
    setBaixaPaymentMethod('pix');
    setBaixaPaymentDate(new Date().toISOString().split('T')[0]);
    setBaixaAdvanceDueDate(true);
    setBaixaError(null);
  };

  const handleConfirmBaixaCustomer = async () => {
    if (!customerToBaixa) return;
    setIsProcessingBaixa(true);
    setBaixaError(null);

    try {
      const numAmount = parseFloat(baixaAmount.replace(',', '.')) || customerToBaixa.price || 0;
      const paidDateIso = baixaPaymentDate
        ? new Date(baixaPaymentDate + 'T12:00:00').toISOString()
        : new Date().toISOString();

      // 1. Procurar fatura pendente desta assinatura
      const pendingSale = sales.find(
        (s) => s.customer_id === customerToBaixa.id && s.status !== 'paid'
      );

      // Resolução segura do plano contratado por ID (sem fallback para plans[0])
      const customerSale = pendingSale || sales.find((s) => s.customer_id === customerToBaixa.id);
      const targetPlanId = customerToBaixa.plan_id || customerSale?.plan_id;

      let matchedPlan: SubscriptionPlan | undefined = targetPlanId
        ? plans.find((p) => p.id === targetPlanId)
        : undefined;

      // Fallback secundário seguro por nome caso não haja ID
      if (!matchedPlan && customerToBaixa.plan_name) {
        matchedPlan = plans.find((p) => p.name?.toLowerCase() === customerToBaixa.plan_name?.toLowerCase());
      }

      if (pendingSale) {
        // Atualizar venda pendente para paga
        const saleUpdates = {
          status: 'paid' as const,
          paid_at: paidDateIso,
          payment_method: baixaPaymentMethod,
          amount: numAmount > 0 ? numAmount : pendingSale.amount,
        };

        if (isSupabaseConfigured && tenant?.id) {
          await updateSubscriptionSaleInSupabase(tenant.id, pendingSale.id, saleUpdates);
        } else {
          await api.updateSubscriptionSale(pendingSale.id, saleUpdates);
        }

        setSales((prev) => {
          const next = prev.map((s) =>
            s.id === pendingSale.id ? { ...s, ...saleUpdates } : s
          );
          try {
            localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(next));
          } catch {}
          return next;
        });
        api.updateSubscriptionSale(pendingSale.id, saleUpdates).catch(() => {});
      } else {
        // Criar nova venda liquidada preservando plano resolvido
        const planIdToUse = matchedPlan?.id || targetPlanId || '';
        const planNameToUse = matchedPlan?.name || customerToBaixa.plan_name || '';
        const planPriceToUse = numAmount > 0 ? numAmount : (matchedPlan?.price || customerToBaixa.price || 0);

        const newSalePayload = {
          tenant_id: tenant.id,
          customer_id: customerToBaixa.id,
          customer_name: customerToBaixa.customer_name,
          whatsapp: customerToBaixa.whatsapp,
          plan_id: planIdToUse,
          plan_name: planNameToUse,
          amount: planPriceToUse,
          start_date: new Date().toISOString().split('T')[0],
          due_date: customerToBaixa.next_due_date,
          status: 'paid' as const,
          paid_at: paidDateIso,
          payment_method: baixaPaymentMethod,
        };

        let createdSale: SubscriptionSale;
        if (isSupabaseConfigured && tenant?.id && newSalePayload.plan_id) {
          createdSale = await createSubscriptionSaleInSupabase(tenant.id, newSalePayload);
        } else {
          createdSale = await api.createSubscriptionSale(newSalePayload as any);
        }

        setSales((prev) => {
          const next = [createdSale, ...prev.filter((s) => s.id !== createdSale.id)];
          try {
            localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(next));
          } catch {}
          return next;
        });
        api.createSubscriptionSale(createdSale as any).catch(() => {});
      }

      // 2. Prorrogar vencimento do cliente se solicitado e garantir status 'active', mantendo dados do plano
      const newNextDueDate = baixaAdvanceDueDate
        ? calculateNextDueDate(customerToBaixa.next_due_date, customerToBaixa.billing_cycle)
        : customerToBaixa.next_due_date;

      const customerUpdates: Partial<SubscriptionCustomer> = {
        plan_id: targetPlanId || customerToBaixa.plan_id || matchedPlan?.id,
        plan_name: customerToBaixa.plan_name || matchedPlan?.name || '',
        price: (customerToBaixa.price && customerToBaixa.price > 0) ? customerToBaixa.price : (matchedPlan?.price || 0),
        billing_cycle: customerToBaixa.billing_cycle || matchedPlan?.billing_cycle || 'monthly',
        start_date: customerToBaixa.start_date,
        next_due_date: newNextDueDate,
        status: 'active',
      };

      let updatedCust: SubscriptionCustomer;
      if (isSupabaseConfigured && tenant?.id) {
        updatedCust = await updateSubscriptionCustomerInSupabase(
          tenant.id,
          customerToBaixa.id,
          customerUpdates
        );
      } else {
        updatedCust = await api.updateSubscriptionCustomer(customerToBaixa.id, customerUpdates);
      }

      setCustomers((prev) => {
        const next = prev.map((c) =>
          c.id === customerToBaixa.id ? { ...c, ...updatedCust } : c
        );
        try {
          localStorage.setItem(`multigestor_sub_customers_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      api.updateSubscriptionCustomer(customerToBaixa.id, customerUpdates).catch(() => {});

      setCustomerToBaixa(null);
    } catch (err: any) {
      console.error('[SubscriptionsView] Erro ao dar baixa na mensalidade do cliente:', err);
      setBaixaError(err?.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setIsProcessingBaixa(false);
    }
  };

  const handleOpenNewPlan = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanCycle('monthly');
    setPlanPrice('');
    setPlanDesc('');
    setPlanFormError(null);
    setIsPlanModalOpen(true);
  };

  const handleEditPlan = (p: SubscriptionPlan) => {
    setEditingPlan(p);
    setPlanName(p.name);
    setPlanCycle(p.billing_cycle);
    setPlanPrice(p.price.toFixed(2).replace('.', ','));
    setPlanDesc(p.description || '');
    setPlanFormError(null);
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return;
    const numPrice = parseFloat(planPrice.replace(',', '.')) || 0;
    setPlanFormError(null);
    setIsSavingPlan(true);

    try {
      if (editingPlan) {
        const updatedData: Partial<SubscriptionPlan> = {
          name: planName.trim(),
          billing_cycle: planCycle,
          price: numPrice,
          description: planDesc.trim() || undefined,
        };

        let updatedPlan: SubscriptionPlan;
        if (isSupabaseConfigured && tenant?.id) {
          updatedPlan = await updateSubscriptionPlanInSupabase(
            tenant.id,
            editingPlan.id,
            updatedData
          );
        } else {
          updatedPlan = await api.updateSubscriptionPlan(editingPlan.id, updatedData);
        }

        setPlans((prev) => {
          const next = prev.map((item) =>
            item.id === editingPlan.id ? { ...item, ...updatedPlan } : item
          );
          try {
            localStorage.setItem(`multigestor_sub_plans_${tenant.id}`, JSON.stringify(next));
          } catch {}
          return next;
        });

        // Sincronização secundária de compatibilidade Express
        api.updateSubscriptionPlan(editingPlan.id, updatedData).catch(() => {});
        setIsPlanModalOpen(false);
      } else {
        const newPlanPayload = {
          tenant_id: tenant.id,
          name: planName.trim(),
          billing_cycle: planCycle,
          price: numPrice,
          description: planDesc.trim() || undefined,
        };

        let createdPlan: SubscriptionPlan;
        if (isSupabaseConfigured && tenant?.id) {
          createdPlan = await createSubscriptionPlanInSupabase(
            tenant.id,
            newPlanPayload
          );
        } else {
          createdPlan = await api.createSubscriptionPlan(newPlanPayload as any);
        }

        setPlans((prev) => {
          const next = [createdPlan, ...prev.filter((p) => p.id !== createdPlan.id)];
          try {
            localStorage.setItem(`multigestor_sub_plans_${tenant.id}`, JSON.stringify(next));
          } catch {}
          return next;
        });

        // Sincronização secundária de compatibilidade Express
        api.createSubscriptionPlan(createdPlan as any).catch(() => {});
        setIsPlanModalOpen(false);
      }
    } catch (err: any) {
      console.error('[SubscriptionsView] Erro ao salvar plano:', err);
      setPlanFormError(err?.message || 'Erro ao comunicar com o PostgreSQL.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleDeletePlanConfirm = async () => {
    if (!planToDelete) return;
    const idToDelete = planToDelete.id;
    setDeletePlanError(null);
    setIsDeletingPlan(true);
    try {
      if (isSupabaseConfigured && tenant?.id) {
        await deleteSubscriptionPlanFromSupabase(tenant.id, idToDelete);
      } else {
        await api.deleteSubscriptionPlan(idToDelete);
      }
      setPlans((prev) => {
        const next = prev.filter((p) => p.id !== idToDelete);
        try {
          localStorage.setItem(`multigestor_sub_plans_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });
      // Sincronização secundária de compatibilidade Express
      api.deleteSubscriptionPlan(idToDelete).catch(() => {});
      setPlanToDelete(null);
    } catch (err: any) {
      console.error('[SubscriptionsView] Erro ao excluir plano:', err);
      setDeletePlanError(err?.message || 'Erro ao excluir plano no PostgreSQL.');
    } finally {
      setIsDeletingPlan(false);
    }
  };

  const handleOpenNewSale = () => {
    setSaleFormError(null);
    const firstCust = customers[0];
    const firstPlan = plans[0];
    setSaleCustId(firstCust ? firstCust.id : '');
    setSaleCustName(firstCust ? firstCust.customer_name : '');
    setSaleCustPhone(firstCust ? firstCust.whatsapp : '');
    setSalePlanId(firstPlan ? firstPlan.id : '');
    setSalePlanName(firstPlan ? firstPlan.name : '');
    setSaleAmount(firstPlan ? firstPlan.price.toFixed(2).replace('.', ',') : '');
    setSaleDueDate(new Date().toISOString().split('T')[0]);
    setIsSaleModalOpen(true);
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaleFormError(null);

    const selectedCust = customers.find((c) => c.id === saleCustId) || customers[0];
    const selectedPlan = plans.find((p) => p.id === salePlanId);

    if (!selectedCust) {
      setSaleFormError('Cadastre pelo menos um assinante antes de lançar uma fatura.');
      return;
    }
    if (!selectedPlan) {
      setSaleFormError('Cadastre pelo menos um plano antes de lançar uma fatura.');
      return;
    }

    const numAmount = parseFloat(saleAmount.replace(',', '.')) || selectedPlan.price;
    setIsSavingSale(true);

    try {
      const salePayload = {
        tenant_id: tenant.id,
        customer_id: selectedCust.id,
        customer_name: selectedCust.customer_name,
        whatsapp: selectedCust.whatsapp,
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
        amount: numAmount > 0 ? numAmount : selectedPlan.price,
        start_date: new Date().toISOString().split('T')[0],
        due_date: saleDueDate || new Date().toISOString().split('T')[0],
        status: 'pending' as const,
      };

      let createdSale: SubscriptionSale;
      if (isSupabaseConfigured && tenant?.id) {
        createdSale = await createSubscriptionSaleInSupabase(tenant.id, salePayload);
      } else {
        createdSale = await api.createSubscriptionSale(salePayload as any);
      }

      setSales((prev) => {
        const next = [createdSale, ...prev.filter((s) => s.id !== createdSale.id)];
        try {
          localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Sincronização secundária de compatibilidade Express
      api.createSubscriptionSale(createdSale as any).catch(() => {});
      setIsSaleModalOpen(false);
    } catch (err: any) {
      console.error('[SubscriptionsView] Erro ao registrar venda:', err);
      setSaleFormError(err?.message || 'Erro ao registrar venda no PostgreSQL.');
    } finally {
      setIsSavingSale(false);
    }
  };

  const handleMarkSaleAsPaid = async (saleId: string) => {
    const paidAt = new Date().toISOString();
    const updates = {
      status: 'paid' as const,
      paid_at: paidAt,
      payment_method: 'pix' as const,
    };

    try {
      if (isSupabaseConfigured && tenant?.id) {
        await updateSubscriptionSaleInSupabase(tenant.id, saleId, updates);
      } else {
        await api.updateSubscriptionSale(saleId, updates);
      }

      setSales((prev) => {
        const next = prev.map((s) =>
          s.id === saleId ? { ...s, ...updates } : s
        );
        try {
          localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Sincronização secundária de compatibilidade Express
      api.updateSubscriptionSale(saleId, updates).catch(() => {});
    } catch (err: any) {
      console.error('[SubscriptionsView] Erro ao baixar venda no Supabase:', err);
    }
  };

  const handleDeleteSaleConfirm = async () => {
    if (!saleToDelete) return;
    const idToDelete = saleToDelete.id;
    setDeleteSaleError(null);
    setIsDeletingSale(true);
    try {
      if (isSupabaseConfigured && tenant?.id) {
        await deleteSubscriptionSaleFromSupabase(tenant.id, idToDelete);
      } else {
        await api.deleteSubscriptionSale(idToDelete);
      }

      setSales((prev) => {
        const next = prev.filter((s) => s.id !== idToDelete);
        try {
          localStorage.setItem(`multigestor_sub_sales_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });

      // Sincronização secundária de compatibilidade Express
      api.deleteSubscriptionSale(idToDelete).catch(() => {});
      setSaleToDelete(null);
    } catch (err: any) {
      console.error('[SubscriptionsView] Erro ao excluir venda:', err);
      setDeleteSaleError(err?.message || 'Erro ao excluir venda no PostgreSQL.');
    } finally {
      setIsDeletingSale(false);
    }
  };

  // WhatsApp Billing
  const handleSendWhatsApp = async (item: {
    id?: string;
    customer_id?: string;
    customerId?: string;
    customer_name: string;
    whatsapp?: string;
    phone?: string;
    plan_name: string;
    amount?: number;
    price?: number;
    due_date?: string;
    next_due_date?: string;
  }) => {
    // 1. Resolve o telefone: prioriza o campo direto ou busca o assinante na lista pelo id/nome
    let rawPhone = item.whatsapp || item.phone || '';
    if (!rawPhone) {
      const foundCust = customers.find(
        (c) =>
          (item.customer_id && c.id === item.customer_id) ||
          (item.customer_name &&
            ((c.customer_name && c.customer_name.toLowerCase() === item.customer_name.toLowerCase()) ||
              ((c as any).name && (c as any).name.toLowerCase() === item.customer_name.toLowerCase())))
      );
      if (foundCust?.whatsapp) {
        rawPhone = foundCust.whatsapp;
      }
    }

    const digits = rawPhone.replace(/\D/g, '');
    if (!digits || digits.length < 8) {
      setWaToast({
        type: 'error',
        message: `Telefone WhatsApp não encontrado para "${item.customer_name}". Edite o assinante e informe o WhatsApp com DDD.`,
      });
      setTimeout(() => setWaToast(null), 5000);
      return;
    }

    const cleanPhone = digits.length <= 11 ? `55${digits}` : digits;
    const val = item.amount ?? item.price ?? 0;
    const due = item.due_date ?? item.next_due_date ?? '';
    const formattedDue = due
      ? new Date(due.includes('T') ? due : due + 'T12:00:00').toLocaleDateString('pt-BR')
      : 'a combinar';
    const pixKey = tenant.pix_key || 'dlinformatica3137@gmail.com';
    const merchantName = tenant.trade_name || tenant.name || 'Multi Gestor';

    const text =
      `🔔 *Aviso de Mensalidade / Assinatura*\n\n` +
      `Olá, *${item.customer_name}*! Tudo bem?\n\n` +
      `Lembramos sobre a renovação do seu plano *${item.plan_name}* com vencimento em *${formattedDue}* no valor de *${formatMoney(val)}*.\n\n` +
      `🔑 *Chave PIX:* \`${pixKey}\`\n` +
      `Beneficiário: *${merchantName}*\n\n` +
      `Assim que realizar o pagamento, por favor envie o comprovante por aqui. Muito obrigado!`;

    const encoded = encodeURIComponent(text);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encoded}`;

    const sendId = item.id || item.customer_name;
    setSendingWhatsAppId(sendId);

    try {
      const res = await api.sendDirectWhatsApp({
        tenantId: tenant.id,
        phone: cleanPhone,
        message: text,
        customerName: item.customer_name,
        description: `Renovação de Assinatura: ${item.plan_name}`,
      });

      if (res.success && (res.method === 'evolution_api' || (res as any).sentDirectly)) {
        setWaToast({
          type: 'success',
          message: `✅ Mensagem enviada com sucesso para ${item.customer_name} direto pelo WhatsApp conectado!`,
        });
        setTimeout(() => setWaToast(null), 4000);
        return;
      }

      setWaToast({
        type: 'link',
        message: `Aparelho ainda não conectado via QR Code. Clique para enviar a ${item.customer_name}:`,
        url: waUrl,
      });
      try {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      } catch {}
    } catch {
      setWaToast({
        type: 'link',
        message: `Clique para enviar via WhatsApp Web/App para ${item.customer_name}:`,
        url: waUrl,
      });
      try {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      } catch {}
    } finally {
      setSendingWhatsAppId(null);
    }
  };

  // Copy PIX
  const handleCopyPix = (saleId: string, amount: number, desc: string) => {
    const pixKey = tenant.pix_key || 'dlinformatica3137@gmail.com';
    const payload = generatePixPayload({
      pixKey,
      merchantName: tenant.name || 'Multi Gestor',
      merchantCity: tenant.address_city || 'SAO PAULO',
      amount,
      txId: saleId.replace(/[^A-Za-z0-9]/g, '').slice(0, 20),
      description: desc.slice(0, 30),
    });

    navigator.clipboard.writeText(payload);
    setCopiedPixId(saleId);
    setTimeout(() => setCopiedPixId(null), 3000);
  };

  // Helpers & Metrics
  const getDaysUntilDue = (dateStr?: string) => {
    if (!dateStr) return 999;
    const clean = dateStr.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length !== 3) return 999;
    const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const expiringSoonSubscribers = customers.filter((c) => {
    if (c.status === 'cancelled') return false;
    const diff = getDaysUntilDue(c.next_due_date);
    return diff === 0 || diff === 1;
  }).length;

  const overdueSubscribers = customers.filter((c) => {
    if (c.status === 'cancelled') return false;
    const diff = getDaysUntilDue(c.next_due_date);
    return c.status === 'overdue' || diff < 0;
  }).length;

  const activeSubscribers = customers.filter((c) => {
    if (c.status === 'cancelled') return false;
    const diff = getDaysUntilDue(c.next_due_date);
    return diff >= 0 && c.status !== 'overdue';
  }).length;

  const monthlyRecurringRevenue = customers
    .filter((c) => {
      if (c.status === 'cancelled') return false;
      const diff = getDaysUntilDue(c.next_due_date);
      return diff >= 0 && c.status !== 'overdue';
    })
    .reduce((acc, c) => {
      if (c.billing_cycle === 'quarterly') return acc + c.price / 3;
      if (c.billing_cycle === 'semiannual') return acc + c.price / 6;
      if (c.billing_cycle === 'annual') return acc + c.price / 12;
      return acc + c.price;
    }, 0);

  const totalSalesPaid = sales
    .filter((s) => s.status === 'paid')
    .reduce((acc, s) => acc + s.amount, 0);

  return (
    <div className="space-y-5 select-none animate-in fade-in duration-150">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#170e2b] via-[#120a24] to-[#0c061a] border border-purple-500/30 p-4 sm:p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-950/60 border border-purple-400/40 shrink-0">
            <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                Módulo de Assinaturas
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 uppercase shrink-0">
                STREAMING
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              Gestão de mensalidades, clubes, planos e cobranças recorrentes automáticas
            </p>
          </div>
        </div>

        {/* Action Button depends on active subtab */}
        <div className="flex items-center gap-2 shrink-0">
          {activeSubTab === 'customers' && (
            <button
              onClick={handleOpenNewCustomer}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/40 text-xs transition-all active:scale-95 cursor-pointer border border-purple-400/30"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Novo Assinante</span>
            </button>
          )}

          {activeSubTab === 'plans' && (
            <button
              onClick={handleOpenNewPlan}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/40 text-xs transition-all active:scale-95 cursor-pointer border border-purple-400/30"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Novo Plano</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 Financial Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-4">
        {/* Card 1: Assinantes Ativos */}
        <div
          onClick={() => {
            setActiveSubTab('customers');
            setCustomerStatusFilter(customerStatusFilter === 'active' ? 'all' : 'active');
          }}
          className={`p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white shadow-xl shadow-purple-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[135px] cursor-pointer hover:scale-[1.02] transition-all ${
            activeSubTab === 'customers' && customerStatusFilter === 'active' ? 'ring-2 ring-white/90 scale-[1.02]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-purple-100">
              Assinantes Ativos
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-3xl font-black font-mono">{activeSubscribers}</div>
            <div className="text-[10px] sm:text-xs text-purple-100 mt-1">Planos em dia</div>
          </div>
        </div>

        {/* Card 2: Vencem Hoje ou Amanhã */}
        <div
          onClick={() => {
            setActiveSubTab('customers');
            setCustomerStatusFilter(customerStatusFilter === 'expiring_soon' ? 'all' : 'expiring_soon');
          }}
          className={`p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white shadow-xl shadow-amber-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[135px] cursor-pointer hover:scale-[1.02] transition-all ${
            activeSubTab === 'customers' && customerStatusFilter === 'expiring_soon' ? 'ring-2 ring-white/90 scale-[1.02]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-100">
              Vencem Hoje / Amanhã
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-3xl font-black font-mono">{expiringSoonSubscribers}</div>
            <div className="text-[10px] sm:text-xs text-amber-100 mt-1">Necessitam de lembrete</div>
          </div>
        </div>

        {/* Card 3: MRR - Receita Recorrente Mensal */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-xl shadow-emerald-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[135px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-100">
              MRR Estimado
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-black font-mono">
              {formatMoney(monthlyRecurringRevenue)}
            </div>
            <div className="text-[10px] sm:text-xs text-emerald-100 mt-1">Receita mensal base</div>
          </div>
        </div>

        {/* Card 4: Total Baixado (Vendas) */}
        <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white shadow-xl shadow-blue-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[135px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-100">
              Total Faturado
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-black font-mono">{formatMoney(totalSalesPaid)}</div>
            <div className="text-[10px] sm:text-xs text-blue-100 mt-1">Mensalidades quitadas</div>
          </div>
        </div>

        {/* Card 5: Inadimplentes */}
        <div
          onClick={() => {
            setActiveSubTab('customers');
            setCustomerStatusFilter(customerStatusFilter === 'overdue' ? 'all' : 'overdue');
          }}
          className={`p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f43f5e] to-[#be123c] text-white shadow-xl shadow-rose-950/30 flex flex-col justify-between min-h-[125px] sm:min-h-[135px] cursor-pointer hover:scale-[1.02] transition-all ${
            activeSubTab === 'customers' && customerStatusFilter === 'overdue' ? 'ring-2 ring-white/90 scale-[1.02]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-rose-100">
              Vencidos / Atrasados
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-3xl font-black font-mono">{overdueSubscribers}</div>
            <div className="text-[10px] sm:text-xs text-rose-100 mt-1">Cobranças a enviar</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs Pills */}
      <div className="flex items-center gap-2 p-1.5 bg-[#0f1b38] border border-[#1e2f57] rounded-2xl">
        <button
          onClick={() => setActiveSubTab('customers')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'customers'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50'
              : 'text-slate-400 hover:text-white hover:bg-[#132247]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Clientes ({customers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('plans')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'plans'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50'
              : 'text-slate-400 hover:text-white hover:bg-[#132247]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Planos ({plans.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sales')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'sales'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50'
              : 'text-slate-400 hover:text-white hover:bg-[#132247]'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Faturas ({sales.length})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 sm:p-4 bg-[#0f1b38] border border-[#1e2f57] rounded-2xl flex items-center justify-between gap-3 shadow-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            placeholder={
              activeSubTab === 'customers'
                ? 'Buscar assinante por nome ou WhatsApp...'
                : activeSubTab === 'plans'
                ? 'Buscar plano por nome ou ciclo...'
                : 'Buscar venda por cliente ou plano...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#091124] border border-[#1b2b4f] rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-purple-500/60"
          />
        </div>
      </div>

      {/* SUBTAB 1: CLIENTES */}
      {activeSubTab === 'customers' && (
        <div className="bg-[#0f1b38] border border-[#1e2f57] rounded-2xl overflow-hidden shadow-xl p-3 sm:p-0">
          {/* Mobile View: Cards */}
          <div className="md:hidden space-y-3">
            {customers
              .filter((c) => {
                const name = (c.customer_name || (c as any).name || '').toLowerCase();
                const whatsapp = (c.whatsapp || '').toLowerCase();
                const term = (searchTerm || '').toLowerCase();
                const matchesSearch = name.includes(term) || whatsapp.includes(term);
                if (!matchesSearch) return false;

                if (customerStatusFilter === 'active') {
                  const diff = getDaysUntilDue(c.next_due_date);
                  return diff >= 0 && c.status !== 'overdue' && c.status !== 'cancelled';
                }
                if (customerStatusFilter === 'expiring_soon') {
                  const diff = getDaysUntilDue(c.next_due_date);
                  return (diff === 0 || diff === 1) && c.status !== 'cancelled';
                }
                if (customerStatusFilter === 'overdue') {
                  const diff = getDaysUntilDue(c.next_due_date);
                  return c.status === 'overdue' || (diff < 0 && c.status !== 'cancelled');
                }
                return true;
              })
              .map((cust) => {
                const diff = getDaysUntilDue(cust.next_due_date);
                const isDueToday = diff === 0;
                const isDueTomorrow = diff === 1;
                const isOverdue = cust.status === 'overdue' || (diff < 0 && cust.status !== 'cancelled');
                const displayName = cust.customer_name || (cust as any).name || 'Cliente';
                return (
                  <div
                    key={cust.id}
                    className="p-3.5 rounded-xl bg-[#091124] border border-[#1b2b4f] space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">{displayName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{cust.whatsapp || '—'}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            cust.status === 'cancelled'
                              ? 'bg-slate-700/40 text-slate-400 border-slate-600'
                              : isOverdue
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : isDueToday
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 animate-pulse'
                              : isDueTomorrow
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {cust.status === 'cancelled'
                            ? 'Cancelada'
                            : isOverdue
                            ? 'Atrasada'
                            : isDueToday
                            ? 'Vence Hoje'
                            : isDueTomorrow
                            ? 'Vence Amanhã'
                            : 'Ativa'}
                        </span>
                        <button
                          onClick={() => setCustomerToDelete(cust)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded-md"
                          title="Excluir assinante"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#1b2b4f]/60">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Plano:</span>
                        <span className="font-bold text-purple-300">{cust.plan_name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Próx. Vencimento:</span>
                        <span className="font-mono text-slate-300 font-medium">
                          {new Date(cust.next_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Ciclo:</span>
                        <span className="font-semibold text-slate-300">
                          {CYCLE_LABELS[cust.billing_cycle] || cust.billing_cycle}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Valor:</span>
                        <span className="font-mono font-black text-white text-base">
                          {formatMoney(cust.price)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1b2b4f]/60">
                      <button
                        onClick={() => handleSendWhatsApp(cust)}
                        className="py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                        title="Cobrar via WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Cobrar</span>
                      </button>

                      <button
                        onClick={() => handleOpenBaixaCustomer(cust)}
                        className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-md shadow-emerald-900/40"
                        title="Dar baixa na mensalidade"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Baixar</span>
                      </button>

                      <button
                        onClick={() => handleEditCustomer(cust)}
                        className="py-2 rounded-lg bg-[#121f3f] text-blue-400 hover:text-blue-300 border border-[#1b2b4f] text-xs font-bold flex items-center justify-center gap-1 transition-all"
                        title="Editar assinante"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#091124] border-b border-[#1b2b4f] text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Assinante</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Ciclo</th>
                  <th className="py-3 px-4">Próx. Vencimento</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172547]">
                {customers
                  .filter((c) => {
                    const name = (c.customer_name || (c as any).name || '').toLowerCase();
                    const whatsapp = (c.whatsapp || '').toLowerCase();
                    const term = (searchTerm || '').toLowerCase();
                    const matchesSearch = name.includes(term) || whatsapp.includes(term);
                    if (!matchesSearch) return false;

                    if (customerStatusFilter === 'active') {
                      const diff = getDaysUntilDue(c.next_due_date);
                      return diff >= 0 && c.status !== 'overdue' && c.status !== 'cancelled';
                    }
                    if (customerStatusFilter === 'expiring_soon') {
                      const diff = getDaysUntilDue(c.next_due_date);
                      return (diff === 0 || diff === 1) && c.status !== 'cancelled';
                    }
                    if (customerStatusFilter === 'overdue') {
                      const diff = getDaysUntilDue(c.next_due_date);
                      return c.status === 'overdue' || (diff < 0 && c.status !== 'cancelled');
                    }
                    return true;
                  })
                  .map((cust) => {
                    const diff = getDaysUntilDue(cust.next_due_date);
                    const isDueToday = diff === 0;
                    const isDueTomorrow = diff === 1;
                    const isOverdue = cust.status === 'overdue' || (diff < 0 && cust.status !== 'cancelled');
                    const displayName = cust.customer_name || (cust as any).name || 'Cliente';
                    return (
                      <tr key={cust.id} className="hover:bg-[#121f3f]/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div>{displayName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{cust.whatsapp || '—'}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-purple-300">{cust.plan_name}</td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {CYCLE_LABELS[cust.billing_cycle] || cust.billing_cycle}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-200">
                          {new Date(cust.next_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          {formatMoney(cust.price)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              cust.status === 'cancelled'
                                ? 'bg-slate-700/40 text-slate-400 border-slate-600'
                                : isOverdue
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                : isDueToday
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 animate-pulse'
                                : isDueTomorrow
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            {cust.status === 'cancelled'
                              ? 'Cancelada'
                              : isOverdue
                              ? 'Atrasada'
                              : isDueToday
                              ? 'Vence Hoje'
                              : isDueTomorrow
                              ? 'Vence Amanhã'
                              : 'Ativa'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSendWhatsApp(cust)}
                              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                              title="Cobrar via WhatsApp"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenBaixaCustomer(cust)}
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm shadow-emerald-900/30"
                              title="Dar Baixa na Mensalidade"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEditCustomer(cust)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#091124] text-blue-400 hover:text-blue-300 border border-[#1b2b4f] hover:border-blue-500/40 text-xs font-semibold transition-colors cursor-pointer"
                              title="Editar dados deste assinante"
                            >
                              <Pencil className="w-3.5 h-3.5 text-blue-400" />
                              <span>Editar</span>
                            </button>
                            <button
                              onClick={() => setCustomerToDelete(cust)}
                              className="p-1.5 rounded-lg bg-[#091124] text-slate-400 hover:text-rose-400 border border-[#1b2b4f] hover:border-rose-500/30 transition-colors cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PLANOS */}
      {activeSubTab === 'plans' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans
            .filter((p) => (p.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()))
            .map((plan) => (
              <div
                key={plan.id}
                className="p-5 bg-[#0f1b38] border border-[#1e2f57] rounded-2xl flex flex-col justify-between hover:border-purple-500/40 transition-all shadow-xl space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {CYCLE_LABELS[plan.billing_cycle] || plan.billing_cycle}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Editar plano"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPlanToDelete(plan)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Excluir plano"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{plan.description}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#1b2b4f] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                      Valor
                    </span>
                    <span className="text-lg font-black text-white font-mono">
                      {formatMoney(plan.price)}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 font-medium">
                    Cobrança {(CYCLE_LABELS[plan.billing_cycle] || plan.billing_cycle || '').toLowerCase()}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* SUBTAB 3: VENDAS / FATURAS */}
      {activeSubTab === 'sales' && (
        <div className="bg-[#0f1b38] border border-[#1e2f57] rounded-2xl overflow-hidden shadow-xl p-3 sm:p-0">
          {/* Mobile View: Cards */}
          <div className="md:hidden space-y-3">
            {sales
              .filter((s) => {
                const custName = (s.customer_name || '').toLowerCase();
                const planName = (s.plan_name || '').toLowerCase();
                const term = (searchTerm || '').toLowerCase();
                return custName.includes(term) || planName.includes(term);
              })
              .map((sale) => {
                const isPaid = sale.status === 'paid';
                return (
                  <div
                    key={sale.id}
                    className="p-3.5 rounded-xl bg-[#091124] border border-[#1b2b4f] space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">{sale.customer_name || 'Cliente'}</div>
                        <div className="text-[11px] text-purple-300 font-medium truncate">{sale.plan_name || 'Plano'}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          isPaid
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {isPaid ? 'Pago' : 'Pendente'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1b2b4f]/60">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Valor:</span>
                        <span className="font-mono font-black text-white text-base">
                          {formatMoney(sale.amount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Vencimento:</span>
                        <span className="font-mono text-slate-300 font-medium">
                          {sale.due_date ? new Date(sale.due_date.includes('T') ? sale.due_date : sale.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#1b2b4f]/60">
                      <button
                        onClick={() => handleSendWhatsApp(sale)}
                        className="py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Cobrar</span>
                      </button>

                      <button
                        onClick={() => handleCopyPix(sale.id, sale.amount, sale.plan_name)}
                        className="py-2 rounded-lg bg-[#121f3f] text-slate-200 hover:text-white border border-[#1b2b4f] text-xs font-bold flex items-center justify-center gap-1 transition-all"
                      >
                        {copiedPixId === sale.id ? (
                          <Check className="w-3.5 h-3.5 text-purple-400" />
                        ) : (
                          <QrCode className="w-3.5 h-3.5" />
                        )}
                        <span>PIX</span>
                      </button>

                      {!isPaid ? (
                        <button
                          onClick={() => handleMarkSaleAsPaid(sale.id)}
                          className="py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-black flex items-center justify-center gap-1 transition-all shadow-md"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Baixar</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setSaleToDelete(sale)}
                          className="py-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#091124] border-b border-[#1b2b4f] text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172547]">
                {sales
                  .filter((s) => {
                    const custName = (s.customer_name || '').toLowerCase();
                    const planName = (s.plan_name || '').toLowerCase();
                    const term = (searchTerm || '').toLowerCase();
                    return custName.includes(term) || planName.includes(term);
                  })
                  .map((sale) => {
                    const isPaid = sale.status === 'paid';
                    return (
                      <tr key={sale.id} className="hover:bg-[#121f3f]/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div>{sale.customer_name || 'Cliente'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{sale.whatsapp || '—'}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-purple-300">{sale.plan_name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-200">
                          {new Date(sale.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          {formatMoney(sale.amount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isPaid
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {isPaid ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSendWhatsApp(sale)}
                              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                              title="Cobrar via WhatsApp"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyPix(sale.id, sale.amount, sale.plan_name)}
                              className="p-1.5 rounded-lg bg-[#091124] text-slate-200 hover:text-white border border-[#1b2b4f] transition-colors cursor-pointer"
                              title="Copiar PIX"
                            >
                              {copiedPixId === sale.id ? (
                                <Check className="w-3.5 h-3.5 text-purple-400" />
                              ) : (
                                <QrCode className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {!isPaid && (
                              <button
                                onClick={() => handleMarkSaleAsPaid(sale.id)}
                                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors cursor-pointer"
                                title="Confirmar Baixa"
                              >
                                Baixar
                              </button>
                            )}
                            <button
                              onClick={() => setSaleToDelete(sale)}
                              className="p-1.5 rounded-lg bg-[#091124] text-slate-400 hover:text-rose-400 border border-[#1b2b4f] hover:border-rose-500/30 transition-colors cursor-pointer"
                              title="Excluir venda"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Customer Form */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
            <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingCustomer ? 'Editar Assinante' : 'Novo Assinante'}
                  </h2>
                  <p className="text-xs text-slate-400">Dados do cliente e plano vinculado</p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 overflow-y-auto space-y-4 text-xs">
              {customerFormError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{customerFormError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="Ex: João Ferreira"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  WhatsApp com DDD *
                </label>
                <input
                  type="text"
                  required
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Plano de Assinatura
                  </label>
                  <select
                    value={custPlan}
                    onChange={(e) => {
                      const selected = plans.find((p) => p.name === e.target.value);
                      setCustPlan(e.target.value);
                      if (selected) {
                        setCustPrice(selected.price.toFixed(2).replace('.', ','));
                        setCustCycle(selected.billing_cycle);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-purple-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} - {formatMoney(p.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Valor Cobrado (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={custPrice}
                    onChange={(e) => setCustPrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Ciclo de Renovação
                  </label>
                  <select
                    value={custCycle}
                    onChange={(e) => setCustCycle(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-purple-500"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="semiannual">Semestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Próximo Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={custNextDue}
                    onChange={(e) => setCustNextDue(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Status da Assinatura
                </label>
                <select
                  value={custStatus}
                  onChange={(e) => setCustStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-purple-500"
                >
                  <option value="active">Ativa (Em dia)</option>
                  <option value="overdue">Atrasada / Vencida</option>
                  <option value="cancelled">Cancelada / Inativa</option>
                </select>
              </div>

              {!editingCustomer && (
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-purple-400" />
                        <span>Dar baixa na 1ª mensalidade agora?</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Marca a primeira fatura como paga e liquidada imediatamente
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={custMarkAsPaid}
                        onChange={(e) => setCustMarkAsPaid(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {custMarkAsPaid && (
                    <div className="pt-2.5 border-t border-slate-800/80 animate-in fade-in duration-200">
                      <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                        Forma de Pagamento
                      </label>
                      <select
                        value={custPaymentMethod}
                        onChange={(e) => setCustPaymentMethod(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                      >
                        <option value="pix">PIX</option>
                        <option value="cash">Dinheiro em Espécie</option>
                        <option value="credit_card">Cartão de Crédito</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-purple-900/50 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingCustomer ? 'Salvando...' : (editingCustomer ? 'Salvar Alterações' : 'Cadastrar Assinante')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Plan Form */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-md my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
            <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {editingPlan ? 'Editar Plano' : 'Novo Plano de Assinatura'}
                  </h2>
                  <p className="text-xs text-slate-400">Configure valor e período de faturamento</p>
                </div>
              </div>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-4 text-xs">
              {planFormError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{planFormError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Nome do Plano *
                </label>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Ex: Plano Mensal VIP"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Ciclo de Cobrança
                  </label>
                  <select
                    value={planCycle}
                    onChange={(e) => setPlanCycle(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-purple-500"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="semiannual">Semestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Valor (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Descrição dos Benefícios
                </label>
                <textarea
                  rows={2}
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  placeholder="O que está incluso neste plano..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlan}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-purple-900/50 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingPlan ? 'Salvando...' : (editingPlan ? 'Salvar Alterações' : 'Criar Plano')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Sale Form */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-md my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)]">
            <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Lançar Fatura de Assinatura</h2>
                  <p className="text-xs text-slate-400">Emita uma cobrança avulsa ou mensalidade</p>
                </div>
              </div>
              <button
                onClick={() => setIsSaleModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSale} className="p-6 space-y-4 text-xs">
              {saleFormError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{saleFormError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Assinante / Cliente *
                </label>
                {customers.length > 0 ? (
                  <select
                    value={saleCustId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setSaleCustId(selectedId);
                      const found = customers.find((c) => c.id === selectedId);
                      if (found) {
                        setSaleCustName(found.customer_name);
                        setSaleCustPhone(found.whatsapp);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name} {c.whatsapp ? `(${c.whatsapp})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
                    Nenhum assinante cadastrado. Cadastre um assinante antes de lançar uma fatura.
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Plano de Assinatura *
                </label>
                {plans.length > 0 ? (
                  <select
                    value={salePlanId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setSalePlanId(selectedId);
                      const found = plans.find((p) => p.id === selectedId);
                      if (found) {
                        setSalePlanName(found.name);
                        setSaleAmount(found.price.toFixed(2).replace('.', ','));
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {formatMoney(p.price)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs">
                    Nenhum plano cadastrado. Cadastre um plano antes de lançar uma fatura.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Valor (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={saleDueDate}
                    onChange={(e) => setSaleDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSaleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSale || customers.length === 0 || plans.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-purple-900/50 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingSale ? 'Gerando...' : 'Gerar Venda'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Dar Baixa na Mensalidade do Assinante */}
      {customerToBaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]">
            {/* Header fixo */}
            <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Dar Baixa na Mensalidade</h2>
                  <p className="text-xs text-slate-400">Confirmar recebimento e atualizar vencimento</p>
                </div>
              </div>
              <button
                onClick={() => setCustomerToBaixa(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com barra de rolagem e layout otimizado */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
              {baixaError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{baixaError}</span>
                </div>
              )}

              {/* Informações do Assinante (Grade 2x2) */}
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Assinante</span>
                  <span className="font-bold text-white text-sm truncate block">{customerToBaixa.customer_name}</span>
                  {customerToBaixa.whatsapp && (
                    <span className="text-[11px] font-mono text-slate-400 block">{customerToBaixa.whatsapp}</span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Plano Contratado</span>
                  <span className="font-semibold text-purple-300 block">{customerToBaixa.plan_name}</span>
                  <span className="text-[11px] text-slate-400 block">
                    Ciclo {CYCLE_LABELS[customerToBaixa.billing_cycle] || customerToBaixa.billing_cycle}
                  </span>
                </div>
                <div className="sm:col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Vencimento Atual:</span>
                  <span className="font-mono text-amber-300 font-bold text-xs bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    {new Date(customerToBaixa.next_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Valor, Forma e Data de Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Valor Pago (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={baixaAmount}
                    onChange={(e) => setBaixaAmount(e.target.value)}
                    placeholder="25,00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Forma Pagto *
                  </label>
                  <select
                    value={baixaPaymentMethod}
                    onChange={(e) => setBaixaPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="pix">PIX</option>
                    <option value="cash">Dinheiro</option>
                    <option value="credit_card">Cartão</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                    Data Pagto *
                  </label>
                  <input
                    type="date"
                    required
                    value={baixaPaymentDate}
                    onChange={(e) => setBaixaPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Opção de Prorrogar Vencimento */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-1.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={baixaAdvanceDueDate}
                    onChange={(e) => setBaixaAdvanceDueDate(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-emerald-200 block">
                      Avançar para o próximo ciclo de vencimento
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Novo vencimento:{' '}
                      <strong className="text-emerald-400 font-mono">
                        {baixaAdvanceDueDate
                          ? new Date(
                              calculateNextDueDate(
                                customerToBaixa.next_due_date,
                                customerToBaixa.billing_cycle
                              ) + 'T12:00:00'
                            ).toLocaleDateString('pt-BR')
                          : new Date(customerToBaixa.next_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </strong>
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer Fixo: Botões SEMPRE visíveis */}
            <div className="shrink-0 p-3.5 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-end gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setCustomerToBaixa(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBaixaCustomer}
                disabled={isProcessingBaixa}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-900/50 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isProcessingBaixa ? 'Processando...' : 'Confirmar Baixa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CUSTOMER CONFIRMATION MODAL */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Excluir Assinante?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deseja remover <strong className="text-white">{customerToDelete.customer_name}</strong>?
              </p>
            </div>
            {deleteCustomerError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 text-left flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteCustomerError}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingCustomer}
                onClick={() => setCustomerToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingCustomer}
                onClick={handleDeleteCustomerConfirm}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                {isDeletingCustomer ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PLAN CONFIRMATION MODAL */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Excluir Plano?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deseja realmente remover o plano <strong className="text-white">{planToDelete.name}</strong>?
              </p>
            </div>
            {deletePlanError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 text-left flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deletePlanError}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingPlan}
                onClick={() => setPlanToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingPlan}
                onClick={handleDeletePlanConfirm}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                {isDeletingPlan ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SALE CONFIRMATION MODAL */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Excluir Venda?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deseja realmente remover a venda de <strong className="text-white">{saleToDelete.customer_name}</strong> no valor de <strong className="text-white font-mono">{formatMoney(saleToDelete.amount)}</strong>?
              </p>
            </div>
            {deleteSaleError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 text-left flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteSaleError}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingSale}
                onClick={() => setSaleToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingSale}
                onClick={handleDeleteSaleConfirm}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                {isDeletingSale ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
