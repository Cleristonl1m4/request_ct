import type { Requisicao, RequisicaoItem, RequisicaoWithItems, HistoricoEntry, PermissaoUsuario, MaterialCatalogo } from '@/lib/types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Erro na API');
  return body as T;
}

export const fetchRequisicoes = (filter: 'minhas' | 'fila' | 'todas') => request<Requisicao[]>(`/requisicoes?filter=${filter}`);
export const fetchRequisicao = (id: string) => request<RequisicaoWithItems | null>(`/requisicoes/${id}`);
export const fetchHistorico = (id: string) => request<HistoricoEntry[]>(`/requisicoes/${id}/historico`);
export const createRequisicao = (empresa?: string) => request<Requisicao>('/requisicoes', { method: 'POST', body: JSON.stringify({ empresa }) });
export const addRequisicaoItem = (id: string, material: string, quantidade: number) => request<RequisicaoItem>(`/requisicoes/${id}/itens`, { method: 'POST', body: JSON.stringify({ material, quantidade }) });
export const updateRequisicaoItem = (id: string, material: string, quantidade: number) => request<void>(`/itens/${id}`, { method: 'PATCH', body: JSON.stringify({ material, quantidade }) });
export const deleteRequisicaoItem = (id: string) => request<void>(`/itens/${id}`, { method: 'DELETE' });
export const deleteRequisicao = (id: string) => request<void>(`/requisicoes/${id}`, { method: 'DELETE' });
export const transitionRequisicao = (id: string, acao: string, motivo?: string, numeroCt?: string, itemIds?: string[]) => request<Requisicao>(`/requisicoes/${id}/transicao`, { method: 'POST', body: JSON.stringify({ acao, motivo, numeroCt, itemIds }) });
export const updateItemAprovado = (id: string, quantidadeAprovada: number, decisao: string, giro?: number) => request<void>(`/itens/${id}/aprovacao`, { method: 'POST', body: JSON.stringify({ quantidadeAprovada, decisao, giro }) });
export const fetchPermissoes = () => request<PermissaoUsuario[]>('/permissoes');
export const upsertPermissao = (userId: string, nivel: number, nome: string, empresa?: string) => request<void>('/permissoes', { method: 'PUT', body: JSON.stringify({ userId, nivel, nome, empresa }) });
export const togglePermissaoAtivo = (userId: string, ativo: boolean) => request<void>(`/permissoes/${userId}/ativo`, { method: 'POST', body: JSON.stringify({ ativo }) });
export const fetchMaterial = (codigo: string) => request<MaterialCatalogo[]>(`/materiais?codigo=${encodeURIComponent(codigo)}`);
