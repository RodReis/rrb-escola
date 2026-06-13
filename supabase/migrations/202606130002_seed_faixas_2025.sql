-- INSS 2025 — faixas progressivas
--
-- Fonte: Portaria Interministerial MPS/MF nº 1.202, de 30 de dezembro de 2024
-- Vigência: 1º de janeiro de 2025 a 31 de dezembro de 2025
-- Salário mínimo 2025: R$ 1.518,00
-- Teto de contribuição 2025: R$ 7.786,02
--
insert into public.inss_brackets (vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir)
values
  ('2025-01-01', 1,    0.00, 1518.00, 0.0750,   0.00),
  ('2025-01-01', 2, 1518.01, 2793.88, 0.0900,  22.77),
  ('2025-01-01', 3, 2793.89, 4190.83, 0.1200, 106.59),
  ('2025-01-01', 4, 4190.84, 7786.02, 0.1400, 190.37)
on conflict (vigencia_inicio, ordem) do nothing;

-- IRRF 2025 — tabela progressiva mensal
--
-- Fonte: Receita Federal — Instrução Normativa RFB nº 2.178/2024
-- Vigência: 1º de janeiro de 2025 a 31 de dezembro de 2025
-- Dedução mensal por dependente: R$ 189,59
-- Nota: mesmos brackets que 2026; sem redutor Lei 15.270 (vigente apenas a partir de 2026-01-01)
--
insert into public.ir_brackets (vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir, deducao_dependente)
values
  ('2025-01-01', 1,    0.00, 2428.80, 0.0000,    0.00, 189.59),
  ('2025-01-01', 2, 2428.81, 2826.65, 0.0750,  182.16, 189.59),
  ('2025-01-01', 3, 2826.66, 3751.05, 0.1500,  394.16, 189.59),
  ('2025-01-01', 4, 3751.06, 4664.68, 0.2250,  675.49, 189.59),
  ('2025-01-01', 5, 4664.69,    null, 0.2750,  908.73, 189.59)
on conflict (vigencia_inicio, ordem) do nothing;
