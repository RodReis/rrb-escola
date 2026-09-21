-- Permissões por painel do dashboard.
--
-- Antes: o dashboard era visível para qualquer usuário autenticado e as abas
-- apareciam por composição dos módulos de dado. Não havia como dar acesso a um
-- módulo sem dar também o resumo consolidado dele no painel inicial.
--
-- Agora cada aba tem seu próprio módulo RBAC, configurável em
-- Perfis e Permissões. O gate é ADICIONAL: a aba exige a permissão do painel
-- E algum módulo de dado por trás (ver src/app/(app)/page.tsx).

-- 1) Catálogo. `grupo` = 'dashboard' para a matriz agrupar numa seção própria.
insert into modulos (codigo, grupo, nome, ordem) values
  ('dashboard.financeiro', 'dashboard', 'Painel Financeiro',  1),
  ('dashboard.comercial',  'dashboard', 'Painel Comercial',   2),
  ('dashboard.secretaria', 'dashboard', 'Painel Secretaria',  3),
  ('dashboard.pedagogico', 'dashboard', 'Painel Pedagógico',  4)
on conflict (codigo) do nothing;

-- 2) Toda role precisa de uma linha por módulo (a UI da matriz e o
--    update delete-all/insert assumem isso).
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
select r.codigo, m.codigo, false, false, false, false
from roles r
cross join (values
  ('dashboard.financeiro'), ('dashboard.comercial'),
  ('dashboard.secretaria'), ('dashboard.pedagogico')
) as m(codigo)
on conflict (role_codigo, modulo_codigo) do nothing;

-- 3) Preserva o comportamento atual: quem já via uma aba continua vendo.
--    Sem este passo o deploy tiraria o dashboard de todos os perfis de uma vez.
--    A condição de cada painel espelha a do page.tsx.
update role_permissoes rp set pode_ler = true
where rp.modulo_codigo = 'dashboard.financeiro'
  and exists (
    select 1 from role_permissoes s
    where s.role_codigo = rp.role_codigo and s.pode_ler
      and s.modulo_codigo in ('financeiro.cobrancas', 'despesas', 'bolsistas', 'rh.folha-v2')
  );

update role_permissoes rp set pode_ler = true
where rp.modulo_codigo = 'dashboard.comercial'
  and exists (
    select 1 from role_permissoes s
    where s.role_codigo = rp.role_codigo and s.pode_ler
      and s.modulo_codigo in ('comercial.vendas', 'comercial.estoque', 'comercial.produtos')
  );

update role_permissoes rp set pode_ler = true
where rp.modulo_codigo = 'dashboard.secretaria'
  and exists (
    select 1 from role_permissoes s
    where s.role_codigo = rp.role_codigo and s.pode_ler
      and s.modulo_codigo in ('alunos', 'matriculas', 'frequencias', 'turmas', 'eventos')
  );

update role_permissoes rp set pode_ler = true
where rp.modulo_codigo = 'dashboard.pedagogico'
  and exists (
    select 1 from role_permissoes s
    where s.role_codigo = rp.role_codigo and s.pode_ler
      and s.modulo_codigo in ('avaliacoes', 'frequencias', 'pipeline')
  );

-- 4) admin enxerga tudo por bypass no código, mas mantém o seed coerente.
update role_permissoes
set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = true
where role_codigo = 'admin' and modulo_codigo like 'dashboard.%';
