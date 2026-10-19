import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import pino from 'pino';

// Auto-patch whatsapp-rust-bridge if needed before importing Baileys
try {
  const candidatePaths = [
    path.join(process.cwd(), 'node_modules', 'whatsapp-rust-bridge', 'package.json'),
    path.join(process.cwd(), 'node_modules', '@whiskeysockets', 'baileys', 'node_modules', 'whatsapp-rust-bridge', 'package.json'),
  ];
  for (const rustBridgePkgPath of candidatePaths) {
    if (fs.existsSync(rustBridgePkgPath)) {
      const pkgContent = fs.readFileSync(rustBridgePkgPath, 'utf8');
      const parsed = JSON.parse(pkgContent);
      let dirty = false;
      if (!parsed.main) {
        parsed.main = './dist/index.js';
        dirty = true;
      }
      if (parsed.exports && parsed.exports['.']) {
        if (!parsed.exports['.'].require) {
          parsed.exports['.'].require = './dist/index.js';
          dirty = true;
        }
        if (!parsed.exports['.'].default) {
          parsed.exports['.'].default = './dist/index.js';
          dirty = true;
        }
      }
      if (dirty) {
        fs.writeFileSync(rustBridgePkgPath, JSON.stringify(parsed, null, 4));
      }
    }
  }
} catch (e) {
  console.warn('[BaileysManager] Rust bridge patch check warning:', e);
}

// Dynamically or directly import Baileys
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import { getSupabaseClient, isSupabaseConfigured } from './supabase.js';

export interface BaileysInstanceSession {
  instanceName: string;
  socket: any | null;
  state: 'connecting' | 'open' | 'close' | 'waiting_qr';
  qrCodeRaw: string | null;
  qrCodeDataUrl: string | null;
  ownerPhone: string | null;
  ownerName: string | null;
  connectedAt: string | null;
  lastError: string | null;
  qrExpiresAt: number;
}

const instancesMap = new Map<string, BaileysInstanceSession>();
const initPromises = new Map<string, Promise<BaileysInstanceSession>>();
const logger = pino({ level: 'silent' });

// Cache de modificação de arquivos de sessão para evitar uploads repetidos
const fileSyncedMtimes = new Map<string, number>();
const syncDebounceTimers = new Map<string, NodeJS.Timeout>();

function getSessionPath(instanceName: string) {
  const safeName = instanceName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(process.cwd(), 'data', 'whatsapp_sessions', safeName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Sincroniza arquivos de sessão locais (creds.json, chaves) para o Supabase PostgreSQL
export async function syncSessionFilesToSupabase(instanceName: string, force = false): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = getSupabaseClient();
  if (!client) return;

  const safeName = instanceName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sessionDir = getSessionPath(instanceName);
  if (!fs.existsSync(sessionDir)) return;

  try {
    const files = fs.readdirSync(sessionDir);
    const rowsToUpsert: { instance_name: string; file_name: string; file_data: string; updated_at: string }[] = [];

    for (const file of files) {
      const fullPath = path.join(sessionDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const cacheKey = `${safeName}:${file}`;
          const lastSynced = fileSyncedMtimes.get(cacheKey) || 0;
          if (force || stat.mtimeMs > lastSynced) {
            const content = fs.readFileSync(fullPath, 'utf8');
            rowsToUpsert.push({
              instance_name: safeName,
              file_name: file,
              file_data: content,
              updated_at: new Date().toISOString(),
            });
          }
        }
      } catch {}
    }

    if (rowsToUpsert.length > 0) {
      for (let i = 0; i < rowsToUpsert.length; i += 40) {
        const batch = rowsToUpsert.slice(i, i + 40);
        const { error: upsertErr } = await client
          .from('whatsapp_sessions')
          .upsert(batch, { onConflict: 'instance_name,file_name' });
        if (upsertErr) {
          console.error(`[BaileysManager] Erro ao sincronizar lote de sessão no Supabase:`, upsertErr.message);
        } else {
          for (const item of batch) {
            fileSyncedMtimes.set(`${safeName}:${item.file_name}`, Date.now());
          }
        }
      }
      console.log(`[BaileysManager] ☁️ Sessão de "${instanceName}" salva com sucesso no Supabase (${rowsToUpsert.length} arquivos sincronizados)!`);
    }
  } catch (err: any) {
    console.warn(`[BaileysManager] Aviso ao sincronizar sessão "${instanceName}" com Supabase:`, err?.message);
  }
}

// Dispara sincronização em segundo plano com debounce para agrupar atualizações de chaves
export function triggerDebouncedSessionSync(instanceName: string, delayMs = 1500) {
  const existingTimer = syncDebounceTimers.get(instanceName);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    syncDebounceTimers.delete(instanceName);
    syncSessionFilesToSupabase(instanceName).catch(() => {});
  }, delayMs);

  syncDebounceTimers.set(instanceName, timer);
}

// Restaura arquivos da sessão a partir do Supabase PostgreSQL para o disco local
export async function restoreSessionFilesFromSupabase(instanceName: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const client = getSupabaseClient();
  if (!client) return false;

  const safeName = instanceName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sessionDir = getSessionPath(instanceName);

  try {
    const { data, error } = await client
      .from('whatsapp_sessions')
      .select('file_name, file_data')
      .eq('instance_name', safeName);

    if (error || !data || data.length === 0) {
      return false;
    }

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    let credsFound = false;
    for (const row of data) {
      if (row.file_name && row.file_data) {
        const fullPath = path.join(sessionDir, row.file_name);
        fs.writeFileSync(fullPath, row.file_data, 'utf8');
        try {
          const stat = fs.statSync(fullPath);
          fileSyncedMtimes.set(`${safeName}:${row.file_name}`, stat.mtimeMs);
        } catch {}
        if (row.file_name === 'creds.json') credsFound = true;
      }
    }

    console.log(`[BaileysManager] ✅ Sessão "${instanceName}" restaurada do Supabase (${data.length} arquivos, creds=${credsFound})`);
    return credsFound;
  } catch (err: any) {
    console.warn(`[BaileysManager] Erro ao restaurar sessão "${instanceName}" do Supabase:`, err?.message);
    return false;
  }
}

// Remove arquivos da sessão do Supabase quando o usuário solicita desconexão explícita
export async function deleteSessionFilesFromSupabase(instanceName: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = getSupabaseClient();
  if (!client) return;

  const safeName = instanceName.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    await client.from('whatsapp_sessions').delete().eq('instance_name', safeName);
    console.log(`[BaileysManager] 🗑️ Sessão "${instanceName}" removida do Supabase.`);
  } catch (err: any) {
    console.warn(`[BaileysManager] Erro ao remover sessão "${instanceName}" do Supabase:`, err?.message);
  }
}

export async function getOrInitBaileysInstance(
  instanceName: string,
  options: { forceRestart?: boolean } = {}
): Promise<BaileysInstanceSession> {
  // If an initialization is already ongoing for this instance and not forced restart, wait for it
  if (!options.forceRestart && initPromises.has(instanceName)) {
    return initPromises.get(instanceName)!;
  }

  const existing = instancesMap.get(instanceName);

  if (existing && !options.forceRestart) {
    // If already open and connected, return existing
    if (existing.state === 'open' && existing.socket) {
      return existing;
    }
    // If actively waiting for QR code and QR code is still recent (< 45s) with active socket
    if (existing.state === 'waiting_qr' && existing.socket && existing.qrCodeDataUrl && Date.now() < existing.qrExpiresAt) {
      return existing;
    }
  }

  const promise = (async () => {
    // Cleanup old socket if exists
    if (existing?.socket) {
      try {
        existing.socket.end(undefined);
      } catch {}
    }

    const sessionDir = getSessionPath(instanceName);

    if (options.forceRestart) {
      // Remove session directory to allow clean re-pairing
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        fs.mkdirSync(sessionDir, { recursive: true });
        await deleteSessionFilesFromSupabase(instanceName).catch(() => {});
      } catch (e) {
        console.warn('[BaileysManager] Error clearing session dir:', e);
      }
    } else {
      // Se não tem creds no disco local (ex: após deploy no Render), restaura do Supabase antes de iniciar!
      const credsPath = path.join(sessionDir, 'creds.json');
      if (!fs.existsSync(credsPath)) {
        await restoreSessionFilesFromSupabase(instanceName).catch(() => {});
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1043857760] as any }));

    const sessionData: BaileysInstanceSession = {
      instanceName,
      socket: null,
      state: 'connecting',
      qrCodeRaw: null,
      qrCodeDataUrl: null,
      ownerPhone: existing?.ownerPhone || null,
      ownerName: existing?.ownerName || null,
      connectedAt: existing?.connectedAt || null,
      lastError: null,
      qrExpiresAt: Date.now() + 60000,
    };

    instancesMap.set(instanceName, sessionData);

    return new Promise<BaileysInstanceSession>((resolve) => {
      let resolved = false;

      const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS('Desktop'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });

      sessionData.socket = sock;

      sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
          triggerDebouncedSessionSync(instanceName);
        } catch (e) {
          console.error('[Baileys] Error saving creds:', e);
        }
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`[Baileys] Generated REAL QR Code for instance: ${instanceName}`);
          sessionData.qrCodeRaw = qr;
          sessionData.state = 'waiting_qr';
          sessionData.qrExpiresAt = Date.now() + 55000;

          try {
            const dataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 7,
              color: { dark: '#0f172a', light: '#ffffff' },
            });
            sessionData.qrCodeDataUrl = dataUrl;
          } catch (e) {
            console.error('[Baileys] Failed to convert QR to DataURL:', e);
          }

          if (!resolved) {
            resolved = true;
            resolve(sessionData);
          }
        }

        if (connection === 'open') {
          console.log(`[Baileys] WhatsApp connected successfully for instance: ${instanceName}`);
          sessionData.state = 'open';
          sessionData.qrCodeRaw = null;
          sessionData.qrCodeDataUrl = null;
          sessionData.connectedAt = new Date().toISOString();

          if (sock.user) {
            const rawId = sock.user.id || '';
            const digits = rawId.split(':')[0].split('@')[0].replace(/\D/g, '');
            sessionData.ownerPhone = digits ? `+${digits}` : null;
            sessionData.ownerName = sock.user.name || null;
          }

          // Salva imediatamente no Supabase para garantir persistência pós-atualização
          syncSessionFilesToSupabase(instanceName, true).catch(() => {});
          setTimeout(() => syncSessionFilesToSupabase(instanceName, true).catch(() => {}), 4000);
          setTimeout(() => syncSessionFilesToSupabase(instanceName, true).catch(() => {}), 10000);

          if (!resolved) {
            resolved = true;
            resolve(sessionData);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isRestartRequired = statusCode === DisconnectReason.restartRequired;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`[Baileys] Connection closed for ${instanceName}. Code: ${statusCode}. Reconnecting: ${shouldReconnect}`);

          sessionData.state = 'close';
          sessionData.lastError = (lastDisconnect?.error as any)?.message || 'Conexão encerrada';

          if (statusCode === DisconnectReason.loggedOut) {
            try {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch {}
            deleteSessionFilesFromSupabase(instanceName).catch(() => {});
            sessionData.ownerPhone = null;
            sessionData.ownerName = null;
            sessionData.connectedAt = null;
            sessionData.qrCodeRaw = null;
            sessionData.qrCodeDataUrl = null;
          } else if (shouldReconnect) {
            // Clear QR code to force new handshake or load saved creds
            sessionData.qrCodeDataUrl = null;
            sessionData.qrCodeRaw = null;
            sessionData.qrExpiresAt = 0;

            const delay = isRestartRequired ? 600 : 2500;
            setTimeout(() => {
              getOrInitBaileysInstance(instanceName).catch((err) =>
                console.error('[Baileys] Reconnect failed:', err)
              );
            }, delay);
          }
        }
      });

      // Timeout safety fallback: if no QR event fired within 5 seconds (e.g. already authenticated), resolve
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(sessionData);
        }
      }, 4500);
    });
  })();

  initPromises.set(instanceName, promise);
  promise.finally(() => {
    initPromises.delete(instanceName);
  });

  return promise;
}

export function getAvailableSessionDirs(): string[] {
  const base = path.join(process.cwd(), 'data', 'whatsapp_sessions');
  if (!fs.existsSync(base)) return [];
  try {
    return fs.readdirSync(base).filter((d) => {
      const credsPath = path.join(base, d, 'creds.json');
      return fs.existsSync(credsPath);
    });
  } catch {
    return [];
  }
}

export async function getAnyActiveBaileysSession(preferredInstanceName?: string): Promise<BaileysInstanceSession | null> {
  if (!preferredInstanceName) return null;

  // 1. Tenta a instância preferencial em memória
  if (instancesMap.has(preferredInstanceName)) {
    const s = instancesMap.get(preferredInstanceName)!;
    if (s.state === 'open' && s.socket) return s;
  }

  // 2. Tenta restaurar a instância preferencial do disco
  const dirs = getAvailableSessionDirs();
  if (dirs.includes(preferredInstanceName)) {
    try {
      console.log(`[Baileys] Restaurando sessão autenticada do disco para "${preferredInstanceName}"`);
      const restored = await getOrInitBaileysInstance(preferredInstanceName);
      if (restored.state === 'open' && restored.socket) {
        return restored;
      }
    } catch (e) {
      console.warn(`[Baileys] Falha ao restaurar sessão "${preferredInstanceName}":`, e);
    }
  }

  return null;
}

export async function initAllSavedBaileysSessions(): Promise<void> {
  // 1. Busca instâncias que têm sessão salva no Supabase PostgreSQL
  let supabaseInstances: string[] = [];
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      if (client) {
        const { data, error } = await client
          .from('whatsapp_sessions')
          .select('instance_name')
          .eq('file_name', 'creds.json');
        if (!error && data && data.length > 0) {
          supabaseInstances = [...new Set(data.map((r: any) => r.instance_name))];
          console.log(`[BaileysManager] ☁️ Encontradas ${supabaseInstances.length} sessões ativas do WhatsApp no Supabase: ${supabaseInstances.join(', ')}`);
        }
      }
    } catch (e: any) {
      console.warn('[BaileysManager] Erro ao listar sessões no Supabase:', e?.message);
    }
  }

  // 2. Restaura os arquivos do Supabase para o disco local antes de iniciar
  for (const inst of supabaseInstances) {
    await restoreSessionFilesFromSupabase(inst);
  }

  // 3. Combina instâncias locais com as do Supabase
  const dirs = [...new Set([...getAvailableSessionDirs(), ...supabaseInstances])];
  console.log(`[BaileysManager] 🔄 Reconectando sessões ativas do WhatsApp (${dirs.length}): ${dirs.join(', ') || 'nenhuma'}`);

  for (const d of dirs) {
    try {
      getOrInitBaileysInstance(d).catch((e) => {
        console.warn(`[BaileysManager] Falha ao auto-restaurar sessão "${d}":`, e?.message);
      });
    } catch (err: any) {
      console.warn(`[BaileysManager] Erro ao disparar inicialização da sessão "${d}":`, err?.message);
    }
  }
}

export function getBaileysStatus(instanceName: string) {
  const session = instancesMap.get(instanceName);

  if (session) {
    const isConnected = session.state === 'open';
    return {
      connected: isConnected,
      state: session.state,
      ownerPhone: session.ownerPhone,
      ownerName: session.ownerName,
      connectedAt: session.connectedAt,
      instanceName: session.instanceName,
      actualInstanceName: session.instanceName,
      qrCode: session.qrCodeDataUrl,
      message: isConnected
        ? `Conectado com sucesso (${session.ownerPhone || 'WhatsApp Ativo'})`
        : session.state === 'waiting_qr'
        ? 'Aguardando leitura do QR Code pelo WhatsApp'
        : session.state === 'connecting'
        ? 'Conectando ao WhatsApp...'
        : `Desconectado (${session.lastError || 'Pronto para reconectar'})`,
    };
  }

  // Se não está em memória, verifica se há sessão no disco local
  const dirs = getAvailableSessionDirs();
  if (dirs.includes(instanceName)) {
    getOrInitBaileysInstance(instanceName).catch(() => {});
    return {
      connected: false,
      state: 'connecting' as const,
      ownerPhone: null,
      ownerName: null,
      connectedAt: null,
      instanceName: instanceName,
      actualInstanceName: instanceName,
      message: 'Conectando ao WhatsApp com sessão salva...',
    };
  }

  return {
    connected: false,
    state: 'not_initialized' as const,
    instanceName: instanceName,
    actualInstanceName: instanceName,
    message: 'Instância nativa ainda não conectada. Abra o QR Code para conectar seu aparelho.',
  };
}

export async function sendBaileysMessage({
  instanceName,
  phone,
  text,
}: {
  instanceName: string;
  phone: string;
  text: string;
}) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const formattedPhone =
    cleanPhone.length === 10 || cleanPhone.length === 11
      ? `55${cleanPhone}`
      : cleanPhone;

  if (!formattedPhone) {
    throw new Error('Número de telefone inválido para envio.');
  }

  let session = instancesMap.get(instanceName);

  // If session is not initialized or not open, attempt restore strictly for this instance
  if (!session || session.state !== 'open' || !session.socket) {
    session = await getOrInitBaileysInstance(instanceName).catch(() => null as any);
  }

  // Se a sessão está conectando (ex: restaurando do Supabase ou reconectando), aguarda ela ficar aberta
  if (session && session.state === 'connecting') {
    const startWait = Date.now();
    while (Date.now() - startWait < 20000) {
      if ((session.state as string) === 'open' && session.socket) {
        break;
      }
      if ((session.state as string) === 'close' || (session.state as string) === 'waiting_qr') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (!session || session.state !== 'open' || !session.socket) {
    throw new Error(`Instância WhatsApp "${instanceName}" não está conectada no momento. Por favor, conecte via QR Code em Configurações > Automação WhatsApp.`);
  }

  // Resolve o JID real na rede do WhatsApp (essencial para números do Brasil com ou sem 9º dígito)
  let targetJid = `${formattedPhone}@s.whatsapp.net`;
  try {
    const [lookup] = await session.socket.onWhatsApp(formattedPhone);
    if (lookup?.exists && lookup?.jid) {
      targetJid = lookup.jid;
      console.log(`[Baileys] JID verificado via WhatsApp server: ${targetJid}`);
    } else if (formattedPhone.startsWith('55') && formattedPhone.length === 13) {
      // Tenta formato sem o nono dígito (55 + DDD + 8 dígitos)
      const phoneWithout9 = `55${formattedPhone.slice(2, 4)}${formattedPhone.slice(5)}`;
      const [lookup8] = await session.socket.onWhatsApp(phoneWithout9);
      if (lookup8?.exists && lookup8?.jid) {
        targetJid = lookup8.jid;
        console.log(`[Baileys] JID verificado sem 9º dígito: ${targetJid}`);
      }
    }
  } catch (lookupErr: any) {
    console.warn('[Baileys] Aviso ao consultar onWhatsApp:', lookupErr?.message);
  }

  console.log(`[Baileys] Sending WhatsApp message to ${targetJid} via instance ${session.instanceName}`);

  const sent = await session.socket.sendMessage(targetJid, { text });
  return {
    success: true,
    messageId: sent?.key?.id || `msg-${Date.now()}`,
    jid: targetJid,
    instanceName: session.instanceName,
  };
}

export async function disconnectBaileysInstance(instanceName: string) {
  const session = instancesMap.get(instanceName);
  if (session?.socket) {
    try {
      await session.socket.logout();
    } catch {}
    try {
      session.socket.end(undefined);
    } catch {}
  }
  instancesMap.delete(instanceName);

  const sessionDir = getSessionPath(instanceName);
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch {}

  // Remove também do Supabase quando o usuário solicita desconexão explícita
  await deleteSessionFilesFromSupabase(instanceName).catch(() => {});

  return { success: true };
}
