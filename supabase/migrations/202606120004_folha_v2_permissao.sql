insert into modulos (codigo, grupo, nome, ordem) values
  ('rh.folha-v2', 'rh', 'Folha de Pagamento v2', 34)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'admin', 'rh.folha-v2', true, true, true, true
on conflict (role_codigo, modulo_codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select 'financeiro', 'rh.folha-v2', true, true, true, true
on conflict (role_codigo, modulo_codigo) do nothing;
