import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchRequisicoes, deleteRequisicao } from '@/lib/api';
import type { Requisicao, StatusRequisicao } from '@/lib/types';
import { STATUS_LABELS, STATUS_COLORS, STATUS_ORDER } from '@/lib/constants';
import { Loader2, FileText, Trash2, ChevronRight, Inbox, Plus, Layers } from 'lucide-react';
import { NovaRequisicao } from '@/components/NovaRequisicao';

interface DashboardProps {
  onSelectRequisicao: (id: string) => void;
  onEditRequisicao?: (id: string) => void;
  onNewRequisicao: () => void;
  novaAberta?: boolean;
  novaRequisicaoId?: string | null;
  onCloseNova?: () => void;
  onCreated?: (id: string) => void;
}

export function Dashboard({ onSelectRequisicao, onEditRequisicao, onNewRequisicao, novaAberta = false, novaRequisicaoId, onCloseNova, onCreated }: DashboardProps) {
  const { nivel } = useAuth();
  const [items, setItems] = useState<Requisicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusRequisicao | 'todas'>('todas');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = nivel === 1 ? 'minhas' : 'fila';
      const data = await fetchRequisicoes(filter);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [nivel]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    statusFilter === 'todas' ? items : items.filter((r) => r.status === statusFilter);

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = items.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<StatusRequisicao, number>);

  async function handleDelete(id: string) {
    if (!confirm('Deseja realmente excluir esta requisição? Esta ação não pode ser desfeita.')) return;
    try {
      await deleteRequisicao(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  }

  const isSolicitante = nivel === 1 || nivel === 5;

  return (
    <div className="max-w-7xl mx-auto px-0 py-0 space-y-8 animate-fade-in pb-20 md:pb-0">
      
      <div className="flex justify-end">
        {isSolicitante && (
          <button
            onClick={onNewRequisicao}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#10233f] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#10233f]/15 transition hover:bg-[#18375f] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Nova requisição
          </button>
        )}
      </div>

      {/* 🔹 Grid de Indicadores (KPI Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {STATUS_ORDER.map((s) => {
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`group relative text-left p-5 rounded-2xl border transition-all duration-200 overflow-hidden ${
                isActive
                  ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-600/20 shadow-lg shadow-blue-500/5'
                  : 'bg-white/80 backdrop-blur-sm border-slate-200/80 hover:border-blue-300 hover:bg-white hover:shadow-md'
              }`}
            >
              {/* Barra indicadora lateral */}
              <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${isActive ? 'bg-blue-600' : 'bg-transparent group-hover:bg-blue-300'}`} />
              
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide border ${STATUS_COLORS[s]}`}>
                  {STATUS_LABELS[s]}
                </span>
              </div>
              
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {counts[s]}
                </span>
                <span className="text-xs font-medium text-slate-400 group-hover:text-blue-600 transition-colors">
                  pedidos
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 🔹 Barra de Ferramentas / Filtros Ativos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/60">
        <div className="flex items-center gap-3">
          {statusFilter !== 'todas' ? (
            <button
              onClick={() => setStatusFilter('todas')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-xl border border-blue-200/80 transition-all"
            >
              <span>← Voltar para todas</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Filtrando todas as requisições
            </div>
          )}
        </div>

        <div className="text-xs font-medium text-slate-500 px-2">
          Mostrando <strong className="text-slate-900">{filtered.length}</strong> de {items.length} registros
        </div>
      </div>

      {/* 🔹 Alerta de Erro */}
      {error && (
        <div className="flex items-center gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm animate-shake">
          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 🔹 Área de Listagem (Loading, Empty ou Lista) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white/60 rounded-3xl border border-slate-200/60 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs font-medium text-slate-400 tracking-wider uppercase">Sincronizando dados...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 px-4 bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            <Inbox className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <p className="text-base font-bold text-slate-900">
              {isSolicitante ? 'Nenhuma requisição encontrada' : 'Fila de aprovação vazia'}
            </p>
            <p className="text-xs text-slate-500">
              {isSolicitante
                ? 'Você ainda não registrou nenhum pedido de equipamento ou uniforme.'
                : 'Não há solicitações pendentes para o seu nível de aprovação no momento.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <RequisicaoRow
              key={r.id}
              req={r}
               onClick={() => r.status === 'rascunho' && onEditRequisicao ? onEditRequisicao(r.id) : onSelectRequisicao(r.id)}
              onDelete={isSolicitante && r.status === 'rascunho' ? () => handleDelete(r.id) : undefined}
            />
          ))}
        </div>
      )}
      {novaAberta && onCloseNova && onCreated && (
        <NovaRequisicao onCreated={onCreated} onBack={onCloseNova} requisicaoId={novaRequisicaoId || undefined} />
      )}
    </div>
  );
}

function RequisicaoRow({
  req,
  onClick,
  onDelete,
}: {
  req: Requisicao;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const dataCriacao = new Date(req.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="group relative flex items-center justify-between gap-4 bg-white/90 hover:bg-white border border-slate-200/80 hover:border-blue-300 rounded-2xl px-5 py-4 shadow-xs hover:shadow-md transition-all duration-200">
      
      {/* Botão Principal do Item */}
      <button onClick={onClick} className="flex-1 flex items-center gap-4 text-left min-w-0">
        
        {/* Ícone com Hover Dinâmico */}
        <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-blue-600 text-slate-500 group-hover:text-white flex items-center justify-center shrink-0 transition-colors duration-200 shadow-inner">
          <FileText className="w-5 h-5" />
        </div>

        {/* Informações Principais */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-900 group-hover:text-blue-950 transition-colors tracking-tight truncate">
              Solicitação de CT #{req.numero_solicitacao}
            </span>
            {req.ciclo > 1 && (
              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md shadow-2xs">
                Ciclo {req.ciclo}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Criada em <span className="text-slate-600">{dataCriacao}</span>
          </p>
        </div>

        {/* Status Badge (Desktop) */}
        <div className="hidden sm:block shrink-0">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-xl border ${STATUS_COLORS[req.status]}`}>
            {STATUS_LABELS[req.status]}
          </span>
        </div>
      </button>

      {/* Ações Secundárias / Direita */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Status Badge (Mobile) */}
        <div className="sm:hidden">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${STATUS_COLORS[req.status]}`}>
            {STATUS_LABELS[req.status]}
          </span>
        </div>

        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Excluir rascunho"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Indicador de Seta com Microinteração */}
        <div className="w-9 h-9 rounded-xl bg-slate-50 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 flex items-center justify-center transition-all duration-200">
          <ChevronRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
}
