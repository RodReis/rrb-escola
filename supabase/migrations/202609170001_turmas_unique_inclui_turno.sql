-- (escola_id, serie_id, nome, ano_letivo) nao inclui turno: duas turmas da
-- mesma serie/ano com o mesmo nome mas turnos diferentes (ex: nome livre
-- "3o ANO 2027" usado pra Matutino e Vespertino) colidem no unique e o
-- INSERT falha silenciosamente (action nao verificava error).
alter table turmas drop constraint turmas_escola_id_serie_id_nome_ano_letivo_key;
alter table turmas add constraint turmas_escola_id_serie_id_nome_ano_letivo_turno_key
  unique (escola_id, serie_id, nome, ano_letivo, turno);
