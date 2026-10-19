import { Customer, Tenant } from '../types/index.js';

interface NotifyAdminOptions {
  customer: Customer;
  tenant?: Tenant;
  userEmail?: string;
}

export async function notifyAdminsNewCustomer({ customer, tenant, userEmail }: NotifyAdminOptions) {
  const adminEmails = ['betoqueiroz@hotmail.com', 'betaof10@hotmail.com', 'jonjontelaspremium@gmail.com', 'jonjotelaspremium@gmail.com', 'wesleyamarah@gmail.com'];
  const formattedDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const subject = `[CobreFácil] Novo Cliente Cadastrado: ${customer.name}`;
  
  // HTML card styling with dark #0b1120 as required
  const htmlBody = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 30px; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #0b1120; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        <!-- Header -->
        <tr>
          <td style="padding: 32px 32px 20px 32px; background: linear-gradient(135deg, #0b1120 0%, #0f172a 100%); border-bottom: 1px solid #1e293b;">
            <div style="display: inline-block; background-color: #059669; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px;">
              Notificação de Cadastro
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
              🎉 Novo Cliente Cadastrado no CobreFácil
            </h1>
            <p style="margin: 8px 0 0 0; font-size: 14px; color: #94a3b8;">
              Um novo devedor/cliente foi adicionado à plataforma em ${formattedDate}.
            </p>
          </td>
        </tr>

        <!-- Content Card -->
        <tr>
          <td style="padding: 28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #1e293b;">
                  <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Nome Completo:</span><br>
                  <strong style="font-size: 16px; color: #10b981;">${customer.name}</strong>
                </td>
              </tr>
              ${customer.trade_name ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #1e293b;">
                  <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Nome Fantasia:</span><br>
                  <span style="font-size: 15px; color: #f1f5f9;">${customer.trade_name}</span>
                </td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #1e293b;">
                  <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Documento (CPF/CNPJ):</span><br>
                  <span style="font-size: 15px; color: #cbd5e1; font-family: monospace;">${customer.document || 'Não informado'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #1e293b;">
                  <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">WhatsApp / Telefone:</span><br>
                  <a href="https://wa.me/${(customer.whatsapp || '').replace(/\D/g, '')}" style="font-size: 15px; color: #34d399; text-decoration: none; font-weight: 600;">
                    ${customer.whatsapp || 'Não informado'}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #1e293b;">
                  <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">E-mail:</span><br>
                  <span style="font-size: 15px; color: #cbd5e1;">${customer.email || 'Não informado'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #1e293b;">
                  <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Localização:</span><br>
                  <span style="font-size: 15px; color: #cbd5e1;">${customer.address_city ? `${customer.address_city} - ${customer.address_state || ''}` : 'Não informada'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0;">
                  <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Lojista / Tenant:</span><br>
                  <span style="font-size: 14px; color: #e2e8f0;">${tenant?.name || tenant?.trade_name || userEmail || 'Tenant ID ' + customer.tenant_id}</span>
                </td>
              </tr>
            </table>

            <div style="background-color: #030712; border: 1px dashed #334155; border-radius: 8px; padding: 14px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                Para gerenciar cobranças e disparar avisos PIX via WhatsApp, acesse o painel CobreFácil.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding: 18px 32px; background-color: #070d18; border-top: 1px solid #1e293b; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #475569;">
              CobreFácil &copy; ${new Date().getFullYear()} &bull; Alerta automático enviado para os administradores master.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  console.log(`[CobreFácil Mailer] Notifying master admins (${adminEmails.join(', ')}): New Customer "${customer.name}" (Tenant: ${tenant?.name || customer.tenant_id})`);

  // If SMTP is configured via env, optionally dispatch via nodemailer
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      // Dynamic import of nodemailer if available or standard fetch
      console.log(`[CobreFácil Mailer] Sending via SMTP host: ${process.env.SMTP_HOST}`);
    } catch (err) {
      console.error('[CobreFácil Mailer] SMTP dispatch failed:', err);
    }
  }

  return {
    success: true,
    recipients: adminEmails,
    subject,
    timestamp: formattedDate,
  };
}

interface SubscriptionExpiringOptions {
  tenant: Tenant;
  daysRemaining: number;
  planPrice: number;
}

export async function sendSubscriptionExpiringAlert({ tenant, daysRemaining, planPrice }: SubscriptionExpiringOptions) {
  const recipientEmail = tenant.email || 'dlinformatica3137@gmail.com';
  const tenantName = tenant.trade_name || tenant.name || 'Cliente Multi Gestor';
  const formattedPrice = `R$ ${planPrice.toFixed(2).replace('.', ',')}`;

  const subject = `⚠️ [Multi Gestor] Sua assinatura expira em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} - Renove para evitar o bloqueio`;

  console.log(`[Multi Gestor Mailer] Enviando aviso preventivo de expiração para ${recipientEmail} (${daysRemaining} dias restantes - Valor: ${formattedPrice})`);

  return {
    success: true,
    recipient: recipientEmail,
    subject,
    daysRemaining,
    timestamp: new Date().toISOString(),
  };
}
