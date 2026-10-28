import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchRequisicao,
  addRequisicaoItem,
  updateRequisicaoItem,
  deleteRequisicaoItem,
  transitionRequisicao,
  updateItemAprovado,
} from '@/lib/api';
import type { RequisicaoWithItems, DecisaoItem } from '@/lib/types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  DECISAO_LABELS,
  DECISAO_COLORS,
} from '@/lib/constants';
import {
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  Send,
  Check,
  X,
  RotateCcw,
  FileCheck2,
  AlertTriangle,
  Package,
} from 'lucide-react';

interface DetailProps {
  requisicaoId: string;
  onBack: () => void;
  onEdit?: () => void;
}

export function RequisicaoDetail({ requisicaoId, onBack, onEdit }: DetailProps) {
  const { nivel, user } = useAuth();
  const [req, setReq] = useState<RequisicaoWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // New item form (draft only)
  const [novoMaterial, setNovoMaterial] = useState('');
  const [novaQtd, setNovaQtd] = useState('');

  // Action modals
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [reanaliseMode, setReanaliseMode] = useState(false);
  const [reanaliseMotivo, setReanaliseMotivo] = useState('');
  const [ctMode, setCtMode] = useState(false);
  const [ctNumero, setCtNumero] = useState('');
  const [selectedCtItems, setSelectedCtItems] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRequisicao(requisicaoId);
      setReq(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [requisicaoId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddItem() {
    if (!req || !novoMaterial.trim() || !novaQtd.trim()) return;
    const qtd = parseFloat(novaQtd);
    if (isNaN(qtd) || qtd <= 0) return;
    try {
      await addRequisicaoItem(req.id, novoMaterial.trim(), qtd);
      setNovoMaterial('');
      setNovaQtd('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao adicionar item');
    }
  }

  async function handleEditItem(itemId: string, material: string, qtdStr: string) {
    if (!req) return;
    const qtd = parseFloat(qtdStr);
    if (isNaN(qtd) || qtd <= 0) return;
    try {
      await updateRequisicaoItem(itemId, material, qtd);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao editar item');
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteRequisicaoItem(itemId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao remover item');
    }
  }

  async function runTransition(acao: string, motivo?: string, numeroCt?: string, itemIds?: string[]) {
    if (!req) return;
    setActionLoading(true);
    setError(null);
    try {
      await transitionRequisicao(req.id, acao, motivo, numeroCt, itemIds);
      setRejectMode(false);
      setReanaliseMode(false);
      setCtMode(false);
      setRejectMotivo('');
      setReanaliseMotivo('');
      setCtNumero('');
      setSelectedCtItems([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na ação');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAprovarItem(itemId: string, qtdAprovada: number, decisao: DecisaoItem, giro?: number) {
    setActionLoading(true);
    try {
      await updateItemAprovado(itemId, qtdAprovada, decisao, giro);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao ajustar item');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!req) {
    return (
      <div className="max-w-3xl">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-900 mb-4">
          ← voltar
        </button>
        <p className="text-slate-500">Solicitação de CT não encontrada.</p>
      </div>
    );
  }

  const isOwner = user?.id === req.solicitante_id;
  const isDraft = req.status === 'rascunho';
  const isReprovada = req.status === 'reprovada';
  const isAdmin = nivel === 5;
  const canApproveGestao = (nivel === 2 || isAdmin) && req.status === 'aguardando_gestao';
  const canApproveDiretoria = (nivel === 3 || isAdmin) && req.status === 'aguardando_diretoria' && (isAdmin || !isOwner);
  const canReject = (nivel === 2 || nivel === 3 || isAdmin) && req.status.startsWith('aguardando_');
  const canReanalise = (nivel === 4 || isAdmin) && req.status === 'aguardando_geracao_ct';
  const canMarkCt = (nivel === 4 || isAdmin) && req.status === 'aguardando_geracao_ct';
  const canEditItems = (isOwner || isAdmin) && isDraft;
  const canAdjustItems = (nivel === 2 || nivel === 3 || isAdmin) && (req.status === 'aguardando_gestao' || req.status === 'aguardando_diretoria');

  function openCtModal() {
    setSelectedCtItems(req?.itens.filter((item) => !item.ct_gerada).map((item) => item.id) || []);
    setCtMode(true);
  }

  return (
    <div className="max-w-4xl">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-5 transition">
        <ArrowLeft className="w-4 h-4" />
        voltar
      </button>

      {error && (
        <div className="mb-5 flex items-start gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Solicitação de CT #{req.numero_solicitacao}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Criada em {new Date(req.created_at).toLocaleString('pt-BR')}
              {req.ciclo > 1 && (
                <span className="ml-2 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs">
                  Ciclo {req.ciclo}
                </span>
              )}
            </p>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full border ${STATUS_COLORS[req.status]}`}>
            {STATUS_LABELS[req.status]}
          </span>
        </div>

        {req.motivo_reprovacao && (
          <div className="mt-4 text-sm bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-rose-800">
            <span className="font-medium">Motivo da reprovação: </span>
            {req.motivo_reprovacao}
          </div>
        )}
        {req.numero_ct && (
          <div className="mt-4 text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-800">
            <span className="font-medium">CT gerada: </span>
            {req.numero_ct}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Itens</h3>
          <span className="text-xs text-slate-400">({req.itens.length})</span>
        </div>

        {req.itens.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            {isDraft ? 'Adicione itens à sua requisição.' : 'Sem itens.'}
          </p>
        ) : (
          <div className="space-y-2">
            {req.itens.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                canEdit={canEditItems}
                onEditRequest={onEdit}
                canAdjust={canAdjustItems}
                onEdit={handleEditItem}
                onDelete={() => handleDeleteItem(item.id)}
                onAprovar={handleAprovarItem}
              />
            ))}
          </div>
        )}

        {canEditItems && (
          <div className="mt-4 flex flex-wrap gap-2 items-end pt-4 border-t border-slate-100">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-slate-600 mb-1">Material</label>
              <input
                value={novoMaterial}
                onChange={(e) => setNovoMaterial(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="Código ou descrição"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-slate-600 mb-1">Quantidade</label>
              <input
                type="number"
                min="0"
                step="any"
                value={novaQtd}
                onChange={(e) => setNovaQtd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="0"
              />
            </div>
            <button
              onClick={handleAddItem}
              disabled={!novoMaterial.trim() || !novaQtd.trim()}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <h3 className="font-semibold text-slate-900 mb-4">Ações</h3>
        <div className="flex flex-wrap gap-2.5">
          {(isOwner || isAdmin) && isDraft && req.itens.length > 0 && (
            <button
              onClick={() => runTransition('enviar')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 bg-reptec-500 hover:bg-reptec-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Enviar para gestão
            </button>
          )}
          {(isOwner || isAdmin) && isReprovada && (
            <button
              onClick={() => runTransition('reabrir')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Reabrir como rascunho
            </button>
          )}
          {canApproveGestao && (
            <button
              onClick={() => runTransition('aprovar')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Aprovar (enviar à diretoria)
            </button>
          )}
          {canApproveDiretoria && (
            <button
              onClick={() => runTransition('aprovar')}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Aprovar (enviar à geração de CT)
            </button>
          )}
          {canReject && (
            <button
              onClick={() => setRejectMode(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Reprovar
            </button>
          )}
          {canReanalise && (
            <button
              onClick={() => setReanaliseMode(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Solicitar reanálise
            </button>
          )}
          {canMarkCt && (
            <button
               onClick={openCtModal}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              <FileCheck2 className="w-4 h-4" />
              Marcar CT realizada
            </button>
          )}
          {!canApproveGestao && !canApproveDiretoria && !canReject && !canReanalise && !canMarkCt && !isOwner && !isDraft && (
            <p className="text-sm text-slate-400">Sem ações disponíveis para seu perfil nesta etapa.</p>
          )}
        </div>
      </div>

      {/* Modals */}
      {rejectMode && (
        <Modal title="Reprovar requisição" onClose={() => setRejectMode(false)}>
          <textarea
            value={rejectMotivo}
            onChange={(e) => setRejectMotivo(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            placeholder="Motivo da reprovação (obrigatório)"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setRejectMode(false)} className="px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              Cancelar
            </button>
            <button
              onClick={() => runTransition('reprovar', rejectMotivo)}
              disabled={!rejectMotivo.trim() || actionLoading}
              className="px-3.5 py-2 text-sm bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition disabled:opacity-50"
            >
              Confirmar reprovação
            </button>
          </div>
        </Modal>
      )}
      {reanaliseMode && (
        <Modal title="Solicitar reanálise" onClose={() => setReanaliseMode(false)}>
          <textarea
            value={reanaliseMotivo}
            onChange={(e) => setReanaliseMotivo(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            placeholder="Motivo da reanálise (obrigatório)"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setReanaliseMode(false)} className="px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              Cancelar
            </button>
            <button
              onClick={() => runTransition('reanalise', reanaliseMotivo)}
              disabled={!reanaliseMotivo.trim() || actionLoading}
              className="px-3.5 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition disabled:opacity-50"
            >
              Confirmar reanálise
            </button>
          </div>
        </Modal>
      )}
      {ctMode && (
        <Modal title="Marcar CT como realizada" onClose={() => setCtMode(false)}>
          <p className="mb-3 text-sm text-slate-500">Selecione somente os itens efetivamente gerados no sistema externo.</p>
          <div className="mb-4 max-h-52 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {req.itens.filter((item) => !item.ct_gerada).map((item) => (
              <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedCtItems.includes(item.id)}
                  onChange={() => setSelectedCtItems((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                  className="h-4 w-4 rounded border-slate-300 text-reptec-600 focus:ring-reptec-500"
                />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{item.material}</span>
                <span className="text-xs text-slate-400">Qtd. {item.quantidade_aprovada}</span>
              </label>
            ))}
          </div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Número da CT</label>
          <input
            value={ctNumero}
            onChange={(e) => setCtNumero(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            placeholder="Ex.: CT-2026-0001"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setCtMode(false)} className="px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              Cancelar
            </button>
            <button
              onClick={() => runTransition('ct_realizada', undefined, ctNumero, selectedCtItems)}
              disabled={!ctNumero.trim() || !selectedCtItems.length || actionLoading}
              className="px-3.5 py-2 text-sm bg-brand-700 hover:bg-brand-800 text-white rounded-lg transition disabled:opacity-50"
            >
              Confirmar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ItemRow({
  item,
  canEdit,
  onEditRequest,
  canAdjust,
  onEdit,
  onDelete,
  onAprovar,
}: {
  item: { id: string; material: string; quantidade_solicitada: number; quantidade_aprovada: number; giro_calculado: number | null; decisao_item: DecisaoItem; situacao?: string; ct_gerada?: boolean; numero_ct?: string | null };
  canEdit: boolean;
  onEditRequest?: () => void;
  canAdjust: boolean;
  onEdit: (id: string, material: string, qtd: string) => void;
  onDelete: () => void;
  onAprovar: (id: string, qtd: number, decisao: DecisaoItem, giro?: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [material, setMaterial] = useState(item.material);
  const [qtd, setQtd] = useState(String(item.quantidade_solicitada));
  const [qtdAprovada, setQtdAprovada] = useState(String(item.quantidade_aprovada));
  const [giro, setGiro] = useState(item.giro_calculado ? String(item.giro_calculado) : '');

  if (editing && canEdit) {
    return (
      <div className="flex flex-wrap gap-2 items-center bg-slate-50 border border-slate-200 rounded-lg p-3">
        <input
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          className="flex-1 min-w-[160px] px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
        />
        <input
          type="number"
          value={qtd}
          onChange={(e) => setQtd(e.target.value)}
          className="w-24 px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
        />
        <button
          onClick={() => { onEdit(item.id, material, qtd); setEditing(false); }}
          className="px-2.5 py-1.5 text-sm bg-slate-900 text-white rounded-md hover:bg-slate-800"
        >
          Salvar
        </button>
        <button onClick={() => setEditing(false)} className="px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
      <div className="flex-1 min-w-[160px]">
        <p className="text-sm font-medium text-slate-900">{item.material}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Solicitado: <span className="font-medium text-slate-700">{item.quantidade_solicitada}</span>
          {item.quantidade_aprovada !== item.quantidade_solicitada && (
            <span className="ml-2">Aprovado: <span className="font-medium text-slate-700">{item.quantidade_aprovada}</span></span>
          )}
        </p>
      </div>

      {item.giro_calculado !== null && (
        <span className="text-xs text-slate-500">Giro: <span className="font-medium text-slate-700">{item.giro_calculado}</span></span>
      )}

      {item.decisao_item !== 'pendente' && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${DECISAO_COLORS[item.decisao_item]}`}>
          {DECISAO_LABELS[item.decisao_item]}
        </span>
      )}

      {item.ct_gerada && (
        <span className="text-xs font-medium px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
          CT gerada{item.numero_ct ? ` · ${item.numero_ct}` : ''}
        </span>
      )}

      {canEdit && (
        <div className="flex items-center gap-1">
          <button onClick={() => onEditRequest ? onEditRequest() : setEditing(true)} className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 hover:bg-slate-200 rounded">
            editar
          </button>
          <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {canAdjust && (
        <div className="flex items-center gap-1.5 w-full sm:w-auto sm:ml-auto">
          <input
            type="number"
            min="0"
            step="any"
            value={qtdAprovada}
            onChange={(e) => setQtdAprovada(e.target.value)}
            className="w-24 px-2 py-1 text-sm border border-slate-200 rounded-md bg-white"
            title="Quantidade aprovada"
          />
          <input
            type="number"
            step="any"
            value={giro}
            onChange={(e) => setGiro(e.target.value)}
            className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-md bg-white"
            placeholder="Giro"
            title="Giro calculado"
          />
          <button
            onClick={() => {
              const q = parseFloat(qtdAprovada);
              if (isNaN(q) || q < 0) return;
              const decisao = q === item.quantidade_solicitada ? 'aprovado' : 'ajustado';
              onAprovar(item.id, q, decisao as DecisaoItem, giro ? parseFloat(giro) : undefined);
            }}
            className="text-xs bg-slate-900 text-white px-2.5 py-1.5 rounded-md hover:bg-slate-800"
          >
            Salvar
          </button>
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
