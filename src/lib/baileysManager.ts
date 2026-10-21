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
import { Boom } from '@hapi/boom';
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
    const bundle: Record<string, string> = {};

    // Filtra apenas os arquivos estritamente necessários para autenticação Baileys
    // Ignora milhares de arquivos efêmeros como lid-* e tctoken-* que travavam o event loop
    const essentialFiles = files.filter((f) => {
      if (f === 'creds.json') return true;
      if (f.startsWith('app-state-sync-key-')) return true;
      if (f.startsWith('session-')) return true;
      if (f.startsWith('sender-key-')) return true;
      if (f.startsWith('pre-key-')) return true;
      return false;
    });

    for (const file of essentialFiles) {
      const fullPath = path.join(sessionDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          const content = fs.readFileSync(fullPath, 'utf8');
          bundle[file] = content;
          const cacheKey = `${safeName}:${file}`;
          const lastSynced = fileSyncedMtimes.get(cacheKey) || 0;
          if (force || stat.mtimeMs > lastSynced) {
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

    // 1. Grava bundle consolidado na tabela system_settings (garantida de existir e acessível)
    if (Object.keys(bundle).length > 0 && bundle['creds.json']) {
      try {
        await client.from('system_settings').upsert({
          key: `whatsapp_session_${safeName}`,
          value: bundle,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
        console.log(`[BaileysManager] ☁️ Sessão "${instanceName}" consolidada em system_settings (${Object.keys(bundle).length} arquivos essenciais)!`);
      } catch (sysErr: any) {
        console.warn(`[BaileysManager] Erro ao sincronizar em system_settings:`, sysErr?.message);
      }
    }

    // 2. Também tenta gravar na tabela granular whatsapp_sessions se ela existir
    if (rowsToUpsert.length > 0) {
      try {
        for (let i = 0; i < rowsToUpsert.length; i += 40) {
          const batch = rowsToUpsert.slice(i, i + 40);
          const { error: upsertErr } = await client
            .from('whatsapp_sessions')
            .upsert(batch, { onConflict: 'instance_name,file_name' });
          if (!upsertErr) {
            for (const item of batch) {
              fileSyncedMtimes.set(`${safeName}:${item.file_name}`, Date.now());
            }
          }
        }
      } catch {}
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
    let filesToRestore: { file_name: string; file_data: string }[] = [];

    // 1. Tenta restaurar do bundle em system_settings (mais rápido e 100% garantido)
    try {
      const { data: settingRow } = await client
        .from('system_settings')
        .select('value')
        .eq('key', `whatsapp_session_${safeName}`)
        .maybeSingle();

      if (settingRow && settingRow.value && typeof settingRow.value === 'object') {
        filesToRestore = Object.entries(settingRow.value).map(([file_name, file_data]) => ({
          file_name,
          file_data: String(file_data),
        }));
      }
    } catch {}

    // 2. Se não encontrou em system_settings, tenta whatsapp_sessions
    if (filesToRestore.length === 0) {
      try {
        const { data } = await client
          .from('whatsapp_sessions')
          .select('file_name, file_data')
          .eq('instance_name', safeName);
        if (data && data.length > 0) {
          filesToRestore = data;
        }
      } catch {}
    }

    if (filesToRestore.length === 0) {
      return false;
    }

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    let credsFound = false;
    for (const row of filesToRestore) {
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

    console.log(`[BaileysManager] ✅ Sessão "${instanceName}" restaurada do Supabase (${filesToRestore.length} arquivos, creds=${credsFound})`);
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
    await client.from('system_settings').delete().eq('key', `whatsapp_session_${safeName}`);
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
    const sessionDirCheck = getSessionPath(instanceName);
    const credsCheck = path.join(sessionDirCheck, 'creds.json');
    let isCredsValid = true;
    if (fs.existsSync(credsCheck)) {
      try {
        const c = JSON.parse(fs.readFileSync(credsCheck, 'utf-8'));
        if (c.registered === false) isCredsValid = false;
      } catch {
        isCredsValid = false;
      }
    } else {
      isCredsValid = false;
    }

    // If already open and connected, return existing only if creds on disk are registered
    if (existing.state === 'open' && existing.socket && isCredsValid) {
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
        existing.socket.ev.removeAllListeners('connection.update');
        existing.socket.ev.removeAllListeners('creds.update');
        existing.socket.end(undefined);
      } catch {}
    }

    const sessionDir = getSessionPath(instanceName);
    const credsPath = path.join(sessionDir, 'creds.json');

    // Detecta se a sessão existente está corrompida ou deslogada (registered === false)
    let isStaleSession = false;
    if (fs.existsSync(credsPath)) {
      try {
        const c = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
        if (c && c.registered === false) {
          isStaleSession = true;
        }
      } catch {
        isStaleSession = true;
      }
    }

    if (options.forceRestart || isStaleSession) {
      // Remove session directory to allow clean re-pairing
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        fs.mkdirSync(sessionDir, { recursive: true });
        await deleteSessionFilesFromSupabase(instanceName).catch(() => {});
      } catch (e) {
        console.warn('[BaileysManager] Error clearing session dir:', e);
      }
    } else {
      // Se não tem creds no disco local (ex: após deploy ou restart), restaura do Supabase antes de iniciar!
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
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        syncFullHistory: false,
        markOnlineOnConnect: true,
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

          // Inicia heartbeat ping de presença a cada 25s para manter WebSocket ativo
          try {
            sock.sendPresenceUpdate('available').catch(() => {});
          } catch {}

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
          // Ignora se o socket atual já foi substituído por outro mais recente
          if (sessionData.socket !== sock) {
            console.log(`[Baileys] Ignorando evento close de socket obsoleto para ${instanceName}`);
            return;
          }

          const isExplicit = Boolean((sessionData as any).isExplicitDisconnect);
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isRestartRequired = statusCode === DisconnectReason.restartRequired;
          const shouldReconnect = !isExplicit && statusCode !== DisconnectReason.loggedOut;
          console.log(`[Baileys] Connection closed for ${instanceName}. Code: ${statusCode}. Reconnecting: ${shouldReconnect} (explicit: ${isExplicit})`);

          sessionData.state = 'close';
          sessionData.lastError = (lastDisconnect?.error as any)?.message || 'Conexão encerrada';

          if (isExplicit || statusCode === DisconnectReason.loggedOut) {
            try {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch {}
            deleteSessionFilesFromSupabase(instanceName).catch(() => {});
            sessionData.ownerPhone = null;
            sessionData.ownerName = null;
            sessionData.connectedAt = null;
            sessionData.qrCodeRaw = null;
            sessionData.qrCodeDataUrl = null;
            sessionData.socket = null;
          } else if (shouldReconnect) {
            // Limpa QR code temporário para forçar reconexão
            sessionData.qrCodeDataUrl = null;
            sessionData.qrCodeRaw = null;
            sessionData.qrExpiresAt = 0;
            // Mantém como 'connecting' para evitar que checagens de status resetem a instância para desconectada
            sessionData.state = 'connecting';

            const delay = isRestartRequired ? 1200 : 3000;
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

export function getActiveOpenInstanceName(): string | null {
  for (const [name, sess] of instancesMap.entries()) {
    if (sess.state === 'open' && sess.socket) {
      return name;
    }
  }
  return null;
}

export async function getAnyActiveBaileysSession(preferredInstanceName?: string): Promise<BaileysInstanceSession | null> {
  if (preferredInstanceName && instancesMap.has(preferredInstanceName)) {
    const s = instancesMap.get(preferredInstanceName)!;
    if (s.state === 'open' && s.socket) return s;
  }

  const activeName = getActiveOpenInstanceName();
  if (activeName) {
    return instancesMap.get(activeName) || null;
  }

  // Tenta restaurar do disco
  const dirs = getAvailableSessionDirs();
  const target = preferredInstanceName && dirs.includes(preferredInstanceName) ? preferredInstanceName : dirs[0];
  if (target) {
    try {
      console.log(`[Baileys] Restaurando sessão autenticada do disco para "${target}"`);
      const restored = await getOrInitBaileysInstance(target);
      if (restored.state === 'open' && restored.socket) {
        return restored;
      }
    } catch (e) {
      console.warn(`[Baileys] Falha ao restaurar sessão "${target}":`, e);
    }
  }

  return null;
}

export async function initAllSavedBaileysSessions(): Promise<void> {
  let supabaseInstances: string[] = [];
  if (isSupabaseConfigured()) {
    try {
      const client = getSupabaseClient();
      if (client) {
        // 1. Busca em whatsapp_sessions
        try {
          const { data, error } = await client
            .from('whatsapp_sessions')
            .select('instance_name')
            .eq('file_name', 'creds.json');
          if (!error && data && data.length > 0) {
            supabaseInstances = [...new Set(data.map((r: any) => r.instance_name))];
          }
        } catch {}

        // 2. Busca também em system_settings por whatsapp_session_*
        try {
          const { data: setSessions } = await client
            .from('system_settings')
            .select('key')
            .like('key', 'whatsapp_session_%');
          if (setSessions && setSessions.length > 0) {
            const names = setSessions.map((r: any) => r.key.replace('whatsapp_session_', ''));
            supabaseInstances = [...new Set([...supabaseInstances, ...names])];
          }
        } catch {}

        if (supabaseInstances.length > 0) {
          console.log(`[BaileysManager] ☁️ Encontradas ${supabaseInstances.length} sessões ativas do WhatsApp no Supabase: ${supabaseInstances.join(', ')}`);
        }
      }
    } catch (e: any) {
      console.warn('[BaileysManager] Erro ao listar sessões no Supabase:', e?.message);
    }
  }

  // Restaura os arquivos do Supabase para o disco local antes de iniciar
  for (const inst of supabaseInstances) {
    await restoreSessionFilesFromSupabase(inst);
  }

  // Combina instâncias locais com as do Supabase
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
  let session = instancesMap.get(instanceName);

  // Se a instância solicitada não estiver aberta, verifica se há alguma outra instância conectada
  if (!session || session.state !== 'open') {
    const activeName = getActiveOpenInstanceName();
    if (activeName && instancesMap.has(activeName)) {
      session = instancesMap.get(activeName);
    }
  }

  if (session) {
    const isConnected = session.state === 'open';
    const isReconnecting = session.state === 'connecting' && Boolean(session.ownerPhone);
    return {
      connected: isConnected || isReconnecting,
      isReconnecting,
      state: session.state,
      ownerPhone: session.ownerPhone,
      ownerName: session.ownerName,
      connectedAt: session.connectedAt,
      instanceName: session.instanceName,
      actualInstanceName: session.instanceName,
      qrCode: session.qrCodeDataUrl,
      message: isConnected
        ? `Conectado com sucesso (${session.ownerPhone || 'WhatsApp Ativo'})`
        : isReconnecting
        ? `Reconectando ao WhatsApp (${session.ownerPhone})...`
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
    if (!initPromises.has(instanceName)) {
      getOrInitBaileysInstance(instanceName).catch(() => {});
    }
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

  // Se a instância solicitada não estiver conectada, usa qualquer sessão Baileys conectada
  if (!session || session.state !== 'open' || !session.socket) {
    const activeName = getActiveOpenInstanceName();
    if (activeName && instancesMap.has(activeName)) {
      session = instancesMap.get(activeName);
    }
  }

  // Se não encontrou nenhuma sessão aberta, tenta inicializar/restaurar
  if (!session || session.state !== 'open' || !session.socket) {
    session = await getOrInitBaileysInstance(instanceName).catch(() => null as any);
  }

  // Se a sessão está conectando (ex: restaurando do Supabase ou reconectando), aguarda ela ficar aberta
  if (session && (session.state === 'connecting' || session.state === 'close')) {
    const startWait = Date.now();
    while (Date.now() - startWait < 15000) {
      const current = instancesMap.get(instanceName) || (getActiveOpenInstanceName() ? instancesMap.get(getActiveOpenInstanceName()!) : null);
      if (current && current.state === 'open' && current.socket) {
        session = current;
        break;
      }
      if (current && current.state === 'waiting_qr') {
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

export async function disconnectBaileysInstance(targetInstanceName?: string) {
  const targets = new Set<string>();
  if (targetInstanceName && typeof targetInstanceName === 'string' && targetInstanceName.trim()) {
    targets.add(targetInstanceName.trim());
  }

  // Identifica e inclui qualquer instância que esteja aberta ou com socket ativo
  for (const [name, sess] of instancesMap.entries()) {
    if (sess.state === 'open' || sess.socket) {
      targets.add(name);
    }
  }

  const activeName = getActiveOpenInstanceName();
  if (activeName) {
    targets.add(activeName);
  }

  // Se nenhuma foi identificada, inclui instâncias salvas em diretórios
  if (targets.size === 0) {
    const dirs = getAvailableSessionDirs();
    for (const d of dirs) targets.add(d);
  }

  for (const name of targets) {
    console.log(`[BaileysManager] 🚪 Processando desconexão da instância WhatsApp: "${name}"`);

    // 1. Cancela debounce de sincronização para evitar salvar creds de volta no Supabase
    const syncTimer = syncDebounceTimers.get(name);
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncDebounceTimers.delete(name);
    }

    // 2. Remove promessas de inicialização pendentes
    initPromises.delete(name);

    const session = instancesMap.get(name);
    if (session) {
      (session as any).isExplicitDisconnect = true;
      session.state = 'close';
      session.lastError = 'Desconectado pelo usuário';

      if (session.socket) {
        const sock = session.socket;
        try {
          console.log(`[BaileysManager] 📲 Deslogando dispositivo conectado no WhatsApp para "${name}"...`);
          // O comando logout envia a stanza <remove-companion-device> para o servidor do WhatsApp,
          // fazendo o WhatsApp no aparelho celular deslogar a sessão imediatamente em tempo real!
          await Promise.race([
            sock.logout('Desconexão manual solicitada pelo usuário no painel'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao aguardar logout do WhatsApp')), 4500)),
          ]);
          console.log(`[BaileysManager] ✅ Sessão "${name}" deslogada com sucesso do WhatsApp!`);
        } catch (err: any) {
          console.warn(`[BaileysManager] Aviso durante logout do WhatsApp para "${name}":`, err?.message);
          try {
            sock.end(new Boom('Intentional Logout', { statusCode: DisconnectReason.loggedOut }));
          } catch {}
        }

        try {
          sock.ev.removeAllListeners('connection.update');
          sock.ev.removeAllListeners('creds.update');
        } catch {}
      }

      session.socket = null;
      session.ownerPhone = null;
      session.ownerName = null;
      session.connectedAt = null;
      session.qrCodeRaw = null;
      session.qrCodeDataUrl = null;
    }

    instancesMap.delete(name);

    // 3. Exclui a pasta da sessão no disco local
    const sessionDir = getSessionPath(name);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`[BaileysManager] Erro ao remover diretório local de "${name}":`, e);
    }

    // 4. Remove credenciais do Supabase para evitar restauração automática
    await deleteSessionFilesFromSupabase(name).catch(() => {});
  }

  return { success: true };
}

export async function requestBaileysPairingCode({
  instanceName,
  phoneNumber,
}: {
  instanceName: string;
  phoneNumber: string;
}): Promise<{ success: boolean; code?: string; error?: string }> {
  const cleanPhone = (phoneNumber || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, error: 'Informe um número com DDD válido (ex: 21989850026).' };
  }

  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

  let session = instancesMap.get(instanceName);
  if (!session || !session.socket || session.state === 'close') {
    session = await getOrInitBaileysInstance(instanceName, { forceRestart: true });
  }

  const start = Date.now();
  while (!session.socket && Date.now() - start < 12000) {
    await new Promise((r) => setTimeout(r, 400));
    session = instancesMap.get(instanceName) || session;
  }

  if (!session?.socket) {
    return { success: false, error: 'Falha ao inicializar o socket para solicitar o código.' };
  }

  try {
    const rawCode = await session.socket.requestPairingCode(formattedPhone);
    const formattedCode = rawCode?.match(/.{1,4}/g)?.join('-') || rawCode;
    return { success: true, code: formattedCode };
  } catch (err: any) {
    console.error('[Baileys] Error requesting pairing code:', err);
    return { success: false, error: err?.message || 'Falha ao gerar código de emparelhamento no WhatsApp' };
  }
}
