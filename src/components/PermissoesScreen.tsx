import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchPermissoes, upsertPermissao, togglePermissaoAtivo } from '@/lib/api';
import type { PermissaoUsuario, Nivel } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/constants';
import { Loader2, Users, ShieldCheck, AlertTriangle, UserPlus, Power } from 'lucide-react';

export function PermissoesScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<PermissaoUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // New user form
  const [userId, setUserId] = useState('');
  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState<Nivel>(1);
  const [empresa, setEmpresa] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPermissoes();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpsert() {
    if (!userId.trim() || !nome.trim()) {
      setError('ID do usuário e nome são obrigatórios.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertPermissao(userId.trim(), nivel, nome.trim(), empresa.trim() || undefined);
      setUserId('');
      setNome('');
      setNivel(1);
      setEmpresa('');
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar permissão');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(userId: string, ativo: boolean) {
    try {
      await togglePermissaoAtivo(userId, !ativo);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao alterar status');
    }
  }

  const nivelColor: Record<Nivel, string> = {
    1: 'bg-slate-100 text-slate-700 border-slate-200',
    2: 'bg-amber-50 text-amber-700 border-amber-200',
    3: 'bg-brand-50 text-brand-700 border-brand-200',
    4: 'bg-reptec-50 text-reptec-700 border-reptec-200',
    5: 'bg-violet-50 text-violet-700 border-violet-200',
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Permissões de usuários</h2>
          <p className="text-sm text-slate-500 mt-1">Gerencie quem pode acessar o sistema e qual papel cada um tem.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Atribuir permissão
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
          <h3 className="font-semibold text-slate-900 mb-4">Atribuir permissão</h3>
          <p className="text-xs text-slate-500 mb-4">
            O ID do usuário é o identificador único (UUID) da conta. Para elevar um solicitante,
            use o ID que aparece ao lado dele na lista abaixo.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ID do usuário (UUID)</label>
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-mono"
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome de exibição</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="Nome"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nível</label>
              <select
                value={nivel}
                onChange={(e) => setNivel(Number(e.target.value) as Nivel)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white"
              >
                <option value={1}>1 — Solicitante</option>
                <option value={2}>2 — Gestão</option>
                <option value={3}>3 — Diretoria</option>
                <option value={4}>4 — Geração de CT</option>
                <option value={5}>5 — Administrador</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Empresa (opcional)</label>
              <input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="Matriz"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              Cancelar
            </button>
            <button
              onClick={handleUpsert}
              disabled={saving}
              className="px-3.5 py-2 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Nenhum usuário com permissão cadastrada.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className="text-left font-medium text-slate-600 px-4 py-3">Usuário</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Nível</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Empresa</th>
                <th className="text-left font-medium text-slate-600 px-4 py-3">Status</th>
                <th className="text-right font-medium text-slate-600 px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.user_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">{p.nome_exibicao}</p>
                        <p className="text-xs text-slate-400 font-mono truncate">{p.user_id.slice(0, 8)}…</p>
                      </div>
                      {user?.id === p.user_id && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">você</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${nivelColor[p.nivel]}`}>
                      {p.nivel} · {ROLE_LABELS[p.nivel]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.empresa || '—'}</td>
                  <td className="px-4 py-3">
                    {p.ativo ? (
                      <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">Ativo</span>
                    ) : (
                      <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggle(p.user_id, p.ativo)}
                      disabled={user?.id === p.user_id}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1.5 hover:bg-slate-100 rounded-lg transition"
                      title={p.ativo ? 'Desativar' : 'Ativar'}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {p.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
