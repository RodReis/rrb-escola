-- RBAC do módulo Comercial (Fase 1). Grupo 'secretaria' (já existente).
-- Visível para admin/financeiro/secretaria. Idempotente.

insert into modulos (codigo, grupo, nome, ordem) values
  ('comercial.produtos', 'secretaria', 'Produtos', 19),
  ('comercial.vendas',   'secretaria', 'Vendas', 20)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin',      'comercial.produtos', true, true, true, true),
  ('financeiro', 'comercial.produtos', true, true, true, true),
  ('secretaria', 'comercial.produtos', true, true, true, true),
  ('professor',  'comercial.produtos', false, false, false, false),
  ('admin',      'comercial.vendas',   true, true, true, true),
  ('financeiro', 'comercial.vendas',   true, true, true, true),
  ('secretaria', 'comercial.vendas',   true, true, true, true),
  ('professor',  'comercial.vendas',   false, false, false, false)
on conflict (role_codigo, modulo_codigo) do nothing;
