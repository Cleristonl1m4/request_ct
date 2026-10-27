import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { PermissaoUsuario, Nivel } from '@/lib/types';

export interface AuthUser {
  id: string;
  email: string;
  nome?: string;
}

interface AuthSession { userId: string }
interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  permissao: PermissaoUsuario | null;
  nivel: Nivel | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (login: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshPermissao: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, user: null, permissao: null, nivel: null, loading: true, error: null });

  const applySession = useCallback((data: { authenticated: boolean; user?: AuthUser; permissao?: PermissaoUsuario }) => {
    if (!data.authenticated || !data.user) {
      setState({ session: null, user: null, permissao: null, nivel: null, loading: false, error: null });
      return;
    }
    setState({ session: { userId: data.user.id }, user: data.user, permissao: data.permissao || null, nivel: data.permissao?.ativo ? data.permissao.nivel : null, loading: false, error: null });
  }, []);

  const refreshPermissao = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' });
      applySession(await response.json());
    } catch {
      setState((current) => ({ ...current, loading: false }));
    }
  }, [applySession]);

  useEffect(() => { refreshPermissao(); }, [refreshPermissao]);

  const signIn = useCallback(async (login: string, password: string) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch('/api/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ NomeUsuario: login, Senha: password }) });
      const result = await response.json();
      if (!response.ok) {
        setState((current) => ({ ...current, loading: false, error: result.error || 'Falha no login.' }));
        return { error: result.error || 'Falha no login.' };
      }
      applySession(result);
      return { error: null };
    } catch {
      const error = 'Não foi possível conectar ao servidor.';
      setState((current) => ({ ...current, loading: false, error }));
      return { error };
    }
  }, [applySession]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setState({ session: null, user: null, permissao: null, nivel: null, loading: false, error: null });
  }, []);

  return <AuthContext.Provider value={{ ...state, signIn, signOut, refreshPermissao }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
