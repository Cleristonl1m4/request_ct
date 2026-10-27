export type Nivel = 1 | 2 | 3 | 4 | 5;

export type StatusRequisicao =
  | 'rascunho'
  | 'aguardando_gestao'
  | 'aguardando_diretoria'
  | 'aguardando_geracao_ct'
  | 'reprovada'
  | 'ct_realizada';

export type DecisaoItem = 'pendente' | 'aprovado' | 'reprovado' | 'ajustado';

export interface PermissaoUsuario {
  user_id: string;
  nivel: Nivel;
  codigo_usuario?: string | null;
  nome_permissao?: string | null;
  nome_exibicao: string;
  empresa: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Requisicao {
  id: string;
  numero_solicitacao: number;
  solicitante_id: string;
  status: StatusRequisicao;
  ciclo: number;
  motivo_reprovacao: string | null;
  numero_ct: string | null;
  empresa: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequisicaoItem {
  id: string;
  requisicao_id: string;
  material: string;
  quantidade_solicitada: number;
  quantidade_aprovada: number;
  giro_calculado: number | null;
  decisao_item: DecisaoItem;
  situacao?: string;
  ct_gerada?: boolean;
  numero_ct?: string | null;
  ct_gerada_em?: string | null;
  ct_gerada_por?: string | null;
  created_at: string;
}

export interface HistoricoEntry {
  id: string;
  requisicao_id: string;
  etapa: string;
  usuario_id: string;
  acao: string;
  motivo: string | null;
  valores_antes: Record<string, unknown> | null;
  valores_depois: Record<string, unknown> | null;
  created_at: string;
}

export interface RequisicaoWithItems extends Requisicao {
  itens: RequisicaoItem[];
}

export interface MaterialCatalogo {
  Cd_material: string;
  Descricao: string;
  Cd_especif1: string | null;
  Descricao_especif: string | null;
  Numeracao: string | number | null;
}
