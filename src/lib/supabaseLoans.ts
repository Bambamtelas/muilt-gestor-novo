import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { Loan, LoanInstallment } from '../components/LoansView.js';

/**
 * Converte uma linha do Supabase (snake_case) para a interface do frontend Loan (camelCase)
 */
export function mapSupabaseRowToLoan(row: any): Loan {
  let rawInstallments = row.installments;
  if (typeof rawInstallments === 'string') {
    try {
      rawInstallments = JSON.parse(rawInstallments);
    } catch {
      rawInstallments = [];
    }
  }

  const installments: LoanInstallment[] = Array.isArray(rawInstallments)
    ? rawInstallments.map((inst: any, idx: number) => ({
        id: inst.id || `inst-${idx + 1}`,
        number: Number(inst.number || idx + 1),
        amount: Number(inst.amount || 0),
        dueDate: inst.dueDate || inst.due_date || new Date().toISOString().split('T')[0],
        status: (inst.status === 'paid' ? 'paid' : 'pending') as 'paid' | 'pending',
        paidAt: inst.paidAt || inst.paid_at || undefined,
        paidAmount: inst.paidAmount !== undefined ? Number(inst.paidAmount) : inst.paid_amount !== undefined ? Number(inst.paid_amount) : undefined,
      }))
    : [];

  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    description: row.description || '',
    principalAmount: Number(row.principal_amount || 0),
    dueDate: row.due_date ? String(row.due_date).split('T')[0] : new Date().toISOString().split('T')[0],
    isRecurringOrInstallment: Boolean(row.is_recurring_or_installment),
    billingType: (row.billing_type || 'single') as 'single' | 'installment' | 'recurring',
    installmentsCount: Number(row.installments_count || installments.length || 1),
    frequency: (row.frequency || 'monthly') as 'daily' | 'weekly' | 'biweekly' | 'monthly',
    paymentMethod: (row.payment_method || 'pix') as any,
    instructions: row.instructions || '',
    status: (row.status || 'active') as 'active' | 'completed' | 'overdue',
    createdAt: row.created_at || new Date().toISOString(),
    totalToReceive: Number(row.total_to_receive || row.principal_amount || 0),
    installments,
  };
}

/**
 * Converte um objeto Loan do frontend para o formato aceito pelo Supabase (snake_case)
 */
export function mapLoanToSupabaseRow(loan: Partial<Loan>, tenantId: string): Record<string, any> {
  const row: Record<string, any> = {
    tenant_id: tenantId,
    updated_at: new Date().toISOString(),
  };

  if (loan.id) row.id = loan.id;
  if (loan.customerName !== undefined) row.customer_name = loan.customerName;
  if (loan.customerPhone !== undefined) row.customer_phone = loan.customerPhone;
  if (loan.description !== undefined) row.description = loan.description;
  if (loan.principalAmount !== undefined) row.principal_amount = Number(loan.principalAmount);
  if (loan.dueDate !== undefined) row.due_date = loan.dueDate;
  if (loan.isRecurringOrInstallment !== undefined) row.is_recurring_or_installment = loan.isRecurringOrInstallment;
  if (loan.billingType !== undefined) row.billing_type = loan.billingType;
  if (loan.installmentsCount !== undefined) row.installments_count = Number(loan.installmentsCount);
  if (loan.frequency !== undefined) row.frequency = loan.frequency;
  if (loan.paymentMethod !== undefined) row.payment_method = loan.paymentMethod;
  if (loan.instructions !== undefined) row.instructions = loan.instructions;
  if (loan.status !== undefined) row.status = loan.status;
  if (loan.totalToReceive !== undefined) row.total_to_receive = Number(loan.totalToReceive);
  if (loan.installments !== undefined) row.installments = loan.installments;
  if (loan.createdAt !== undefined) row.created_at = loan.createdAt;

  return row;
}

/**
 * Consulta oficial no Supabase PostgreSQL de todos os empréstimos pertencentes ao tenant
 */
export async function loadLoansFromSupabase(tenantId: string): Promise<Loan[]> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Falha ao consultar empréstimos no Supabase: ${error.message}`);
  }

  if (!Array.isArray(data)) return [];
  return data.map(mapSupabaseRowToLoan);
}

/**
 * Salva ou cria um novo contrato de empréstimo diretamente no Supabase PostgreSQL
 */
export async function saveLoanToSupabase(tenantId: string, loan: Loan): Promise<Loan> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const payload = mapLoanToSupabaseRow(loan, tenantId);

  const { data, error } = await supabase
    .from('loans')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw new Error(`Não foi possível salvar o empréstimo no servidor: ${error.message}`);
  }

  return mapSupabaseRowToLoan(data);
}

/**
 * Atualiza um empréstimo existente no Supabase PostgreSQL
 */
export async function updateLoanInSupabase(
  tenantId: string,
  loanId: string,
  updates: Partial<Loan>
): Promise<Loan> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const payload = mapLoanToSupabaseRow(updates, tenantId);
  delete payload.id; // Não altera a chave primária
  delete payload.tenant_id; // Respeita a chave imutável

  const { data, error } = await supabase
    .from('loans')
    .update(payload)
    .eq('id', loanId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    throw new Error(`Não foi possível atualizar o empréstimo no servidor: ${error.message}`);
  }

  return mapSupabaseRowToLoan(data);
}

/**
 * Função transacional oficial para "Dar Baixa" ou "Desfazer Baixa" de uma parcela específica.
 * O Supabase PostgreSQL é a fonte da verdade: a alteração é gravada no banco antes de retornar.
 */
export async function toggleInstallmentPaidInSupabase(
  tenantId: string,
  currentLoan: Loan,
  installmentId: string
): Promise<{ updatedLoan: Loan; changedInstallment: LoanInstallment; wasPaid: boolean }> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  let changedInstallment: LoanInstallment | null = null;
  let wasPaid = false;

  const updatedInstallments = currentLoan.installments.map((inst) => {
    if (inst.id !== installmentId) return inst;

    const isCurrentlyPaid = inst.status === 'paid';
    wasPaid = !isCurrentlyPaid;

    const next: LoanInstallment = {
      ...inst,
      status: isCurrentlyPaid ? 'pending' : 'paid',
      paidAt: isCurrentlyPaid ? undefined : new Date().toISOString(),
      paidAmount: isCurrentlyPaid ? undefined : inst.amount,
    };
    changedInstallment = next;
    return next;
  });

  if (!changedInstallment) {
    throw new Error('Parcela não encontrada no contrato especificado.');
  }

  const allPaid = updatedInstallments.every((i) => i.status === 'paid');
  const newLoanStatus: 'completed' | 'active' = allPaid ? 'completed' : 'active';

  // 1. UPDATE atômico direto no Supabase PostgreSQL
  const { data, error } = await supabase
    .from('loans')
    .update({
      installments: updatedInstallments,
      status: newLoanStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', currentLoan.id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    throw new Error(`Não foi possível salvar a baixa no servidor: ${error.message}`);
  }

  const updatedLoan = mapSupabaseRowToLoan(data);
  return { updatedLoan, changedInstallment, wasPaid };
}

/**
 * Remove um empréstimo permanentemente do Supabase PostgreSQL
 */
export async function deleteLoanFromSupabase(tenantId: string, loanId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !tenantId) {
    throw new Error('Supabase não está configurado.');
  }

  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('id', loanId)
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Não foi possível excluir o empréstimo do servidor: ${error.message}`);
  }

  return true;
}
