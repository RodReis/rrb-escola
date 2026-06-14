-- RBAC do Livro-Razão (Fase 0). RLS sozinho não faz a tela aparecer no menu —
-- o gating de UI usa modulos/role_permissoes. Semeia o módulo financeiro.lancamentos
-- restrito a admin/financeiro. Idempotente.

insert into modulos (codigo, grupo, nome, ordem) values
  ('financeiro.lancamentos', 'financeiro', 'Livro-Razão', 16)
on conflict (codigo) do nothing;

insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar) values
  ('admin',      'financeiro.lancamentos', true,  true,  true,  true),
  ('financeiro', 'financeiro.lancamentos', true,  true,  true,  true),
  ('secretaria', 'financeiro.lancamentos', false, false, false, false),
  ('professor',  'financeiro.lancamentos', false, false, false, false)
on conflict (role_codigo, modulo_codigo) do nothing;
