-- Adds the administrative permission and links users to the external login code.
ALTER TABLE public.permissoes_usuario
  ADD COLUMN IF NOT EXISTS codigo_usuario text,
  ADD COLUMN IF NOT EXISTS nome_permissao text NOT NULL DEFAULT 'padrao';

ALTER TABLE public.permissoes_usuario
  DROP CONSTRAINT IF EXISTS permissoes_usuario_nivel_check;

ALTER TABLE public.permissoes_usuario
  ADD CONSTRAINT permissoes_usuario_nivel_check CHECK (nivel BETWEEN 1 AND 5);

CREATE UNIQUE INDEX IF NOT EXISTS uq_permissoes_codigo_usuario
  ON public.permissoes_usuario(codigo_usuario)
  WHERE codigo_usuario IS NOT NULL;

DROP POLICY IF EXISTS "select_all_permissao_diretoria" ON public.permissoes_usuario;
CREATE POLICY "select_all_permissao_diretoria"
ON public.permissoes_usuario FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.permissoes_usuario p
  WHERE p.user_id = auth.uid() AND p.nivel IN (3, 5) AND p.ativo
));

DROP POLICY IF EXISTS "select_queue_requisicoes" ON public.requisicoes;
CREATE POLICY "select_queue_requisicoes"
ON public.requisicoes FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.permissoes_usuario p
  WHERE p.user_id = auth.uid() AND p.ativo AND p.nivel IN (2, 3, 4, 5)
));

DROP POLICY IF EXISTS "select_itens_approvers" ON public.requisicao_itens;
CREATE POLICY "select_itens_approvers"
ON public.requisicao_itens FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.permissoes_usuario p
  WHERE p.user_id = auth.uid() AND p.ativo AND p.nivel IN (2, 3, 4, 5)
));

DROP POLICY IF EXISTS "update_itens_approvers" ON public.requisicao_itens;
CREATE POLICY "update_itens_approvers"
ON public.requisicao_itens FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.permissoes_usuario p
  WHERE p.user_id = auth.uid() AND p.ativo AND p.nivel IN (2, 3, 5)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.permissoes_usuario p
  WHERE p.user_id = auth.uid() AND p.ativo AND p.nivel IN (2, 3, 5)
));

DROP POLICY IF EXISTS "select_historico_approvers" ON public.requisicao_historico;
CREATE POLICY "select_historico_approvers"
ON public.requisicao_historico FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.permissoes_usuario p
  WHERE p.user_id = auth.uid() AND p.ativo AND p.nivel IN (2, 3, 4, 5)
));

CREATE OR REPLACE FUNCTION public.transition_requisicao(
  p_requisicao_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL,
  p_numero_ct text DEFAULT NULL
)
RETURNS requisicoes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  req requisicoes%ROWTYPE;
  v_nivel smallint;
  v_antes jsonb;
  v_depois jsonb;
  new_status text;
BEGIN
  SELECT * INTO req FROM requisicoes WHERE id = p_requisicao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Requisição não encontrada'; END IF;
  v_nivel := public.current_nivel();

  IF p_acao = 'enviar' THEN
    IF req.status <> 'rascunho' OR (auth.uid() IS DISTINCT FROM req.solicitante_id AND v_nivel <> 5) THEN
      RAISE EXCEPTION 'Apenas o solicitante pode enviar o rascunho';
    END IF;
    new_status := 'aguardando_gestao';
  ELSIF p_acao = 'aprovar' THEN
    IF req.status = 'aguardando_gestao' AND v_nivel IN (2, 5) THEN
      new_status := 'aguardando_diretoria';
    ELSIF req.status = 'aguardando_diretoria' AND v_nivel IN (3, 5) THEN
      new_status := 'aguardando_geracao_ct';
    ELSE
      RAISE EXCEPTION 'Perfil ou status inválido para aprovação';
    END IF;
  ELSIF p_acao = 'reprovar' THEN
    IF req.status NOT IN ('aguardando_gestao', 'aguardando_diretoria') OR v_nivel NOT IN (2, 3, 5) THEN
      RAISE EXCEPTION 'Perfil ou status inválido para reprovação';
    END IF;
    IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN RAISE EXCEPTION 'Motivo da reprovação é obrigatório'; END IF;
    new_status := 'reprovada';
  ELSIF p_acao = 'reabrir' THEN
    IF req.status <> 'reprovada' OR (auth.uid() IS DISTINCT FROM req.solicitante_id AND v_nivel <> 5) THEN
      RAISE EXCEPTION 'Apenas o solicitante pode reabrir';
    END IF;
    new_status := 'rascunho';
  ELSIF p_acao = 'reanalise' THEN
    IF req.status <> 'aguardando_geracao_ct' OR v_nivel NOT IN (4, 5) THEN RAISE EXCEPTION 'Perfil ou status inválido para reanálise'; END IF;
    IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN RAISE EXCEPTION 'Motivo da reanálise é obrigatório'; END IF;
    new_status := 'aguardando_gestao';
  ELSIF p_acao = 'ct_realizada' THEN
    IF req.status <> 'aguardando_geracao_ct' OR v_nivel NOT IN (4, 5) THEN RAISE EXCEPTION 'Perfil ou status inválido para CT'; END IF;
    IF p_numero_ct IS NULL OR btrim(p_numero_ct) = '' THEN RAISE EXCEPTION 'Número da CT é obrigatório'; END IF;
    new_status := 'ct_realizada';
  ELSE
    RAISE EXCEPTION 'Ação desconhecida: %', p_acao;
  END IF;

  v_antes := to_jsonb(req);
  UPDATE requisicoes SET status = new_status,
    motivo_reprovacao = CASE WHEN p_acao = 'reprovar' THEN p_motivo ELSE NULL END,
    numero_ct = CASE WHEN p_acao = 'ct_realizada' THEN p_numero_ct ELSE numero_ct END,
    ciclo = CASE WHEN p_acao = 'reanalise' THEN ciclo + 1 ELSE ciclo END,
    updated_at = now()
  WHERE id = p_requisicao_id RETURNING * INTO req;
  v_depois := to_jsonb(req);
  PERFORM public.append_historico(p_requisicao_id, new_status, p_acao, p_motivo, v_antes, v_depois);
  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_permissao(
  p_user_id uuid, p_nivel smallint, p_nome_exibicao text, p_empresa text DEFAULT NULL
)
RETURNS permissoes_usuario
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor smallint; existing_row permissoes_usuario%ROWTYPE;
BEGIN
  actor := public.current_nivel();
  IF actor IS NULL OR actor NOT IN (3, 5) THEN RAISE EXCEPTION 'Apenas diretoria/admin pode gerenciar permissões'; END IF;
  IF p_nivel NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Nível inválido (1-5)'; END IF;
  INSERT INTO permissoes_usuario (user_id, nivel, nome_exibicao, empresa, ativo, updated_at)
  VALUES (p_user_id, p_nivel, p_nome_exibicao, p_empresa, true, now())
  ON CONFLICT (user_id) DO UPDATE SET nivel = EXCLUDED.nivel, nome_exibicao = EXCLUDED.nome_exibicao,
    empresa = EXCLUDED.empresa, ativo = true, updated_at = now()
  RETURNING * INTO existing_row;
  RETURN existing_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_permissao_ativo(p_user_id uuid, p_ativo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE actor smallint;
BEGIN
  actor := public.current_nivel();
  IF actor IS NULL OR actor NOT IN (3, 5) THEN RAISE EXCEPTION 'Apenas diretoria/admin pode alterar permissões'; END IF;
  IF auth.uid() IS NOT DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Você não pode desativar a si mesmo'; END IF;
  UPDATE permissoes_usuario SET ativo = p_ativo, updated_at = now() WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_item_aprovado(
  p_item_id uuid, p_quantidade_aprovada numeric, p_decisao text, p_giro numeric DEFAULT NULL
)
RETURNS requisicao_itens
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE item requisicao_itens%ROWTYPE; v_nivel smallint; v_antes jsonb; v_depois jsonb; v_req_status text;
BEGIN
  SELECT * INTO item FROM requisicao_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  v_nivel := public.current_nivel();
  IF v_nivel IS NULL OR v_nivel NOT IN (2, 3, 5) THEN RAISE EXCEPTION 'Perfil sem permissão para ajustar itens'; END IF;
  SELECT status INTO v_req_status FROM requisicoes WHERE id = item.requisicao_id;
  IF v_req_status NOT IN ('aguardando_gestao', 'aguardando_diretoria') THEN RAISE EXCEPTION 'Itens só podem ser ajustados nas etapas de aprovação'; END IF;
  IF p_decisao NOT IN ('pendente', 'aprovado', 'reprovado', 'ajustado') OR p_quantidade_aprovada < 0 THEN RAISE EXCEPTION 'Valores de item inválidos'; END IF;
  v_antes := to_jsonb(item);
  UPDATE requisicao_itens SET quantidade_aprovada = p_quantidade_aprovada, decisao_item = p_decisao, giro_calculado = p_giro
  WHERE id = p_item_id RETURNING * INTO item;
  v_depois := to_jsonb(item);
  PERFORM public.append_historico(item.requisicao_id, v_req_status, 'edicao_item', NULL, v_antes, v_depois);
  RETURN item;
END;
$$;
