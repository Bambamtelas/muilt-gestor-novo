import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  ShieldCheck,
  Sparkles,
  Building2,
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  CheckCircle2,
  Check,
  HandCoins,
  Tv,
  Repeat,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { AppModule, calculatePlanPrice, GlobalPlanPrices, DEFAULT_PLAN_PRICES, Tenant, Profile } from '../types/index.js';
import { signInWithSupabase, signUpWithSupabase, resetPasswordWithSupabase, resendConfirmationEmail } from '../lib/supabaseAuth.js';
import { MULTI_GESTOR_LOGO } from '../constants/logo.js';

interface AuthViewProps {
  onLoginSuccess: (email: string, tenant?: Tenant, profile?: Profile) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register fields
  const [selectedModules, setSelectedModules] = useState<AppModule[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [planPrices, setPlanPrices] = useState<GlobalPlanPrices>(DEFAULT_PLAN_PRICES);

  // Reset Password State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetError('Informe o e-mail da sua conta.');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const email = resetEmail.trim().toLowerCase();
      await resetPasswordWithSupabase(email);
      setResetSuccess(true);
    } catch (err: any) {
      setResetError(err?.message || 'Erro ao enviar e-mail de recuperação de senha.');
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    api.getGlobalPlanPrices()
      .then((res) => {
        if (res && typeof res === 'object') {
          setPlanPrices({
            module_1: Number(res.module_1) || DEFAULT_PLAN_PRICES.module_1,
            module_2: Number(res.module_2) || DEFAULT_PLAN_PRICES.module_2,
            module_3: Number(res.module_3) || DEFAULT_PLAN_PRICES.module_3,
            module_4: Number(res.module_4) || DEFAULT_PLAN_PRICES.module_4,
          });
        }
      })
      .catch(() => {});
  }, [activeTab]);

  const toggleModule = (mod: AppModule) => {
    setSelectedModules((prev) => {
      if (prev.includes(mod)) {
        return prev.filter((m) => m !== mod);
      }
      return [...prev, mod];
    });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMsg('Informe seu e-mail e senha para continuar.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const email = loginEmail.trim().toLowerCase();
      let res: any;
      try {
        res = await signInWithSupabase({
          email,
          password: loginPassword.trim(),
        });
      } catch (supabaseErr) {
        // Fallback resiliente para login via backend caso o usuário esteja no banco local
        try {
          const localRes = await api.login(email, loginPassword.trim());
          if (localRes && localRes.tenant && localRes.profile) {
            onLoginSuccess(email, localRes.tenant, localRes.profile);
            return;
          }
        } catch {
          // Se o login local também falhar, lança o erro original
          throw supabaseErr;
        }
        throw supabaseErr;
      }
      onLoginSuccess(email, res.tenant, res.profile);
    } catch (err: any) {
      console.error('Falha no login:', err);
      const rawMsg = err?.message || '';
      if (rawMsg.includes('Invalid login credentials')) {
        setErrorMsg('E-mail ou senha incorretos. Verifique seus dados.');
      } else {
        setErrorMsg(rawMsg || 'Falha ao autenticar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedModules.length === 0) {
      setErrorMsg('Por favor, marque pelo menos uma opção que deseja gerenciar (Empréstimo, IPTV, Negócios ou Assinaturas).');
      return;
    }
    if (!registerEmail.trim() || !companyName.trim()) {
      setErrorMsg('Preencha os campos obrigatórios da empresa e e-mail.');
      return;
    }
    if (!registerPassword.trim() || registerPassword.trim().length < 6) {
      setErrorMsg('A senha deve ter no mínimo 6 caracteres para o Supabase Auth.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const email = registerEmail.trim().toLowerCase();

      // Checagem prévia imediata contra e-mails repetidos
      const checkRes = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`).catch(() => null);
      if (checkRes && checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData?.exists) {
          setErrorMsg('Já existe uma conta cadastrada com este e-mail. Por favor, acesse pela aba "Entrar" com sua senha.');
          setLoading(false);
          return;
        }
      }

      const res = await signUpWithSupabase({
        email,
        password: registerPassword.trim(),
        companyName: companyName.trim(),
        fullName: fullName.trim() || companyName.trim(),
        phone: registerPhone.trim(),
        modules: selectedModules,
        planPrices,
      });

      // Conta criada e autenticada imediatamente no Supabase Auth: prossegue direto para o Multi Gestor
      onLoginSuccess(email, res.tenant, res.profile);
    } catch (err: any) {
      console.error('Falha no cadastro Supabase Auth:', err);
      setErrorMsg(err?.message || 'Erro ao criar conta no Supabase Auth. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-[#070d1e] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#11234c] via-[#081024] to-[#040814] text-slate-100 selection:bg-emerald-500 selection:text-white">
      <div className="min-h-full w-full flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 py-8 sm:py-12">
        {/* 1. Logomarca / Logotipo FORA DO CARD e ACIMA DELE */}
        <div className="w-full max-w-md sm:max-w-lg mx-auto flex flex-col items-center justify-center mb-5 sm:mb-6 text-center select-none">
        <div className="relative group">
          {/* Subtle Ambient Glow */}
          <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-500/25 to-teal-500/25 rounded-3xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity" />
          
          {/* Quadradinho da Logo com Bordas Arredondadas */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl sm:rounded-3xl bg-slate-950/90 border border-[#1b2b4f] p-2 shadow-2xl shadow-black/90 overflow-hidden flex items-center justify-center">
            <img
              src={MULTI_GESTOR_LOGO}
              alt="Multi Gestor - Logotipo"
              className="w-full h-full object-contain drop-shadow-md select-none"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/multigestor.png';
              }}
            />
          </div>
        </div>

        {/* Título da Logomarca */}
        <div className="mt-3.5 flex flex-col items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              MULTI GESTOR
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              OFICIAL
            </span>
          </div>
          <p className="text-xs text-emerald-400/90 font-bold uppercase tracking-wider mt-1 max-w-xs text-center">
            SISTEMA MULTINEGOCIOS
          </p>
        </div>
      </div>

      {/* 2. CARD - Contém apenas a partir de "Acessar Conta" ou "Criar Conta" */}
      <div className="w-full max-w-md sm:max-w-lg bg-[#0a142c]/95 border border-[#1b2b4f] rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col transition-all">
        
        {/* Menu de Navegação Superior: Login vs Criar Conta (2 Dias Grátis) */}
        <div className="p-4 sm:p-6 pb-2">
          <div className="grid grid-cols-2 p-1 bg-slate-950/85 rounded-2xl border border-[#18274a] gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMsg(null);
              }}
              className={`py-2.5 px-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>Acessar Conta</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMsg(null);
              }}
              className={`py-2.5 px-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <UserPlus className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="truncate">Criar Conta</span>
              <span className="px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shrink-0">
                2 DIAS GRÁTIS
              </span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-4 sm:mx-6 mt-1 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-lg shadow-rose-950/40 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <span className="font-semibold leading-relaxed">{errorMsg}</span>
            </div>
            {activeTab === 'login' && errorMsg.toLowerCase().includes('nenhuma conta') && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setRegisterEmail(loginEmail);
                  setErrorMsg(null);
                }}
                className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-[11px] font-bold underline underline-offset-2 shrink-0 cursor-pointer transition-colors"
              >
                Criar conta grátis &rarr;
              </button>
            )}
            {activeTab === 'login' && (errorMsg.toLowerCase().includes('confirmação') || errorMsg.toLowerCase().includes('email not confirmed')) && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await resendConfirmationEmail(loginEmail);
                    setErrorMsg('Link de ativação reenviado com sucesso para seu e-mail! Verifique sua caixa de entrada.');
                  } catch (e: any) {
                    setErrorMsg(e?.message || 'Erro ao reenviar.');
                  }
                }}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer transition-colors"
              >
                Reenviar link agora &rarr;
              </button>
            )}
            {activeTab === 'login' && errorMsg.toLowerCase().includes('senha') && !errorMsg.toLowerCase().includes('confirmação') && (
              <button
                type="button"
                onClick={() => {
                  setResetEmail(loginEmail);
                  setShowResetModal(true);
                  setErrorMsg(null);
                }}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer transition-colors"
              >
                Redefinir Senha &rarr;
              </button>
            )}
          </div>
        )}

        {/* 3. Conteúdo dos Formulários */}
        <div className="p-4 sm:p-6 pt-2 space-y-4">
          
          {/* TAB: LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="text-center pb-0.5">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Bem-vindo de volta!
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Informe suas credenciais para entrar no Multi Gestor
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1.5 block">
                  E-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seu-email@exemplo.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(loginEmail);
                      setShowResetModal(true);
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 hover:from-emerald-600 to-teal-600 hover:to-teal-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-3 pb-1 text-center">
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
                  Ainda não tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setErrorMsg(null);
                    }}
                    className="font-black text-emerald-400 hover:text-emerald-300 underline underline-offset-4 decoration-2 decoration-emerald-500/60 hover:decoration-emerald-400 cursor-pointer transition-all inline-block mt-0.5 sm:mt-0"
                  >
                    Criar conta com 2 dias de teste grátis
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* TAB: REGISTER (2 DIAS DE TESTE GRÁTIS) */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="text-center pb-0.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-black mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span>2 DIAS DE TESTE GRÁTIS</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Criar Conta no Multi Gestor
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Teste todas as funcionalidades liberadas sem cobrança inicial
                </p>
              </div>

              {/* OPÇÕES DE MARCAR: Módulos a ativar (Empréstimo, IPTV, Negócios Empresa, Assinaturas) */}
              {/* Escolha dos Módulos com Preço Dinâmico */}
              <div className="p-3.5 bg-slate-950/85 border border-[#1b2b4f] rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Escolha o que deseja gerenciar *</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {selectedModules.length === 0 ? 'Selecione ao menos 1' : `${selectedModules.length} selecionado(s)`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* 1. Empréstimo */}
                  <button
                    type="button"
                    onClick={() => toggleModule('loans')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      selectedModules.includes('loans')
                        ? 'bg-emerald-950/50 border-emerald-500/80 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                        selectedModules.includes('loans')
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-slate-600 bg-slate-800'
                      }`}
                    >
                      {selectedModules.includes('loans') && (
                        <Check className="w-3 h-3 stroke-[3]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <HandCoins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Empréstimo</span>
                        </div>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-950 border border-emerald-500/30 text-emerald-400 shrink-0">
                          R$ {planPrices.module_1.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Contratos, juros &amp; parcelas
                      </p>
                    </div>
                  </button>

                  {/* 2. IPTV */}
                  <button
                    type="button"
                    onClick={() => toggleModule('iptv')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      selectedModules.includes('iptv')
                        ? 'bg-purple-950/50 border-purple-500/80 text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                        selectedModules.includes('iptv')
                          ? 'bg-purple-500 border-purple-400 text-white'
                          : 'border-slate-600 bg-slate-800'
                      }`}
                    >
                      {selectedModules.includes('iptv') && (
                        <Check className="w-3 h-3 stroke-[3]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <Tv className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span>IPTV</span>
                        </div>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-950 border border-purple-500/30 text-purple-400 shrink-0">
                          R$ {planPrices.module_1.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Clientes, planos &amp; apps
                      </p>
                    </div>
                  </button>

                  {/* 3. Negócios Empresa */}
                  <button
                    type="button"
                    onClick={() => toggleModule('business')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      selectedModules.includes('business')
                        ? 'bg-blue-950/50 border-blue-500/80 text-white shadow-md shadow-blue-950/40 ring-1 ring-blue-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                        selectedModules.includes('business')
                          ? 'bg-blue-500 border-blue-400 text-white'
                          : 'border-slate-600 bg-slate-800'
                      }`}
                    >
                      {selectedModules.includes('business') && (
                        <Check className="w-3 h-3 stroke-[3]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>Negócios Empresa</span>
                        </div>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-950 border border-blue-500/30 text-blue-400 shrink-0">
                          R$ {planPrices.module_1.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Clientes, produtos &amp; vendas
                      </p>
                    </div>
                  </button>

                  {/* 4. Assinaturas */}
                  <button
                    type="button"
                    onClick={() => toggleModule('subscriptions')}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      selectedModules.includes('subscriptions')
                        ? 'bg-indigo-950/50 border-indigo-500/80 text-white shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                        selectedModules.includes('subscriptions')
                          ? 'bg-indigo-500 border-indigo-400 text-white'
                          : 'border-slate-600 bg-slate-800'
                      }`}
                    >
                      {selectedModules.includes('subscriptions') && (
                        <Check className="w-3 h-3 stroke-[3]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <Repeat className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Assinaturas</span>
                        </div>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-950 border border-indigo-500/30 text-indigo-400 shrink-0">
                          R$ {planPrices.module_1.toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Planos de Streamings
                      </p>
                    </div>
                  </button>
                </div>

                {/* Banner de Preço Dinâmico Conforme Quantidade Escolhida */}
                {(() => {
                  const count = Math.max(1, selectedModules.length);
                  const activePrice = calculatePlanPrice(count, planPrices);
                  const fullIndividual = planPrices.module_1 * count;
                  const discount = fullIndividual - activePrice;

                  return (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-slate-950 via-[#0c1836] to-slate-950 border border-emerald-500/40 text-xs shadow-inner mt-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-black text-xs shrink-0">
                            {count}
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs block leading-tight">
                              {count === 1 && '1 Módulo Individual'}
                              {count === 2 && 'Combo 2 Módulos'}
                              {count === 3 && 'Combo 3 Módulos'}
                              {count >= 4 && 'Plano Completo (4 Módulos)'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              2 Dias de Teste Grátis Inclusos
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base sm:text-lg font-black text-emerald-400 leading-none">
                            R$ {activePrice.toFixed(2).replace('.', ',')}
                            <span className="text-[10px] text-slate-400 font-normal">/mês</span>
                          </div>
                          {count > 1 && discount > 0 && (
                            <span className="inline-block text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.2 rounded border border-emerald-500/30 mt-0.5">
                              Economiza R$ {discount.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80 leading-relaxed">
                        💡 <strong>Valor Fixo Mensal:</strong> Você utiliza <strong>100% grátis por 2 dias</strong>. O valor de <strong className="text-emerald-300">R$ {activePrice.toFixed(2).replace('.', ',')}/mês</strong> só será cobrado caso você decida continuar após o teste (ou renovar antecipadamente).
                      </p>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">
                  Nome da sua Empresa / Negócio *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Multi Telecom, Eletrônicos & Serviços"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">
                  Seu Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">
                    E-mail Comercial *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="email"
                      required
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="seu@negocio.com"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">
                    WhatsApp de Cobrança
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value)}
                      placeholder="(11) 99999-8888"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">
                  Criar Senha de Acesso *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Destaque de 2 Dias de Teste Grátis */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold">2 Dias de Teste Grátis Liberados</strong>
                  <span className="text-[11px] text-emerald-200/80">Você terá acesso imediato e ilimitado para testar emissão de PIX, clientes, cobranças e mensagens no WhatsApp.</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 hover:from-emerald-600 to-teal-600 hover:to-teal-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Começar Meus 2 Dias de Teste Grátis</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <p className="text-sm sm:text-base text-slate-300 font-medium">
                  Já tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMsg(null);
                    }}
                    className="font-black text-emerald-400 hover:text-emerald-300 underline underline-offset-4 decoration-2 decoration-emerald-500/60 cursor-pointer"
                  >
                    Acessar minha conta
                  </button>
                </p>
              </div>
            </form>
          )}

        </div>

        {/* Footer Security Badges */}
        <div className="p-3 bg-slate-950/90 border-t border-[#18274a] flex items-center justify-between text-[11px] text-slate-400 px-4 sm:px-6">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ambiente Seguro &amp; Criptografado</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">Multi Gestor</span>
        </div>

      </div>

      {/* MODAL REDEFINIR SENHA */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-md my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Redefinir Senha de Acesso</h3>
                  <p className="text-xs text-slate-400">Crie uma nova senha para sua conta cadastrada</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetError(null);
                  setResetSuccess(false);
                }}
                className="text-slate-400 hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {resetError && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/40 rounded-xl text-rose-200 text-xs">
                ⚠️ {resetError}
              </div>
            )}

            {resetSuccess ? (
              <div className="p-4 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <h4 className="text-sm font-bold text-white">E-mail de recuperação enviado!</h4>
                <p className="text-xs text-emerald-300">Verifique a caixa de entrada do seu e-mail para redefinir sua senha com segurança no Supabase Auth.</p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-1 block">
                    E-mail da sua conta
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="seu-email@exemplo.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetError(null);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {resetLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Enviar Link de Recuperação</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
