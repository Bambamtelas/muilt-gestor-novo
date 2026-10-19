import React, { useState, useEffect } from 'react';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, X, ShieldCheck } from 'lucide-react';
import { updatePasswordWithSupabase } from '../lib/supabaseAuth.js';

interface ChangeMasterPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminEmail?: string;
}

export const ChangeMasterPasswordModal: React.FC<ChangeMasterPasswordModalProps> = ({
  isOpen,
  onClose,
  adminEmail = 'betaof10@hotmail.com',
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanNew) {
      setFeedback({ type: 'error', message: 'Digite a nova senha desejada.' });
      return;
    }

    if (cleanNew.length < 4) {
      setFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 4 caracteres.' });
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setFeedback({ type: 'error', message: 'A confirmação de senha não confere com a nova senha digitada.' });
      return;
    }

    setLoading(true);
    try {
      // 1. Atualiza no Supabase Auth se houver sessão ativa
      try {
        await updatePasswordWithSupabase(cleanNew);
      } catch (authErr: any) {
        console.warn('[ChangeMasterPasswordModal] Aviso ao atualizar senha no Supabase:', authErr?.message);
      }

      // 2. Atualiza no backend / store local
      const res = await fetch('/api/auth/change-master-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail,
          newPassword: cleanNew,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Falha ao alterar senha.');
      }

      setFeedback({
        type: 'success',
        message: 'Senha do Administrador Master alterada com sucesso! Guarde suas novas credenciais.',
      });

      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao comunicar com o servidor.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md my-auto flex flex-col bg-[#0b1329] border border-purple-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-purple-950/60 text-white overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-20 -left-20 w-44 h-44 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 p-0.5 shadow-lg shadow-purple-900/40 flex items-center justify-center mb-3">
            <div className="w-full h-full bg-[#0a1124] rounded-2xl flex items-center justify-center text-purple-300">
              <KeyRound className="w-7 h-7" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Segurança Master</span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Alterar Senha do Admin Master
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Defina uma nova senha de acesso para a conta administrativa.
          </p>

          <div className="mt-3 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-2">
            <span className="text-slate-500">Conta:</span>
            <span className="text-purple-300 font-bold">{adminEmail}</span>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 mb-5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 border shadow-lg ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200 shadow-emerald-950/50'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-200 shadow-rose-950/50'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="flex-1">{feedback.message}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>Nova Senha</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs font-medium placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>Confirmar Nova Senha</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite novamente a nova senha"
              autoComplete="new-password"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-white text-xs font-medium placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-1/2 py-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-950/60 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? 'Salvando...' : 'Salvar Senha'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
