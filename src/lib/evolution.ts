import { Charge, Customer, Tenant, WhatsAppAutomationConfig } from '../types/index.js';
import {
  TemplateType,
  WhatsAppOptions,
  renderCustomTemplate,
  formatWhatsAppMessage,
} from './whatsappTemplates.js';
import {
  getOrInitBaileysInstance,
  getBaileysStatus,
  sendBaileysMessage,
  disconnectBaileysInstance,
} from './baileysManager.js';

export type { TemplateType, WhatsAppOptions };
export { renderCustomTemplate, formatWhatsAppMessage };

function isExternalEvolutionUrl(url?: string): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  if (clean === '' || clean === 'native' || clean === 'local' || clean === 'internal') return false;
  if (clean.includes('api.meuzap.com') || clean.includes('meuzap.com')) return false;
  return clean.startsWith('http://') || clean.startsWith('https://');
}

async function resolveWorkingEvolutionInstance(
  preferredInstance?: string,
  serverUrl?: string,
  apiKey?: string
): Promise<{ serverUrl: string; apiKey: string; instanceName: string } | null> {
  if (!serverUrl || !apiKey || !isExternalEvolutionUrl(serverUrl)) {
    return null;
  }

  const url = serverUrl.replace(/\/$/, '');
  const key = apiKey;

  // 1. Testa a instância preferida se informada
  if (preferredInstance) {
    try {
      const res = await fetch(`${url}/instance/connectionState/${preferredInstance}`, {
        headers: { apikey: key },
      });
      if (res.ok) {
        const data: any = await res.json().catch(() => ({}));
        const state = data?.instance?.state || data?.state;
        if (state === 'open') {
          return { serverUrl: url, apiKey: key, instanceName: preferredInstance };
        }
      }
    } catch {}
  }

  // 2. Se a preferida falhou ou não foi informada, busca qualquer instância 'open' no servidor fornecido
  try {
    const res = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: key },
    });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        const openInst = list.find((i: any) => i.connectionStatus === 'open');
        if (openInst) {
          return { serverUrl: url, apiKey: key, instanceName: openInst.name };
        }
      }
    }
  } catch {}

  // 3. Fallback para a instância preferida configurada
  return preferredInstance ? { serverUrl: url, apiKey: key, instanceName: preferredInstance } : null;
}

export async function sendWhatsAppMessage(options: WhatsAppOptions & { phone?: string }) {
  const message = formatWhatsAppMessage(options);
  const rawPhone =
    (options as any).phone ||
    options.customer?.whatsapp ||
    (options.customer as any)?.phone ||
    (options.charge as any)?.customer_whatsapp ||
    (options.charge as any)?.customer_phone ||
    '';
  const cleanPhone = (rawPhone || '').replace(/\D/g, '');
  
  const formattedPhone = cleanPhone.length === 10 || cleanPhone.length === 11 
    ? `55${cleanPhone}` 
    : cleanPhone;

  const waDirectUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

  // 1. Tentar envio por Evolution API Externa APENAS se configurado servidor externo válido
  const isExternal = isExternalEvolutionUrl(options.apiConfig?.server_url) && !!options.apiConfig?.api_key;
  if (isExternal && formattedPhone) {
    const rawServerUrl = options.apiConfig!.server_url!;
    const rawApiKey = options.apiConfig!.api_key!;
    try {
      const resolved = await resolveWorkingEvolutionInstance(options.apiConfig?.instance_name, rawServerUrl, rawApiKey);
      if (resolved && isExternalEvolutionUrl(resolved.serverUrl) && resolved.apiKey) {
        const endpoint = `${resolved.serverUrl}/message/sendText/${resolved.instanceName}`;
        const delayMs = (options.apiConfig?.delay_seconds || 1.2) * 1000;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': resolved.apiKey,
            'Authorization': `Bearer ${resolved.apiKey}`,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
            textMessage: { text: message },
            delay: delayMs,
            options: {
              delay: delayMs,
              presence: 'composing',
              linkPreview: false,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          return {
            success: true,
            method: 'evolution_api' as const,
            sentDirectly: true,
            instanceName: resolved.instanceName,
            waDirectUrl,
            message,
            data,
          };
        }
      }
    } catch (err: any) {
      console.warn('[Evolution API] Falha na API externa, tentando Baileys nativo:', err?.message || err);
    }
  }

  // 2. Engine Baileys Nativo Integrado (Padrão Oficial - 100% Automático via QR Code)
  const instanceName = options.apiConfig?.instance_name || 'instancia_principal';
  try {
    const baileysResult = await sendBaileysMessage({
      instanceName,
      phone: formattedPhone,
      text: message,
    });

    if (baileysResult.success) {
      return {
        success: true,
        method: 'evolution_api' as const,
        sentDirectly: true,
        instanceName: baileysResult.instanceName || instanceName,
        waDirectUrl,
        message,
        data: baileysResult,
      };
    }
  } catch (baileysErr: any) {
    console.warn(`[Baileys Engine] Instância "${instanceName}" falhou:`, baileysErr?.message || baileysErr);
    return {
      success: false,
      method: 'direct_whatsapp' as const,
      sentDirectly: false,
      instanceName,
      waDirectUrl,
      message,
      phone: formattedPhone,
      error: baileysErr?.message || 'Instância WhatsApp nativa desconectada. Abra o menu "Automação WhatsApp" e leia o QR Code.',
    };
  }

  // 3. Fallback
  return {
    success: false,
    method: 'direct_whatsapp' as const,
    sentDirectly: false,
    instanceName,
    waDirectUrl,
    message,
    phone: formattedPhone,
    error: 'Instância WhatsApp não está conectada no momento.',
  };
}

export async function sendDirectWhatsAppTextMessage({
  phone,
  message,
  apiConfig,
}: {
  phone: string;
  message: string;
  apiConfig?: Partial<WhatsAppAutomationConfig>;
}) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const formattedPhone = cleanPhone.length === 10 || cleanPhone.length === 11 
    ? `55${cleanPhone}` 
    : cleanPhone;

  const waDirectUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

  // 1. Tenta API Externa APENAS se configurado servidor externo válido
  const isExternal = isExternalEvolutionUrl(apiConfig?.server_url) && !!apiConfig?.api_key;
  if (isExternal && formattedPhone) {
    const rawServerUrl = apiConfig!.server_url!;
    const rawApiKey = apiConfig!.api_key!;
    try {
      const resolved = await resolveWorkingEvolutionInstance(apiConfig?.instance_name, rawServerUrl, rawApiKey);
      if (resolved && isExternalEvolutionUrl(resolved.serverUrl) && resolved.apiKey) {
        const endpoint = `${resolved.serverUrl}/message/sendText/${resolved.instanceName}`;
        const delayMs = (apiConfig?.delay_seconds || 1.2) * 1000;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': resolved.apiKey,
            'Authorization': `Bearer ${resolved.apiKey}`,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
            textMessage: { text: message },
            delay: delayMs,
            options: { delay: delayMs, presence: 'composing', linkPreview: false },
          }),
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          return {
            success: true,
            method: 'evolution_api' as const,
            sentDirectly: true,
            instanceName: resolved.instanceName,
            waDirectUrl,
            data,
          };
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn('[Evolution API sendDirect] Resposta não-ok:', errData);
        }
      }
    } catch (err: any) {
      console.warn('[Evolution API sendDirect] Falha na API externa, tentando Baileys nativo:', err);
    }
  }

  // 2. Engine Baileys Nativo Integrado (Padrão Oficial)
  const instanceName = apiConfig?.instance_name || 'instancia_principal';
  try {
    const baileysResult = await sendBaileysMessage({
      instanceName,
      phone: formattedPhone,
      text: message,
    });

    if (baileysResult.success) {
      return {
        success: true,
        method: 'evolution_api' as const,
        sentDirectly: true,
        instanceName: baileysResult.instanceName || instanceName,
        waDirectUrl,
        data: baileysResult,
      };
    }
  } catch (baileysErr: any) {
    console.warn('[Baileys Engine] Falha no envio nativo:', baileysErr?.message);
    return {
      success: false,
      method: 'direct_whatsapp' as const,
      sentDirectly: false,
      instanceName,
      waDirectUrl,
      error: baileysErr?.message || 'Instância WhatsApp nativa desconectada. Abra o menu "Automação WhatsApp" e leia o QR Code.',
    };
  }

  return {
    success: false,
    method: 'direct_whatsapp' as const,
    sentDirectly: false,
    waDirectUrl,
    error: 'Instância WhatsApp não está conectada no momento.',
  };
}

// Criar nova instância
export async function createEvolutionInstance({
  server_url,
  api_key,
  instance_name,
}: {
  server_url?: string;
  api_key?: string;
  instance_name: string;
}) {
  // Se for externa, tenta criar no servidor externo
  if (isExternalEvolutionUrl(server_url) && api_key) {
    try {
      const url = server_url!.replace(/\/$/, '');
      const endpoint = `${url}/instance/create`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': api_key,
          'Authorization': `Bearer ${api_key}`,
        },
        body: JSON.stringify({
          instanceName: instance_name,
          token: api_key,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return {
          success: true,
          created: true,
          base64: data?.qrcode?.base64 || data?.base64 || null,
          code: data?.qrcode?.code || data?.code || null,
          pairingCode: data?.qrcode?.pairingCode || data?.pairingCode || null,
          instance: data?.instance,
        };
      }
    } catch (err: any) {
      console.warn('[Evolution API] Falha ao criar no servidor externo, usando engine nativo:', err);
    }
  }

  // Engine Baileys Nativo: inicializa sessão limpa
  const session = await getOrInitBaileysInstance(instance_name, { forceRestart: true });
  return {
    success: true,
    created: true,
    base64: session.qrCodeDataUrl,
    code: session.qrCodeRaw,
    pairingCode: null,
    connected: session.state === 'open',
    ownerPhone: session.ownerPhone,
    instance: { instanceName: instance_name, status: session.state },
  };
}

// Consultar status da instância
export async function checkEvolutionInstanceStatus({
  server_url,
  api_key,
  instance_name,
}: {
  server_url?: string;
  api_key?: string;
  instance_name: string;
}) {
  // 1. Se configurado servidor externo válido, consulta
  if (isExternalEvolutionUrl(server_url) && api_key) {
    try {
      const url = server_url!.replace(/\/$/, '');
      const endpoint = `${url}/instance/connectionState/${instance_name}`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: api_key,
          Authorization: `Bearer ${api_key}`,
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const state = data?.instance?.state || data?.state || 'close';
        const isConnected = state === 'open' || state === 'connected';

        let ownerPhone: string | undefined = undefined;
        const rawOwner = data?.instance?.ownerJid || data?.instance?.wuid || data?.ownerJid || data?.wuid;
        if (rawOwner && typeof rawOwner === 'string') {
          const digits = rawOwner.split('@')[0].replace(/\D/g, '');
          if (digits) {
            ownerPhone = `+${digits}`;
          }
        }

        return {
          connected: isConnected,
          state,
          ownerPhone,
          instanceName: instance_name,
          data,
          message: isConnected
            ? `Instância "${instance_name}" conectada e pronta para envio!`
            : `Status da instância: ${state === 'close' ? 'Aguardando leitura do QR Code' : state}`,
        };
      }
    } catch (err: any) {
      console.warn('[Evolution API] Falha na verificação de status externo:', err);
    }
  }

  // 2. Engine Baileys Nativo Integrado (Padrão Oficial)
  return getBaileysStatus(instance_name);
}

// Gerar QR Code Real da Instância (Conectar)
export async function fetchEvolutionQRCode({
  server_url,
  api_key,
  instance_name,
}: {
  server_url?: string;
  api_key?: string;
  instance_name: string;
}) {
  // 1. Se configurada API externa válida, tenta obter dela
  if (isExternalEvolutionUrl(server_url) && api_key) {
    try {
      const url = server_url!.replace(/\/$/, '');
      const endpoint = `${url}/instance/connect/${instance_name}`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: api_key,
          Authorization: `Bearer ${api_key}`,
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const base64 = data?.base64 || data?.qrcode?.base64 || null;
        const code = data?.code || data?.qrcode?.code || null;
        const pairingCode = data?.pairingCode || data?.qrcode?.pairingCode || null;

        if (base64 || code || pairingCode) {
          return { base64, code, pairingCode, method: 'external_evolution' };
        }
      }
    } catch (err) {
      console.warn('[Evolution API] Falha na API externa, usando Baileys nativo:', err);
    }
  }

  // 2. Engine Baileys Nativo Integrado (gera QR code 100% autêntico do WhatsApp)
  console.log(`[WhatsApp] Gerando QR Code Baileys autêntico para instância "${instance_name}"...`);
  const session = await getOrInitBaileysInstance(instance_name, { forceRestart: false });

  if (session.state === 'open') {
    return {
      connected: true,
      ownerPhone: session.ownerPhone,
      method: 'native_baileys',
      message: 'Instância já está conectada!',
    };
  }

  return {
    base64: session.qrCodeDataUrl,
    code: session.qrCodeRaw,
    connected: false,
    method: 'native_baileys',
  };
}

// Desconectar Instância
export async function disconnectEvolutionInstance({
  server_url,
  api_key,
  instance_name,
}: {
  server_url?: string;
  api_key?: string;
  instance_name?: string;
}) {
  // Desconecta do Baileys nativo
  await disconnectBaileysInstance(instance_name).catch(() => {});

  // Desconecta da API externa se configurada
  if (isExternalEvolutionUrl(server_url) && api_key && instance_name) {
    try {
      const url = server_url!.replace(/\/$/, '');
      const endpoint = `${url}/instance/logout/${instance_name}`;
      await fetch(endpoint, {
        method: 'DELETE',
        headers: { apikey: api_key },
      });
    } catch {}
  }

  return { success: true };
}
