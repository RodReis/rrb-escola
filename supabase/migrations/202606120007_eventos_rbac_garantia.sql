-- Garantia idempotente do módulo RBAC "eventos" que a 202605230002 não pôde
-- semear por rodar antes de modulos/role_permissoes existirem (202605300001).

insert into modulos (codigo, grupo, nome, ordem) values
  ('eventos', 'secretaria', 'Eventos', 18)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin', 'eventos', true, true, true, true),
  ('secretaria', 'eventos', true, true, true, true),
  ('financeiro', 'eventos', true, false, false, false),
  ('professor', 'eventos', true, false, false, false)
on conflict (role_codigo, modulo_codigo) do nothing;
