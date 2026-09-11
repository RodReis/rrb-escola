-- INFANTIL2 e INFANTIL3 foram cadastradas com a mesma ordem (2), embora sejam
-- etapas distintas (161 alunos cursaram as duas). O empate quebra tudo que
-- depende da progressao: a funcao rematriculate() escolhe a proxima serie por
-- "ordem > ordem atual", entao um aluno em INFANTIL2 pula para INFANTIL4, e a
-- reconstrucao do historico enxerga as duas como um unico ano letivo.
--
-- Reabre espaco deslocando as series seguintes em +1 antes de assentar
-- INFANTIL3 na ordem 3. Ordem final: INFANTIL1 0, MATERNAL 1, INFANTIL2 2,
-- INFANTIL3 3, INFANTIL4 4, INFANTIL5 5, 1o ANO 6 ... 3a SERIE 17.

update public.series
set ordem = ordem + 1
where ordem >= 3;

update public.series
set ordem = 3
where nome = 'INFANTIL3';
