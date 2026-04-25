import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, Loader2, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

export function AuthModal({ isOpen = true, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setIsSignUp(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          toast.error('As senhas não coincidem');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          toast.error('A senha deve ter pelo menos 6 caracteres');
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        toast.success('Conta criada! Verifique seu email para confirmar. Você tem 3 dias de teste.');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success('Login realizado!');
        onClose?.();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border/50 rounded-xl max-w-md w-full p-6 space-y-6 shadow-2xl">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center bg-transparent">
              <img src="/logo-nexia.png" alt="Nexia" className="w-full h-full object-contain" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold">{isSignUp ? 'Criar Conta' : 'Entrar no Nexia'}</h2>
            <p className="text-sm text-muted-foreground">
              {isSignUp ? 'Crie sua conta para começar' : 'Mais alcance, menos esforço'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
                minLength={6}
              />
            </div>
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                  minLength={6}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {isSignUp ? 'Criar Conta' : 'Entrar'}
              </>
            )}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-primary hover:underline"
          >
            {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar'}
          </button>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}