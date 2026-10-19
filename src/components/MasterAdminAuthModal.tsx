import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, AlertTriangle, KeyRound, X, CheckCircle2 } from 'lucide-react';

interface MasterAdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userEmail?: string;
  userName?: string;
}

export const MasterAdminAuthModal: React.FC<MasterAdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userEmail,
  userName,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setIsSuccess(false);
      setLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const trimmed = password.trim();
    if (!trimmed) {
      setError('Por favor, digite a senha de Administrador Master.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-master-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed }),
      });

      if (res.ok) {
        setIsSuccess(true);
        setError(null);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 500);
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.message || 'Senha incorreta. Verifique suas credenciais de Administrador Master.');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Erro ao comunicar com o servidor para validar a senha Master.');
      setPassword('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md my-auto max-h-[calc(100dvh-1.5rem)] flex flex-col bg-[#0a1224] border border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl shadow-amber-950/50 text-white overflow-y-auto overscroll-contain">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 p-0.5 shadow-lg shadow-amber-900/40 flex items-center justify-center mb-3.5">
            <div className="w-full h-full bg-[#0d162d] rounded-2xl flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>Acesso Restrito • Master SaaS</span>
          </div>

          <h3 className="text-xl font-black text-white tracking-tight">
            Autenticação Master Admin
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Área exclusiva da conta <strong className="text-amber-300">{userName || 'John John Telas Premium'}</strong>. Digite sua senha de segurança para liberar o painel.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Senha de Administrador Master
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4 text-amber-400/80" />
              </div>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Digite a senha master..."
                className="w-full pl-10 pr-12 py-3 rounded-2xl bg-[#0e1935] border border-amber-500/30 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-white placeholder-slate-500 text-sm font-medium transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-medium animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {isSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Senha confirmada com sucesso! Liberando acesso...</span>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSuccess}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-950/50 hover:shadow-amber-900/60 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSuccess ? 'Acesso Liberado...' : 'Acessar Painel Master'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-2xl bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>

        {/* Footer tip */}
        <div className="mt-4 pt-4 border-t border-[#172547] text-center">
          <p className="text-[11px] text-slate-500">
            Acesso protegido por autenticação mestra exclusiva do proprietário.
          </p>
        </div>
      </div>
    </div>
  );
};
