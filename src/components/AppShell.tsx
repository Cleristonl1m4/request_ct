import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/constants';
import { Package, LogOut, LayoutDashboard, Users, ShieldCheck, ArrowUpRight } from 'lucide-react';

export type View = 'dashboard' | 'nova' | 'detalhe' | 'permissoes';

interface ShellProps {
  view: View;
  onNavigate: (v: View) => void;
  children: React.ReactNode;
}

export function AppShell({ view, onNavigate, children }: ShellProps) {
  const { user, permissao, nivel, signOut } = useAuth();
  const nome = permissao?.nome_exibicao || user?.email || 'Usuário';
  const canManagePerms = nivel === 3 || nivel === 5;

  const navItems: { key: View; label: string; icon: React.ReactNode; show: boolean }[] = [
    { key: 'dashboard', label: 'Solicitação de CT', icon: <LayoutDashboard className="w-4 h-4" />, show: true },
    { key: 'permissoes', label: 'Permissões', icon: <Users className="w-4 h-4" />, show: canManagePerms },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7fb] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#0d2341] text-slate-100 flex-col fixed inset-y-0 left-0 z-20 shadow-[12px_0_35px_rgba(13,35,65,0.08)]">
        <div className="px-6 py-6 flex items-center gap-3 border-b border-white/[0.08]">
          <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-reptec-400 to-reptec-600 flex items-center justify-center shadow-lg shadow-reptec-600/30">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold tracking-tight leading-none text-[15px]">REPTEC</p>
            <p className="text-[10px] text-slate-400 mt-1">Controle de reposição</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <p className="px-3 mb-3 text-[10px] uppercase tracking-[0.16em] text-slate-500 font-semibold">Workspace</p>
          {navItems.filter((i) => i.show).map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                view === item.key
                  ? 'bg-white/[0.11] text-white shadow-inner ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-5 border-t border-white/[0.08]">
          <div className="px-3 py-2 mb-2">
              <p className="text-sm font-semibold text-white truncate">{nome}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-reptec-400" />
              <span className="text-xs text-slate-400">
                {nivel ? `${ROLE_LABELS[nivel]} · Nível ${nivel}` : 'Sem permissão'}
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="bg-white/90 backdrop-blur border-b border-slate-200/80 px-5 md:px-10 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between max-w-[1500px] mx-auto w-full">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-slate-400 mb-1">REPTEC / Operações</p>
              <h1 className="font-display text-xl font-bold text-[#10233f] tracking-tight">
                {navItems.find((i) => i.key === view)?.label || 'REPTEC'}
              </h1>
              {nivel && (
                <p className="text-xs text-slate-500 mt-0.5">{ROLE_DESCRIPTIONS[nivel]}</p>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sistema operacional
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </header>
        <main className="flex-1 px-5 md:px-10 pt-7 pb-24 md:py-7 max-w-[1500px] w-full mx-auto animate-rise-in">{children}</main>
      </div>
      {view === 'nova' && (
        <div
          aria-hidden="true"
          className="fixed inset-0 left-0 z-30 pointer-events-auto backdrop-blur-[4px] md:left-64"
        />
      )}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0d2341]/95 backdrop-blur-xl border-t border-white/10 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(13,35,65,0.18)]">
        <div className="flex items-center justify-around gap-1">
          {navItems.filter((item) => item.show).map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition ${
                view === item.key ? 'bg-white/10 text-white' : 'text-slate-400'
              }`}
            >
              {item.icon}
              <span className="truncate max-w-full">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
