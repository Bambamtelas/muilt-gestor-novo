import React, { useState, useEffect } from 'react';
import {
  HandCoins,
  Plus,
  Search,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Phone,
  ArrowUpRight,
  TrendingUp,
  Percent,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  FileText,
  Repeat,
  Pencil,
} from 'lucide-react';
import { Tenant } from '../types/index.js';
import { api } from '../lib/api.js';
import { useSupabaseRealtime } from '../hooks/useSupabaseRealtime.js';
import {
  loadLoansFromSupabase,
  saveLoanToSupabase,
  updateLoanInSupabase,
  toggleInstallmentPaidInSupabase,
  deleteLoanFromSupabase,
} from '../lib/supabaseLoans.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';

// Authentic WhatsApp SVG Icon
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

export interface LoanInstallment {
  id: string;
  number: number;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string;
  paidAmount?: number;
}

export type PaymentMethod = 'pix' | 'credit_card' | 'cash';

export interface Loan {
  id: string;
  tenantId: string;
  customerName: string;
  customerPhone: string;
  description: string; // Descrição da cobrança
  principalAmount: number; // Valor principal ou total
  dueDate: string; // Data de vencimento
  isRecurringOrInstallment: boolean;
  billingType: 'single' | 'installment' | 'recurring';
  installmentsCount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  paymentMethod: PaymentMethod;
  instructions: string; // Instruções ou observações
  status: 'active' | 'completed' | 'overdue';
  createdAt: string;
  totalToReceive: number;
  installments: LoanInstallment[];
}

interface LoansViewProps {
  tenant: Tenant;
}

export const LoansView: React.FC<LoansViewProps> = ({ tenant }) => {
  const tenantId = tenant.id || 'tenant-default';
  const storageKey = `loans_${tenantId}`;

  // Estado em memória (cache/interface) inicializado com cache do localStorage para carregamento instantâneo
  const [loans, setLoans] = useState<Loan[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [savingInstallmentId, setSavingInstallmentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Consulta oficial do Supabase PostgreSQL (Fonte da Verdade)
  const loadDataFromSupabase = async (showLoadingSpinner = false) => {
    if (!tenantId) return;
    try {
      if (showLoadingSpinner) setLoading(true);

      if (isSupabaseConfigured) {
        const remoteLoans = await loadLoansFromSupabase(tenantId);
        setLoans(remoteLoans);
        localStorage.setItem(storageKey, JSON.stringify(remoteLoans));
      } else {
        const remoteLoans = await api.getLoans(tenantId);
        if (Array.isArray(remoteLoans) && remoteLoans.length > 0) {
          setLoans(remoteLoans);
          localStorage.setItem(storageKey, JSON.stringify(remoteLoans));
        }
      }
    } catch (err: any) {
      console.warn('[LoansView] Erro ao sincronizar com Supabase:', err?.message || err);
      // Fallback para cache local caso esteja offline
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const localParsed = JSON.parse(saved);
          if (Array.isArray(localParsed)) setLoans(localParsed);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  // Canal Realtime para receber alterações disparadas por outros dispositivos conectados
  const { broadcastChange } = useSupabaseRealtime<Loan>({
    table: 'loans',
    tenantId,
    onInsert: (newLoan) => {
      setLoans((prev) => {
        if (prev.some((l) => l.id === newLoan.id)) return prev;
        const next = [newLoan, ...prev];
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    onUpdate: (updatedLoan) => {
      setLoans((prev) => {
        const next = prev.map((l) => (l.id === updatedLoan.id ? updatedLoan : l));
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    onDelete: (deletedId) => {
      setLoans((prev) => {
        const next = prev.filter((l) => l.id !== deletedId);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    onSyncNeeded: () => {
      loadDataFromSupabase(false);
    },
  });

  // Carrega ao montar e sincroniza com o banco sempre que o usuário retornar à aba/dispositivo
  useEffect(() => {
    loadDataFromSupabase(loans.length === 0);

    const handleFocus = () => {
      loadDataFromSupabase(false);
    };
    const handleVisibility = () => {
      if (!document.hidden) {
        loadDataFromSupabase(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    // Polling de segurança de 45 segundos para garantir sincronização entre abas/dispositivos
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadDataFromSupabase(false);
      }
    }, 45000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [tenantId, storageKey]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'received' | 'open' | 'active' | 'completed' | 'overdue' | 'due_today'>('all');
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  // Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('150.00');
  const [dueDate, setDueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isRecurringOrInstallment, setIsRecurringOrInstallment] = useState(false);
  const [billingType, setBillingType] = useState<'installment' | 'recurring'>('installment');
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [instructions, setInstructions] = useState('');
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const numAmount = parseFloat(amount.replace(',', '.')) || 0;

  const handleOpenCreate = () => {
    setEditingLoanId(null);
    setCustomerName('');
    setCustomerPhone('');
    setDescription('');
    setAmount('150.00');
    setDueDate(new Date().toISOString().split('T')[0]);
    setIsRecurringOrInstallment(false);
    setBillingType('installment');
    setInstallmentsCount(3);
    setFrequency('monthly');
    setPaymentMethod('pix');
    setInstructions('');
    setIsNewModalOpen(true);
  };

  const handleOpenEdit = (loan: Loan) => {
    setEditingLoanId(loan.id);
    setCustomerName(loan.customerName || '');
    setCustomerPhone(loan.customerPhone || '');
    setDescription(loan.description || (loan as any).guaranteeNote || 'Empréstimo Pessoal');
    setAmount(loan.principalAmount != null ? String(loan.principalAmount) : '150.00');
    setDueDate(loan.dueDate || (loan as any).firstDueDate || new Date().toISOString().split('T')[0]);
    setIsRecurringOrInstallment(Boolean(loan.isRecurringOrInstallment));
    setBillingType(loan.billingType === 'single' ? 'installment' : (loan.billingType || 'installment'));
    setInstallmentsCount(loan.installmentsCount || 1);
    setFrequency(loan.frequency || 'monthly');
    setPaymentMethod(loan.paymentMethod || 'pix');
    setInstructions(loan.instructions || (loan as any).guaranteeNote || '');
    setIsNewModalOpen(true);
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !description.trim() || numAmount <= 0) return;

    const generatedInstallments: LoanInstallment[] = [];
    const baseDate = new Date(dueDate + 'T12:00:00');

    if (isRecurringOrInstallment && billingType === 'installment') {
      const perInstallment = Number((numAmount / installmentsCount).toFixed(2));
      for (let i = 1; i <= installmentsCount; i++) {
        const instDate = new Date(baseDate);
        if (frequency === 'monthly') {
          instDate.setMonth(baseDate.getMonth() + (i - 1));
        } else if (frequency === 'biweekly') {
          instDate.setDate(baseDate.getDate() + (i - 1) * 15);
        } else if (frequency === 'weekly') {
          instDate.setDate(baseDate.getDate() + (i - 1) * 7);
        } else if (frequency === 'daily') {
          instDate.setDate(baseDate.getDate() + (i - 1));
        }

        generatedInstallments.push({
          id: `inst-${Date.now()}-${i}`,
          number: i,
          dueDate: instDate.toISOString().split('T')[0],
          amount: perInstallment,
          status: 'pending',
        });
      }
    } else {
      // Single charge or recurring base installment
      generatedInstallments.push({
        id: `inst-${Date.now()}-1`,
        number: 1,
        dueDate,
        amount: numAmount,
        status: 'pending',
      });
    }

    if (editingLoanId) {
      let targetLoan: Loan | null = null;
      const currentToEdit = loans.find((l) => l.id === editingLoanId);

      const updated: Loan = {
        id: editingLoanId,
        tenantId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        description: description.trim(),
        principalAmount: numAmount,
        dueDate,
        isRecurringOrInstallment,
        billingType: (isRecurringOrInstallment ? billingType : 'single') as 'installment' | 'recurring' | 'single',
        installmentsCount:
          isRecurringOrInstallment && billingType === 'installment'
            ? installmentsCount
            : 1,
        frequency,
        paymentMethod,
        instructions: instructions.trim(),
        status: currentToEdit?.status || 'active',
        createdAt: currentToEdit?.createdAt || new Date().toISOString(),
        totalToReceive: numAmount,
        installments: generatedInstallments,
      };

      try {
        if (isSupabaseConfigured) {
          targetLoan = await updateLoanInSupabase(tenantId, editingLoanId, updated);
        } else {
          targetLoan = updated;
        }

        const updatedList = loans.map((l) => (l.id === editingLoanId ? targetLoan! : l));
        setLoans(updatedList);
        localStorage.setItem(storageKey, JSON.stringify(updatedList));

        broadcastChange('update', targetLoan);
        api.updateLoan(editingLoanId, targetLoan).catch(() => {});
        api.syncLoans(tenantId, updatedList).catch(() => {});
        setEditingLoanId(null);
        setToastMessage('Empréstimo atualizado com sucesso!');
        setTimeout(() => setToastMessage(null), 3000);
      } catch (err: any) {
        console.error('[Editar Empréstimo] Erro:', err);
        setToastMessage('Não foi possível sincronizar com o servidor. Verifique sua conexão e tente novamente.');
        setTimeout(() => setToastMessage(null), 4500);
        return;
      }
    } else {
      const newLoan: Loan = {
        id: `loan-${Date.now()}`,
        tenantId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        description: description.trim(),
        principalAmount: numAmount,
        dueDate,
        isRecurringOrInstallment,
        billingType: (isRecurringOrInstallment ? billingType : 'single') as 'installment' | 'recurring' | 'single',
        installmentsCount:
          isRecurringOrInstallment && billingType === 'installment'
            ? installmentsCount
            : 1,
        frequency,
        paymentMethod,
        instructions: instructions.trim(),
        status: 'active',
        createdAt: new Date().toISOString(),
        totalToReceive: numAmount,
        installments: generatedInstallments,
      };

      try {
        let savedLoan = newLoan;
        if (isSupabaseConfigured) {
          savedLoan = await saveLoanToSupabase(tenantId, newLoan);
        }

        const updatedList = [savedLoan, ...loans];
        setLoans(updatedList);
        localStorage.setItem(storageKey, JSON.stringify(updatedList));

        broadcastChange('insert', savedLoan);
        api.createLoan(savedLoan).catch(() => {});
        api.syncLoans(tenantId, updatedList).catch(() => {});

        // Registra como cliente no sistema para aparecer na aba Clientes
        if (customerName.trim()) {
          api
            .createCustomer({
              tenant_id: tenantId,
              name: customerName.trim(),
              whatsapp: customerPhone.trim() || undefined,
            })
            .catch(() => {});
        }
        setToastMessage('Empréstimo criado com sucesso!');
        setTimeout(() => setToastMessage(null), 3000);
      } catch (err: any) {
        console.error('[Novo Empréstimo] Erro:', err);
        setToastMessage('Não foi possível sincronizar com o servidor. Verifique sua conexão e tente novamente.');
        setTimeout(() => setToastMessage(null), 4500);
        return;
      }
    }

    setIsNewModalOpen(false);

    // Reset Form
    setCustomerName('');
    setCustomerPhone('');
    setDescription('');
    setAmount('150.00');
    setIsRecurringOrInstallment(false);
    setInstallmentsCount(3);
    setInstructions('');
  };

  const handleToggleInstallmentPaid = async (loanId: string, installmentId: string) => {
    const currentLoan = loans.find((l) => l.id === loanId);
    if (!currentLoan) return;

    setSavingInstallmentId(installmentId);

    try {
      if (isSupabaseConfigured) {
        // 1. UPDATE atômico direto no Supabase PostgreSQL (Fonte Oficial)
        const { updatedLoan, wasPaid: nextIsPaid } = await toggleInstallmentPaidInSupabase(
          tenantId,
          currentLoan,
          installmentId
        );

        // 2. Atualiza estado React com a resposta confirmada do Supabase
        setLoans((prev) => {
          const next = prev.map((l) => (l.id === loanId ? updatedLoan : l));
          localStorage.setItem(storageKey, JSON.stringify(next));
          return next;
        });

        // 3. Notifica instantaneamente os demais dispositivos conectados via Supabase Realtime Broadcast
        broadcastChange('update', updatedLoan);

        // 4. Sincronização em segundo plano para Express
        api.updateLoan(loanId, updatedLoan).catch(() => {});

        // 5. Feedback visual de sucesso
        setToastMessage(nextIsPaid ? 'Parcela baixada com sucesso!' : 'Baixa desfeita com sucesso!');
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        // Fallback local caso Supabase não esteja configurado
        let targetUpdatedLoan: Loan | null = null;
        const updatedLoans = loans.map((loan) => {
          if (loan.id !== loanId) return loan;

          const updatedInstallments = loan.installments.map((inst) => {
            if (inst.id !== installmentId) return inst;
            const isCurrentlyPaid = inst.status === 'paid';
            return {
              ...inst,
              status: isCurrentlyPaid ? ('pending' as const) : ('paid' as const),
              paidAt: isCurrentlyPaid ? undefined : new Date().toISOString(),
              paidAmount: isCurrentlyPaid ? undefined : inst.amount,
            };
          });

          const allPaid = updatedInstallments.every((i) => i.status === 'paid');
          const updated = {
            ...loan,
            installments: updatedInstallments,
            status: (allPaid ? 'completed' : 'active') as 'completed' | 'active',
          };
          targetUpdatedLoan = updated;
          return updated;
        });

        setLoans(updatedLoans);
        localStorage.setItem(storageKey, JSON.stringify(updatedLoans));
        if (targetUpdatedLoan) {
          api.updateLoan(loanId, targetUpdatedLoan).catch(() => {});
          api.syncLoans(tenantId, updatedLoans).catch(() => {});
        }
      }
    } catch (err: any) {
      console.error('[Dar Baixa] Erro ao sincronizar com servidor Supabase:', err);
      // Não marca como PAGO na interface em caso de falha; exibe mensagem clara
      setToastMessage('Não foi possível sincronizar com o servidor. Verifique sua conexão e tente novamente.');
      setTimeout(() => setToastMessage(null), 4500);
    } finally {
      setSavingInstallmentId(null);
    }
  };

  const handleDeleteLoan = (loan: Loan) => {
    setLoanToDelete(loan);
  };

  const handleSendWhatsApp = async (loan: Loan, installment?: LoanInstallment) => {
    const rawPhone = loan.customerPhone.replace(/\D/g, '');
    if (!rawPhone) {
      setToastMessage('Telefone do cliente não cadastrado!');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const phone = rawPhone.length <= 11 && !rawPhone.startsWith('55') ? `55${rawPhone}` : rawPhone;

    const pixKey = tenant.pix_key || 'Chave PIX a combinar';
    let paymentText = '';
    if (loan.paymentMethod === 'pix') {
      paymentText = `🔑 *Forma de Pagamento:* PIX\n📌 *Chave PIX:* ${pixKey}`;
    } else if (loan.paymentMethod === 'credit_card') {
      paymentText = `💳 *Forma de Pagamento:* Cartão de Crédito`;
    } else {
      paymentText = `💵 *Forma de Pagamento:* Dinheiro em Espécie`;
    }

    let message = '';
    if (installment) {
      message = `Olá, *${loan.customerName}*!\n\nLembramos sobre a sua cobrança referente a *${loan.description}*:\n\n` +
        `📦 *Parcela:* ${installment.number}/${loan.installmentsCount}\n` +
        `💰 *Valor:* R$ ${installment.amount.toFixed(2).replace('.', ',')}\n` +
        `📅 *Vencimento:* ${new Date(installment.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}\n` +
        `${paymentText}\n\n` +
        (loan.instructions ? `ℹ️ *Observações:* ${loan.instructions}\n\n` : '') +
        `Assim que efetuar o pagamento, por favor nos envie o comprovante. Obrigado!`;
    } else {
      message = `Olá, *${loan.customerName}*!\n\nSegue o resumo da sua cobrança referente a *${loan.description}*:\n\n` +
        `💰 *Valor Total:* R$ ${loan.principalAmount.toFixed(2).replace('.', ',')}\n` +
        `📅 *Vencimento:* ${new Date(loan.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}\n` +
        `${paymentText}\n\n` +
        (loan.instructions ? `ℹ️ *Observações:* ${loan.instructions}\n\n` : '') +
        `Qualquer dúvida estamos à disposição!`;
    }

    const encoded = encodeURIComponent(message);
    const waDirectUrl = `https://wa.me/${phone}?text=${encoded}`;

    try {
      setToastMessage(`Enviando cobrança para ${loan.customerName} pelo seu WhatsApp conectado...`);
      const res = await api.sendDirectWhatsApp({
        tenantId: tenant.id,
        phone,
        message,
        customerName: loan.customerName,
        description: `Cobrança de Empréstimo: ${loan.description}${installment ? ` (Parcela ${installment.number})` : ''}`,
      });

      if (res.success && (res.method === 'evolution_api' || (res as any).sentDirectly)) {
        setToastMessage(`✅ Cobrança enviada com sucesso para ${loan.customerName} direto pelo WhatsApp do seu aparelho!`);
        setTimeout(() => setToastMessage(null), 5000);
        return;
      }

      window.open(waDirectUrl, '_blank');
      setToastMessage(`🚀 Instância não conectada. Conversa aberta no WhatsApp Web / App para ${loan.customerName}!`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.warn('[LoansView] Erro ao enviar direto:', err);
      window.open(waDirectUrl, '_blank');
      setToastMessage(`🚀 Conversa aberta no WhatsApp Web / App para ${loan.customerName}!`);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = now.toISOString().slice(0, 7);
  const currentMonthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Extrato de Pagamentos Recebidos
  interface ReceivedPaymentItem {
    loanId: string;
    installmentId: string;
    customerName: string;
    customerPhone: string;
    loanDescription: string;
    installmentNumber: number;
    totalInstallments: number;
    billingType: 'single' | 'installment' | 'recurring';
    amount: number;
    paidAt: string;
    dueDate: string;
    paymentMethod: PaymentMethod;
  }

  const allReceivedPayments: ReceivedPaymentItem[] = loans.flatMap((loan) =>
    loan.installments
      .filter((inst) => inst.status === 'paid')
      .map((inst) => ({
        loanId: loan.id,
        installmentId: inst.id,
        customerName: loan.customerName,
        customerPhone: loan.customerPhone,
        loanDescription: loan.description,
        installmentNumber: inst.number,
        totalInstallments: loan.installmentsCount || loan.installments.length || 1,
        billingType: loan.billingType,
        amount: inst.paidAmount || inst.amount,
        paidAt: inst.paidAt || loan.createdAt || new Date().toISOString(),
        dueDate: inst.dueDate,
        paymentMethod: loan.paymentMethod,
      }))
  ).sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  const receivedToday = allReceivedPayments
    .filter((p) => p.paidAt.slice(0, 10) === todayStr)
    .reduce((sum, p) => sum + p.amount, 0);

  const receivedTodayCount = allReceivedPayments.filter((p) => p.paidAt.slice(0, 10) === todayStr).length;

  const receivedThisMonth = allReceivedPayments
    .filter((p) => p.paidAt.slice(0, 7) === currentMonthStr)
    .reduce((sum, p) => sum + p.amount, 0);

  const receivedThisMonthCount = allReceivedPayments.filter((p) => p.paidAt.slice(0, 7) === currentMonthStr).length;

  const openLoans = loans.filter((l) => l.installments.some((i) => i.status !== 'paid'));

  // WhatsApp receipt for a paid item
  const handleSendReceiptWhatsApp = async (payment: ReceivedPaymentItem) => {
    const rawPhone = payment.customerPhone.replace(/\D/g, '');
    if (!rawPhone) {
      setToastMessage('Telefone do cliente não cadastrado!');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const phone = rawPhone.length <= 11 && !rawPhone.startsWith('55') ? `55${rawPhone}` : rawPhone;

    const parcelText =
      payment.totalInstallments > 1
        ? `Parcela ${payment.installmentNumber}/${payment.totalInstallments}`
        : 'Pagamento Único / Quitado';

    const message =
      `🧾 *COMPROVANTE DE PAGAMENTO RECEBIDO*\n\n` +
      `Olá, *${payment.customerName}*!\n` +
      `Confirmamos o recebimento do seu pagamento referente a *${payment.loanDescription}*:\n\n` +
      `📦 *Item:* ${parcelText}\n` +
      `💰 *Valor Pago:* R$ ${payment.amount.toFixed(2).replace('.', ',')}\n` +
      `📅 *Data do Recebimento:* ${new Date(payment.paidAt).toLocaleDateString('pt-BR')}\n` +
      `✅ *Status:* Quitado com sucesso\n\n` +
      `Agradecemos pela pontualidade!`;

    const encoded = encodeURIComponent(message);
    const waDirectUrl = `https://wa.me/${phone}?text=${encoded}`;

    try {
      setToastMessage(`Enviando comprovante para ${payment.customerName} pelo WhatsApp conectado...`);
      const res = await api.sendDirectWhatsApp({
        tenantId: tenant.id,
        phone,
        message,
        customerName: payment.customerName,
        description: `Comprovante: ${payment.loanDescription}`,
      });

      if (res.success && (res.method === 'evolution_api' || (res as any).sentDirectly)) {
        setToastMessage(`✅ Comprovante enviado com sucesso para ${payment.customerName} direto pelo WhatsApp!`);
        setTimeout(() => setToastMessage(null), 5000);
        return;
      }

      setToastMessage(`⚠️ Não foi possível disparar comprovante: ${(res as any)?.error || 'Instância desconectada'}.`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.warn('[LoansView] Erro ao enviar comprovante direto:', err);
      setToastMessage(`❌ Erro ao enviar comprovante: ${err?.message || 'Falha na requisição'}`);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Metrics
  const totalLent = loans.reduce((acc, l) => acc + l.principalAmount, 0);
  const totalReceived = loans.reduce((acc, l) => {
    return (
      acc +
      l.installments
        .filter((i) => i.status === 'paid')
        .reduce((sum, inst) => sum + (inst.paidAmount || inst.amount), 0)
    );
  }, 0);

  const totalOverdue = loans.reduce((acc, l) => {
    return (
      acc +
      l.installments
        .filter((i) => i.status !== 'paid' && i.dueDate.slice(0, 10) < todayStr)
        .reduce((sum, inst) => sum + inst.amount, 0)
    );
  }, 0);

  // Vencendo Hoje: contratos com parcelas pendentes com data de hoje
  const loansDueToday = loans.filter((loan) => {
    if (loan.status === 'completed') return false;
    const hasUnpaidInstDueToday = loan.installments.some(
      (i) => i.status !== 'paid' && i.dueDate.slice(0, 10) === todayStr
    );
    const isSingleDueToday =
      (!loan.installments || loan.installments.length === 0) &&
      (loan.dueDate || '').slice(0, 10) === todayStr;
    return hasUnpaidInstDueToday || isSingleDueToday;
  });

  const totalDueToday = loans.reduce((acc, loan) => {
    if (loan.status === 'completed') return acc;
    const todayInsts = loan.installments.filter(
      (i) => i.status !== 'paid' && i.dueDate.slice(0, 10) === todayStr
    );
    if (todayInsts.length > 0) {
      return acc + todayInsts.reduce((sum, inst) => sum + inst.amount, 0);
    }
    if ((!loan.installments || loan.installments.length === 0) && (loan.dueDate || '').slice(0, 10) === todayStr) {
      return acc + (loan.principalAmount || 0);
    }
    return acc;
  }, 0);

  // Filtered loans
  const filteredLoans = loans.filter((loan) => {
    const matchesSearch =
      loan.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.customerPhone.includes(searchTerm) ||
      loan.description.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'due_today') {
      if (loan.status === 'completed') return false;
      const hasUnpaidInstDueToday = loan.installments.some(
        (i) => i.status !== 'paid' && i.dueDate.slice(0, 10) === todayStr
      );
      const isSingleDueToday =
        (!loan.installments || loan.installments.length === 0) &&
        (loan.dueDate || '').slice(0, 10) === todayStr;
      return hasUnpaidInstDueToday || isSingleDueToday;
    }
    if (filterStatus === 'open' || filterStatus === 'active') {
      return loan.installments.some((i) => i.status !== 'paid');
    }
    if (filterStatus === 'completed') return loan.status === 'completed';
    if (filterStatus === 'overdue') {
      return loan.installments.some((i) => i.status !== 'paid' && i.dueDate.slice(0, 10) < todayStr);
    }

    return true;
  });

  const filteredReceivedPayments = allReceivedPayments.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.customerName.toLowerCase().includes(term) ||
      p.customerPhone.includes(term) ||
      p.loanDescription.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#0d231d] via-[#091f1a] to-[#081714] border border-emerald-500/30 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 border border-emerald-400/40">
            <HandCoins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">Empréstimos &amp; Cobranças</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Controle direto de cobranças, empréstimos, parcelas e avisos no WhatsApp
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/40 text-xs transition-all hover:scale-102 cursor-pointer border border-emerald-400/30 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Novo Empréstimo</span>
        </button>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
        {/* CARD 1: SALDO EM ABERTO (Roxo / Lilás #9333ea / #7e22ce) */}
        <div
          onClick={() => setFilterStatus(filterStatus === 'open' ? 'all' : 'open')}
          className={`p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#9333ea] to-[#7e22ce] text-white shadow-xl shadow-purple-950/30 border border-purple-400/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-all cursor-pointer ${
            filterStatus === 'open' ? 'ring-2 ring-white/90 shadow-2xl scale-[1.02]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-purple-100">
              Saldo em Aberto
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
              <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
              R$ {Math.max(0, totalLent - totalReceived).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-[11px] text-purple-100 font-medium">
              <span className="truncate">{openLoans.length} contratos ativos</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>
        </div>

        {/* CARD 2: VENCENDO HOJE (Laranja / Âmbar #f59e0b / #d97706) */}
        <div
          onClick={() => setFilterStatus(filterStatus === 'due_today' ? 'all' : 'due_today')}
          className={`p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white shadow-xl shadow-amber-950/30 border border-amber-400/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-all cursor-pointer ${
            filterStatus === 'due_today' ? 'ring-2 ring-white/90 shadow-2xl scale-[1.02]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-100">
              Vencendo Hoje
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
              R$ {totalDueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-[11px] text-amber-100 font-medium">
              <span className="truncate">{loansDueToday.length} para receber hoje</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>
        </div>

        {/* CARD 3: TOTAL RECEBIDO (Verde #10b981 / #059669) */}
        <div
          onClick={() => setFilterStatus(filterStatus === 'received' ? 'all' : 'received')}
          className={`p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-xl shadow-emerald-950/30 border border-emerald-400/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-all cursor-pointer ${
            filterStatus === 'received' ? 'ring-2 ring-white/90 shadow-2xl scale-[1.02]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-100">
              Total Recebido
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
              R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-[11px] text-emerald-100 font-medium">
              <span className="truncate">Hoje: R$ {receivedToday.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>
        </div>

        {/* CARD 4: PARCELAS VENCIDAS (Vermelho / Rose #f43f5e / #e11d48) */}
        <div
          onClick={() => setFilterStatus(filterStatus === 'overdue' ? 'all' : 'overdue')}
          className={`p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f43f5e] to-[#e11d48] text-white shadow-xl shadow-rose-950/30 border border-rose-400/30 flex flex-col justify-between min-h-[125px] sm:min-h-[140px] relative overflow-hidden group hover:scale-[1.02] transition-all cursor-pointer ${
            filterStatus === 'overdue' ? 'ring-2 ring-white/90 shadow-2xl scale-[1.02]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-rose-100">
              Vencidas
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-inner">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div>
            <div className="text-lg sm:text-3xl font-black tracking-tight text-white font-mono">
              R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-2.5 border-t border-white/20 text-[10px] sm:text-xs text-rose-100 font-medium">
              <span className="truncate">Em atraso</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0b162c]/70 p-3 rounded-2xl border border-[#1a2c54]">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={filterStatus === 'received' ? "Buscar nos pagamentos baixados..." : "Buscar por cliente, telefone ou descrição..."}
            value={searchTerm || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#091224] border border-[#1e305e] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'bg-[#0f1d38] text-slate-400 hover:text-white'
            }`}
          >
            Todos ({loans.length})
          </button>
          <button
            onClick={() => setFilterStatus('due_today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'due_today'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                : 'bg-[#0f1d38] text-amber-400/90 hover:text-amber-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Vencendo Hoje ({loansDueToday.length})</span>
          </button>
          <button
            onClick={() => setFilterStatus('received')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'received'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                : 'bg-[#0f1d38] text-emerald-400/90 hover:text-emerald-300'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Total Recebido ({allReceivedPayments.length})</span>
          </button>
          <button
            onClick={() => setFilterStatus('open')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'open'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                : 'bg-[#0f1d38] text-purple-400/90 hover:text-purple-300'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Saldo em Aberto ({openLoans.length})</span>
          </button>
          <button
            onClick={() => setFilterStatus('overdue')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'overdue'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-900/40'
                : 'bg-[#0f1d38] text-rose-400/90 hover:text-rose-300'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Com Atraso</span>
          </button>
        </div>
      </div>

      {/* SE FILTERSTATUS === 'received': EXIBE O PAINEL E A LISTA DOS PAGAMENTOS RECEBIDOS */}
      {filterStatus === 'received' ? (
        <div className="space-y-4">
          {/* Sub-painel: Recebidos no dia e no mês */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* HOJE */}
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                  Recebido Hoje
                </span>
                <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
                  R$ {receivedToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-emerald-300/80 mt-1">
                  {receivedTodayCount} baixa{receivedTodayCount === 1 ? '' : 's'} hoje
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* MÊS ATUAL */}
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                  Recebido no Mês ({currentMonthName})
                </span>
                <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
                  R$ {receivedThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-emerald-300/80 mt-1">
                  {receivedThisMonthCount} baixa{receivedThisMonthCount === 1 ? '' : 's'} no mês
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            {/* TOTAL GERAL */}
            <div className="p-4 rounded-2xl bg-[#09152b] border border-blue-500/30 flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">
                  Total Geral Baixado
                </span>
                <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
                  R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-blue-300/80 mt-1">
                  {allReceivedPayments.length} baixa{allReceivedPayments.length === 1 ? '' : 's'} registradas
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* TABELA DE PAGAMENTOS RECEBIDOS */}
          <div className="bg-[#0b162c] border border-[#1b2b4f] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#1b2b4f] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Histórico Detalhado de Pagamentos Baixados</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Todas as parcelas e cobranças quitadas (hoje, no mês e anteriores)
                </p>
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                {filteredReceivedPayments.length} pagamento{filteredReceivedPayments.length === 1 ? '' : 's'} listado{filteredReceivedPayments.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#070e21] border-b border-[#1b2b4f] text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Data do Recebimento</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Cobrança / Descrição</th>
                    <th className="py-3 px-4">Parcela / Tipo</th>
                    <th className="py-3 px-4">Forma</th>
                    <th className="py-3 px-4">Valor Baixado</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#152345]">
                  {filteredReceivedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <TrendingUp className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="font-semibold text-sm">Nenhum pagamento baixado encontrado</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Quando uma parcela ou contrato for pago, o registro detalhado aparecerá aqui.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredReceivedPayments.map((payment) => (
                      <tr key={`${payment.loanId}-${payment.installmentId}`} className="hover:bg-[#0f1f3d]/50 transition-colors">
                        {/* Data */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-white">
                            {new Date(payment.paidAt).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {payment.paidAt.slice(0, 10) === todayStr ? (
                              <span className="text-emerald-400 font-bold">Hoje</span>
                            ) : (
                              new Date(payment.paidAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            )}
                          </div>
                        </td>

                        {/* Cliente */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-xs">{payment.customerName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{payment.customerPhone || 'Sem telefone'}</span>
                          </div>
                        </td>

                        {/* Descrição */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200 truncate max-w-xs">
                            {payment.loanDescription}
                          </div>
                        </td>

                        {/* Parcela / Tipo */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            {payment.totalInstallments > 1
                              ? `Parcela ${payment.installmentNumber}/${payment.totalInstallments}`
                              : payment.billingType === 'recurring'
                              ? 'Recorrente'
                              : 'Parcela Única'}
                          </span>
                        </td>

                        {/* Forma */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#142345] text-slate-300 border border-[#233866] inline-flex items-center gap-1">
                            {payment.paymentMethod === 'pix' && <QrCode className="w-3 h-3 text-emerald-400" />}
                            {payment.paymentMethod === 'credit_card' && <CreditCard className="w-3 h-3 text-blue-400" />}
                            {payment.paymentMethod === 'cash' && <Banknote className="w-3 h-3 text-amber-400" />}
                            <span>
                              {payment.paymentMethod === 'pix'
                                ? 'PIX'
                                : payment.paymentMethod === 'credit_card'
                                ? 'Cartão'
                                : 'Dinheiro'}
                            </span>
                          </span>
                        </td>

                        {/* Valor Baixado */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-sm font-black font-mono text-emerald-400">
                            + R$ {payment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* WhatsApp Comprovante */}
                            <button
                              type="button"
                              onClick={() => handleSendReceiptWhatsApp(payment)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-[#25D366]/40 text-xs font-semibold transition-all cursor-pointer"
                              title="Enviar comprovante de pagamento no WhatsApp"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Comprovante</span>
                            </button>

                            {/* Editar Cobrança / Cliente */}
                            {(() => {
                              const relatedLoan = loans.find(l => l.id === payment.loanId);
                              if (!relatedLoan) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(relatedLoan)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-medium transition-colors cursor-pointer"
                                  title="Editar dados desta cobrança e do cliente"
                                >
                                  <Pencil className="w-3 h-3 text-blue-400" />
                                  <span>Editar</span>
                                </button>
                              );
                            })()}

                            {/* Desfazer Baixa */}
                            <button
                              type="button"
                              disabled={savingInstallmentId === payment.installmentId}
                              onClick={() => handleToggleInstallmentPaid(payment.loanId, payment.installmentId)}
                              className="px-2 py-1.5 rounded-lg bg-[#070e21] text-slate-400 hover:text-amber-300 hover:bg-amber-950/40 border border-[#1b2b4f] text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                              title="Reverter baixa e voltar parcela para pendente"
                            >
                              {savingInstallmentId === payment.installmentId ? 'Salvando...' : 'Reabrir'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Contracts List */
        <div className="space-y-3">
          {filteredLoans.length === 0 ? (
            <div className="p-12 text-center bg-[#0b162c]/50 rounded-3xl border border-[#1a2c54]">
              <HandCoins className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">Nenhum contrato encontrado</h3>
              <p className="text-xs text-slate-400 mt-1">
                Cadastre seu primeiro contrato para acompanhar vencimentos, parcelas e avisos no WhatsApp.
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                + Novo Empréstimo
              </button>
            </div>
          ) : (
            filteredLoans.map((loan) => {
              const isExpanded = expandedLoanId === loan.id;
              const paidCount = loan.installments.filter((i) => i.status === 'paid').length;
              const paidAmountTotal = loan.installments
                .filter((i) => i.status === 'paid')
                .reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);
              const openBalanceTotal = Math.max(0, loan.principalAmount - paidAmountTotal);
              const hasOverdue = loan.installments.some(
                (i) => i.status !== 'paid' && i.dueDate.slice(0, 10) < todayStr
              ) || ((!loan.installments || loan.installments.length === 0) && (loan.dueDate || '').slice(0, 10) < todayStr);

              const hasDueToday = loan.installments.some(
                (i) => i.status !== 'paid' && i.dueDate.slice(0, 10) === todayStr
              ) || ((!loan.installments || loan.installments.length === 0) && (loan.dueDate || '').slice(0, 10) === todayStr);

              return (
                <div
                  key={loan.id}
                  className="bg-[#0b162c] border border-[#1b2b4f] rounded-2xl overflow-hidden transition-all hover:border-emerald-500/40"
                >
                  {/* Main Card Header */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                          loan.status === 'completed'
                            ? 'bg-teal-500/20 text-teal-400 border-teal-500/30'
                            : hasOverdue
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : hasDueToday
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {loan.customerName.substring(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">
                            {loan.customerName}
                          </span>
                          {loan.status === 'completed' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-teal-500/20 text-teal-300 border border-teal-500/30">
                              QUITADO
                            </span>
                          ) : hasOverdue ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              EM ATRASO
                            </span>
                          ) : hasDueToday ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/50 animate-pulse">
                              VENCE HOJE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              EM DIA
                            </span>
                          )}

                          {/* Open balance and paid badges */}
                          {openBalanceTotal > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              A Receber: R$ {openBalanceTotal.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                          {paidAmountTotal > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              Pago: R$ {paidAmountTotal.toFixed(2).replace('.', ',')}
                            </span>
                          )}

                          {/* Payment Method Badge */}
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-[#142345] text-slate-300 border border-[#233866] flex items-center gap-1">
                            {loan.paymentMethod === 'pix' && <QrCode className="w-3 h-3 text-emerald-400" />}
                            {loan.paymentMethod === 'credit_card' && <CreditCard className="w-3 h-3 text-blue-400" />}
                            {loan.paymentMethod === 'cash' && <Banknote className="w-3 h-3 text-amber-400" />}
                            <span>
                              {loan.paymentMethod === 'pix'
                                ? 'PIX'
                                : loan.paymentMethod === 'credit_card'
                                ? 'Cartão'
                                : 'Dinheiro'}
                            </span>
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-emerald-300/90 mt-0.5 truncate">
                          {loan.description}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {loan.customerPhone || 'Sem telefone'}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            Venc: {new Date(loan.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          {loan.isRecurringOrInstallment && (
                            <>
                              <span>•</span>
                              <span className="text-purple-300">
                                {loan.billingType === 'installment'
                                  ? `${loan.installmentsCount}x parcelado`
                                  : 'Recorrente'}
                              </span>
                            </>
                          )}
                          {loan.instructions && (
                            <>
                              <span>•</span>
                              <span className="text-amber-400/90 text-[11px] truncate max-w-[200px]" title={loan.instructions}>
                                Obs: {loan.instructions}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                  {/* Financial Values & Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-end gap-3 sm:gap-5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#1a2c54]">
                    <div className="text-left md:text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">
                        Valor
                      </div>
                      <div className="text-sm sm:text-base font-black text-white">
                        R$ {loan.principalAmount.toFixed(2).replace('.', ',')}
                      </div>
                      {loan.isRecurringOrInstallment && loan.billingType === 'installment' && (
                        <div className="text-[10px] text-emerald-400 font-bold">
                          {loan.installmentsCount}x de R${' '}
                          {(loan.principalAmount / loan.installmentsCount).toFixed(2).replace('.', ',')}
                        </div>
                      )}
                    </div>

                    {loan.isRecurringOrInstallment && loan.billingType === 'installment' && (
                      <div className="text-left md:text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Progresso</div>
                        <div className="text-xs font-bold text-slate-300">
                          {paidCount} de {loan.installmentsCount} pagas
                        </div>
                        <div className="w-20 sm:w-24 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{
                              width: `${(paidCount / loan.installmentsCount) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Action buttons: WhatsApp, Editar, Parcelas/Baixa, Excluir */}
                    <div className="flex items-center gap-1.5 sm:gap-2 ml-auto sm:ml-0">
                      {/* WhatsApp Button with official logo */}
                      <button
                        onClick={() => handleSendWhatsApp(loan)}
                        title="Enviar cobrança por WhatsApp"
                        className="p-2 bg-[#25D366]/20 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-[#25D366]/40 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                      </button>

                      {/* Editar Button */}
                      <button
                        onClick={() => handleOpenEdit(loan)}
                        title="Editar cobrança e dados do cliente"
                        className="px-2.5 py-2 bg-blue-500/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5 text-xs font-bold"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>

                      {loan.installments.length > 1 ? (
                        <button
                          onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                          className="flex items-center gap-1 px-3 py-2 bg-[#122244] hover:bg-[#1a2f5e] text-slate-200 border border-[#233c75] rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <span>Parcelas</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ) : (
                        <button
                          disabled={savingInstallmentId === loan.installments[0]?.id}
                          onClick={() => handleToggleInstallmentPaid(loan.id, loan.installments[0]?.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            loan.installments[0]?.status === 'paid'
                              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                          } disabled:opacity-50`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {savingInstallmentId === loan.installments[0]?.id
                              ? 'Salvando...'
                              : loan.installments[0]?.status === 'paid'
                              ? 'Pago'
                              : 'Dar Baixa'}
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteLoan(loan)}
                        title="Excluir cobrança"
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Installments List */}
                {isExpanded && (
                  <div className="border-t border-[#1a2c54] bg-[#081224] p-4 space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Tabela de Parcelas</span>
                      <span className="text-[11px] text-slate-500 lowercase">
                        clique para marcar como paga ou enviar lembrete no WhatsApp
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {loan.installments.map((inst) => {
                        const isOverdue = inst.status !== 'paid' && inst.dueDate < todayStr;
                        const isPaid = inst.status === 'paid';

                        return (
                          <div
                            key={inst.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                              isPaid
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                                : isOverdue
                                ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                                : 'bg-[#0d1a36] border-[#1d2f59] text-slate-300'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black">
                                  Parcela {inst.number}/{loan.installmentsCount}
                                </span>
                                {isPaid ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300">
                                    PAGA
                                  </span>
                                ) : isOverdue ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-300">
                                    VENCIDA
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-700 text-slate-300">
                                    PENDENTE
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-black mt-0.5">
                                R$ {inst.amount.toFixed(2).replace('.', ',')}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Vencimento:{' '}
                                {new Date(inst.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleSendWhatsApp(loan, inst)}
                                title="Cobrar parcela no WhatsApp"
                                className="p-1.5 bg-[#25D366]/20 hover:bg-[#25D366] text-[#25D366] hover:text-white rounded-lg transition-all cursor-pointer shadow-sm flex items-center justify-center"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5" />
                              </button>

                              <button
                                disabled={savingInstallmentId === inst.id}
                                onClick={() => handleToggleInstallmentPaid(loan.id, inst.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  isPaid
                                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                } disabled:opacity-50`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{savingInstallmentId === inst.id ? 'Salvando...' : isPaid ? 'Desfazer' : 'Dar Baixa'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    )}

      {/* Modal: Novo Contrato de Empréstimo / Cobrança Direta (Exact match to reference design) */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-[#0b162c] border border-[#1f325e] rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-6 text-slate-200 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#1b2b4f]">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  {editingLoanId ? 'Editar Empréstimo' : 'Novo Empréstimo'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingLoanId
                    ? 'Altere os dados, valores ou parcelas da cobrança'
                    : 'Preencha os dados da cobrança de forma rápida e direta'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateLoan} className="space-y-4 text-xs">
              {/* Row 1: Nome do Cliente + WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300 text-xs">Nome do Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: João da Silva"
                    value={customerName || ''}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#081224] border border-[#1b2b4f] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300 text-xs">WhatsApp do Cliente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: (11) 99999-8888"
                    value={customerPhone || ''}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#081224] border border-[#1b2b4f] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              {/* Row 2: Descrição da Cobrança */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 text-xs">Descrição da Cobrança *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Empréstimo Pessoal, Mensalidade de Gestão, Pedido #102..."
                  value={description || ''}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#081224] border border-[#1b2b4f] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              {/* Row 3: Valor (R$) + Data de Vencimento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300 text-xs">Valor (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      R$
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="150,00"
                      value={amount || ''}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-[#081224] border border-[#1b2b4f] rounded-xl text-white font-black text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300 text-xs">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={dueDate || ''}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#081224] border border-[#1b2b4f] rounded-xl text-white font-medium focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              {/* Row 4: Checkbox Cobrança Recorrente / Parcelada */}
              <div className="p-3 bg-[#081224] border border-[#1a2c54] rounded-2xl space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRecurringOrInstallment}
                    onChange={(e) => setIsRecurringOrInstallment(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 bg-[#0e1a34] border-[#1f325e] focus:ring-emerald-500 focus:ring-offset-0"
                  />
                  <span className="text-xs font-bold text-white">
                    Cobrança Recorrente / Parcelada
                  </span>
                </label>

                {/* Sub-options if checked */}
                {isRecurringOrInstallment && (
                  <div className="pt-2 border-t border-[#1a2c54] space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-bold">
                        <input
                          type="radio"
                          name="billingType"
                          value="installment"
                          checked={billingType === 'installment'}
                          onChange={() => setBillingType('installment')}
                          className="text-emerald-500"
                        />
                        <span className={billingType === 'installment' ? 'text-emerald-400' : 'text-slate-400'}>
                          Parcelas (Quantidade de vezes)
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-bold">
                        <input
                          type="radio"
                          name="billingType"
                          value="recurring"
                          checked={billingType === 'recurring'}
                          onChange={() => setBillingType('recurring')}
                          className="text-emerald-500"
                        />
                        <span className={billingType === 'recurring' ? 'text-emerald-400' : 'text-slate-400'}>
                          Recorrente (Valor contínuo)
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {billingType === 'installment' ? (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-300">
                            Quantidade de Parcelas
                          </label>
                          <select
                            value={installmentsCount}
                            onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-[#0d1a36] border border-[#1e305e] rounded-xl text-white font-bold"
                          >
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 24, 36, 48].map((n) => (
                              <option key={n} value={n}>
                                {n}x de R$ {(numAmount / n).toFixed(2).replace('.', ',')}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-300">
                            Ciclo de Recorrência
                          </label>
                          <div className="px-3 py-2 bg-[#0d1a36] border border-[#1e305e] rounded-xl text-purple-300 font-bold flex items-center gap-1.5">
                            <Repeat className="w-3.5 h-3.5" />
                            <span>Cobrança Contínua Todo Ciclo</span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">
                          Periodicidade
                        </label>
                        <select
                          value={frequency}
                          onChange={(e) => setFrequency(e.target.value as any)}
                          className="w-full px-3 py-2 bg-[#0d1a36] border border-[#1e305e] rounded-xl text-white font-medium"
                        >
                          <option value="monthly">Mensal (a cada 30 dias)</option>
                          <option value="biweekly">Quinzenal (a cada 15 dias)</option>
                          <option value="weekly">Semanal (a cada 7 dias)</option>
                          <option value="daily">Diária</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Row 5: Forma de Pagamento Principal */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 text-xs">
                  Forma de Pagamento Principal *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'pix'
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/40'
                        : 'bg-[#081224] text-slate-300 border-[#1b2b4f] hover:border-slate-600'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-emerald-300" />
                    <span>PIX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit_card')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'credit_card'
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-950/40'
                        : 'bg-[#081224] text-slate-300 border-[#1b2b4f] hover:border-slate-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-blue-300" />
                    <span>Cartão de Crédito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-950/40'
                        : 'bg-[#081224] text-slate-300 border-[#1b2b4f] hover:border-slate-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-amber-300" />
                    <span>Dinheiro</span>
                  </button>
                </div>
              </div>

              {/* Row 6: Instruções ou Observações */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 text-xs">
                  Instruções ou Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Enviar comprovante via WhatsApp, juros após vencimento, promissória anexada, etc."
                  value={instructions || ''}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#081224] border border-[#1b2b4f] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs resize-none"
                />
              </div>

              {/* Resumo da Operação */}
              <div className="p-3 bg-gradient-to-r from-[#0d221c] to-[#0a1b24] border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    Total a Cobrar
                  </div>
                  <div className="text-base font-black text-white">
                    R$ {numAmount.toFixed(2).replace('.', ',')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-medium">
                    {isRecurringOrInstallment && billingType === 'installment'
                      ? `${installmentsCount} parcelas de R$ ${(numAmount / installmentsCount).toFixed(2).replace('.', ',')}`
                      : 'Pagamento Único'}
                  </div>
                  <div className="text-[11px] font-bold text-slate-300 mt-0.5">
                    Vencimento: {dueDate ? new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '--'}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-lg shadow-emerald-900/40 cursor-pointer text-xs flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingLoanId ? 'Salvar Alterações' : 'Salvar e Gerar Cobrança'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Loan Confirmation Modal */}
      {loanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Excluir Contrato de Empréstimo?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deseja realmente remover o empréstimo de{' '}
                <strong className="text-white font-mono">R$ {loanToDelete.principalAmount.toFixed(2).replace('.', ',')}</strong> de{' '}
                <strong className="text-white">{loanToDelete.customerName}</strong>?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setLoanToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const toDelete = loanToDelete;
                  setLoanToDelete(null);
                  try {
                    if (isSupabaseConfigured) {
                      await deleteLoanFromSupabase(tenantId, toDelete.id);
                    }
                    const updated = loans.filter((l) => l.id !== toDelete.id);
                    setLoans(updated);
                    localStorage.setItem(storageKey, JSON.stringify(updated));

                    broadcastChange('delete', { id: toDelete.id, tenantId });
                    api.deleteLoan(toDelete.id).catch(() => {});
                    api.syncLoans(tenantId, updated).catch(() => {});
                    setToastMessage('Empréstimo excluído com sucesso.');
                    setTimeout(() => setToastMessage(null), 3000);
                  } catch (err: any) {
                    console.error('[Excluir Empréstimo] Erro:', err);
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
        <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-rose-500/50 text-rose-300 text-xs font-bold shadow-2xl shadow-black animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
