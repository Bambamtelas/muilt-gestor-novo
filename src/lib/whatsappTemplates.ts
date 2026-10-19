import { Charge, Customer, Tenant, WhatsAppAutomationConfig } from '../types/index.js';

export type TemplateType = 'friendly' | 'due_today' | 'due_tomorrow' | 'overdue' | 'receipt';

export interface WhatsAppOptions {
  charge: Charge;
  customer: Customer;
  tenant: Tenant;
  templateType: TemplateType;
  customMessage?: string;
  apiConfig?: Partial<WhatsAppAutomationConfig>;
}

export function renderCustomTemplate(
  template: string,
  data: {
    cliente?: string;
    primeiro_nome?: string;
    produto?: string;
    valor?: string | number;
    data_vencimento?: string;
    chave_pix?: string;
    empresa?: string;
    link_pagamento?: string;
    telefone?: string;
  }
): string {
  if (!template || typeof template !== 'string') return '';
  let result = String(template);
  const sampleMap: Record<string, string> = {
    '{cliente}': String(data.cliente || 'Cliente'),
    '{primeiro_nome}': String(data.primeiro_nome || data.cliente?.split(' ')[0] || 'Cliente'),
    '{produto}': String(data.produto || 'Serviço'),
    '{valor}': typeof data.valor === 'number'
      ? data.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(data.valor || '0,00'),
    '{data_vencimento}': String(data.data_vencimento || ''),
    '{chave_pix}': String(data.chave_pix || 'Chave PIX não informada'),
    '{empresa}': String(data.empresa || 'Empresa'),
    '{link_pagamento}': String(data.link_pagamento || ''),
    '{telefone}': String(data.telefone || ''),
  };

  for (const [tag, val] of Object.entries(sampleMap)) {
    result = result.split(tag).join(String(val ?? ''));
  }
  return result;
}

export function formatWhatsAppMessage({
  charge,
  customer,
  tenant,
  templateType,
  customMessage,
}: WhatsAppOptions): string {
  if (customMessage && customMessage.trim().length > 0) {
    return customMessage;
  }

  const tenantName = tenant.trade_name || tenant.name || 'CobreFácil';
  const customerName = customer.name.split(' ')[0];
  const formattedAmount = Number(charge.amount).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const formattedDate = new Date(charge.due_date + 'T12:00:00').toLocaleDateString('pt-BR');
  const pixKey =
    tenant.pix_key ||
    (tenant.email?.toLowerCase().trim() === 'betoqueiroz@hotmail.com' || tenant.email?.toLowerCase().trim() === 'betaof10@hotmail.com' ? (tenant.email || 'betoqueiroz@hotmail.com') : 'Chave PIX a combinar');

  switch (templateType) {
    case 'friendly':
      return `Olá, *${customerName}*! Tudo bem? 😊\n\nPassando apenas para lembrar com carinho sobre a fatura referente a *"${charge.description}"* no valor de *${formattedAmount}*, com vencimento para *${formattedDate}*.\n\n🔑 *Chave PIX para pagamento:*\n\`${pixKey}\`\n\nCaso já tenha efetuado o pagamento, por favor desconsidere esta mensagem. Muito obrigado pela parceria!\n\n_— Atenciosamente, ${tenantName}_`;

    case 'due_today':
      return `⏰ *Lembrete de Vencimento Hoje!*\n\nOlá, *${customerName}*! Lembramos que sua cobrança de *${formattedAmount}* referente a *"${charge.description}"* vence *hoje (${formattedDate})*.\n\n🔑 *Chave PIX:* \`${pixKey}\`\nBeneficiário: *${tenantName}*\n\nPor gentileza, após realizar a transferência, nos envie o comprovante por aqui para darmos a baixa no sistema! 📲\n\n_— ${tenantName}_`;

    case 'due_tomorrow':
      return `🔔 *Lembrete: Sua fatura vence amanhã!*\n\nOlá, *${customerName}*! Tudo bem? Passando para te avisar com antecedência que a cobrança referente a *"${charge.description}"* no valor de *${formattedAmount}* vence *amanhã (${formattedDate})*.\n\n🔑 *Chave PIX para pagamento facilitado:*\n\`${pixKey}\`\nBeneficiário: *${tenantName}*\n\nCaso prefira antecipar ou já tenha programado o pagamento, agradecemos muito pela pontualidade! 👍\n\n_— Atenciosamente, ${tenantName}_`;

    case 'overdue':
      return `⚠️ *Aviso de Pendência Financeira*\n\nPrezado(a) *${customerName}*,\n\nIdentificamos que a cobrança de *${formattedAmount}* referente a *"${charge.description}"*, vencida em *${formattedDate}*, ainda consta em aberto no nosso financeiro.\n\nSabemos que imprevistos acontecem, por isso gostaríamos de te ajudar a regularizar hoje mesmo com toda facilidade:\n\n🔑 *Chave PIX:* \`${pixKey}\`\n\nSe já realizou a quitação ou precisa de uma condição especial, por favor responda a esta mensagem para alinharmos.\n\n_— Departamento Financeiro | ${tenantName}_`;

    case 'receipt':
      return `✅ *Pagamento Confirmado!*\n\nOlá, *${customerName}*!\n\nConfirmamos o recebimento de *${formattedAmount}* referente a *"${charge.description}"* com sucesso!\n\nSua fatura foi baixada e seu saldo está regularizado. Muito obrigado pela confiança e pontualidade! 🤝\n\n_— ${tenantName}_`;

    default:
      return `Olá *${customerName}*, segue o lembrete da cobrança de ${formattedAmount} com vencimento em ${formattedDate}. Chave PIX: ${pixKey}. Obrigado!`;
  }
}
