-- Historicos importados de escolas anteriores usam escala 0-100 (nota 100 e
-- valida). numeric(4,2) so cabe ate 99,99 e rejeitava esses alunos.
alter table historico_notas alter column nota type numeric(5,2);
