import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  addRequisicaoItem,
  createRequisicao,
  fetchMaterial,
  fetchRequisicao,
  updateRequisicaoItem,
  deleteRequisicaoItem,
  transitionRequisicao,
} from '@/lib/api';

import type { MaterialCatalogo } from '@/lib/types';

import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  PackageSearch,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';

type LineStatus = 'idle' | 'loading' | 'ready' | 'error';

interface MaterialLine {
  id: string;
  persistedId?: string;
  codigo: string;
  quantidade: string;
  material: MaterialCatalogo | null;
  options: MaterialCatalogo[];
  especificador: string;
  status: LineStatus;
  error?: string;
}

interface NovaRequisicaoProps {
  onCreated: (id: string) => void;
  onBack: () => void;
  requisicaoId?: string;
}

function newLine(): MaterialLine {
  return {
    id: crypto.randomUUID(),
    codigo: '',
    quantidade: '',
    material: null,
    options: [],
    especificador: '',
    status: 'idle',
  };
}

function formatNumeracao(value: string | number | null | undefined): string {
  const normalized = String(value ?? '').trim();
  return normalized || 'N/A';
}

function materialKey(material: MaterialCatalogo): string {
  return [
    material.Cd_material.trim(),
    material.Cd_especif1?.trim() || '',
    formatNumeracao(material.Numeracao),
    material.Descricao_especif?.trim() || '',
  ].join('|');
}

export function NovaRequisicao({ onCreated, onBack, requisicaoId }: NovaRequisicaoProps) {
  const [lines, setLines] = useState<MaterialLine[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(requisicaoId));
  const [draftItemIds, setDraftItemIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onBack();
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onBack, saving]);

  useEffect(() => {
    if (!requisicaoId) return;
    let active = true;
    setLoadingDraft(true);
    fetchRequisicao(requisicaoId).then(async (requisicao) => {
      if (!active || !requisicao) return;
      const loaded = await Promise.all(requisicao.itens.map(async (item) => {
        const codigo = item.material.split(' - ')[0].trim();
        const options = await fetchMaterial(codigo).catch(() => []);
        const numberMatch = item.material.match(/\bNº\s+(.+)$/);
        const selected = options.find((option) => !numberMatch || formatNumeracao(option.Numeracao) === numberMatch[1].trim()) || options[0] || null;
        return {
          id: crypto.randomUUID(),
          persistedId: item.id,
          codigo,
          quantidade: String(item.quantidade_solicitada),
          material: selected,
          options,
          especificador: selected?.Cd_especif1?.trim() || '',
          status: selected ? 'ready' : 'error',
          error: selected ? undefined : 'Material não encontrado no catálogo atual.',
        } satisfies MaterialLine;
      }));
      if (active) {
        setLines(loaded.length ? loaded : [newLine()]);
        setDraftItemIds(loaded.flatMap((line) => line.persistedId ? [line.persistedId] : []));
      }
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar o rascunho.');
    }).finally(() => {
      if (active) setLoadingDraft(false);
    });
    return () => { active = false; };
  }, [requisicaoId]);

  function updateLine(id: string, changes: Partial<MaterialLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...changes } : line)),
    );
  }

  async function lookupMaterial(line: MaterialLine) {
    const codigo = line.codigo.trim();

    if (!codigo || saving || line.status === 'loading') return;

    updateLine(line.id, {
      status: 'loading',
      material: null,
      options: [],
      especificador: '',
      error: undefined,
    });

    try {
      const results = await fetchMaterial(codigo);

      if (!results.length) {
        updateLine(line.id, {
          status: 'error',
          error: 'Material não encontrado. Confira o código informado.',
        });
        return;
      }

      // Seleciona inicialmente uma variação numerada, quando existir.
      const initialMaterial =
        results.find((item) => formatNumeracao(item.Numeracao) !== 'N/A') ??
        results[0];

      updateLine(line.id, {
        status: 'ready',
        material: initialMaterial,
        options: results,
        especificador: initialMaterial.Cd_especif1?.trim() || '',
      });
    } catch (err) {
      updateLine(line.id, {
        status: 'error',
        error:
          err instanceof Error
            ? err.message
            : 'Falha ao consultar o catálogo. Tente novamente.',
      });
    }
  }

  function selectMaterial(id: string, optionKey: string) {
    const line = lines.find((item) => item.id === id);
    const material =
      line?.options.find((option) => materialKey(option) === optionKey) ?? null;

    updateLine(id, {
      material,
      especificador: material?.Cd_especif1?.trim() || '',
      status: material ? 'ready' : line?.status ?? 'idle',
      error: undefined,
    });
  }

  function selectSpecifier(id: string, value: string) {
    const line = lines.find((item) => item.id === id);
    if (!line) return;

    const especificador = value.trim();
    const matches = line.options.filter(
      (option) => (option.Cd_especif1?.trim() || '') === especificador,
    );

    updateLine(id, {
      especificador: value,
      material: matches[0] ?? (especificador ? null : line.options[0] ?? null),
      status: especificador && !matches.length ? 'error' : 'ready',
      error:
        especificador && !matches.length
          ? 'O especificador informado não pertence a este material.'
          : undefined,
    });
  }

  const validLines = useMemo(
    () =>
      lines.filter(
        (line) =>
          line.material &&
          Number.isFinite(Number(line.quantidade)) &&
          Number(line.quantidade) > 0,
      ),
    [lines],
  );

  const canSubmit =
    validLines.length > 0 &&
    lines.every(
      (line) =>
        (!line.codigo.trim() && !line.quantidade.trim()) ||
        (Boolean(line.codigo.trim()) && line.status === 'ready'),
    ) &&
    !lines.some((line) => line.status === 'loading');

  async function save(send: boolean) {
    if (!canSubmit || saving || loadingDraft) {
      setError(
        'Consulte os materiais e informe uma quantidade maior que zero antes de continuar.',
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const requisicao = requisicaoId ? { id: requisicaoId } : await createRequisicao();

      if (requisicaoId) {
        const currentIds = new Set(lines.flatMap((line) => line.persistedId ? [line.persistedId] : []));
        for (const itemId of draftItemIds) {
          if (!currentIds.has(itemId)) await deleteRequisicaoItem(itemId);
        }
      }

      for (const line of validLines) {
        // A validação de validLines garante que o material esteja selecionado.
        const material = line.material;
        if (!material) continue;

        const numeracao = formatNumeracao(material.Numeracao);
        const description = [
          material.Descricao,
          material.Descricao_especif,
          numeracao !== 'N/A' ? `Nº ${numeracao}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        const materialValue = `${material.Cd_material} - ${description}`;
        if (line.persistedId) {
          await updateRequisicaoItem(line.persistedId, materialValue, Number(line.quantidade));
        } else {
          await addRequisicaoItem(requisicao.id, materialValue, Number(line.quantidade));
        }
      }

      if (send) await transitionRequisicao(requisicao.id, 'enviar');
      onCreated(requisicao.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível salvar a requisição. Tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  }

  function removeLine(id: string) {
    setLines((current) =>
      current.length === 1
        ? current
        : current.filter((line) => line.id !== id),
    );
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[3px] sm:items-center sm:p-4 lg:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="nova-requisicao-title"
        className="pointer-events-auto flex max-h-[96vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-t-[26px] border border-white/70 bg-[#f6f8fb] shadow-2xl shadow-slate-950/25 sm:rounded-[26px]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/80 bg-white px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-reptec-50 text-reptec-600 ring-1 ring-reptec-100">
              <PackageSearch className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-reptec-600">
                {requisicaoId ? 'Editar solicitação' : 'Nova solicitação'}
              </p>
              <h2
                id="nova-requisicao-title"
                className="mt-1 text-xl font-bold tracking-tight text-[#10233f] sm:text-2xl"
              >
                {requisicaoId ? 'Atualizar materiais' : 'Repor materiais'}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
                Consulte o catálogo CIGAM e organize os materiais da sua requisição.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-reptec-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Fechar janela"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-0 py-0">
          {error && (
            <div
              role="alert"
              className="mx-4 mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:mx-5 lg:mx-8"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-auto rounded-lg p-1 text-rose-500 transition hover:bg-rose-100"
                aria-label="Dispensar mensagem de erro"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          <section className="overflow-hidden border-0 bg-transparent shadow-none">
            {/* Cabeçalho e linhas usam exatamente a mesma grade a partir de telas XL. */}
            <div className="hidden grid-cols-[112px_148px_132px_minmax(190px,1.45fr)_minmax(170px,1.2fr)_104px_112px_42px] items-center gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 xl:grid 2xl:grid-cols-[120px_160px_145px_minmax(220px,1.5fr)_minmax(190px,1.2fr)_112px_120px_44px] 2xl:gap-4 2xl:px-5">
              <span>Situação</span>
              <span>Código</span>
              <span>Especificador</span>
              <span>Descrição do material</span>
              <span>Descrição do especificador</span>
              <span>Numeração</span>
              <span className="text-right">Quantidade</span>
              <span className="sr-only">Ações</span>
            </div>

            <div className="divide-y divide-slate-200/80">
              {lines.map((line, index) => (
                <MaterialLineRow
                  key={line.id}
                  line={line}
                  index={index}
                  saving={saving}
                  onChange={updateLine}
                  onLookup={lookupMaterial}
                  onSelectMaterial={selectMaterial}
                  onSelectSpecifier={selectSpecifier}
                  onQuantity={(id, quantidade) => updateLine(id, { quantidade })}
                  onRemove={() => removeLine(line.id)}
                />
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={() => setLines((current) => [...current, newLine()])}
            disabled={saving}
            className="mx-4 my-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-2.5 text-sm font-semibold text-[#10233f] transition hover:border-reptec-300 hover:bg-reptec-50/60 hover:text-reptec-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-reptec-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:mx-5 lg:mx-8"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar outro material
          </button>
        </main>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-xs leading-5 text-slate-500">
            {validLines.length} de {lines.length} {lines.length === 1 ? 'linha válida' : 'linhas válidas'}
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onBack}
              disabled={saving}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => save(false)}
              disabled={saving || loadingDraft || !canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#10233f] transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              Salvar rascunho
            </button>

            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving || loadingDraft || !canSubmit}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#10233f] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#10233f]/15 transition hover:bg-[#18375f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#10233f]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              Enviar para gestão
              {!saving && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

interface MaterialLineRowProps {
  line: MaterialLine;
  index: number;
  saving: boolean;
  onChange: (id: string, changes: Partial<MaterialLine>) => void;
  onLookup: (line: MaterialLine) => void;
  onSelectMaterial: (id: string, key: string) => void;
  onSelectSpecifier: (id: string, value: string) => void;
  onQuantity: (id: string, value: string) => void;
  onRemove: () => void;
}

function MaterialLineRow({
  line,
  index,
  saving,
  onChange,
  onLookup,
  onSelectMaterial,
  onSelectSpecifier,
  onQuantity,
  onRemove,
}: MaterialLineRowProps) {
  const specifierOptions = [
    ...new Set(
      line.options
        .map((option) => option.Cd_especif1?.trim() || '')
        .filter(Boolean),
    ),
  ];

  const numberOptions = line.especificador.trim()
    ? line.options.filter(
        (option) =>
          (option.Cd_especif1?.trim() || '') === line.especificador.trim(),
      )
    : line.options;

  const status =
    line.status === 'ready' ? (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">
        <Check className="h-3 w-3" aria-hidden="true" />
        Encontrado
      </span>
    ) : line.status === 'loading' ? (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Consultando
      </span>
    ) : line.status === 'error' ? (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Verificar
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-500">
        Pendente
      </span>
    );

  const fieldLabel =
    'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 xl:hidden';
  const displayField =
    'min-h-10 min-w-0 rounded-xl border px-3 py-2.5 text-sm leading-5';
  const inputField =
    'h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-reptec-400 focus:ring-4 focus:ring-reptec-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';

  return (
    <div className="group px-3 py-4 transition-colors hover:bg-slate-50/70 sm:px-4 sm:py-5 xl:grid xl:grid-cols-[112px_148px_132px_minmax(190px,1.45fr)_minmax(170px,1.2fr)_104px_112px_42px] xl:items-start xl:gap-3 2xl:grid-cols-[120px_160px_145px_minmax(220px,1.5fr)_minmax(190px,1.2fr)_112px_120px_44px] 2xl:gap-4 2xl:px-5">
      <div className="mb-4 flex items-center justify-between xl:mb-0 xl:block">
        <span className={fieldLabel}>Situação</span>
        {status}
      </div>

      <div className="mb-4 min-w-0 xl:mb-0">
        <label className={fieldLabel} htmlFor={`codigo-${line.id}`}>
          Código do material
        </label>
        <div className="flex min-w-0 gap-2">
          <input
            id={`codigo-${line.id}`}
            value={line.codigo}
            disabled={saving || line.status === 'loading'}
            onChange={(event) =>
              onChange(line.id, {
                codigo: event.target.value,
                status: 'idle',
                material: null,
                options: [],
                especificador: '',
                error: undefined,
              })
            }
            onBlur={() => {
              if (line.codigo.trim() && line.status === 'idle') onLookup(line);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onLookup(line);
              }
            }}
            className={`${inputField} bg-slate-50 font-semibold text-[#10233f]`}
            placeholder="Ex.: 002020"
            aria-label={`Código do material, item ${index + 1}`}
          />
          <button
            type="button"
            // Evita que o campo perca o foco antes do clique e dispare uma consulta duplicada no onBlur.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onLookup(line)}
            disabled={saving || line.status === 'loading' || !line.codigo.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-reptec-200 hover:bg-reptec-50 hover:text-reptec-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-reptec-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`Consultar material ${line.codigo || index + 1}`}
          >
            {line.status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {line.error && (
          <p className="mt-1.5 text-xs leading-4 text-rose-600" role="alert">
            {line.error}
          </p>
        )}
      </div>

      <div className="mb-4 min-w-0 xl:mb-0">
        <label className={fieldLabel} htmlFor={`especificador-${line.id}`}>
          Especificador
        </label>
        <input
          id={`especificador-${line.id}`}
          list={`especificadores-${line.id}`}
          value={line.especificador}
          onChange={(event) =>
            onSelectSpecifier(line.id, event.target.value)
          }
          disabled={saving || specifierOptions.length <= 1}
          className={inputField}
          placeholder={
            specifierOptions.length > 1
              ? 'Digite ou selecione'
              : specifierOptions.length === 1
                ? 'Única opção'
                : 'Não aplicável'
          }
          aria-label={`Especificador do item ${index + 1}`}
        />
        <datalist id={`especificadores-${line.id}`}>
          {specifierOptions.map((code) => (
            <option key={code} value={code} />
          ))}
        </datalist>
      </div>

      <div className="mb-4 min-w-0 xl:mb-0">
        <label className={fieldLabel}>Descrição do material</label>
        <p
          className={`${displayField} ${
            line.material
              ? 'border-slate-200 bg-slate-50/80 font-semibold text-slate-800'
              : 'border-dashed border-slate-200 bg-white text-slate-400'
          } break-words`}
          title={line.material?.Descricao || undefined}
        >
          {line.material?.Descricao || 'Será preenchida após a consulta.'}
        </p>
      </div>

      <div className="mb-4 min-w-0 xl:mb-0">
        <label className={fieldLabel}>Descrição do especificador</label>
        <p
          className={`${displayField} ${
            line.material
              ? 'border-slate-200 bg-slate-50/80 text-slate-600'
              : 'border-dashed border-slate-200 bg-white text-slate-400'
          } break-words`}
          title={line.material?.Descricao_especif || undefined}
        >
          {line.material
            ? line.material.Descricao_especif || 'Sem descrição adicional'
            : 'Será preenchida após a consulta.'}
        </p>
      </div>

      <div className="mb-4 min-w-0 xl:mb-0">
        <label className={fieldLabel} htmlFor={`numeracao-${line.id}`}>
          Numeração
        </label>
        {numberOptions.length > 1 ? (
          <select
            id={`numeracao-${line.id}`}
            value={line.material ? materialKey(line.material) : ''}
            onChange={(event) =>
              onSelectMaterial(line.id, event.target.value)
            }
            disabled={saving}
            className={inputField}
            aria-label={`Numeração do item ${index + 1}`}
          >
            <option value="">Selecione</option>
            {numberOptions.map((option) => (
              <option key={materialKey(option)} value={materialKey(option)}>
                {formatNumeracao(option.Numeracao)}
              </option>
            ))}
          </select>
        ) : (
          <p
            id={`numeracao-${line.id}`}
            className={`${displayField} flex items-center border-slate-200 bg-slate-50 font-semibold text-slate-700`}
          >
            {formatNumeracao(line.material?.Numeracao)}
          </p>
        )}
      </div>

      <div className="mb-4 min-w-0 xl:mb-0">
        <label className={fieldLabel} htmlFor={`quantidade-${line.id}`}>
          Quantidade
        </label>
        <input
          id={`quantidade-${line.id}`}
          type="number"
          min="0"
          step="any"
          value={line.quantidade}
          onChange={(event) => onQuantity(line.id, event.target.value)}
          disabled={saving}
          className={`${inputField} text-right font-semibold tabular-nums`}
          placeholder="0"
          aria-label={`Quantidade do item ${index + 1}`}
        />
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 xl:justify-center xl:border-0 xl:pt-0">
        <span className="text-xs font-medium text-slate-400 xl:hidden">
          Item {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={saving || index === 0}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/15 disabled:cursor-not-allowed disabled:opacity-20"
          aria-label={`Remover item ${index + 1}`}
          title={index === 0 ? 'A primeira linha não pode ser removida' : 'Remover material'}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
