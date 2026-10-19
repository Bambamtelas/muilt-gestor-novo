import React, { useState } from 'react';
import {
  X,
  Check,
  Plus,
  Sparkles,
  ShieldCheck,
  Tv,
  HandCoins,
  Building2,
  Repeat,
  Copy,
  CheckCircle2,
  ArrowRight,
  Clock,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { Tenant, AppModule, calculatePlanPrice } from '../types/index.js';
import { api } from '../lib/api.js';

interface AddModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: Tenant;
  onModuleAdded: (updatedTenant: Tenant) => void;
}

interface ModuleOption {
  id: AppModule;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge: string;
}

const MODULES_INFO: ModuleOption[] = [
  {
    id: 'iptv',
    title: 'IPTV & P2P Streamings',
    subtitle: 'Ativações, Vencimentos & Renovação Automática',
    description: 'Gestão completa de assinantes IPTV, controle de telas, servidores, planos mensais/anuais e disparo de lembretes via WhatsApp.',
    icon: Tv,
    color: 'from-purple-600 to-indigo-600',
    badge: 'IPTV / P2P',
  },
  {
    id: 'subscriptions',
    title: 'Assinaturas & Streamings',
    subtitle: 'Gestão de Contas, Perfis & Telas',
    description: 'Controle de clientes de streamings compartilhados, perfis, dados de acesso e cobrança recorrente mensal.',
    icon: Repeat,
    color: 'from-indigo-600 to-blue-600',
    badge: 'Assinaturas',
  },
  {
    id: 'loans',
    title: 'Empréstimos & Parcelas',
    subtitle: 'Cobranças Parceladas, Juros & Promissórias',
    description: 'Gestão ágil de empréstimos, cálculo de juros, parcelas em atraso, recibos e automação de cobranças parceladas.',
    icon: HandCoins,
    color: 'from-amber-600 to-emerald-600',
    badge: 'Empréstimos',
  },
  {
    id: 'business',
    title: 'Negócios & Empresas',
    subtitle: 'Clientes, Produtos, Vendas & Cobranças',
    description: 'Controle de vendas de balcão, produtos, serviços, ordens de cobrança e gestão financeira empresarial.',
    icon: Building2,
    color: 'from-blue-600 to-cyan-600',
    badge: 'Negócios',
  },
];

export const AddModuleModal: React.FC<AddModuleModalProps> = ({
  isOpen,
  onClose,
  tenant,
  onModuleAdded,
}) => {
  const [selectedModule, setSelectedModule] = useState<AppModule | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  if (!isOpen) return null;

  const currentModules: AppModule[] =
    tenant.selected_modules && tenant.selected_modules.length > 0
      ? tenant.selected_modules
      : ['business'];

  const isTrial = tenant.subscription_status === 'trial';
  const availableToAdd = MODULES_INFO.filter((m) => !currentModules.includes(m.id));

  // Preço da adição unitária imediata e próximo mês
  const unitAdditionPrice = isTrial ? 0 : 24.9;
  const newModuleCount = currentModules.length + 1;
  const nextMonthComboPrice = calculatePlanPrice(newModuleCount);

  const handleCopyPix = () => {
    navigator.clipboard.writeText('betaof10@hotmail.com');
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2500);
  };

  const handleConfirmAddModule = async () => {
    if (!selectedModule) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.addModuleToTenant(tenant.id, selectedModule);
      if (res && res.success && res.tenant) {
        setSuccessMsg(
          `Módulo ${MODULES_INFO.find((m) => m.id === selectedModule)?.title} ativado com sucesso!`
        );
        onModuleAdded(res.tenant);
        setTimeout(() => {
          onClose();
          setSelectedModule(null);
          setSuccessMsg(null);
        }, 1800);
      } else {
        throw new Error(res?.message || 'Falha ao ativar módulo.');
      }
    } catch (err: any) {
      console.error('Erro ao adicionar módulo:', err);
      setErrorMsg(err?.message || 'Erro ao processar ativação do módulo. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#0e1b38] to-[#091224] border border-[#1e3260] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#18264d] bg-[#091224]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/40 text-white">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                Adicionar Novo Módulo ao Sistema
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </h2>
              <p className="text-xs text-slate-400">
                Expanda as ferramentas da sua empresa com ativação imediata
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Status Atual do Plano */}
          <div className="p-4 rounded-2xl bg-[#09142e] border border-[#1b2b54] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Seu Plano Atual
              </div>
              <div className="text-sm font-black text-white mt-0.5 flex items-center gap-2">
                <span>{currentModules.length} de 4 Módulos Ativos</span>
                {isTrial && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    2 Dias de Teste Grátis
                  </span>
                )}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-[11px] text-slate-400">Mensalidade Atual:</div>
              <div className="text-base font-black text-emerald-400">
                R$ {(tenant.plan_monthly_price || calculatePlanPrice(currentModules.length)).toFixed(2).replace('.', ',')} / mês
              </div>
            </div>
          </div>

          {/* Lista de Módulos */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Escolha o Módulo para Adicionar:
            </div>

            {availableToAdd.length === 0 ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-base font-bold text-white">Todos os Módulos Já Estão Ativos!</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Sua conta já possui acesso liberado a todos os módulos do Multi Gestor.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {availableToAdd.map((mod) => {
                  const Icon = mod.icon;
                  const isSelected = selectedModule === mod.id;

                  return (
                    <div
                      key={mod.id}
                      onClick={() => setSelectedModule(mod.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#102248] border-emerald-500 shadow-lg ring-1 ring-emerald-500/50'
                          : 'bg-[#091328]/80 hover:bg-[#0c1834] border-[#18274d]'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center text-white shrink-0 shadow-md`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-white">{mod.title}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                              {mod.badge}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 font-medium mt-0.5">{mod.subtitle}</p>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            {mod.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 shrink-0">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">
                            {isTrial ? 'No Período de Teste' : 'Ativação Avulsa'}
                          </div>
                          <div className="text-sm font-black text-emerald-400">
                            {isTrial ? 'GRÁTIS' : '+ R$ 24,90'}
                          </div>
                        </div>

                        <div
                          className={`mt-1.5 w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                              : 'border-slate-600 bg-slate-800 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo da Contratação quando um módulo é selecionado */}
          {selectedModule && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0c1834] to-[#091224] border border-emerald-500/40 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Condições de Adesão e Nova Mensalidade</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-slate-400 font-medium">1. Ativação Imediata do Módulo:</div>
                  <div className="text-base font-black text-white mt-1">
                    {isTrial ? (
                      <span className="text-emerald-400">R$ 0,00 (Grátis no Teste)</span>
                    ) : (
                      <span>R$ 24,90</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isTrial
                      ? 'Liberado instantaneamente para testar no seu período grátis'
                      : 'Taxa unitária de adição de novo módulo'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-slate-400 font-medium">
                    2. Próxima Mensalidade Recorrente:
                  </div>
                  <div className="text-base font-black text-emerald-400 mt-1">
                    R$ {nextMonthComboPrice.toFixed(2).replace('.', ',')} / mês
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Combo de {newModuleCount} módulos no mês seguinte (desconto automático)
                  </div>
                </div>
              </div>

              {/* Informação do PIX caso não esteja em trial */}
              {!isTrial && (
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">
                      Chave PIX do Multi Gestor (R$ 24,90):
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {pixCopied ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar PIX</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-xs text-white bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 select-all">
                    betaof10@hotmail.com
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Botão de Ação */}
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmAddModule}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Ativando Módulo...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Confirmar e Ativar Módulo Agora</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
