-- =============================================================================
-- Seed: rubricas, perfis, faixas fiscais 2026 e folha_config
-- =============================================================================

-- -----------------------------------------------------------------------------
-- INSS 2026 — faixas progressivas
--
-- Fonte: Portaria Interministerial MPS/MF nº 13, de 9 de janeiro de 2026
--   https://www.gov.br/inss/pt-br/assuntos/com-reajuste-de-3-9-teto-do-inss-chega-a-r-8-475-55-em-2026
--   https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal
--
-- Vigência: 1º de janeiro de 2026
-- Salário mínimo 2026: R$ 1.621,00
-- Teto de contribuição 2026: R$ 8.475,55
-- Desconto máximo: R$ 988,09
--
-- Âncoras de validação (calcINSS progressivo):
--   calcINSS(1621.00) = 1621.00 × 0.075 = 121.58
--   calcINSS(8475.55) = 121.58 + 115.36 + 174.17 + 576.98 = 988.09
-- -----------------------------------------------------------------------------
insert into public.inss_brackets (vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir)
values
  ('2026-01-01', 1,    0.00, 1621.00, 0.0750,   0.00),
  ('2026-01-01', 2, 1621.01, 2902.84, 0.0900,  22.77),
  ('2026-01-01', 3, 2902.85, 4354.27, 0.1200, 106.59),
  ('2026-01-01', 4, 4354.28, 8475.55, 0.1400, 190.40)
on conflict (vigencia_inicio, ordem) do update set
  valor_de         = excluded.valor_de,
  valor_ate        = excluded.valor_ate,
  aliquota         = excluded.aliquota,
  parcela_deduzir  = excluded.parcela_deduzir,
  updated_at       = now();

-- -----------------------------------------------------------------------------
-- IRRF 2026 — tabela progressiva mensal
--
-- Fonte: Receita Federal — Tributação 2026
--   https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
--   https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/janeiro/receita-divulga-nova-tabela-do-irpf-com-as-mudancas-apos-isencao-para-quem-ganha-ate-r-5-mil
--
-- Dedução mensal por dependente: R$ 189,59
-- (mesmos brackets que 2025; novidade é o redutor Lei 15.270/2025 abaixo)
-- -----------------------------------------------------------------------------
insert into public.ir_brackets (vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir, deducao_dependente)
values
  ('2026-01-01', 1,    0.00, 2428.80, 0.0000,    0.00, 189.59),
  ('2026-01-01', 2, 2428.81, 2826.65, 0.0750,  182.16, 189.59),
  ('2026-01-01', 3, 2826.66, 3751.05, 0.1500,  394.16, 189.59),
  ('2026-01-01', 4, 3751.06, 4664.68, 0.2250,  675.49, 189.59),
  ('2026-01-01', 5, 4664.69,    null, 0.2750,  908.73, 189.59)
on conflict (vigencia_inicio, ordem) do update set
  valor_de           = excluded.valor_de,
  valor_ate          = excluded.valor_ate,
  aliquota           = excluded.aliquota,
  parcela_deduzir    = excluded.parcela_deduzir,
  deducao_dependente = excluded.deducao_dependente,
  updated_at         = now();

-- -----------------------------------------------------------------------------
-- IRRF redutor — Lei 15.270/2025 (isenção até R$ 5.000; redução até R$ 7.350)
--
-- Fonte: Lei nº 15.270, de 6 de janeiro de 2025 (vigente a partir de 2026-01-01)
--   https://www.gov.br/secom/pt-br/assuntos/noticias/2026/01/nova-tabela-do-ir-veja-faixas-e-aliquotas-e-saiba-mais-sobre-medida-que-isenta-o-pagamento-para-quem-ganha-ate-r-5-mil
--   https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/dezembro/receita-federal-orienta-fontes-pagadoras-e-contribuintes-a-calcular-a-reducao-do-imposto-de-renda-a-partir-de-1o-de-janeiro-de-2026
-- -----------------------------------------------------------------------------
insert into public.irrf_redutor (valido_de, limite_isencao, limite_reducao)
values ('2026-01-01', 5000.00, 7350.00)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Rubricas — 25 rubricas × todas as escolas
-- -----------------------------------------------------------------------------
insert into public.folha_rubricas
  (escola_id, codigo, nome, tipo, metodo_calculo,
   incide_inss, incide_irrf, incide_fgts, incide_dsr, ordem_holerite)
select
  e.id,
  r.codigo, r.nome, r.tipo, r.metodo,
  r.inss, r.irrf, r.fgts, r.dsr, r.ordem
from public.escolas e
cross join (values
  ('salario_base',      'Salário base',             'provento',    'salario_base',           true,  true,  true,  false, 10),
  ('hora_aula',         'Hora-aula',                'provento',    'hora_aula',               true,  true,  true,  true,  10),
  ('salario_dobra',     'Salário dobra',            'provento',    'valor_contratual',        true,  true,  true,  true,  20),
  ('dsr',               'DSR',                      'provento',    'dsr',                     true,  true,  true,  false, 30),
  ('hora_atividade',    'Hora-atividade',           'provento',    'hora_atividade',          true,  true,  true,  false, 40),
  ('he50',              'Horas extras 50%',         'provento',    'manual',                  true,  true,  true,  true,  50),
  ('adicional_noturno', 'Adicional noturno',        'provento',    'manual',                  true,  true,  true,  true,  51),
  ('gratificacao',      'Gratificação',             'provento',    'valor_contratual',        true,  true,  true,  false, 52),
  ('um_terco_ferias',   '1/3 de férias',            'provento',    'manual',                  true,  true,  true,  false, 53),
  ('salario_familia',   'Salário-família',          'provento',    'manual',                  false, false, false, false, 54),
  ('bolsa_estagio',     'Bolsa estágio',            'provento',    'salario_base',            false, false, false, false, 10),
  ('valor_servico',     'Valor do serviço',         'provento',    'salario_base',            false, false, false, false, 10),
  ('inss',              'INSS',                     'desconto',    'inss',                    false, false, false, false, 60),
  ('inss_rpa',          'INSS 11%',                 'desconto',    'inss_rpa',                false, false, false, false, 60),
  ('irrf',              'IRRF',                     'desconto',    'irrf',                    false, false, false, false, 61),
  ('vale_transporte',   'Vale transporte 6%',       'desconto',    'percentual_sobre_base',   false, false, false, false, 62),
  ('vale_alimentacao',  'Vale alimentação',         'desconto',    'valor_contratual',        false, false, false, false, 63),
  ('adiantamento',      'Adiantamento',             'desconto',    'manual',                  false, false, false, false, 64),
  ('consignado',        'Empréstimo consignado',    'desconto',    'valor_contratual',        false, false, false, false, 65),
  ('sindicato',         'Mensalidade sindical',     'desconto',    'valor_contratual',        false, false, false, false, 66),
  ('faltas',            'Faltas',                   'desconto',    'manual',                  false, false, false, false, 67),
  ('fgts',              'FGTS 8%',                  'informativa', 'fgts',                    false, false, false, false, 80),
  ('inss_patronal',     'INSS patronal',            'informativa', 'inss_patronal',            false, false, false, false, 81),
  ('provisao_13',       'Provisão 13º',             'informativa', 'provisao_13',             false, false, false, false, 82),
  ('provisao_ferias',   'Provisão férias+1/3',      'informativa', 'provisao_ferias',         false, false, false, false, 83)
) as r(codigo, nome, tipo, metodo, inss, irrf, fgts, dsr, ordem)
on conflict (escola_id, codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Perfis de cálculo — 5 perfis × todas as escolas
-- -----------------------------------------------------------------------------
insert into public.folha_perfis_calculo (escola_id, codigo, nome)
select e.id, p.codigo, p.nome
from public.escolas e
cross join (values
  ('clt',          'CLT'),
  ('clt_professor', 'CLT Professor'),
  ('pj',           'PJ'),
  ('rpa',          'Autônomo / RPA'),
  ('estagiario',   'Estagiário')
) as p(codigo, nome)
on conflict (escola_id, codigo) do nothing;

-- -----------------------------------------------------------------------------
-- Vínculos perfil ↔ rubrica
-- -----------------------------------------------------------------------------
insert into public.folha_perfis_rubricas (perfil_id, rubrica_id, automatica, ordem_execucao)
select p.id, r.id, true, m.ordem
from public.folha_perfis_calculo p
join (values
  ('clt',           'salario_base',    10),
  ('clt',           'inss',            60),
  ('clt',           'irrf',            61),
  ('clt',           'fgts',            80),
  ('clt',           'inss_patronal',   81),
  ('clt',           'provisao_13',     82),
  ('clt',           'provisao_ferias', 83),
  ('clt_professor', 'hora_aula',       10),
  ('clt_professor', 'salario_dobra',   20),
  ('clt_professor', 'dsr',             30),
  ('clt_professor', 'hora_atividade',  40),
  ('clt_professor', 'inss',            60),
  ('clt_professor', 'irrf',            61),
  ('clt_professor', 'fgts',            80),
  ('clt_professor', 'inss_patronal',   81),
  ('clt_professor', 'provisao_13',     82),
  ('clt_professor', 'provisao_ferias', 83),
  ('rpa',           'valor_servico',   10),
  ('rpa',           'inss_rpa',        60),
  ('rpa',           'irrf',            61),
  ('rpa',           'inss_patronal',   81),
  ('pj',            'valor_servico',   10),
  ('estagiario',    'bolsa_estagio',   10)
) as m(perfil, rubrica, ordem) on m.perfil = p.codigo
join public.folha_rubricas r
  on r.codigo = m.rubrica
  and r.escola_id = p.escola_id
on conflict (perfil_id, rubrica_id) do nothing;

-- -----------------------------------------------------------------------------
-- folha_config — 1 linha por company, escola padrão DEFAULT_SCHOOL_ID
-- -----------------------------------------------------------------------------
insert into public.folha_config (company_id, escola_id)
select c.id, '00000000-0000-0000-0000-000000000001'
from public.companies c
on conflict (company_id) do nothing;
