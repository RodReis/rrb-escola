-- Listar anos distintos via select paginado do PostgREST trazia só as primeiras
-- 1000 matrículas (limite padrão), escondendo anos com poucas linhas (ex: 2027).
CREATE OR REPLACE FUNCTION anos_letivos_matriculas(p_escola_id uuid)
RETURNS TABLE (ano_letivo integer)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT m.ano_letivo
  FROM matriculas m
  WHERE m.escola_id = p_escola_id
  ORDER BY m.ano_letivo DESC;
$$;

GRANT EXECUTE ON FUNCTION anos_letivos_matriculas(uuid) TO authenticated, service_role;
