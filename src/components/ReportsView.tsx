import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Share2,
  Printer,
  Sparkles,
  TrendingUp,
  AlertOctagon,
  Percent,
  CheckCircle2,
  Send,
  ArrowUpRight,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { MonthlyReportData, Tenant } from '../types/index.js';
import { api } from '../lib/api.js';

interface ReportsViewProps {
  tenant: Tenant;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ tenant }) => {
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [report, setReport] = useState<MonthlyReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const formatMoney = (val?: number) =>
    (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    let isMounted = true;
    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await api.getMonthlyReport(tenant.id, selectedMonth);
        if (isMounted) setReport(data);
      } catch (err) {
        console.error('Failed to fetch report', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReport();
    return () => {
      isMounted = false;
    };
  }, [tenant.id, selectedMonth]);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (!report) return;

    const summaryText = `📊 *Relatório Financeiro Mensal - ${report.monthName}*\n_Empresa: ${tenant.trade_name || tenant.name}_\n\n` +
      `💰 *Total Faturado:* ${formatMoney(report.totalBilled)}\n` +
      `✅ *Total Recebido:* ${formatMoney(report.totalReceived)}\n` +
      `⚠️ *Inadimplência / Atraso:* ${formatMoney(report.totalOverdue)}\n` +
      `📈 *Taxa de Recuperação:* ${report.recoveryRate.toFixed(1)}%\n` +
      `🎫 *Ticket Médio:* ${formatMoney(report.averageTicket)}\n\n` +
      `*Cobranças:* ${report.chargesCount} emitidas | ${report.paidChargesCount} quitadas\n\n` +
      `_Gerado automaticamente pelo CobreFácil_ 🚀`;

    const url = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase mb-1">
            <Sparkles className="w-3 h-3" />
            <span>Fechamento & Automação</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Relatórios Mensais Automáticos
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Acompanhe o faturamento, liquidações via PIX e histórico analítico mês a mês
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-emerald-500/50"
            >
              <option value="2026-09">Setembro 2026 (Mês Atual)</option>
              <option value="2026-08">Agosto 2026</option>
              <option value="2026-07">Julho 2026</option>
              <option value="2026-06">Junho 2026</option>
            </select>
          </div>

          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
            title="Compartilhar resumo via WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#6d28d9] to-[#7c3aed] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/40 border border-purple-400/30 transition-all cursor-pointer"
            title="Imprimir ou Salvar PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {loading || !report ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          Carregando indicadores do relatório mensal...
        </div>
      ) : (
        <>
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-5 bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white rounded-2xl shadow-xl shadow-blue-950/30">
              <span className="text-xs font-black uppercase text-blue-100">Total Faturado no Mês</span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
                {formatMoney(report.totalBilled)}
              </div>
              <div className="text-xs text-blue-100 mt-1">
                {report.chargesCount} faturas e cobranças
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-[#10b981] to-[#059669] text-white rounded-2xl shadow-xl shadow-emerald-950/30">
              <span className="text-xs font-black uppercase text-emerald-100">Total Recebido (PIX)</span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
                {formatMoney(report.totalReceived)}
              </div>
              <div className="text-xs text-emerald-100 mt-1">
                {report.paidChargesCount} cobranças quitadas
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-[#f43f5e] to-[#be123c] text-white rounded-2xl shadow-xl shadow-rose-950/30">
              <span className="text-xs font-black uppercase text-rose-100">Inadimplência em Atraso</span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
                {formatMoney(report.totalOverdue)}
              </div>
              <div className="text-xs text-rose-100 mt-1">
                {report.overdueChargesCount} faturas vencidas
              </div>
            </div>

            <div className="p-5 bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white rounded-2xl shadow-xl shadow-purple-950/30">
              <span className="text-xs font-black uppercase text-purple-100">Taxa de Adimplência</span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
                {report.recoveryRate.toFixed(1)}%
              </div>
              <div className="text-xs text-purple-100 mt-1">
                Ticket Médio: {formatMoney(report.averageTicket)}
              </div>
            </div>
          </div>

          {/* AI Executive Analysis Box */}
          {report.aiAnalysis && (
            <div className="p-5 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-2xl flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Análise Executiva & Diagnóstico Financeiro</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {report.aiAnalysis}
                </p>
              </div>
            </div>
          )}

          {/* Daily Cash Flow Area Chart */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">Fluxo Diário de Cobranças e Recebimentos</h3>
                <p className="text-xs text-slate-400">Evolução dia a dia ao longo de {report.monthName}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-blue-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span>Faturado</span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span>Recebido (PIX)</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report.dailyFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    formatter={(val: any) => formatMoney(Number(val))}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    labelFormatter={(label) => `Dia ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="billed"
                    name="Faturado"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.15}
                  />
                  <Area
                    type="monotone"
                    dataKey="received"
                    name="Recebido"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.25}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 5 Debtors List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Top 5 Devedores Prioritários do Mês</h3>
                <p className="text-xs text-slate-400">Maiores valores pendentes ou vencidos para ação imediata</p>
              </div>
              <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                Ação Recomendada
              </span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {report.topDebtors.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Nenhum devedor pendente para este período. Parabéns pelo fechamento!
                </div>
              ) : (
                report.topDebtors.map((debtor, index) => (
                  <div key={debtor.customerId} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 font-bold text-xs text-slate-300 flex items-center justify-center font-mono">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{debtor.customerName}</div>
                        <div className="text-xs text-slate-400 font-mono">{debtor.whatsapp || 'Sem telefone'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-bold text-rose-400 font-mono">
                          {formatMoney(debtor.amount)}
                        </div>
                        <div className="text-[11px] text-slate-500">Valor em aberto</div>
                      </div>

                      {debtor.whatsapp && (
                        <a
                          href={`https://wa.me/55${debtor.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Olá, ${debtor.customerName}! Consta uma pendência financeira de ${formatMoney(
                              debtor.amount
                            )} no fechamento deste mês. Segue nossa chave PIX para acerto: ${tenant.pix_key}. Muito obrigado!`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 transition-all"
                          title="Cobrar este devedor no WhatsApp"
                        >
                          <Send className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
