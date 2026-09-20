-- Um aluno tem no maximo uma matricula por ano letivo.
--
-- A ausencia dessa trava permitiu que a linha deslocada convivesse com a do ano
-- correto: o importador do sistema antigo derivou ano_letivo de
-- year(data_matricula), mas a escola matricula de set-dez PARA o ano seguinte,
-- entao parte do historico ficou um ano atras e duplicou a serie do aluno.
--
-- Verificado direto em producao (estado corrigido em 2026-09): 0 pares
-- (escola_id, aluno_id, ano_letivo) duplicados.
--
-- O snapshot de seed local (202605270002_seed_real_data.sql, congelado em
-- 13/06) e anterior as correcoes de ano letivo/rematricula de setembro e
-- carrega 330 pares duplicados: duas gravacoes do mesmo evento de matricula,
-- criadas com poucos milissegundos de diferenca, uma na serie "certa" e outra
-- numa serie vizinha (ex.: 4 ANO e 3 ANO no mesmo ano_letivo). Sem a limpeza
-- abaixo, a constraint falha ao rodar `db reset --local` neste seed.
--
-- Criterio: mantem a matricula da serie mais avancada (maior series.ordem) e
-- marca a outra como 'cancelada' — nao apaga, so tira do enum ativo/concluido
-- que os relatorios ja filtram (ver uso de .neq("status","cancelada") em
-- src/lib/data/*.ts). Repetencia real nao gera este padrao: aqui as duas
-- linhas do par nascem juntas, no mesmo instante de import.
DO $$
DECLARE
  v_conflitos int;
BEGIN
  SELECT count(*) INTO v_conflitos
  FROM (
    SELECT escola_id, aluno_id, ano_letivo
    FROM matriculas
    WHERE status <> 'cancelada'
    GROUP BY escola_id, aluno_id, ano_letivo
    HAVING count(*) > 1
  ) dup;

  IF v_conflitos > 0 THEN
    RAISE NOTICE 'matriculas_aluno_ano_unico: cancelando % par(es) duplicado(s) de import antes de travar a constraint', v_conflitos;

    UPDATE matriculas m
    SET status = 'cancelada'
    WHERE m.status <> 'cancelada'
      AND EXISTS (
        SELECT 1
        FROM matriculas m2
        JOIN series s1 ON s1.id = m.serie_id
        JOIN series s2 ON s2.id = m2.serie_id
        WHERE m2.escola_id = m.escola_id
          AND m2.aluno_id = m.aluno_id
          AND m2.ano_letivo = m.ano_letivo
          AND m2.status <> 'cancelada'
          AND m2.id <> m.id
          -- so a de serie MENOS avancada perde; empate de ordem (caso nao
          -- observado nos 330 pares, mas coberto por seguranca) mantem a
          -- criada primeiro e cancela a mais nova.
          AND (s2.ordem > s1.ordem OR (s2.ordem = s1.ordem AND m2.created_at < m.created_at))
      );
  END IF;
END $$;

-- Indice parcial, nao constraint simples: duas matriculas 'cancelada' do mesmo
-- aluno/ano sao um caso legitimo (aluno matriculado, cancelado, matriculado de
-- novo no mesmo ano) e nao devem colidir entre si nem com a limpeza acima.
CREATE UNIQUE INDEX matriculas_aluno_ano_unico
  ON matriculas (escola_id, aluno_id, ano_letivo)
  WHERE status <> 'cancelada';
