import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Save,
  RotateCcw,
  Sparkles,
  Check,
  Power,
  ShieldCheck,
  Calendar,
  ExternalLink,
  ChevronRight,
  Info,
  RefreshCw,
  Play,
  History,
  Users,
  CheckCheck,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sun,
  CloudSun,
  Moon,
  Copy,
} from 'lucide-react';
import { Tenant, WhatsAppAutomationConfig, WhatsAppDispatchLog } from '../types/index.js';
import { api } from '../lib/api.js';
import QRCode from 'qrcode';
import { ModuleAutomationDiagnostic } from './ModuleAutomationDiagnostic.js';

interface WhatsAppAutomationViewProps {
  tenant: Tenant;
}

const DEFAULT_TEMPLATE_TOMORROW = `Olá, {primeiro_nome}! Tudo bem? Esperamos que sim! 😊

Passando para te avisar com antecedência que a sua fatura referente ao serviço *{produto}* vence *amanhã*, dia *{data_vencimento}*.

💰 *Valor:* R$ {valor}
🔑 *Chave PIX:* {chave_pix}
🏢 *Favorecido:* {empresa}

Caso já tenha efetuado o pagamento ou tenha agendamento, desconsidere este aviso. Muito obrigado pela parceria! 🤝`;

const DEFAULT_TEMPLATE_TODAY = `⏰ *Aviso de Vencimento Hoje!*

Olá, {cliente}! Bom dia! ☀️

Lembramos que a sua fatura referente a *{produto}* vence *hoje*, dia *{data_vencimento}*.

💰 *Valor a pagar:* R$ {valor}
🔑 *Chave PIX:* {chave_pix}
🏢 *Favorecido:* {empresa}

Após realizar o pagamento via PIX, por favor nos envie o comprovante por aqui para confirmação imediata. Qualquer dúvida estamos à disposição! 🚀`;

const DEFAULT_TEMPLATE_OVERDUE = `⚠️ *Aviso de Fatura em Atraso*

Olá, {primeiro_nome}! Como vai?

Passando para informar que identificamos a sua fatura referente a *{produto}* no valor de *R$ {valor}* que estava com vencimento em *{data_vencimento}* ainda em aberto.

Sabemos que imprevistos acontecem! Para regularizar sua situação de forma simples e rápida, você pode nos pagar via PIX:

🔑 *Chave PIX:* {chave_pix}
🏢 *Favorecido:* {empresa}

Se já realizou o pagamento, por gentileza nos encaminhe o comprovante por aqui. Qualquer dúvida estamos à disposição! 🙏`;

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  color?: 'emerald' | 'purple' | 'blue' | 'amber' | 'rose';
  disabled?: boolean;
  ariaLabel?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  color = 'emerald',
  disabled = false,
  ariaLabel = 'Alternar opção',
}) => {
  const activeBg =
    color === 'purple'
      ? 'bg-purple-600'
      : color === 'blue'
      ? 'bg-blue-600'
      : color === 'amber'
      ? 'bg-amber-600'
      : color === 'rose'
      ? 'bg-rose-600'
      : 'bg-emerald-600';

  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-slate-700/60 p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${checked ? activeBg : 'bg-slate-800'}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export const WhatsAppAutomationView: React.FC<WhatsAppAutomationViewProps> = ({ tenant }) => {
  const storageKey = `cobre_whatsapp_automation_${tenant.id}`;

  const cleanTenantId = (tenant.id || 'tenant').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
  const slugName = (tenant.name || 'cliente')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 15) || 'cliente';
  const defaultInstanceName =
    tenant.id === '2caa686e-9c14-439b-8e9d-9b25cfbac345'
      ? 'instancia_ativacoes_e_vendas'
      : `inst_${slugName}_${cleanTenantId}`;

  const isMasterAdmin =
    tenant.id === '2caa686e-9c14-439b-8e9d-9b25cfbac345' ||
    tenant.email === 'betaof10@hotmail.com' ||
    tenant.email === 'betoqueiroz@hotmail.com' ||
    tenant.email === 'jonjontelaspremium@gmail.com';

  const [config, setConfig] = useState<WhatsAppAutomationConfig>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.server_url && parsed.server_url.includes('meuzap.com')) {
          parsed.server_url = '';
        }
        // Garante isolamento estrito: contas de clientes entram desconectadas e nunca herdam instância do master
        if (!isMasterAdmin) {
          if (
            parsed.instance_name === 'instancia_cobrefacil_master_corporation' ||
            (parsed.instance_name === 'instancia_ativacoes_e_vendas' && !parsed.connected_phone) ||
            parsed.connected_phone?.includes('219899850026')
          ) {
            parsed.instance_name = defaultInstanceName;
            parsed.status = 'disconnected';
            parsed.connected_phone = '';
            delete parsed.connected_at;
          }
        }
        // Ensure new fields are present with defaults
        if (!parsed.template_tomorrow_message) parsed.template_tomorrow_message = DEFAULT_TEMPLATE_TOMORROW;
        if (parsed.template_tomorrow_enabled === undefined) parsed.template_tomorrow_enabled = true;
        if (!parsed.template_today_message) parsed.template_today_message = DEFAULT_TEMPLATE_TODAY;
        if (parsed.template_today_enabled === undefined) parsed.template_today_enabled = true;
        if (parsed.template_overdue_enabled === undefined) parsed.template_overdue_enabled = true;
        if (!parsed.template_overdue_message) parsed.template_overdue_message = DEFAULT_TEMPLATE_OVERDUE;
        if (parsed.overdue_days_limit === undefined) parsed.overdue_days_limit = 30;
        if (parsed.second_scheduled_time_enabled === undefined) parsed.second_scheduled_time_enabled = false;
        if (!parsed.second_scheduled_time) parsed.second_scheduled_time = '14:30';
        if (parsed.morning_schedule_enabled === undefined) parsed.morning_schedule_enabled = true;
        if (!parsed.morning_schedule_time) parsed.morning_schedule_time = parsed.scheduled_time || '09:00';
        if (parsed.afternoon_schedule_enabled === undefined) parsed.afternoon_schedule_enabled = Boolean(parsed.second_scheduled_time_enabled);
        if (!parsed.afternoon_schedule_time) parsed.afternoon_schedule_time = parsed.second_scheduled_time || '14:30';
        if (parsed.night_schedule_enabled === undefined) parsed.night_schedule_enabled = false;
        if (!parsed.night_schedule_time) parsed.night_schedule_time = '19:00';
        if (parsed.charge_business_enabled === undefined) parsed.charge_business_enabled = true;
        if (parsed.charge_iptv_enabled === undefined) parsed.charge_iptv_enabled = true;
        if (parsed.charge_loans_enabled === undefined) parsed.charge_loans_enabled = true;
        if (parsed.charge_subscriptions_enabled === undefined) parsed.charge_subscriptions_enabled = true;
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load local WhatsApp automation config', e);
    }

    return {
      instance_name: defaultInstanceName,
      server_url: '',
      api_key: '',
      status: 'disconnected',
      connected_phone: '',
      auto_send_enabled: true,
      scheduled_time: '09:00',
      second_scheduled_time_enabled: false,
      second_scheduled_time: '14:30',
      morning_schedule_enabled: true,
      morning_schedule_time: '09:00',
      afternoon_schedule_enabled: false,
      afternoon_schedule_time: '14:30',
      night_schedule_enabled: false,
      night_schedule_time: '19:00',
      send_on_weekends: true,
      delay_seconds: 25,
      charge_business_enabled: true,
      charge_iptv_enabled: true,
      charge_loans_enabled: true,
      charge_subscriptions_enabled: true,
      template_tomorrow_enabled: true,
      template_tomorrow_message: DEFAULT_TEMPLATE_TOMORROW,
      template_today_enabled: true,
      template_today_message: DEFAULT_TEMPLATE_TODAY,
      template_overdue_enabled: true,
      template_overdue_message: DEFAULT_TEMPLATE_OVERDUE,
      overdue_days_limit: 30,
    };
  });

  const [loadingConfig, setLoadingConfig] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [countdown, setCountdown] = useState(180);
  const [pairingStatusInfo, setPairingStatusInfo] = useState<string>('Gerando QR Code para conexão...');
  const [pairingMode, setPairingMode] = useState<'qrcode' | 'pairing_code'>('qrcode');
  const [pairingPhone, setPairingPhone] = useState(tenant.whatsapp || config.connected_phone || '21989850026');
  const [pairingCodeValue, setPairingCodeValue] = useState<string | null>(null);
  const [loadingPairingCode, setLoadingPairingCode] = useState(false);
  const [pairingCodeCopied, setPairingCodeCopied] = useState(false);
  const [pairingCodeError, setPairingCodeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [connectionSuccessAlert, setConnectionSuccessAlert] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'tomorrow' | 'today' | 'overdue'>('tomorrow');
  const [activeTextarea, setActiveTextarea] = useState<'tomorrow' | 'today' | 'overdue'>('tomorrow');
  
  // Test send state
  const [testPhone, setTestPhone] = useState(tenant.whatsapp || '');
  const [testingSend, setTestingSend] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    method?: string;
    waDirectUrl?: string;
    error?: string;
    message?: string;
  } | null>(null);

  // Status check state
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Pending items & Execution
  const [pendingData, setPendingData] = useState<{
    todayDate: string;
    tomorrowDate: string;
    pendingToday: any[];
    pendingTomorrow: any[];
    pendingOverdue: any[];
    totalPending: number;
    totalOverdue: number;
  }>({
    todayDate: new Date().toISOString().slice(0, 10),
    tomorrowDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    pendingToday: [],
    pendingTomorrow: [],
    pendingOverdue: [],
    totalPending: 0,
    totalOverdue: 0,
  });
  const [loadingPending, setLoadingPending] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [runResult, setRunResult] = useState<{
    success: boolean;
    message?: string;
    dispatchedCount?: number;
  } | null>(null);
  const [showPendingList, setShowPendingList] = useState(false);

  // Dispatch logs
  const [logs, setLogs] = useState<WhatsAppDispatchLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const tomorrowTextareaRef = useRef<HTMLTextAreaElement>(null);
  const todayTextareaRef = useRef<HTMLTextAreaElement>(null);
  const overdueTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Atualiza um campo de configuração e persiste imediatamente no storage e backend
  const updateConfigField = <K extends keyof WhatsAppAutomationConfig>(
    field: K,
    value: WhatsAppAutomationConfig[K]
  ) => {
    setConfig((prev) => {
      const updated = { ...prev, [field]: value };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
      }
      api.saveWhatsAppConfig(tenant.id, updated).catch(() => {});
      return updated;
    });
  };

  // Atualiza múltiplos campos de configuração simultaneamente e persiste no storage e backend
  const updateConfigFields = (patch: Partial<WhatsAppAutomationConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...patch };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Erro ao salvar no localStorage:', e);
      }
      api.saveWhatsAppConfig(tenant.id, updated).catch(() => {});
      return updated;
    });
  };

  // Restaura mensagem padrão do modelo selecionado
  const handleRestoreTemplate = (templateKey: 'tomorrow' | 'today' | 'overdue') => {
    const defaultText =
      templateKey === 'tomorrow'
        ? DEFAULT_TEMPLATE_TOMORROW
        : templateKey === 'today'
        ? DEFAULT_TEMPLATE_TODAY
        : DEFAULT_TEMPLATE_OVERDUE;

    const configField =
      templateKey === 'tomorrow'
        ? 'template_tomorrow_message'
        : templateKey === 'today'
        ? 'template_today_message'
        : 'template_overdue_message';

    updateConfigField(configField, defaultText);
    setActiveTextarea(templateKey);
    setPreviewTab(templateKey);
  };

  // Load configuration from backend API
  const loadConfigFromBackend = async () => {
    setLoadingConfig(true);
    try {
      const serverConfig = await api.getWhatsAppConfig(tenant.id);
      if (serverConfig && serverConfig.instance_name) {
        if (
          !isMasterAdmin &&
          (serverConfig.instance_name === 'instancia_cobrefacil_master_corporation' ||
            (serverConfig.instance_name === 'instancia_ativacoes_e_vendas' && !serverConfig.connected_phone) ||
            serverConfig.connected_phone?.includes('219899850026'))
        ) {
          serverConfig.instance_name = defaultInstanceName;
          serverConfig.status = 'disconnected';
          serverConfig.connected_phone = '';
          delete serverConfig.connected_at;
          api.saveWhatsAppConfig(tenant.id, serverConfig).catch(() => {});
        }

        if (!serverConfig.template_tomorrow_message) serverConfig.template_tomorrow_message = DEFAULT_TEMPLATE_TOMORROW;
        if (!serverConfig.template_today_message) serverConfig.template_today_message = DEFAULT_TEMPLATE_TODAY;
        if (!serverConfig.template_overdue_message) serverConfig.template_overdue_message = DEFAULT_TEMPLATE_OVERDUE;

        setConfig(serverConfig);
        localStorage.setItem(storageKey, JSON.stringify(serverConfig));

        // Auto-verifica o status real da instância em segundo plano para manter o badge 100% fiel
        api.getWhatsAppInstanceStatus({
          server_url: serverConfig.server_url,
          api_key: serverConfig.api_key,
          instance_name: serverConfig.instance_name,
        }).then((liveRes) => {
          // Se a instância estiver em processo de conexão ou reconexão automática, NÃO reseta o status para desconectada
          if (liveRes?.state === 'connecting' || (liveRes as any)?.isReconnecting) {
            return;
          }
          const liveInst = (liveRes as any)?.actualInstanceName || (liveRes as any)?.instanceName;
          if (!isMasterAdmin && liveInst && (liveInst.includes('ativa') || liveInst.startsWith('instancia_'))) {
            return;
          }
          const actualStatus = liveRes?.connected ? 'connected' : 'disconnected';
          const ownerPhone = (liveRes as any)?.ownerPhone || '';
          if (!isMasterAdmin && ownerPhone && (ownerPhone.includes('219899850026') || ownerPhone.includes('21989850026'))) {
            return;
          }
          if (serverConfig.status !== actualStatus) {
            const updated: WhatsAppAutomationConfig = {
              ...serverConfig,
              status: actualStatus,
              connected_phone: liveRes?.connected ? (ownerPhone || serverConfig.connected_phone) : '',
              connected_at: liveRes?.connected ? (serverConfig.connected_at || new Date().toISOString()) : undefined,
            };
            setConfig(updated);
            localStorage.setItem(storageKey, JSON.stringify(updated));
            api.saveWhatsAppConfig(tenant.id, updated).catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Could not load WhatsApp config from server, using local fallback:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Load pending automation notices
  const loadPendingNotices = async () => {
    setLoadingPending(true);
    try {
      const data = await api.getPendingAutomationNotices(tenant.id);
      if (
        data &&
        typeof data === 'object' &&
        typeof (data as any).todayDate === 'string' &&
        Array.isArray((data as any).pendingToday)
      ) {
        setPendingData({
          todayDate: data.todayDate,
          tomorrowDate: data.tomorrowDate || '',
          pendingToday: Array.isArray(data.pendingToday) ? data.pendingToday : [],
          pendingTomorrow: Array.isArray(data.pendingTomorrow) ? data.pendingTomorrow : [],
          pendingOverdue: Array.isArray(data.pendingOverdue) ? data.pendingOverdue : [],
          totalPending: typeof data.totalPending === 'number' ? data.totalPending : 0,
          totalOverdue: typeof data.totalOverdue === 'number' ? data.totalOverdue : 0,
        });
      }
    } catch (err) {
      console.warn('Failed to load pending notices:', err);
    } finally {
      setLoadingPending(false);
    }
  };

  // Load recent dispatch logs
  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await api.getWhatsAppDispatchLogs(tenant.id, 20);
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.warn('Failed to load dispatch logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadConfigFromBackend();
    loadPendingNotices();
    loadLogs();
  }, [tenant.id]);

  // QR Code pairing logic & Real-time Auto-Detection
  useEffect(() => {
    let timer: any;
    let statusPoller: any;

    if (connecting) {
      setCountdown(180);
      setPairingStatusInfo('Inicializando sessão segura do WhatsApp e gerando QR Code oficial...');
      setQrCodeDataUrl(null);

      const requestRealQR = async () => {
        try {
          // 1. Tenta criar/conectar na instância
          const res = await api.createWhatsAppInstance({
            server_url: config.server_url,
            api_key: config.api_key,
            instance_name: config.instance_name,
          });

          if (res?.base64) {
            setQrCodeDataUrl(res.base64.startsWith('data:') ? res.base64 : `data:image/png;base64,${res.base64}`);
            setPairingStatusInfo('Aponte a câmera do WhatsApp para escanear');
            return;
          } else if (res?.code) {
            const url = await QRCode.toDataURL(res.code, {
              margin: 3,
              scale: 8,
              color: { dark: '#000000', light: '#ffffff' },
            });
            setQrCodeDataUrl(url);
            setPairingStatusInfo('Aponte a câmera do WhatsApp para escanear');
            return;
          }

          // Fallback para connect se create não retornou imediato
          const connRes = await api.connectWhatsAppInstance({
            server_url: config.server_url,
            api_key: config.api_key,
            instance_name: config.instance_name,
          });

          if (connRes?.base64) {
            setQrCodeDataUrl(connRes.base64.startsWith('data:') ? connRes.base64 : `data:image/png;base64,${connRes.base64}`);
            setPairingStatusInfo('Aponte a câmera do WhatsApp para escanear');
          } else if (connRes?.code) {
            const url = await QRCode.toDataURL(connRes.code, {
              margin: 3,
              scale: 8,
              color: { dark: '#000000', light: '#ffffff' },
            });
            setQrCodeDataUrl(url);
            setPairingStatusInfo('Aponte a câmera do WhatsApp para escanear');
          } else {
            setPairingStatusInfo('Aguardando resposta do WhatsApp... Se demorar, clique em "Regerar QR Code".');
          }
        } catch (err: any) {
          console.error('[WhatsApp Pairing Error]', err);
          setPairingStatusInfo(`Erro na geração: ${err?.message || 'Falha ao obter QR Code'}. Clique em "Regerar QR Code".`);
        }
      };

      requestRealQR();

      // 2. Auto-polling: detecta em tempo real quando o usuário escaneia no celular
      statusPoller = setInterval(async () => {
        try {
          const res = await api.getWhatsAppInstanceStatus({
            server_url: config.server_url,
            api_key: config.api_key,
            instance_name: config.instance_name,
          });

          if (res?.connected) {
            clearInterval(statusPoller);
            if (timer) clearInterval(timer);

            const connectedPhone = (res as any).ownerPhone || tenant.whatsapp || config.connected_phone || '+55 (11) 98765-4321';
            const actualInst = (res as any).actualInstanceName || (res as any).instanceName || config.instance_name;
            const updated: WhatsAppAutomationConfig = {
              ...config,
              instance_name: actualInst,
              status: 'connected',
              connected_phone: connectedPhone,
              connected_at: new Date().toISOString(),
            };

            setConfig(updated);
            localStorage.setItem(storageKey, JSON.stringify(updated));
            api.saveWhatsAppConfig(tenant.id, updated).catch(() => {});

            setConnecting(false);
            setQrCodeDataUrl(null);
            setConnectionSuccessAlert(`🎉 WhatsApp conectado com sucesso à instância "${actualInst}"! O número ${connectedPhone} está ativo para disparos automáticos.`);
            setTimeout(() => setConnectionSuccessAlert(null), 8000);
          }
        } catch {}
      }, 2000);

      // 3. Contagem regressiva do QR code
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            if (statusPoller) clearInterval(statusPoller);
            setConnecting(false);
            setQrCodeDataUrl(null);
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setQrCodeDataUrl(null);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (statusPoller) clearInterval(statusPoller);
    };
  }, [connecting, config.instance_name, config.server_url, config.api_key]);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
      const res = await api.saveWhatsAppConfig(tenant.id, config);
      if (res?.config) {
        setConfig(res.config);
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save WhatsApp config', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckInstanceStatus = async () => {
    setCheckingStatus(true);
    setStatusMessage(null);
    try {
      const res = await api.getWhatsAppInstanceStatus({
        server_url: config.server_url,
        api_key: config.api_key,
        instance_name: config.instance_name,
      });

      if (res?.connected) {
        const actualInst = (res as any).actualInstanceName || (res as any).instanceName || config.instance_name;
        const connectedPhone = (res as any).ownerPhone || tenant.whatsapp || config.connected_phone;
        const updated: WhatsAppAutomationConfig = {
          ...config,
          instance_name: actualInst,
          status: 'connected',
          connected_phone: connectedPhone,
          connected_at: new Date().toISOString(),
        };
        setConfig(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        api.saveWhatsAppConfig(tenant.id, updated).catch(() => {});
        setStatusMessage(`✅ WhatsApp conectado com sucesso (${connectedPhone || 'Ativo'}) via instância "${actualInst}"!`);
      } else {
        setStatusMessage(`ℹ️ ${res?.message || 'Instância desconectada ou aguardando QR Code.'}`);
      }
    } catch (err: any) {
      setStatusMessage(`⚠️ Erro ao verificar: ${err?.message || 'Servidor inacessível'}`);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleStartConnection = (forceNewInstance = false) => {
    if (forceNewInstance) {
      const slug = (tenant.trade_name || tenant.name || 'empresa')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 15);
      const newInstName = isMasterAdmin
        ? 'instancia_ativacoes_e_vendas'
        : `inst_${slug}_${cleanTenantId}_${Math.random().toString(36).substring(2, 6)}`;
      setConfig((prev) => ({
        ...prev,
        instance_name: newInstName,
        status: 'disconnected',
        connected_phone: '',
      }));
    }
    setConnecting(true);
  };

  const handleRegenerateQR = () => {
    setCountdown(180);
    setQrCodeDataUrl(null);
    setPairingStatusInfo('Recriando sessão e gerando novo QR Code oficial...');
    api.createWhatsAppInstance({
      server_url: config.server_url,
      api_key: config.api_key,
      instance_name: config.instance_name,
    })
      .then((res) => {
        if (res?.base64) {
          setQrCodeDataUrl(res.base64.startsWith('data:') ? res.base64 : `data:image/png;base64,${res.base64}`);
          setPairingStatusInfo('Aponte a câmera do WhatsApp para escanear');
        } else if (res?.code) {
          QRCode.toDataURL(res.code, {
            margin: 3,
            scale: 8,
            color: { dark: '#000000', light: '#ffffff' },
          }).then((url) => {
            setQrCodeDataUrl(url);
            setPairingStatusInfo('Aponte a câmera do WhatsApp para escanear');
          });
        } else {
          setPairingStatusInfo('Aguardando código... Tente novamente em instantes.');
        }
      })
      .catch((err) => {
        setPairingStatusInfo(`Erro ao regerar: ${err?.message || 'Falha ao obter QR'}`);
      });
  };

  const handleRequestPairingCode = async () => {
    const raw = (pairingPhone || '').replace(/\D/g, '');
    if (raw.length < 10) {
      setPairingCodeError('Informe um número de WhatsApp com DDD (ex: 21989850026).');
      return;
    }
    setLoadingPairingCode(true);
    setPairingCodeError(null);
    setPairingCodeValue(null);
    setPairingStatusInfo('Solicitando código de emparelhamento de 8 dígitos ao WhatsApp...');
    try {
      const res = await api.requestWhatsAppPairingCode({
        instance_name: config.instance_name || 'instancia_ativacoes_e_vendas',
        phoneNumber: raw,
      });
      if (res.success && res.code) {
        setPairingCodeValue(res.code);
        setPairingStatusInfo(`Código gerado: ${res.code}. Digite este código no WhatsApp do celular agora!`);
      } else {
        setPairingCodeError(res.error || 'Falha ao gerar código no WhatsApp');
      }
    } catch (err: any) {
      setPairingCodeError(err?.message || 'Erro ao comunicar com o servidor');
    } finally {
      setLoadingPairingCode(false);
    }
  };

  const handleSimulateConnected = async () => {
    setCheckingStatus(true);
    try {
      const res = await api.getWhatsAppInstanceStatus({
        server_url: config.server_url,
        api_key: config.api_key,
        instance_name: config.instance_name,
      });

      if (res?.connected) {
        const connectedPhone = (res as any).ownerPhone || tenant.whatsapp || config.connected_phone || '+55 (11) 98765-4321';
        const actualInst = (res as any).actualInstanceName || (res as any).instanceName || config.instance_name;
        const updated: WhatsAppAutomationConfig = {
          ...config,
          instance_name: actualInst,
          status: 'connected',
          connected_phone: connectedPhone,
          connected_at: new Date().toISOString(),
        };
        setConfig(updated);
        setConnecting(false);
        setQrCodeDataUrl(null);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        api.saveWhatsAppConfig(tenant.id, updated).catch(() => {});
        setConnectionSuccessAlert(`🎉 WhatsApp conectado com sucesso à instância "${actualInst}"! O número ${connectedPhone} está ativo para disparos automáticos.`);
        setTimeout(() => setConnectionSuccessAlert(null), 8000);
        return;
      } else {
        // Se ainda não detectou o escaneamento na API/WhatsApp
        setPairingStatusInfo(`Aguardando leitura do QR Code no aparelho... (${res?.message || 'ainda não escaneado'})`);
        alert(
          `⚠️ O WhatsApp ainda não detectou a leitura do QR Code pelo seu aparelho celular.\n\nPor favor, no seu celular vá em:\nWhatsApp > Aparelhos Conectados > Conectar um aparelho\ne aponte a câmera para o QR Code na tela.\n\nAssim que o celular ler o código, o sistema detectará automaticamente!`
        );
        return;
      }
    } catch (e: any) {
      console.warn('Erro ao checar status antes da confirmação:', e);
      alert('⚠️ Erro ao verificar status da conexão. Tente clicar em "Regerar QR Code".');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Tem certeza que deseja desconectar a instância do WhatsApp? Os disparos automáticos serão pausados até nova conexão.')) {
      setCheckingStatus(true);
      try {
        await api.disconnectWhatsAppInstance({
          server_url: config.server_url,
          api_key: config.api_key,
          instance_name: config.instance_name,
          tenantId: tenant.id,
        });
      } catch (err) {
        console.warn('Erro ao chamar desconexão de instância:', err);
      }

      const updated: WhatsAppAutomationConfig = {
        ...config,
        status: 'disconnected',
        connected_phone: '',
        connected_at: undefined,
      };
      setConfig(updated);
      setConnecting(false);
      setQrCodeDataUrl(null);
      setPairingStatusInfo('');
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      await api.saveWhatsAppConfig(tenant.id, updated).catch(() => {});
      setCheckingStatus(false);
    }
  };


  const insertTag = (tag: string) => {
    const targetRef =
      activeTextarea === 'tomorrow'
        ? tomorrowTextareaRef
        : activeTextarea === 'today'
        ? todayTextareaRef
        : overdueTextareaRef;
    const targetKey =
      activeTextarea === 'tomorrow'
        ? 'template_tomorrow_message'
        : activeTextarea === 'today'
        ? 'template_today_message'
        : 'template_overdue_message';
    const fallbackVal =
      activeTextarea === 'tomorrow'
        ? DEFAULT_TEMPLATE_TOMORROW
        : activeTextarea === 'today'
        ? DEFAULT_TEMPLATE_TODAY
        : DEFAULT_TEMPLATE_OVERDUE;
    const currentVal = config[targetKey] || fallbackVal;

    if (targetRef.current) {
      const start = targetRef.current.selectionStart || currentVal.length;
      const end = targetRef.current.selectionEnd || currentVal.length;
      const updated = currentVal.substring(0, start) + tag + currentVal.substring(end);
      setConfig((prev) => ({ ...prev, [targetKey]: updated }));
      setTimeout(() => {
        if (targetRef.current) {
          targetRef.current.focus();
          targetRef.current.selectionStart = targetRef.current.selectionEnd = start + tag.length;
        }
      }, 50);
    } else {
      setConfig((prev) => ({ ...prev, [targetKey]: currentVal + ' ' + tag }));
    }

    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  // Preview formatting
  const getRenderedPreview = (text?: string) => {
    const rawText =
      (typeof text === 'string' && text.length > 0)
        ? text
        : previewTab === 'tomorrow'
        ? (config?.template_tomorrow_message || DEFAULT_TEMPLATE_TOMORROW)
        : previewTab === 'today'
        ? (config?.template_today_message || DEFAULT_TEMPLATE_TODAY)
        : (config?.template_overdue_message || DEFAULT_TEMPLATE_OVERDUE);

    if (!rawText || typeof rawText !== 'string') {
      return '';
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('pt-BR');
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const overdueStr = new Date(Date.now() - 5 * 86400000).toLocaleDateString('pt-BR'); // 5 days ago sample

    const sampleData: Record<string, string> = {
      '{cliente}': 'Nome do Cliente',
      '{primeiro_nome}': 'Cliente',
      '{produto}': 'Plano / Serviço Contratado',
      '{valor}': '35,00',
      '{data_vencimento}': previewTab === 'tomorrow' ? tomorrowStr : previewTab === 'overdue' ? overdueStr : todayStr,
      '{chave_pix}': tenant?.pix_key || 'contato@suaempresa.com.br',
      '{empresa}': tenant?.trade_name || tenant?.name || 'Minha Empresa',
      '{link_pagamento}': 'https://cobre.app/fatura/98213',
      '{telefone}': tenant?.whatsapp || '(11) 98765-4321',
    };

    let result = String(rawText);
    for (const [tag, val] of Object.entries(sampleData)) {
      result = result.split(tag).join(String(val ?? ''));
    }
    return result;
  };

  const getActivePreviewMessage = () => {
    if (previewTab === 'tomorrow') {
      return config?.template_tomorrow_message || DEFAULT_TEMPLATE_TOMORROW;
    }
    if (previewTab === 'today') {
      return config?.template_today_message || DEFAULT_TEMPLATE_TODAY;
    }
    return config?.template_overdue_message || DEFAULT_TEMPLATE_OVERDUE;
  };

  // Test Send
  const handleTestSend = async () => {
    if (!testPhone.trim()) {
      alert('Informe um número de telefone com DDD para testar o envio.');
      return;
    }

    setTestingSend(true);
    setTestResult(null);

    const messageToSend = getRenderedPreview(getActivePreviewMessage());

    try {
      const res = await api.testWhatsAppSend({
        tenantId: tenant.id,
        phone: testPhone,
        message: messageToSend,
      });

      setTestResult(res);
      loadLogs();
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.message || 'Falha ao enviar mensagem de teste.',
      });
    } finally {
      setTestingSend(false);
    }
  };

  // Run Automation Now (Immediate Dispatch)
  const handleRunAutomationNow = async () => {
    const total = pendingData.totalPending + (pendingData.totalOverdue ?? 0);
    const msg = total > 0
      ? `Deseja executar o disparo agora para ${pendingData.totalPending} fatura(s) com vencimento hoje/amanhã e ${pendingData.totalOverdue ?? 0} vencida(s)?`
      : 'Não há faturas pendentes ou vencidas registradas no momento. Deseja executar a verificação assim mesmo?';

    if (!confirm(msg)) return;

    setRunningAutomation(true);
    setRunResult(null);

    try {
      const res = await api.runAutomatedDispatches(tenant.id, true);
      const count = res?.dispatchedCount || 0;
      setRunResult({
        success: true,
        dispatchedCount: count,
        message:
          count > 0
            ? `🚀 ${count} fatura(s) disparada(s) com sucesso via WhatsApp!`
            : `✅ Verificação concluída: Nenhuma fatura com vencimento hoje ou amanhã pendente de aviso. O agendador automático enviará assim que chegarem ao dia de vencimento!`,
      });
      loadPendingNotices();
      loadLogs();
      loadConfigFromBackend();
    } catch (err: any) {
      setRunResult({
        success: false,
        message: `Falha ao executar automação: ${err?.message || err}`,
      });
    } finally {
      setRunningAutomation(false);
    }
  };

  const tagsList = [
    { tag: '{cliente}', label: 'Nome Completo', desc: 'Ex: Carlos Eduardo Silva' },
    { tag: '{primeiro_nome}', label: 'Primeiro Nome', desc: 'Ex: Carlos' },
    { tag: '{produto}', label: 'Produto / Serviço', desc: 'Ex: Plano Mensal' },
    { tag: '{valor}', label: 'Valor da Fatura', desc: 'Ex: 35,00' },
    { tag: '{data_vencimento}', label: 'Data de Vencimento', desc: 'Ex: 30/09/2026' },
    { tag: '{chave_pix}', label: 'Chave PIX', desc: 'Chave cadastrada' },
    { tag: '{empresa}', label: 'Nome da Empresa', desc: 'Nome Fantasia' },
    { tag: '{link_pagamento}', label: 'Link da Fatura', desc: 'URL de pagamento' },
    { tag: '{telefone}', label: 'Telefone', desc: 'Telefone do cliente' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Success banner when connected */}
      {connectionSuccessAlert && (
        <div className="p-4 bg-emerald-950/90 border border-emerald-500 rounded-2xl flex items-center justify-between gap-3 text-emerald-200 shadow-xl animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-semibold">{connectionSuccessAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setConnectionSuccessAlert(null)}
            className="text-xs text-emerald-400 hover:text-white px-2 py-1 rounded"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Top Banner / Status Overview */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0d2218] via-[#0b1c2b] to-[#0f172a] border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shrink-0 border ${
              config.status === 'connected'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-950/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}
          >
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-white tracking-tight">
                Automação de Disparos WhatsApp
              </h2>
              {config.status === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Instância Conectada ({config.instance_name})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Aguardando Conexão</span>
                </span>
              )}
              {config.auto_send_enabled && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Clock className="w-3 h-3" />
                  <span>
                    Diário:{' '}
                    {[
                      config.morning_schedule_enabled !== false ? `☀️ ${config.morning_schedule_time || config.scheduled_time || '09:00'}` : null,
                      (config.afternoon_schedule_enabled || config.second_scheduled_time_enabled) ? `⛅ ${config.afternoon_schedule_time || config.second_scheduled_time || '14:30'}` : null,
                      config.night_schedule_enabled ? `🌙 ${config.night_schedule_time || '19:00'}` : null,
                    ].filter(Boolean).join(' • ') || 'Nenhum turno ativo'}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Envio automático de lembretes de cobrança com chave PIX na véspera e no dia do vencimento.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRunAutomationNow}
            disabled={runningAutomation}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Executar disparos de hoje e amanhã agora mesmo"
          >
            {runningAutomation ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{runningAutomation ? 'Disparando...' : 'Disparar Agora (Manual)'}</span>
          </button>

          {config.status === 'connected' ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStartConnection(false)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Reconectar com novo QR Code"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>Reconectar</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={checkingStatus}
                className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{checkingStatus ? 'Desconectando...' : 'Desconectar'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStartConnection(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Cria uma nova instância e abre o QR Code para conectar"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gerar Nova Instância (QR Code)</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartConnection(false)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Conectar a instância já cadastrada"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>Conectar Existente</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PAINEL DE EXECUÇÃO & STATUS DAS COBRANÇAS PENDENTES */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Painel de Disparos do Dia</span>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {pendingData.totalPending} para notificar
                </span>
                {(pendingData.totalOverdue ?? 0) > 0 && (
                  <span className="text-[11px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    {pendingData.totalOverdue} vencidos
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Faturas e assinaturas com vencimento hoje ou amanhã aguardando aviso pelo WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadPendingNotices();
                loadLogs();
              }}
              disabled={loadingPending}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Atualizar lista de faturas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPendingList(!showPendingList)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>{showPendingList ? 'Ocultar detalhes' : 'Ver clientes'}</span>
              {showPendingList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 4 Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {/* Vencem Hoje */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Vencem Hoje ({(() => {
                  const d = pendingData?.todayDate || '';
                  return typeof d === 'string' && d.includes('-')
                    ? d.split('-').reverse().join('/')
                    : new Date().toLocaleDateString('pt-BR');
                })()})
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {Array.isArray(pendingData?.pendingToday) ? pendingData.pendingToday.length : 0}
              </span>
              <span className="text-[10px] text-slate-500">
                {config.template_today_enabled ? 'Disparo ativo' : 'Disparo pausado'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Vencem Amanhã */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                Vencem Amanhã ({(() => {
                  const d = pendingData?.tomorrowDate || '';
                  return typeof d === 'string' && d.includes('-')
                    ? d.split('-').reverse().join('/')
                    : new Date(Date.now() + 86400000).toLocaleDateString('pt-BR');
                })()})
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {Array.isArray(pendingData?.pendingTomorrow) ? pendingData.pendingTomorrow.length : 0}
              </span>
              <span className="text-[10px] text-slate-500">
                {config.template_tomorrow_enabled ? 'Disparo ativo (véspera)' : 'Disparo pausado'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          {/* Vencidos / Inadimplentes */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-rose-800/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                Vencidos (até {config.overdue_days_limit ?? 30}d)
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {pendingData?.totalOverdue ?? (Array.isArray(pendingData?.pendingOverdue) ? pendingData.pendingOverdue.length : 0)}
              </span>
              <span className="text-[10px] text-slate-500">
                {config.template_overdue_enabled ? 'Cobrança ativa' : 'Cobrança pausada'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>

          {/* Última Execução */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                Último Disparo
              </span>
              <span className="text-xs font-bold text-slate-200 mt-1 block">
                {(() => {
                  if (!config?.last_run_at) return 'Ainda não executado';
                  try {
                    const d = new Date(config.last_run_at);
                    return isNaN(d.getTime()) ? 'Ainda não executado' : d.toLocaleString('pt-BR');
                  } catch {
                    return 'Ainda não executado';
                  }
                })()}
              </span>
              <span className="text-[10px] text-slate-500">
                {config.last_run_count !== undefined ? `${config.last_run_count} mensagens enviadas` : 'Agendado diariamente'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <CheckCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Detailed pending list toggle */}
        {showPendingList && (
          <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-slate-400">
              Clientes que receberão aviso:
            </h4>
            {(pendingData?.totalPending || 0) === 0 && (pendingData?.totalOverdue || 0) === 0 ? (
              <div className="text-slate-500 text-xs py-2 text-center">
                Nenhuma fatura com vencimento para hoje ou amanhã com telefone cadastrado.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {[...(pendingData?.pendingToday || []), ...(pendingData?.pendingTomorrow || []), ...(pendingData?.pendingOverdue || [])].map((item, idx) => (
                  <div
                    key={`${item.id || idx}-${idx}`}
                    className="p-2 bg-slate-900/80 rounded-lg border border-slate-800/80 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          item.type === 'due_today'
                            ? 'bg-amber-500/20 text-amber-300'
                            : item.type === 'overdue'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {item.type === 'due_today' ? 'Vence Hoje' : item.type === 'overdue' ? '⚠️ Vencido' : 'Vence Amanhã'}
                      </span>
                      {item.source && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                          item.source === 'iptv'
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : item.source === 'loan'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : item.source === 'subscription'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {item.source === 'iptv'
                            ? '📺 IPTV'
                            : item.source === 'loan'
                            ? '💰 Empréstimo'
                            : item.source === 'subscription'
                            ? '🔄 Assinatura'
                            : '🏢 Negócios'}
                        </span>
                      )}
                      <span className="font-bold text-white">{item.customer_name || 'Cliente'}</span>
                      <span className="text-slate-400 font-mono text-[11px]">({item.phone || 'Sem telefone'})</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${item.type === 'overdue' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {Number(item.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <span className="text-[10px] text-slate-500 block">{item.product || 'Serviço'}</span>
                      {item.type === 'overdue' && (
                        <span className="text-[9px] text-rose-400/70 block">
                          venc. {typeof item.due_date === 'string' && item.due_date.includes('-') ? item.due_date.split('-').reverse().join('/') : String(item.due_date || '')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Result of manual execution */}
        {runResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in ${
              runResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {runResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{runResult.message || `${runResult.dispatchedCount} mensagens processadas.`}</span>
            </div>
            <button
              type="button"
              onClick={() => setRunResult(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Fechar
            </button>
          </div>
        )}
      </div>

      {/* QR Code / Connection Modal / Section */}
      {connecting && (
        <div className="p-6 bg-slate-900 border border-emerald-500/50 rounded-2xl shadow-2xl space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Conectar WhatsApp à Instância</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/30">
                    {config.instance_name}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Escaneie com a câmera do WhatsApp para ativar as mensagens automáticas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Expira em: {countdown}s
              </span>
              <button
                type="button"
                onClick={handleRegenerateQR}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                title="Gerar novo código"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">Regerar QR Code</span>
              </button>
            </div>
          </div>

          {/* Live auto-detection status radar */}
          <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300">
                <b>Status da Conexão:</b> {pairingStatusInfo}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Detecção automática em tempo real
            </span>
          </div>

          {/* Tabs: QR Code vs Pairing Code */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setPairingMode('qrcode')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                pairingMode === 'qrcode'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>📷 Escanear QR Code</span>
            </button>
            <button
              type="button"
              onClick={() => setPairingMode('pairing_code')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                pairingMode === 'pairing_code'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>🔢 Conectar com Código (Sem Câmera)</span>
            </button>
          </div>

          {pairingMode === 'qrcode' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* QR Code view */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-950 rounded-2xl border border-slate-800">
                {qrCodeDataUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-2xl">
                    <img src={qrCodeDataUrl} alt="WhatsApp QR Code" className="w-56 h-56 object-contain" />
                  </div>
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-500 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                    <span className="text-xs">Gerando QR Code...</span>
                  </div>
                )}
                <div className="text-[11px] text-slate-400 mt-3 text-center">
                  Aponte a câmera do WhatsApp para este código
                </div>
              </div>

              {/* Step by step instructions */}
              <div className="space-y-3 text-xs text-slate-300">
                <div className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span>Como Conectar no Seu Smartphone:</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    1
                  </span>
                  <span>Abra o <b>WhatsApp</b> no seu celular.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    2
                  </span>
                  <span>Toque em <b>Mais opções (⋮)</b> ou <b>Configurações (⚙️)</b> e selecione <b>Aparelhos Conectados</b>.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    3
                  </span>
                  <span>Toque em <b>Conectar um aparelho</b> e aponte a câmera para o QR Code ao lado.</span>
                </div>

                {/* Action buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={handleSimulateConnected}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Já Escaneei / Confirmar Conexão</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConnecting(false);
                      setQrCodeDataUrl(null);
                    }}
                    className="w-full py-1.5 text-slate-400 hover:text-white text-xs text-center cursor-pointer"
                  >
                    Fechar Janela
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Pairing Code view */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                <div className="w-full space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Número do WhatsApp (com DDD)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      placeholder="Ex: 21989850026"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleRequestPairingCode}
                      disabled={loadingPairingCode}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      {loadingPairingCode ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>{loadingPairingCode ? 'Gerando...' : 'Gerar Código'}</span>
                    </button>
                  </div>
                  {pairingCodeError && (
                    <p className="text-[11px] text-rose-400 font-medium">{pairingCodeError}</p>
                  )}
                </div>

                {pairingCodeValue ? (
                  <div className="w-full p-4 bg-emerald-950/30 border-2 border-emerald-500 rounded-2xl flex flex-col items-center justify-center gap-2">
                    <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                      Seu Código de Conexão:
                    </span>
                    <div className="font-mono text-3xl font-black text-white tracking-widest bg-slate-900/90 px-5 py-2.5 rounded-xl border border-emerald-500/40 select-all">
                      {pairingCodeValue}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pairingCodeValue.replace('-', ''));
                        setPairingCodeCopied(true);
                        setTimeout(() => setPairingCodeCopied(false), 2500);
                      }}
                      className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium"
                    >
                      <Copy className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{pairingCodeCopied ? 'Código Copiado!' : 'Copiar Código'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-full py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1.5">
                    <Smartphone className="w-8 h-8 text-slate-600" />
                    <span>Clique em <b>Gerar Código</b> para obter o código de 8 dígitos</span>
                  </div>
                )}
              </div>

              {/* Pairing code instructions */}
              <div className="space-y-3 text-xs text-slate-300">
                <div className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Como Inserir o Código no WhatsApp:</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    1
                  </span>
                  <span>Abra o <b>WhatsApp</b> no celular &gt; <b>Aparelhos Conectados</b>.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    2
                  </span>
                  <span>Toque em <b>Conectar um aparelho</b>.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    3
                  </span>
                  <span>Na parte inferior, toque em <b>Conectar com número de telefone</b>.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    4
                  </span>
                  <span>Digite o código gerado ao lado. O sistema conectará instantaneamente!</span>
                </div>

                {/* Action buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={handleSimulateConnected}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Já Digitei no Celular / Confirmar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConnecting(false);
                      setQrCodeDataUrl(null);
                    }}
                    className="w-full py-1.5 text-slate-400 hover:text-white text-xs text-center cursor-pointer"
                  >
                    Fechar Janela
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Settings Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Instance Config & Schedule & Templates */}
        <div className="lg:col-span-2 space-y-6">
          {/* CARD 1: DADOS DA INSTÂNCIA */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Configuração da Instância WhatsApp</h3>
                  <p className="text-[11px] text-slate-400">Identificação da conexão e gateway de mensagens (Evolution API)</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCheckInstanceStatus}
                  disabled={checkingStatus}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Verificar status real na API"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Verificar Conexão</span>
                </button>

                {config.status === 'connected' && (
                  <div className="text-right">
                    <div className="text-[11px] font-bold text-emerald-400 font-mono">
                      {config.connected_phone}
                    </div>
                    <div className="text-[9px] text-slate-500">Número Ativo</div>
                  </div>
                )}
              </div>
            </div>

            {statusMessage && (
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 animate-in fade-in">
                {statusMessage}
              </div>
            )}

            {/* Engine Selector */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Modo de Conexão WhatsApp:</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  {config.server_url ? 'Servidor Externo' : '🟢 Engine Nativo (Zero Config)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, server_url: '', api_key: '' })}
                  className={`py-2 px-3 rounded-xl border text-left font-medium transition-all cursor-pointer ${
                    !config.server_url
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <span>⚡ Nativo Integrado</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    100% Automático via QR Code Baileys oficial
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!config.server_url) {
                      setConfig({ ...config, server_url: 'http://localhost:8080' });
                    }
                  }}
                  className={`py-2 px-3 rounded-xl border text-left font-medium transition-all cursor-pointer ${
                    config.server_url
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <span>🌐 Servidor Externo</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Evolution API própria (VPS/Docker)
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={!config.server_url ? 'sm:col-span-2' : ''}>
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Nome da Instância *
                </label>
                <input
                  type="text"
                  value={config.instance_name}
                  onChange={(e) => setConfig({ ...config, instance_name: e.target.value })}
                  placeholder="Ex: financeiro_zap"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                {!config.server_url && (
                  <p className="text-[11px] text-emerald-400/90 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Pronto para conectar! Clique em <b>"Conectar via QR Code"</b> no topo para vincular seu celular.</span>
                  </p>
                )}
              </div>

              {config.server_url ? (
                <>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                      Servidor / Gateway da API (URL)
                    </label>
                    <input
                      type="text"
                      value={config.server_url}
                      onChange={(e) => setConfig({ ...config, server_url: e.target.value })}
                      placeholder="Ex: https://api.meuservidor.com"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                      API Token / Chave Secreta (apikey)
                    </label>
                    <input
                      type="password"
                      value={config.api_key}
                      onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                      placeholder="sua-chave-secreta-da-instancia"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* CARD 2: HORÁRIO & REGRAS DE ENVIO AUTOMÁTICO */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Horário e Regras de Disparo Automático</h3>
                  <p className="text-[11px] text-slate-400">Defina quando os lembretes diários são enviados pelo sistema</p>
                </div>
              </div>

              {/* Master Automation Switch */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white hidden sm:inline">
                  {config.auto_send_enabled ? 'Disparos Ativos' : 'Disparos Pausados'}
                </span>
                <ToggleSwitch
                  checked={Boolean(config.auto_send_enabled)}
                  onChange={(val) => updateConfigField('auto_send_enabled', val)}
                  color="emerald"
                  ariaLabel="Disparos Ativos"
                />
              </div>
            </div>

            {/* Horário Diário de Disparo com Períodos: Manhã, Tarde e Noite */}
            {(() => {
              const isMorningActive = config.morning_schedule_enabled !== false;
              const morningTime = config.morning_schedule_time || config.scheduled_time || '09:00';
              const isAfternoonActive = Boolean(config.afternoon_schedule_enabled || config.second_scheduled_time_enabled);
              const afternoonTime = config.afternoon_schedule_time || config.second_scheduled_time || '14:30';
              const isNightActive = Boolean(config.night_schedule_enabled);
              const nightTime = config.night_schedule_time || '19:00';
              const activePeriodsCount = (isMorningActive ? 1 : 0) + (isAfternoonActive ? 1 : 0) + (isNightActive ? 1 : 0);

              return (
                <div className="p-3.5 sm:p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold uppercase text-slate-200 tracking-wider">
                          Horário Diário de Disparo *
                        </label>
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          3 Períodos
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Ative ou desative as cobranças nos períodos da <span className="text-amber-300 font-semibold">Manhã</span>, <span className="text-sky-300 font-semibold">Tarde</span> e <span className="text-purple-300 font-semibold">Noite</span> e defina o horário de disparo para cada um.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <span className="text-[10px] text-slate-400 font-medium">Horário de Brasília:</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          activePeriodsCount > 0
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {activePeriodsCount === 0
                          ? 'Nenhum período ativo'
                          : `${activePeriodsCount} ${activePeriodsCount === 1 ? 'período ativo' : 'períodos ativos'}`}
                      </span>
                    </div>
                  </div>

                  {/* 3 Cards de Períodos: Manhã, Tarde, Noite */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* 1. Manhã */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        isMorningActive
                          ? 'bg-amber-950/15 border-amber-500/40 ring-1 ring-amber-500/20 shadow-sm shadow-amber-950/30'
                          : 'bg-slate-900/40 border-slate-800/80 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-lg ${
                              isMorningActive ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <Sun className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Manhã</span>
                              {isMorningActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">Primeiros lembretes</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold ${isMorningActive ? 'text-amber-400' : 'text-slate-500'}`}>
                            {isMorningActive ? 'Ativo' : 'Desativado'}
                          </span>
                          <ToggleSwitch
                            checked={isMorningActive}
                            onChange={(val) => {
                              updateConfigFields({
                                morning_schedule_enabled: val,
                                scheduled_time: config.morning_schedule_time || '09:00',
                              });
                            }}
                            color="amber"
                            ariaLabel="Ativar ou desativar cobrança no período da manhã"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                          Horário do Disparo
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            disabled={!isMorningActive}
                            value={morningTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateConfigFields({
                                morning_schedule_time: val,
                                scheduled_time: val,
                              });
                            }}
                            className={`px-3 py-2 bg-slate-900 border rounded-lg text-xs font-mono font-bold text-white focus:outline-none w-full ${
                              isMorningActive
                                ? 'border-amber-500/50 focus:border-amber-400'
                                : 'border-slate-800 opacity-50 cursor-not-allowed'
                            }`}
                          />
                        </div>

                        {/* Quick suggestions */}
                        <div className="flex items-center gap-1 flex-wrap pt-1">
                          {['07:30', '08:00', '08:30', '09:00', '10:00', '11:00'].map((time) => (
                            <button
                              key={time}
                              type="button"
                              disabled={!isMorningActive}
                              onClick={() => {
                                updateConfigFields({
                                  morning_schedule_time: time,
                                  scheduled_time: time,
                                });
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                morningTime === time && isMorningActive
                                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 2. Tarde */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        isAfternoonActive
                          ? 'bg-sky-950/15 border-sky-500/40 ring-1 ring-sky-500/20 shadow-sm shadow-sky-950/30'
                          : 'bg-slate-900/40 border-slate-800/80 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-lg ${
                              isAfternoonActive ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <CloudSun className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Tarde</span>
                              {isAfternoonActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">Reforço vespertino</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold ${isAfternoonActive ? 'text-sky-400' : 'text-slate-500'}`}>
                            {isAfternoonActive ? 'Ativo' : 'Desativado'}
                          </span>
                          <ToggleSwitch
                            checked={isAfternoonActive}
                            onChange={(val) => {
                              updateConfigFields({
                                afternoon_schedule_enabled: val,
                                second_scheduled_time_enabled: val,
                                second_scheduled_time: config.afternoon_schedule_time || '14:30',
                              });
                            }}
                            color="blue"
                            ariaLabel="Ativar ou desativar cobrança no período da tarde"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                          Horário do Disparo
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            disabled={!isAfternoonActive}
                            value={afternoonTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateConfigFields({
                                afternoon_schedule_time: val,
                                second_scheduled_time: val,
                              });
                            }}
                            className={`px-3 py-2 bg-slate-900 border rounded-lg text-xs font-mono font-bold text-white focus:outline-none w-full ${
                              isAfternoonActive
                                ? 'border-sky-500/50 focus:border-sky-400'
                                : 'border-slate-800 opacity-50 cursor-not-allowed'
                            }`}
                          />
                        </div>

                        {/* Quick suggestions */}
                        <div className="flex items-center gap-1 flex-wrap pt-1">
                          {['13:00', '13:30', '14:00', '14:30', '15:00', '16:00'].map((time) => (
                            <button
                              key={time}
                              type="button"
                              disabled={!isAfternoonActive}
                              onClick={() => {
                                updateConfigFields({
                                  afternoon_schedule_time: time,
                                  second_scheduled_time: time,
                                });
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                afternoonTime === time && isAfternoonActive
                                  ? 'bg-sky-500/25 text-sky-300 border border-sky-500/50'
                                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 3. Noite */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        isNightActive
                          ? 'bg-purple-950/15 border-purple-500/40 ring-1 ring-purple-500/20 shadow-sm shadow-purple-950/30'
                          : 'bg-slate-900/40 border-slate-800/80 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-lg ${
                              isNightActive ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <Moon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>Noite</span>
                              {isNightActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">Repescagem noturna</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold ${isNightActive ? 'text-purple-400' : 'text-slate-500'}`}>
                            {isNightActive ? 'Ativo' : 'Desativado'}
                          </span>
                          <ToggleSwitch
                            checked={isNightActive}
                            onChange={(val) => {
                              updateConfigFields({
                                night_schedule_enabled: val,
                              });
                            }}
                            color="purple"
                            ariaLabel="Ativar ou desativar cobrança no período da noite"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                          Horário do Disparo
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            disabled={!isNightActive}
                            value={nightTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateConfigFields({
                                night_schedule_time: val,
                              });
                            }}
                            className={`px-3 py-2 bg-slate-900 border rounded-lg text-xs font-mono font-bold text-white focus:outline-none w-full ${
                              isNightActive
                                ? 'border-purple-500/50 focus:border-purple-400'
                                : 'border-slate-800 opacity-50 cursor-not-allowed'
                            }`}
                          />
                        </div>

                        {/* Quick suggestions */}
                        <div className="flex items-center gap-1 flex-wrap pt-1">
                          {['18:00', '18:30', '19:00', '19:30', '20:00', '20:30'].map((time) => (
                            <button
                              key={time}
                              type="button"
                              disabled={!isNightActive}
                              onClick={() => {
                                updateConfigFields({
                                  night_schedule_time: time,
                                });
                              }}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                nightTime === time && isNightActive
                                  ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50'
                                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Informative helper note */}
                  {activePeriodsCount === 0 ? (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>
                        Atenção: Todos os períodos de disparo estão desativados. Ative pelo menos um (Manhã, Tarde ou Noite) para que os lembretes automáticos diários sejam enviados.
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 text-slate-300 text-[11px] flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          Turnos programados hoje:{' '}
                          {[
                            isMorningActive ? `☀️ Manhã às ${morningTime}` : null,
                            isAfternoonActive ? `⛅ Tarde às ${afternoonTime}` : null,
                            isNightActive ? `🌙 Noite às ${nightTime}` : null,
                          ].filter(Boolean).join(' • ')} (Horário de Brasília)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        O sistema verifica pendências e envia nos horários definidos com segurança anti-bloqueio.
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Anti-Ban & Weekend row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Intervalo entre Mensagens (Anti-Ban)
                </label>
                <select
                  value={config.delay_seconds}
                  onChange={(e) => updateConfigField('delay_seconds', Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value={15}>15 segundos (Padrão moderado)</option>
                  <option value={25}>25 segundos (Recomendado / Seguro)</option>
                  <option value={40}>40 segundos (Alta segurança)</option>
                  <option value={60}>60 segundos (Máxima proteção de chip)</option>
                </select>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Simula digitação humana para evitar bloqueios</span>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-white">Disparar aos finais de semana</div>
                    <div className="text-[10px] text-slate-400">Permite enviar avisos aos sábados e domingos</div>
                  </div>
                  <ToggleSwitch
                    checked={Boolean(config.send_on_weekends)}
                    onChange={(val) => updateConfigField('send_on_weekends', val)}
                    color="emerald"
                    ariaLabel="Disparar aos finais de semana"
                  />
                </div>
              </div>
            </div>

            {/* MÓDULOS DE COBRANÇA AUTOMÁTICA */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <span>Módulos do Sistema na Cobrança Automática</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Multi-Módulo Ativo
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Quem estiver em atraso ou vencendo em qualquer um dos módulos abaixo será cobrado automaticamente:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                {/* Módulo IPTV */}
                <div
                  onClick={() => updateConfigField('charge_iptv_enabled', config.charge_iptv_enabled === false)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    config.charge_iptv_enabled !== false
                      ? 'bg-slate-950/80 border-purple-500/40 hover:border-purple-500/70'
                      : 'bg-slate-950/40 border-slate-800/80 opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>📺</span> IPTV & Streaming
                    </span>
                    <ToggleSwitch
                      checked={config.charge_iptv_enabled !== false}
                      onChange={(val) => updateConfigField('charge_iptv_enabled', val)}
                      color="purple"
                      ariaLabel="Cobrança IPTV e Streaming"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Cobra assinantes expirados e a vencer automaticamente.
                  </p>
                </div>

                {/* Módulo Empréstimos */}
                <div
                  onClick={() => updateConfigField('charge_loans_enabled', config.charge_loans_enabled === false)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    config.charge_loans_enabled !== false
                      ? 'bg-slate-950/80 border-emerald-500/40 hover:border-emerald-500/70'
                      : 'bg-slate-950/40 border-slate-800/80 opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>💰</span> Empréstimos
                    </span>
                    <ToggleSwitch
                      checked={config.charge_loans_enabled !== false}
                      onChange={(val) => updateConfigField('charge_loans_enabled', val)}
                      color="emerald"
                      ariaLabel="Cobrança Empréstimos"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Cobra parcelas e contratos em atraso ou no vencimento.
                  </p>
                </div>

                {/* Módulo Assinaturas */}
                <div
                  onClick={() => updateConfigField('charge_subscriptions_enabled', config.charge_subscriptions_enabled === false)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    config.charge_subscriptions_enabled !== false
                      ? 'bg-slate-950/80 border-blue-500/40 hover:border-blue-500/70'
                      : 'bg-slate-950/40 border-slate-800/80 opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>🔄</span> Assinaturas
                    </span>
                    <ToggleSwitch
                      checked={config.charge_subscriptions_enabled !== false}
                      onChange={(val) => updateConfigField('charge_subscriptions_enabled', val)}
                      color="blue"
                      ariaLabel="Cobrança Assinaturas"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Cobra mensalidades, planos e vendas com faturas abertas.
                  </p>
                </div>

                {/* Módulo Negócios & Empresas */}
                <div
                  onClick={() => updateConfigField('charge_business_enabled', config.charge_business_enabled === false)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    config.charge_business_enabled !== false
                      ? 'bg-slate-950/80 border-amber-500/40 hover:border-amber-500/70'
                      : 'bg-slate-950/40 border-slate-800/80 opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>🏢</span> Negócios & Empresas
                    </span>
                    <ToggleSwitch
                      checked={config.charge_business_enabled !== false}
                      onChange={(val) => updateConfigField('charge_business_enabled', val)}
                      color="amber"
                      ariaLabel="Cobrança Negócios e Empresas"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Cobra faturas, vendas e clientes comerciais em débito.
                  </p>
                </div>
              </div>
            </div>

            {/* 2.1 Centro de Diagnóstico e Gatilho Imediato dos 4 Módulos */}
            <div className="pt-4 border-t border-slate-800">
              <ModuleAutomationDiagnostic tenant={tenant} onRefreshParent={loadPendingNotices} />
            </div>
          </div>

          {/* CARD 3: TAGS / VARIÁVEIS DINÂMICAS */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Tags Dinâmicas (Clique para inserir no modelo)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">
                Inserindo no: <b className="text-emerald-400">
                  {activeTextarea === 'tomorrow' ? 'Modelo 1 (Amanhã)' : activeTextarea === 'today' ? 'Modelo 2 (Hoje)' : 'Modelo 3 (Vencidos)'}
                </b>
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {tagsList.map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => insertTag(item.tag)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-mono font-bold transition-all cursor-pointer group"
                  title={`${item.label} - ${item.desc}`}
                >
                  <span>{item.tag}</span>
                  {copiedTag === item.tag ? (
                    <Check className="w-3 h-3 text-emerald-300" />
                  ) : (
                    <span className="text-[10px] text-slate-500 font-sans font-normal group-hover:text-emerald-300">
                      ({item.label})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>


          {/* CARD 4: MODELO 1 - VENCIMENTO AMANHÃ */}
          <div
            className={`p-5 bg-slate-900 border rounded-2xl space-y-3 shadow-lg transition-all ${
              activeTextarea === 'tomorrow'
                ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                : 'border-slate-800'
            }`}
            onClick={() => {
              setActiveTextarea('tomorrow');
              setPreviewTab('tomorrow');
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">
                  1
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Modelo 1: Vencimento Amanhã (Véspera - 1 dia antes)</span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Pré-definido
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Disparado automaticamente 1 dia antes da data de vencimento da fatura
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRestoreTemplate('tomorrow');
                  }}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                  title="Restaurar mensagem padrão deste modelo"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>Restaurar</span>
                </button>
                <ToggleSwitch
                  checked={config.template_tomorrow_enabled !== false}
                  onChange={(val) => updateConfigField('template_tomorrow_enabled', val)}
                  color="emerald"
                  ariaLabel="Ativar Modelo 1 Vencimento Amanhã"
                />
              </div>
            </div>

            <textarea
              ref={tomorrowTextareaRef}
              rows={6}
              value={config.template_tomorrow_message ?? DEFAULT_TEMPLATE_TOMORROW}
              onFocus={() => {
                setActiveTextarea('tomorrow');
                setPreviewTab('tomorrow');
              }}
              onChange={(e) => setConfig((prev) => ({ ...prev, template_tomorrow_message: e.target.value }))}
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono resize-y"
              placeholder="Digite a mensagem com as tags..."
            />
          </div>

          {/* CARD 5: MODELO 2 - VENCIMENTO HOJE */}
          <div
            className={`p-5 bg-slate-900 border rounded-2xl space-y-3 shadow-lg transition-all ${
              activeTextarea === 'today'
                ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                : 'border-slate-800'
            }`}
            onClick={() => {
              setActiveTextarea('today');
              setPreviewTab('today');
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center">
                  2
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Modelo 2: Vencimento Hoje (No dia do vencimento)</span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Pré-definido
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Disparado pontualmente no dia exato do vencimento com a chave PIX
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRestoreTemplate('today');
                  }}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                  title="Restaurar mensagem padrão deste modelo"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>Restaurar</span>
                </button>
                <ToggleSwitch
                  checked={config.template_today_enabled !== false}
                  onChange={(val) => updateConfigField('template_today_enabled', val)}
                  color="emerald"
                  ariaLabel="Ativar Modelo 2 Vencimento Hoje"
                />
              </div>
            </div>

            <textarea
              ref={todayTextareaRef}
              rows={6}
              value={config.template_today_message ?? DEFAULT_TEMPLATE_TODAY}
              onFocus={() => {
                setActiveTextarea('today');
                setPreviewTab('today');
              }}
              onChange={(e) => setConfig((prev) => ({ ...prev, template_today_message: e.target.value }))}
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono resize-y"
              placeholder="Digite a mensagem com as tags..."
            />
          </div>

          {/* CARD 6: MODELO 3 - CLIENTES VENCIDOS (INADIMPLENTES) */}
          <div
            className={`p-5 bg-slate-900 border rounded-2xl space-y-3 shadow-lg transition-all ${
              activeTextarea === 'overdue'
                ? 'border-rose-500/50 ring-1 ring-rose-500/20'
                : 'border-slate-800'
            }`}
            onClick={() => {
              setActiveTextarea('overdue');
              setPreviewTab('overdue');
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 font-black text-xs flex items-center justify-center">
                  3
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <span>Modelo 3: Cobrança de Inadimplentes (Faturas Vencidas)</span>
                    <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Automático diário
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Enviado automaticamente no disparo diário para clientes com faturas em atraso
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRestoreTemplate('overdue');
                  }}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                  title="Restaurar mensagem padrão deste modelo"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>Restaurar</span>
                </button>
                <ToggleSwitch
                  checked={config.template_overdue_enabled !== false}
                  onChange={(val) => updateConfigField('template_overdue_enabled', val)}
                  color="rose"
                  ariaLabel="Ativar Modelo 3 Cobrança de Inadimplentes"
                />
              </div>
            </div>

            {/* Overdue limit setting */}
            <div className="flex items-center gap-3 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs" onClick={(e) => e.stopPropagation()}>
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-slate-300 flex-1">Cobrar faturas vencidas há até:</span>
              <select
                value={config.overdue_days_limit ?? 30}
                onChange={(e) => updateConfigField('overdue_days_limit', Number(e.target.value))}
                className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value={7}>7 dias</option>
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
                <option value={60}>60 dias</option>
                <option value={90}>90 dias</option>
              </select>
            </div>

            <textarea
              ref={overdueTextareaRef}
              rows={7}
              value={config.template_overdue_message ?? DEFAULT_TEMPLATE_OVERDUE}
              onFocus={() => {
                setActiveTextarea('overdue');
                setPreviewTab('overdue');
              }}
              onChange={(e) => setConfig((prev) => ({ ...prev, template_overdue_message: e.target.value }))}
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-rose-500 font-mono resize-y"
              placeholder="Digite a mensagem de cobrança de inadimplentes..."
            />
          </div>

          {/* Bottom Save Button */}
          <div className="flex items-center justify-between pt-2">
            {savedSuccess ? (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Configurações salvas e aplicadas aos disparos diários!</span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">
                Altere os textos ou horários e clique em salvar para aplicar aos disparos diários.
              </span>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Automação'}</span>
            </button>
          </div>
        </div>

        {/* Right Column (1 Col): Live WhatsApp Preview & Test Dispatcher & Logs */}
        <div className="space-y-6">
          {/* LIVE WHATSAPP CHAT PREVIEW */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Pré-visualização no WhatsApp</span>
              </div>

              {/* Selector for which model to preview */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPreviewTab('tomorrow')}
                  className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    previewTab === 'tomorrow'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Amanhã
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('today')}
                  className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    previewTab === 'today'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('overdue')}
                  className={`px-2 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    previewTab === 'overdue'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Vencidos
                </button>
              </div>
            </div>

            {/* Mock Smartphone Frame */}
            <div className="rounded-2xl overflow-hidden border border-[#1e2e28] bg-[#0c1317] shadow-2xl flex flex-col text-xs font-sans">
              {/* WhatsApp App Header */}
              <div className="bg-[#202c33] p-3 text-white flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white">
                    {(tenant.name || 'CF').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-xs leading-none">
                      {tenant.trade_name || tenant.name || 'Minha Empresa'}
                    </div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>online</span>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400">
                  {config.scheduled_time || '09:00'}
                </div>
              </div>

              {/* Chat Canvas (WhatsApp Background pattern) */}
              <div className="p-3.5 space-y-2 min-h-[260px] flex flex-col justify-end bg-[#0b141a]">
                <div className="self-center bg-[#182229] text-[10px] text-slate-400 px-3 py-1 rounded-lg shadow-sm">
                  {previewTab === 'tomorrow' ? 'Véspera do Vencimento' : previewTab === 'overdue' ? '⚠️ Fatura Vencida' : 'Dia do Vencimento'}
                </div>

                {/* Received Bubble */}
                <div className={`self-end max-w-[95%] text-slate-100 p-3 rounded-2xl rounded-tr-xs shadow-md space-y-1 relative ${previewTab === 'overdue' ? 'bg-[#4b1515]' : 'bg-[#005c4b]'}`}>
                  <p className="whitespace-pre-line text-[11px] leading-relaxed select-text">
                    {getRenderedPreview(getActivePreviewMessage())}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-200/70 pt-0.5">
                    <span>{config.scheduled_time || '09:00'}</span>
                    <span className="text-sky-300 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Send Section */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 pt-2.5">
              <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                <span>Disparar Mensagem de Teste</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Teste o modelo selecionado no seu próprio WhatsApp para verificar a formatação.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="(11) 98765-4321"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleTestSend}
                  disabled={testingSend}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Send className="w-3 h-3" />
                  <span>{testingSend ? 'Enviando...' : 'Enviar'}</span>
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-2.5 rounded-lg text-[11px] space-y-1.5 animate-in fade-in ${
                    testResult.success
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {testResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    )}
                    <span>
                      {testResult.method === 'evolution_api'
                        ? 'Mensagem enviada com sucesso pela Evolution API!'
                        : 'Pronto! Link de envio direto preparado.'}
                    </span>
                  </div>

                  {testResult.waDirectUrl && (
                    <a
                      href={testResult.waDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 rounded text-[10px] font-bold transition-all cursor-pointer"
                    >
                      <span>Abrir conversa no WhatsApp</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* HISTÓRICO DE DISPAROS / LOGS RECENTES */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <History className="w-4 h-4 text-emerald-400" />
                <span>Histórico de Disparos Recentes</span>
              </div>
              <button
                type="button"
                onClick={loadLogs}
                disabled={loadingLogs}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-xs">
                Nenhum disparo registrado ainda.
              </div>
            ) : (
              <div className="space-y-2 pr-1">
                {logs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase shrink-0 ${
                            log.type === 'overdue'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : log.type === 'due_today'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : log.type === 'due_tomorrow'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : log.type === 'direct_charge'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {log.type === 'overdue'
                            ? 'Vencido'
                            : log.type === 'due_today'
                            ? 'Hoje'
                            : log.type === 'due_tomorrow'
                            ? 'Amanhã'
                            : log.type === 'direct_charge'
                            ? 'Manual'
                            : log.type === 'manual_test'
                            ? 'Teste'
                            : 'Disparo'}
                        </span>
                        <span className="font-bold text-white truncate">
                          {log.customer_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono">{log.phone}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                          log.status === 'sent'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {log.status === 'sent' ? 'Enviado (API)' : 'Link Gerado'}
                      </span>
                    </div>

                    {log.wa_link && (
                      <div className="pt-0.5">
                        <a
                          href={log.wa_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <span>Ver no WhatsApp</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
