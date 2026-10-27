import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Package,
  Loader2,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  User,
  Lock,
} from 'lucide-react';
 
// Barras decorativas que lembram níveis de estoque nas prateleiras
const STOCK_ROWS = [
  { width: 'w-[82%]', tone: 'bg-reptec-500' },
  { width: 'w-[56%]', tone: 'bg-reptec-400/80' },
  { width: 'w-[94%]', tone: 'bg-reptec-500' },
  { width: 'w-[38%]', tone: 'bg-rose-400/80' },
  { width: 'w-[70%]', tone: 'bg-reptec-400/80' },
];
 
export function LoginScreen() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
 
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password.trim()) {
      setLocalError('Preencha usuário e senha.');
      return;
    }
    const { error } = await signIn(email.trim(), password);
    if (error) setLocalError(error);
  }
 
  const inputBase =
    'w-full h-12 rounded-xl border bg-white text-slate-900 placeholder-slate-400 ' +
    'pl-11 pr-4 text-[15px] outline-none transition ' +
    'border-slate-200 hover:border-slate-300 ' +
    'focus:border-reptec-500 focus:ring-4 focus:ring-reptec-500/15 ' +
    'disabled:opacity-60';
 
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-slate-50">
      {/* Painel da marca (desktop) */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-48 -left-32 h-[30rem] w-[30rem] rounded-full bg-reptec-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"
        />
 
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <Package className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">REPTEC</span>
        </div>
 
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-[1.15] tracking-tight">
            Reposição de estoque em um só lugar.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Acompanhe pedidos, aprovações e o giro dos produtos sem sair do sistema.
          </p>
 
          <div
            aria-hidden
            className="mt-10 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
          >
            {STOCK_ROWS.map((row, i) => (
              <div key={i} className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${row.width} ${row.tone}`} />
              </div>
            ))}
          </div>
        </div>
 
        <p className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} Reptec. Todos os direitos reservados.
        </p>
      </aside>
 
      {/* Formulário */}
      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {/* Marca (mobile) */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-900 text-white">
              <Package className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-brand-900">REPTEC</span>
          </div>
 
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Entrar</h1>
          <p className="mt-2 text-sm text-slate-500">
            Use seu usuário e senha do sistema para continuar.
          </p>
 
          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                Usuário
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className={inputBase}
                  placeholder="Seu usuário"
                />
              </div>
            </div>
 
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCapsOn(e.getModifierState('CapsLock'))}
                  onBlur={() => setCapsOn(false)}
                  disabled={loading}
                  className={`${inputBase} pr-12`}
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-reptec-500/40"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsOn && (
                <p className="mt-1.5 text-xs text-amber-600">Caps Lock está ativado.</p>
              )}
            </div>
 
            <div aria-live="polite">
              {localError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{localError}</span>
                </div>
              )}
            </div>
 
            <button
              type="submit"
              disabled={loading}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-900 font-medium text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-reptec-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}