-- RBAC dos relatórios comerciais (Fase 3).
-- relatorios.comercial (estoque parado, ABC, imobilizado): admin/financeiro/secretaria.
-- relatorios.dre (DRE / resultado por categoria e evento): admin/financeiro só.

insert into modulos (codigo, grupo, nome, ordem) values
  ('relatorios.comercial', 'operacional', 'Relatórios Comerciais', 41),
  ('relatorios.dre',       'financeiro',  'DRE / Resultado', 18)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin',      'relatorios.comercial', true,  false, false, false),
  ('financeiro', 'relatorios.comercial', true,  false, false, false),
  ('secretaria', 'relatorios.comercial', true,  false, false, false),
  ('professor',  'relatorios.comercial', false, false, false, false),
  ('admin',      'relatorios.dre', true,  false, false, false),
  ('financeiro', 'relatorios.dre', true,  false, false, false),
  ('secretaria', 'relatorios.dre', false, false, false, false),
  ('professor',  'relatorios.dre', false, false, false, false)
on conflict (role_codigo, modulo_codigo) do nothing;
