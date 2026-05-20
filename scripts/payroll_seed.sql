-- Seed payroll 04/2026 (folha base, ref=2026-05-01)
-- Transcrito manualmente das imagens da folha física
-- Match por employees.name (ILIKE) sem filtro de empresa (DB já tem company_id correta).
-- Homônimos desambiguados por CPF.
-- Estratégia: UPSERT (ON CONFLICT employee_id+reference_month DO UPDATE)

BEGIN;

-- =========================================================================
-- PARTE 0: Funcionários ausentes na DB -- criar com CPF placeholder
-- TODO: ajustar CPF/hire_date/cargo manualmente após import
-- =========================================================================

INSERT INTO public.employees (name, cpf, company_id) VALUES
  ('Läysslla Roberta dos Santos',           'SEED-LAYSSLLA',  (SELECT id FROM public.companies WHERE name ILIKE '%Pinguinho%')),
  ('Sthéfanny Guimarães',                   'SEED-STHEFANNY', (SELECT id FROM public.companies WHERE name ILIKE '%Pinguinho%')),
  ('Victória Karoline de Oliveira Menezes', 'SEED-VICTORIA',  (SELECT id FROM public.companies WHERE name ILIKE '%Pinguinho%')),
  ('Valdirene da Silva Cunha',              'SEED-VALDIRENE', (SELECT id FROM public.companies WHERE name ILIKE '%Pinguinho%')),
  ('Joseane Silva Leite',                   'SEED-JOSEANE',   (SELECT id FROM public.companies WHERE name ILIKE '%Integrado%'))
ON CONFLICT (cpf) DO NOTHING;

-- =========================================================================
-- PARTE 1: Defaults em employees (aplica_dobra, salario_sem_dsr, gps_default)
-- Match por CPF onde homônimo; senão por name único.
-- =========================================================================

-- Imagem 4 (DOBRA) Pinguinho
UPDATE public.employees SET aplica_dobra=true,  salario_sem_dsr=2304.75, gps_default=575.89 WHERE name ILIKE 'Ana Flávia de Jesus Luciano';
UPDATE public.employees SET aplica_dobra=true,  salario_sem_dsr=2304.75, gps_default=575.89 WHERE name ILIKE 'Ângela Maria dos S. Gonçalves';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=1721.91, gps_default=0      WHERE name ILIKE 'Carlene R. da Cunha Manrique';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=2083.33, gps_default=0      WHERE cpf='091.613.834-81';
UPDATE public.employees SET aplica_dobra=true,  salario_sem_dsr=1722.66, gps_default=179.72 WHERE name ILIKE 'Ellizainne Janine Silva';
UPDATE public.employees SET aplica_dobra=true,  salario_sem_dsr=1734.43, gps_default=162.99 WHERE name ILIKE 'Evelyn Emylly Moreira dos Reis';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=1722.66, gps_default=178.70 WHERE name ILIKE 'Hellen Alves Lemes';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=1364.96, gps_default=123.09 WHERE name ILIKE 'Janete de Freitas Rodrigues';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=3305.98, gps_default=364.64 WHERE name ILIKE 'Lucilene Maria Montelo';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=2542.80, gps_default=0      WHERE cpf='711.500.304-10';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=1359.17, gps_default=122.47 WHERE name ILIKE 'Maria da Conceição Bezerra da Silva';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=1734.43, gps_default=162.99 WHERE name ILIKE 'Mariana Alves de Deus';
UPDATE public.employees SET aplica_dobra=true,  salario_sem_dsr=1734.43, gps_default=388.10 WHERE name ILIKE 'Mayara Lorrayne da Silva';
UPDATE public.employees SET aplica_dobra=true,  salario_sem_dsr=1734.43, gps_default=162.99 WHERE name ILIKE 'Sthéfanny Guimarães';
UPDATE public.employees SET aplica_dobra=true,  salario_sem_dsr=1364.96, gps_default=123.09 WHERE name ILIKE 'Victória Karoline de Oliveira Menezes';

-- Imagem 6 Pinguinho (com S/DSR, sem dobra)
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=2641.98, gps_default=0      WHERE name ILIKE 'Aurio Velozo dos Santos Godoy';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=2312.50, gps_default=0      WHERE cpf='272.850.172-64';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=1337.08, gps_default=0      WHERE name ILIKE 'Jean Divino de Jesus';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=808.93,  gps_default=0      WHERE cpf='403.061.691-77';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=1462.04, gps_default=133.58 WHERE name ILIKE 'Pedro Leandro Oliveira Souza';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=1364.96, gps_default=123.09 WHERE name ILIKE 'Tatiana Vieira da Silva';
UPDATE public.employees SET aplica_dobra=false, salario_sem_dsr=1364.96, gps_default=123.09 WHERE name ILIKE 'Valdirene da Silva Cunha';

-- Outros com dobra detectada
UPDATE public.employees SET aplica_dobra=true,  gps_default=384.71 WHERE name ILIKE 'Läysslla Roberta dos Santos';
UPDATE public.employees SET aplica_dobra=true,  gps_default=129.95 WHERE name ILIKE 'Reginalda Canuto Machado Silva';
UPDATE public.employees SET aplica_dobra=true,  gps_default=146.25 WHERE name ILIKE 'Selma dos Reis Teixeira Gonçalves';
UPDATE public.employees SET aplica_dobra=true,  gps_default=446.37 WHERE name ILIKE 'Solange Jesus Koga Lima';

-- =========================================================================
-- PARTE 2: UPSERT payroll (ref=2026-05-01)
-- Match por employees.name (sem filtro empresa); homônimos por CPF.
-- =========================================================================

INSERT INTO public.payroll (
  employee_id, reference_month, base_salary, additional, considera_um_tercio_ferias,
  total_earnings, inss, ir, loan_deduction, advance, total_deductions,
  family_allowance, net_amount, salario_sem_dsr, aplica_dobra, gps
) VALUES
-- ===== IMAGEM 1 =====
((SELECT id FROM public.employees WHERE cpf='216.590.650-46'),                          '2026-05-01', 2067.19, 0,      false, 2067.19, 0,      0,    0,      0,      0,       0,      2067.19, NULL,    false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Inês Vieira de Souza'),                   '2026-05-01', 2067.19, 188.65, false, 2255.84, 178.70, 0,    0,      0,      178.70,  0,      2077.14, NULL,    false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Janaína Maria Nunes'),                    '2026-05-01', 4407.60, 0,      false, 5390.59, 0,      0,    0,      0,      311.50,  0,      5079.09, NULL,    false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Juliana Vieira Jorge'),                   '2026-05-01', 1637.95, 0,      false, 1637.95, 123.09, 0,    0,      65,     188.09,  135.08, 1584.94, NULL,    false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Laís Ramos Fernandes'),                   '2026-05-01', 2067.19, 0,      false, 3367.19, 161.72, 0,    0,      65,     226.72,  0,      3140.47, NULL,    false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Läysslla Roberta dos Santos'),            '2026-05-01', 2067.19, 0,      false, 4569.08, 384.71, 0,    0,      0,      384.71,  0,      4184.37, NULL,    true,  384.71),
((SELECT id FROM public.employees WHERE name ILIKE 'Leia Damasceno%'),                  '2026-05-01', 2067.19, 0,      false, 2067.19, 161.72, 0,    0,      0,      161.72,  0,      1905.47, NULL,    false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Miramar Barbosa Silva'),                  '2026-05-01', 1637.95, 903.34, false, 2541.29, 123.09, 0,    0,      0,      123.09,  67.54,  2485.74, NULL,    false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Samantha Silva Amorim'),                  '2026-05-01', 2623.44, 0,      false, 6123.72, 211.78, 0,    569.76, 0,      1130.74, 0,      4992.98, NULL,    false, NULL),

-- ===== IMAGEM 2 =====
((SELECT id FROM public.employees WHERE name ILIKE 'Benedito Rodrigues borges'),              '2026-05-01', 2012.94, 600,    false, 2612.94, 121.57, 0, 0, 0,      121.57,  0,      2612.94, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Bruna Rocha Ferreira'),                   '2026-05-01', 1621,    0,      false, 1742.57, 121.57, 0, 0, 0,      121.57,  0,      1621,    NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Eduarda Lais Silva Candido'),             '2026-05-01', 1000,    230,    false, 1230,    0,      0, 0, 135.90, 135.90,  0,      1094.10, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Lucimar Souza Silva'),                    '2026-05-01', 1637.95, 135.41, false, 2474.22, 135.28, 0, 0, 0,      135.28,  0,      2338.94, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Rosângela Maria Dias'),                   '2026-05-01', 1637.95, 127.70, false, 2058.57, 134.58, 0, 491.98, 0,  626.56,  0,      1432.01, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Selma Luiz de Paula'),                    '2026-05-01', 1637.95, 100,    false, 1737.95, 132.05, 0, 0, 0,      132.05,  0,      1605.86, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Vanessa Alves Soares'),                   '2026-05-01', 1000,    0,      false, 1000,    0,      0, 0, 567.50, 567.50,  0,      432.50,  NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Any Karolliny Rodrigues Siqueira'),       '2026-05-01', 1000,    399.96, false, 1399.96, 0,      0, 0, 438,    438,     0,      961.96,  NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Suzane dos Santos Martins'),              '2026-05-01', 2236.28, 221.54, false, 2457.82, 176.94, 0, 0, 0,      176.94,  0,      2280.88, NULL, false, NULL),

-- ===== IMAGEM 3 =====
((SELECT id FROM public.employees WHERE name ILIKE 'Ana Livia Lourenço Ferreira'),            '2026-05-01', 1596,    0, false, 1596,    119.70, 0, 0, 0, 119.70, 0, 1476.30, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Carlos Henrique Camilo de Matos'),        '2026-05-01', 1072.93, 0, false, 1235.18, 0,      0, 0, 0, 0,      0, 1235.18, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Fernando Silva Olimpio'),                 '2026-05-01', 2055.28, 0, false, 2584.23, 214.38, 0, 0, 0, 214.38, 0, 2369.85, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Flancley da Silva Sá'),                   '2026-05-01', 3735.86, 0, false, 4168.41, 0,      0, 0, 0, 0,      0, 4168.41, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Gabriel Ferreira e Silva'),               '2026-05-01', 1993.57, 0, false, 1993.57, 0,      0, 0, 0, 0,      0, 1993.57, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Haniery Marques Fernandes'),              '2026-05-01', 1892.67, 0, false, 1982.14, 0,      0, 0, 0, 0,      0, 1982.14, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Jordana Cristina Silava Gaioso'),         '2026-05-01', 1103.76, 0, false, 1263.76, 0,      0, 0, 0, 0,      0, 1263.76, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Letícia Dias de Castro'),                 '2026-05-01', 1072.93, 0, false, 1235.20, 0,      0, 0, 0, 0,      0, 1235.20, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Pedro Junio Dias Rosa'),                  '2026-05-01', 2321,    0, false, 2468.70, 0,      0, 0, 0, 0,      0, 2468.70, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Renato Dias de Oliveira'),                '2026-05-01', 1116.65, 0, false, 1116.65, 0,      0, 0, 0, 0,      0, 1116.65, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Ricardo Alves Martins'),                  '2026-05-01', 2990.93, 0, false, 2990.93, 0,      0, 0, 0, 0,      0, 2990.93, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Saillen Christinna Pereira Couto'),       '2026-05-01', 1582.81, 0, false, 1582.81, 118.65, 0, 0, 372.50, 491.15, 67.54, 1159.20, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Thais Priscilla Souza'),                  '2026-05-01', 1637.95, 0, false, 1637.95, 123.09, 0, 0, 74,     197.09, 0,     1440.86, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'Vinicius Ferreira Barbosa'),              '2026-05-01', 1476.50, 0, false, 1582.50, 0,      0, 0, 0, 0,      0,     1582.50, NULL, false, NULL),
((SELECT id FROM public.employees WHERE name ILIKE 'CARLOS LEONARDO ALVES SOARES'),           '2026-05-01', 1073.32, 0, false, 1073.32, 80.49,  0, 0, 0, 80.49,  0,     992.83,  NULL, false, NULL),

-- ===== IMAGEM 4 (Pinguinho DOBRA) =====
((SELECT id FROM public.employees WHERE name ILIKE 'Ana Flávia de Jesus Luciano'),            '2026-05-01', 2765.70, 0,       false, 5531.40, 0, 203.29, 0,    0,      779.18,  0,     4752.22, 2304.75, true, 575.89),
((SELECT id FROM public.employees WHERE name ILIKE 'Ângela Maria dos S. Gonçalves'),          '2026-05-01', 2765.70, 237,     false, 5918.40, 0, 203.29, 0,    18,     797.18,  0,     5121.22, 2304.75, true, 575.89),
((SELECT id FROM public.employees WHERE name ILIKE 'Carlene R. da Cunha Manrique'),           '2026-05-01', 2066.29, 943.60,  false, 3009.89, 0, 0,      0,    0,      0,       0,     3009.89, 1721.91, false, 0),
((SELECT id FROM public.employees WHERE cpf='091.613.834-81'),                          '2026-05-01', 2500,    0,       false, 2500,    0, 0,      0,    0,      0,       0,     2500,    2083.33, false, 0),
((SELECT id FROM public.employees WHERE name ILIKE 'Ellizainne Janine Silva'),                '2026-05-01', 2067.19, 199.96,  false, 3997.35, 0, 0,      0,    0,      179.72,  0,     3817.63, 1722.66, true, 179.72),
((SELECT id FROM public.employees WHERE name ILIKE 'Evelyn Emylly Moreira dos Reis'),         '2026-05-01', 2081.31, 0,       false, 4148.50, 0, 1,      70.40, 0,    234.39,  0,     3914.11, 1734.43, true, 162.99),
((SELECT id FROM public.employees WHERE name ILIKE 'Hellen Alves Lemes'),                     '2026-05-01', 2067.19, 188.65,  false, 2255.84, 0, 0,      0,    600.99, 1054.19, 0,     1201.65, 1722.66, false, 178.70),
((SELECT id FROM public.employees WHERE name ILIKE 'Janete de Freitas Rodrigues'),            '2026-05-01', 1637.95, 873.60,  false, 2511.55, 0, 0,      0,    0,      123.09,  0,     2388.46, 1364.96, false, 123.09),
((SELECT id FROM public.employees WHERE name ILIKE 'Lucilene Maria Montelo'),                 '2026-05-01', 3967.17, 0,       false, 3967.17, 0, 0,      0,    0,      364.64,  0,     3602.53, 3305.98, false, 364.64),
((SELECT id FROM public.employees WHERE cpf='711.500.304-10'),                          '2026-05-01', 3051.36, 502,     false, 3553.36, 0, 0,      0,    0,      0,       0,     3553.36, 2542.80, false, 0),
((SELECT id FROM public.employees WHERE name ILIKE 'Maria da Conceição Bezerra da Silva'),    '2026-05-01', 1631,    500,     false, 2131,    0, 0,      0,    25.90,  148.37,  0,     1982.63, 1359.17, false, 122.47),
((SELECT id FROM public.employees WHERE name ILIKE 'Mariana Alves de Deus'),                  '2026-05-01', 2081.31, 0,       false, 2081.31, 0, 0,      0,    0,      162.99,  0,     1918.32, 1734.43, false, 162.99),
((SELECT id FROM public.employees WHERE name ILIKE 'Mayara Lorrayne da Silva'),               '2026-05-01', 2081.31, 1734.43, false, 4262.63, 0, 0,      1016.56, 0,  1404.66, 0,     2857.97, 1734.43, true, 388.10),
((SELECT id FROM public.employees WHERE name ILIKE 'Sthéfanny Guimarães'),                    '2026-05-01', 2081.31, 0,       false, 3719.26, 0, 0,      0,    0,      162.99,  0,     3556.27, 1734.43, true, 162.99),
((SELECT id FROM public.employees WHERE name ILIKE 'Victória Karoline de Oliveira Menezes'),  '2026-05-01', 1637.95, 229.12,  false, 3605.02, 0, 0,      0,    688.80, 811.89,  67.54, 2860.67, 1364.96, true, 123.09),

-- ===== IMAGEM 5 =====
((SELECT id FROM public.employees WHERE name ILIKE 'Joseane Silva Leite'),                    '2026-05-01', 1637.95, 371.30,  false, 2009.25, 0,      0, 0, 66,    66,      0, 1943.25, NULL, false, 0),
((SELECT id FROM public.employees WHERE name ILIKE 'Keila Regina de Oliveira'),               '2026-05-01', 2907.58, 0,       false, 2907.58, 237.49, 0, 0, 0,     237.49,  0, 2670.09, NULL, false, 237.49),
((SELECT id FROM public.employees WHERE name ILIKE 'Luciany Maria da Silva'),                 '2026-05-01', 1637.95, 0,       false, 1637.95, 123.09, 0, 0, 0,     123.09,  0, 1514.86, NULL, false, 123.09),
((SELECT id FROM public.employees WHERE name ILIKE 'Maria Márcia B. Souza'),                  '2026-05-01', 1637.95, 128.20,  false, 2083.73, 163.21, 0, 0, 0,     163.21,  0, 1920.52, NULL, false, 163.21),
((SELECT id FROM public.employees WHERE name ILIKE 'Reginalda Canuto Machado Silva'),         '2026-05-01', 1637.95, 72.87,   false, 2772.02, 129.95, 0, 0, 0,     129.95,  0, 2642.07, NULL, true,  129.95),
((SELECT id FROM public.employees WHERE name ILIKE 'Rossania Brigida R.Ribeiro'),             '2026-05-01', 4406.23, 0,       false, 4406.23, 418.37, 0, 0, 0,     418.37,  0, 3987.86, NULL, false, 418.37),
((SELECT id FROM public.employees WHERE name ILIKE 'Selma dos Reis Teixeira Gonçalves'),      '2026-05-01', 1637.95, 257.31,  false, 2195.26, 146.25, 0, 365.08, 0, 511.33, 0, 1683.93, NULL, true,  146.25),
((SELECT id FROM public.employees WHERE name ILIKE 'Solange Jesus Koga Lima'),                '2026-05-01', 2066.38, 1710.06, false, 5366.64, 446.37, 0, 17.90, 0, 464.27, 0, 4902.37, NULL, true,  446.37),
((SELECT id FROM public.employees WHERE name ILIKE 'Wânia Marques Silva'),                    '2026-05-01', 2084.22, 1692.65, false, 3776.87, 341.77, 0, 1052.68, 0, 1394.45, 0, 2382.42, NULL, false, 341.77),

-- ===== IMAGEM 6 (Pinguinho) =====
((SELECT id FROM public.employees WHERE name ILIKE 'Aurio Velozo dos Santos Godoy'),          '2026-05-01', 3170.38, 0,      false, 3170.38, 0,      0, 0, 1671.70, 1671.70, 0, 1498.68, 2641.98, false, 0),
((SELECT id FROM public.employees WHERE cpf='272.850.172-64'),                          '2026-05-01', 2775,    0,      false, 2775,    0,      0, 0, 0,       0,       0, 2775,    2312.50, false, 0),
((SELECT id FROM public.employees WHERE name ILIKE 'Jean Divino de Jesus'),                   '2026-05-01', 1604.49, 0,      false, 1604.49, 0,      0, 0, 0,       0,       0, 1604.49, 1337.08, false, 0),
((SELECT id FROM public.employees WHERE cpf='403.061.691-77'),                          '2026-05-01', 1322.51, 2606.31, false, 3928.82, 0,     0, 0, 989,     989,     0, 2939.82, 808.93,  false, 0),
((SELECT id FROM public.employees WHERE name ILIKE 'Pedro Leandro Oliveira Souza'),           '2026-05-01', 1754.45, 0,      false, 1754.45, 133.58, 0, 0, 0,       133.58,  0, 1620.87, 1462.04, false, 133.58),
((SELECT id FROM public.employees WHERE name ILIKE 'Tatiana Vieira da Silva'),                '2026-05-01', 1637.95, 0,      false, 1637.95, 123.09, 0, 0, 0,       123.09,  0, 1514.86, 1364.96, false, 123.09),
((SELECT id FROM public.employees WHERE name ILIKE 'Valdirene da Silva Cunha'),               '2026-05-01', 1637.95, 247.08, false, 1885.03, 123.09, 0, 0, 0,       123.09,  0, 1761.94, 1364.96, false, 123.09)

ON CONFLICT (employee_id, reference_month) DO UPDATE SET
  base_salary                = EXCLUDED.base_salary,
  additional                 = EXCLUDED.additional,
  considera_um_tercio_ferias = EXCLUDED.considera_um_tercio_ferias,
  total_earnings             = EXCLUDED.total_earnings,
  inss                       = EXCLUDED.inss,
  ir                         = EXCLUDED.ir,
  loan_deduction             = EXCLUDED.loan_deduction,
  advance                    = EXCLUDED.advance,
  total_deductions           = EXCLUDED.total_deductions,
  family_allowance           = EXCLUDED.family_allowance,
  net_amount                 = EXCLUDED.net_amount,
  salario_sem_dsr            = EXCLUDED.salario_sem_dsr,
  aplica_dobra               = EXCLUDED.aplica_dobra,
  gps                        = EXCLUDED.gps,
  updated_at                 = now();

COMMIT;

-- Verificação
-- SELECT COUNT(*) FROM public.payroll WHERE reference_month='2026-05-01';
-- SELECT e.name, c.name AS empresa, p.base_salary, p.aplica_dobra, p.gps, p.net_amount
-- FROM public.payroll p
-- JOIN public.employees e ON e.id=p.employee_id
-- JOIN public.companies c ON c.id=e.company_id
-- WHERE p.reference_month='2026-05-01'
-- ORDER BY c.name, e.name;
