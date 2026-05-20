CREATE OR REPLACE FUNCTION rematriculate(p_matricula_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mat        matriculas%ROWTYPE;
  v_next_serie series%ROWTYPE;
  v_nova_id    uuid;
BEGIN
  SELECT * INTO v_mat FROM matriculas WHERE id = p_matricula_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_mat.status <> 'ativa' THEN RAISE EXCEPTION 'not_active'; END IF;

  SELECT * INTO v_next_serie
  FROM series
  WHERE escola_id = v_mat.escola_id
    AND ativo = true
    AND ordem > (SELECT ordem FROM series WHERE id = v_mat.serie_id)
  ORDER BY ordem ASC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_next_serie'; END IF;

  IF EXISTS (
    SELECT 1 FROM matriculas
    WHERE aluno_id = v_mat.aluno_id
      AND ano_letivo = v_mat.ano_letivo + 1
      AND status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'already_enrolled';
  END IF;

  INSERT INTO matriculas (aluno_id, escola_id, serie_id, plano_id, ano_letivo, data_matricula, status)
  VALUES (v_mat.aluno_id, v_mat.escola_id, v_next_serie.id, v_mat.plano_id,
          v_mat.ano_letivo + 1, CURRENT_DATE, 'ativa')
  RETURNING id INTO v_nova_id;

  UPDATE matriculas SET status = 'concluida' WHERE id = p_matricula_id;

  RETURN v_nova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION rematriculate(uuid) TO authenticated, service_role;
