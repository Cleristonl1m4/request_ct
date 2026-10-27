import type { Nivel, StatusRequisicao, DecisaoItem } from './types';

export const ROLE_LABELS: Record<Nivel, string> = {
  1: 'Solicitante',
  2: 'Gestão',
  3: 'Diretoria',
  4: 'Geração de CT',
  5: 'Administrador',
};

export const ROLE_DESCRIPTIONS: Record<Nivel, string> = {
  1: 'Cria e acompanha suas requisições de reposição.',
  2: 'Analisa, ajusta quantidades e aprova/reprova na 1ª etapa.',
  3: 'Aprova/reprova na 2ª etapa e gerencia permissões de usuários.',
  4: 'Solicita reanálise ou marca a geração de CT como realizada.',
  5: 'Acesso administrativo completo ao sistema.',
};

export const STATUS_LABELS: Record<StatusRequisicao, string> = {
  rascunho: 'Rascunho',
  aguardando_gestao: 'Aguardando Gestão',
  aguardando_diretoria: 'Aguardando Diretoria',
  aguardando_geracao_ct: 'Aguardando Geração de CT',
  reprovada: 'Reprovada',
  ct_realizada: 'CT Realizada',
};

export const STATUS_ORDER: StatusRequisicao[] = [
  'rascunho',
  'aguardando_gestao',
  'aguardando_diretoria',
  'aguardando_geracao_ct',
  'ct_realizada',
];

export const STATUS_COLORS: Record<StatusRequisicao, string> = {
  rascunho: 'bg-slate-100 text-slate-700 border-slate-200',
  aguardando_gestao: 'bg-amber-50 text-amber-700 border-amber-200',
  aguardando_diretoria: 'bg-brand-50 text-brand-700 border-brand-200',
  aguardando_geracao_ct: 'bg-reptec-50 text-reptec-700 border-reptec-200',
  reprovada: 'bg-rose-50 text-rose-700 border-rose-200',
  ct_realizada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const DECISAO_LABELS: Record<DecisaoItem, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  ajustado: 'Ajustado',
};

export const DECISAO_COLORS: Record<DecisaoItem, string> = {
  pendente: 'bg-slate-100 text-slate-600 border-slate-200',
  aprovado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reprovado: 'bg-rose-50 text-rose-700 border-rose-200',
  ajustado: 'bg-amber-50 text-amber-700 border-amber-200',
};

export const ACAO_LABELS: Record<string, string> = {
  enviar: 'Enviado para gestão',
  aprovar: 'Aprovado',
  reprovar: 'Reprovado',
  reabrir: 'Reaberto como rascunho',
  reanalise: 'Reanálise solicitada',
  ct_realizada: 'CT marcada como realizada',
  ct_itens_realizada: 'Itens marcados como CT gerada',
  edicao_item: 'Item ajustado',
  item_removido: 'Item removido',
};

export const ETAPA_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_gestao: 'Aguardando Gestão',
  aguardando_diretoria: 'Aguardando Diretoria',
  aguardando_geracao_ct: 'Aguardando Geração de CT',
  reprovada: 'Reprovada',
  ct_realizada: 'CT Realizada',
};
