import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  QrCode,
  Building,
  Phone,
  Mail,
  CheckCircle2,
  Sparkles,
  MapPin,
  MessageSquare,
  Check,
  HandCoins,
  Tv,
  Building2,
  Repeat,
  Lock,
  ShieldCheck,
  Plus,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { Tenant, AppModule } from '../types/index.js';
import { api } from '../lib/api.js';
import { generatePixPayload, generateQrCodeDataUrl } from '../lib/pix.js';
import { WhatsAppAutomationView } from './WhatsAppAutomationView.js';
import { updatePasswordWithSupabase } from '../lib/supabaseAuth.js';

class WhatsAppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[WhatsAppErrorBoundary caught an error]', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-xl">
            ⚠️
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Carregando Módulo WhatsApp</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {this.state.error?.message || 'Houve uma oscilação na interface.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
          >
            Atualizar Visualização do WhatsApp
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface SettingsViewProps {
  tenant: Tenant;
  isAdmin?: boolean;
  onUpdateTenant: (updated: Tenant) => void;
  initialSubTab?: 'company' | 'whatsapp';
  onOpenAddModuleModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  tenant,
  isAdmin = false,
  onUpdateTenant,
  initialSubTab = 'company',
  onOpenAddModuleModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'company' | 'whatsapp'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const [selectedModules, setSelectedModules] = useState<AppModule[]>(
    tenant.selected_modules && tenant.selected_modules.length > 0
      ? tenant.selected_modules
      : ['loans', 'iptv', 'business', 'subscriptions']
  );
  const [name, setName] = useState(tenant.name || '');
  const [tradeName, setTradeName] = useState(tenant.trade_name || '');
  const [document, setDocument] = useState(tenant.document || '');
  const [whatsapp, setWhatsapp] = useState(tenant.whatsapp || '');
  const [email, setEmail] = useState(tenant.email || '');
  const [pixKey, setPixKey] = useState(tenant.pix_key || tenant.email || '');
  const [pixKeyType, setPixKeyType] = useState(tenant.pix_key_type || 'email');
  const [addressCity, setAddressCity] = useState(tenant.address_city || 'São Paulo');
  const [addressState, setAddressState] = useState(tenant.address_state || 'SP');
  const [logoUrl, setLogoUrl] = useState(tenant.logo_url || '');

  // Sincroniza estado imediatamente se os dados do tenant mudarem (novo login, cadastro ou alternância de conta)
  useEffect(() => {
    setSelectedModules(
      tenant.selected_modules && tenant.selected_modules.length > 0
        ? tenant.selected_modules
        : ['loans', 'iptv', 'business', 'subscriptions']
    );
    setName(tenant.name || '');
    setTradeName(tenant.trade_name || '');
    setDocument(tenant.document || '');
    setWhatsapp(tenant.whatsapp || '');
    setEmail(tenant.email || '');
    setPixKey(tenant.pix_key || tenant.email || '');
    setPixKeyType(tenant.pix_key_type || 'email');
    setAddressCity(tenant.address_city || 'São Paulo');
    setAddressState(tenant.address_state || 'SP');
    setLogoUrl(tenant.logo_url || '');
  }, [tenant]);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [testQrCode, setTestQrCode] = useState<string | null>(null);

  // Estados para troca de senha de acesso
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanNew) {
      setPasswordFeedback({ type: 'error', message: 'Digite a nova senha desejada.' });
      return;
    }

    if (cleanNew.length < 4) {
      setPasswordFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 4 caracteres.' });
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setPasswordFeedback({
        type: 'error',
        message: 'A confirmação de senha não confere com a nova senha digitada.',
      });
      return;
    }

    const targetEmail = (tenant.email || email || '').trim().toLowerCase();
    if (!targetEmail) {
      setPasswordFeedback({
        type: 'error',
        message: 'E-mail da conta não identificado para alteração.',
      });
      return;
    }

    setSavingPassword(true);
    try {
      // 1. Atualiza no Supabase Auth se houver sessão ativa
      try {
        await updatePasswordWithSupabase(cleanNew);
      } catch (err: any) {
        console.warn('[SettingsView] Aviso Supabase updateUser:', err?.message);
      }

      // 2. Atualiza no backend / store local
      await api.changePassword(targetEmail, cleanNew);

      setPasswordFeedback({
        type: 'success',
        message: 'Senha de acesso alterada com sucesso! Utilize sua nova senha ao entrar novamente.',
      });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordFeedback({
        type: 'error',
        message: err?.message || 'Erro ao alterar a senha. Tente novamente.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleModule = (mod: AppModule) => {
    setSelectedModules((prev) => {
      if (prev.includes(mod)) {
        if (prev.length === 1) return prev;
        return prev.filter((m) => m !== mod);
      }
      return [...prev, mod];
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const updated = await api.updateTenant(tenant.id, {
        name,
        trade_name: tradeName,
        document,
        whatsapp,
        email,
        pix_key: pixKey,
        pix_key_type: pixKeyType as any,
        address_city: addressCity,
        address_state: addressState,
        logo_url: logoUrl,
        selected_modules: isAdmin ? selectedModules : (tenant.selected_modules || selectedModules),
      });

      onUpdateTenant(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update settings', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPix = async () => {
    if (!pixKey) return;
    const payload = generatePixPayload({
      pixKey,
      merchantName: tradeName || name || 'COBREFACIL',
      merchantCity: addressCity || 'SAO PAULO',
      amount: 1.0,
      description: 'Teste Chave PIX Lojista',
    });
    const qr = await generateQrCodeDataUrl(payload);
    setTestQrCode(qr);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header & Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#18264d] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Configurações
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Gerencie os dados cadastrais da empresa, chave PIX e automação de disparos no WhatsApp
          </p>
        </div>

        {/* Sub-Tabs: Empresa & PIX / Automação WhatsApp */}
        <div className="flex items-center gap-1.5 p-1 bg-[#091224] border border-[#1e305e] rounded-2xl self-start sm:self-auto shadow-lg">
          <button
            type="button"
            onClick={() => setActiveSubTab('company')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'company'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Dados da Empresa &amp; PIX</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('whatsapp')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
              activeSubTab === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Automação WhatsApp</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>
        </div>
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeSubTab === 'whatsapp' ? (
        <WhatsAppErrorBoundary>
          <WhatsAppAutomationView key={tenant.id} tenant={tenant} />
        </WhatsAppErrorBoundary>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* PIX Settings Card */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-white">Chave PIX do Lojista / Recebedor</h2>
              </div>
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                Destino dos Recebimentos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Tipo da Chave
                </label>
                <select
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="email">E-mail</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="phone">Celular (com DDD)</option>
                  <option value="random">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                  Chave PIX Cadastrada *
                </label>
                <input
                  type="text"
                  required
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="sua-chave-pix@banco.com.br ou CPF/CNPJ"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Test PIX Code button */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestPix}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Testar geração de QR Code desta chave</span>
              </button>

              {testQrCode && (
                <div className="flex items-center gap-3 p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <img src={testQrCode} alt="Teste PIX" className="w-16 h-16 rounded" />
                  <div className="text-xs text-slate-300">
                    <div className="font-semibold text-white">QR Code Válido!</div>
                    <div className="text-[11px] text-slate-400">Padrão BACEN BRCode EMV</div>
                  </div>
                </div>
              )}
            </div>
          </div>

        {/* Business Data Card */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Dados da Empresa / Emitente</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Razão Social / Nome Completo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Nome Fantasia (Como aparece nas cobranças)
              </label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                CPF ou CNPJ
              </label>
              <input
                type="text"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                WhatsApp Oficial de Cobrança
              </label>
              <input
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+55 (11) 99999-9999"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                E-mail Comercial / Cadastro *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@dominio.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Cidade (Utilizada no PIX)
              </label>
              <input
                type="text"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                UF
              </label>
              <input
                type="text"
                value={addressState}
                maxLength={2}
                onChange={(e) => setAddressState(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm uppercase text-slate-200 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>
        </div>

        {/* Módulos do Sistema: Apenas Administrador pode alterar; Cliente visualiza fixo conforme contratado */}
        {isAdmin ? (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">Módulos Visíveis no Menu Lateral</h2>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                      Apenas Administrador
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Ative ou oculte módulos conforme sua necessidade operacional</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Empréstimo */}
              <button
                type="button"
                onClick={() => toggleModule('loans')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  selectedModules.includes('loans')
                    ? 'bg-emerald-950/40 border-emerald-500/80 text-white shadow-md ring-1 ring-emerald-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                  selectedModules.includes('loans') ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-600 bg-slate-800'
                }`}>
                  {selectedModules.includes('loans') && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <HandCoins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Empréstimo</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Contratos e parcelas</p>
                </div>
              </button>

              {/* IPTV */}
              <button
                type="button"
                onClick={() => toggleModule('iptv')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  selectedModules.includes('iptv')
                    ? 'bg-purple-950/40 border-purple-500/80 text-white shadow-md ring-1 ring-purple-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                  selectedModules.includes('iptv') ? 'bg-purple-500 border-purple-400 text-white' : 'border-slate-600 bg-slate-800'
                }`}>
                  {selectedModules.includes('iptv') && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-purple-400" />
                    <span>IPTV</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Clientes, planos e apps</p>
                </div>
              </button>

              {/* Negócios Empresa */}
              <button
                type="button"
                onClick={() => toggleModule('business')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  selectedModules.includes('business')
                    ? 'bg-blue-950/40 border-blue-500/80 text-white shadow-md ring-1 ring-blue-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                  selectedModules.includes('business') ? 'bg-blue-500 border-blue-400 text-white' : 'border-slate-600 bg-slate-800'
                }`}>
                  {selectedModules.includes('business') && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Negócios Empresa</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Clientes, produtos & vendas</p>
                </div>
              </button>

              {/* Assinaturas */}
              <button
                type="button"
                onClick={() => toggleModule('subscriptions')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  selectedModules.includes('subscriptions')
                    ? 'bg-indigo-950/40 border-indigo-500/80 text-white shadow-md ring-1 ring-indigo-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                  selectedModules.includes('subscriptions') ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-slate-600 bg-slate-800'
                }`}>
                  {selectedModules.includes('subscriptions') && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Assinaturas</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Planos de Streamings</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Módulos Contratados no seu Plano</h2>
                  <p className="text-xs text-slate-400">
                    Definidos no seu plano. Adicione mais módulos a qualquer momento!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                {selectedModules.length < 4 && onOpenAddModuleModal && (
                  <button
                    type="button"
                    onClick={onOpenAddModuleModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>+ Adicionar Módulo</span>
                  </button>
                )}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-bold text-emerald-400 shrink-0">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedModules.length} de 4 Ativos</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Empréstimo */}
              <div
                className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2.5 transition-all select-none ${
                  selectedModules.includes('loans')
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-white'
                    : 'bg-slate-950/40 border-slate-900 text-slate-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                      selectedModules.includes('loans')
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                        : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    {selectedModules.includes('loans') && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      <HandCoins className={`w-3.5 h-3.5 ${selectedModules.includes('loans') ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span>Empréstimo</span>
                    </div>
                    <span className={`text-xs font-medium block mt-0.5 ${selectedModules.includes('loans') ? 'text-emerald-400/90' : 'text-slate-500'}`}>
                      {selectedModules.includes('loans') ? '✓ Ativo no seu plano' : 'Não contratado'}
                    </span>
                  </div>
                </div>
                {!selectedModules.includes('loans') && onOpenAddModuleModal && (
                  <button
                    type="button"
                    onClick={onOpenAddModuleModal}
                    className="w-full mt-1 py-1 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>+ Adicionar Módulo</span>
                  </button>
                )}
              </div>

              {/* IPTV */}
              <div
                className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2.5 transition-all select-none ${
                  selectedModules.includes('iptv')
                    ? 'bg-purple-950/30 border-purple-500/40 text-white'
                    : 'bg-slate-950/40 border-slate-900 text-slate-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                      selectedModules.includes('iptv')
                        ? 'bg-purple-500 border-purple-400 text-white'
                        : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    {selectedModules.includes('iptv') && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      <Tv className={`w-3.5 h-3.5 ${selectedModules.includes('iptv') ? 'text-purple-400' : 'text-slate-500'}`} />
                      <span>IPTV</span>
                    </div>
                    <span className={`text-xs font-medium block mt-0.5 ${selectedModules.includes('iptv') ? 'text-purple-400/90' : 'text-slate-500'}`}>
                      {selectedModules.includes('iptv') ? '✓ Ativo no seu plano' : 'Não contratado'}
                    </span>
                  </div>
                </div>
                {!selectedModules.includes('iptv') && onOpenAddModuleModal && (
                  <button
                    type="button"
                    onClick={onOpenAddModuleModal}
                    className="w-full mt-1 py-1 px-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>+ Adicionar Módulo</span>
                  </button>
                )}
              </div>

              {/* Negócios Empresa */}
              <div
                className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2.5 transition-all select-none ${
                  selectedModules.includes('business')
                    ? 'bg-blue-950/30 border-blue-500/40 text-white'
                    : 'bg-slate-950/40 border-slate-900 text-slate-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                      selectedModules.includes('business')
                        ? 'bg-blue-500 border-blue-400 text-white'
                        : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    {selectedModules.includes('business') && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      <Building2 className={`w-3.5 h-3.5 ${selectedModules.includes('business') ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span>Negócios Empresa</span>
                    </div>
                    <span className={`text-xs font-medium block mt-0.5 ${selectedModules.includes('business') ? 'text-blue-400/90' : 'text-slate-500'}`}>
                      {selectedModules.includes('business') ? '✓ Ativo no seu plano' : 'Não contratado'}
                    </span>
                  </div>
                </div>
                {!selectedModules.includes('business') && onOpenAddModuleModal && (
                  <button
                    type="button"
                    onClick={onOpenAddModuleModal}
                    className="w-full mt-1 py-1 px-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>+ Adicionar Módulo</span>
                  </button>
                )}
              </div>

              {/* Assinaturas */}
              <div
                className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2.5 transition-all select-none ${
                  selectedModules.includes('subscriptions')
                    ? 'bg-indigo-950/30 border-indigo-500/40 text-white'
                    : 'bg-slate-950/40 border-slate-900 text-slate-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                      selectedModules.includes('subscriptions')
                        ? 'bg-indigo-500 border-indigo-400 text-white'
                        : 'border-slate-700 bg-slate-900'
                    }`}
                  >
                    {selectedModules.includes('subscriptions') && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      <Repeat className={`w-3.5 h-3.5 ${selectedModules.includes('subscriptions') ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span>Assinaturas</span>
                    </div>
                    <span className={`text-xs font-medium block mt-0.5 ${selectedModules.includes('subscriptions') ? 'text-indigo-400/90' : 'text-slate-500'}`}>
                      {selectedModules.includes('subscriptions') ? '✓ Ativo no seu plano' : 'Não contratado'}
                    </span>
                  </div>
                </div>
                {!selectedModules.includes('subscriptions') && onOpenAddModuleModal && (
                  <button
                    type="button"
                    onClick={onOpenAddModuleModal}
                    className="w-full mt-1 py-1 px-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>+ Adicionar Módulo</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Card de Segurança & Troca de Senha */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Segurança & Trocar Senha de Acesso</h2>
                <p className="text-xs text-slate-400">
                  Altere sua senha de login. A nova senha passa a valer imediatamente para seus próximos acessos.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 self-start sm:self-auto">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>{tenant.email || email}</span>
            </div>
          </div>

          {passwordFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
                passwordFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {passwordFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{passwordFeedback.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Nova Senha de Acesso
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha (mínimo 4 caracteres)"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1 block">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha para confirmar"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              * Guarde sua nova senha em local seguro para quando sair do sistema.
            </span>
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={savingPassword || !newPassword}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{savingPassword ? 'Alterando...' : 'Atualizar Senha de Acesso'}</span>
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between">
          {success && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Configurações atualizadas com sucesso!</span>
            </div>
          )}

          <div className="ml-auto">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>
      </form>
      )}
    </div>
  );
};
