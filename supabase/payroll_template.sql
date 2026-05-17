-- Payroll template (mes base: 2026-05-01)
-- Generated 2026-05-17T11:50:50.017Z
-- Rows: 63
-- Uso: inserir todas linhas substituindo reference_month pelo mes alvo.
-- Idempotente via on conflict (employee_id, reference_month).

INSERT INTO public.payroll (employee_id, reference_month, base_salary, additional, consider_decimo_terceiro, considera_um_tercio_ferias, total_earnings, inss, ir, loan_deduction, advance, total_deductions, family_allowance, net_amount, observations, uniform_value, salario_sem_dsr, aplica_dobra, horas_extras, gratificacao, comissao, adicional_noturno, periculosidade, insalubridade, outros_proventos, vale_transporte, vale_alimentacao, outros_descontos, dependentes, inss_manual, ir_manual, gps) VALUES
  -- Ana Flávia de Jesus Luciano (170.064.953-18)
  ('f4416636-3384-4f5a-964c-f7a0d59afbeb', '2026-05-01', 2765.7, 237, false, false, 5918.4, 575.89, 203.29, 0, 18, 797.18, 0, 5121.22, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Ana Livia Lourenço Ferreira (059.951.591-00)
  ('163aa575-50e6-438b-8179-74ef88e7a1fa', '2026-05-01', 1596, 0, false, false, 1596, 119.7, 0, 0, 0, 119.7, 0, 1476.3, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Ângela Maria dos S. Gonçalves (503.627.653-16)
  ('5fba0ab0-2f7f-4914-a362-88746824d5b8', '2026-05-01', 2066.29, 943.6, false, false, 2066.29, 163.2, 0, 0, 0, 163.2, 0, 1903.09, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Any Karolliny Rodrigues Siqueira (715.774.769-30)
  ('928a90db-b775-432b-b766-85d9691ef2c5', '2026-05-01', 1000, 399.96, false, false, 1000, 75, 0, 0, 0, 75, 0, 925, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Aurio Velozo dos Santos Godoy (984.770.772-31)
  ('64b110e8-9920-4688-ae27-f1182d1cfd6c', '2026-05-01', 3170.38, 0, false, false, 3170.38, 273.86, 40.32, 0, 1671.7, 1985.88, 0, 1184.5, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Benedito Rodrigues borges (686.228.115-14)
  ('dac9c42d-f383-49bc-a61c-1420e81abf42', '2026-05-01', 2012.94, 0, false, false, 2012.94, 158.39, 0, 0, 0, 158.39, 0, 1854.55, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Bruna Rocha Ferreira (182.241.832-11)
  ('4f3beeae-6098-4476-ade5-225d2d38b697', '2026-05-01', 1621, 0, false, false, 1742.57, 121.57, 0, 0, 0, 0, 0, 0, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Carlene R. da Cunha Manrique (638.202.581-08)
  ('ea29b723-82c9-4779-9c40-e4951c40d544', '2026-05-01', 2500, 0, false, false, 2500, 202.23, 0, 0, 0, 202.23, 0, 2297.77, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Carlos Henrique Camilo de Matos (537.593.607-00)
  ('71917de0-27a1-4751-b2f9-bc282a8f6b63', '2026-05-01', 1072.93, 162.25, false, false, 1072.93, 80.47, 0, 0, 0, 80.47, 0, 992.46, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- CARLOS LEONARDO ALVES SOARES (572.324.623-28)
  ('2d730385-fb65-47d3-9110-d904746e0987', '2026-05-01', 1073.32, 0, false, false, 1073.32, 80.49, 0, 0, 0, 80.49, 0, 992.83, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Carolina Cardoso Miranda (216.590.650-46)
  ('3bfd931a-93a5-4998-bff1-37142d88f329', '2026-05-01', 2067.19, 199.96, false, false, 3997.35, 179.72, 0, 0, 0, 179.72, 0, 3817.63, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Carolina Cardoso Miranda (768.051.032-66)
  ('55c62250-1b2d-4d0c-8172-168edce94c06', '2026-05-01', 2067.19, 0, false, false, 2067.19, 163.28, 0, 0, 0, 163.28, 0, 1903.91, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Divino Eterno Bruno Alves Correia (758.014.804-80)
  ('4975663e-72df-4823-af12-d85108025b0e', '2026-05-01', 2081.31, 0, false, false, 4148.5, 162.99, 1, 0, 70.4, 234.39, 0, 3914.11, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Eduarda Lais Silva Candido (469.365.377-23)
  ('e20914aa-09c4-48f1-a6ff-eae249933953', '2026-05-01', 1000, 230, false, false, 1000, 75, 0, 0, 0, 75, 0, 925, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Elaine Batista Oliveira (272.850.172-64)
  ('36dc92b1-40c6-49a6-82ac-a239cc2db3fe', '2026-05-01', 2775, 0, false, false, 2775, 226.98, 8.94, 0, 0, 235.92, 0, 2539.08, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Elaine Batista Oliveira (091.613.834-81)
  ('e5e22848-3a0f-4850-b8f7-32ae3b60c936', '2026-05-01', 2067.19, 188.65, false, false, 2255.84, 178.7, 0, 0, 274.5, 1054.19, 0, 1201.65, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Ellizainne Janine Silva (379.278.706-70)
  ('802b4b02-7998-4bb0-83ab-765ebcd3383b', '2026-05-01', 1637.95, 873.6, false, false, 2511.55, 123.09, 0, 0, 0, 123.09, 0, 2388.46, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Evelyn Emylly Moreira dos Reis (898.912.885-44)
  ('c1277cc9-e473-49d4-95f3-e7ab0a72fead', '2026-05-01', 3967.17, 0, false, false, 3967.17, 364.64, 0, 0, 0, 364.64, 0, 3602.53, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Fernando Silva Olimpio (488.190.737-90)
  ('036a10e4-61a9-46a4-a537-0c23ea2ee0b2', '2026-05-01', 2055.28, 528.95, false, false, 2584.23, 214.38, 0, 0, 0, 214.38, 0, 2369.85, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Flancley da Silva Sá (336.514.058-18)
  ('14832704-a6df-463b-8c00-198c30a70f6d', '2026-05-01', 3735.86, 432.55, false, false, 3735.86, 341.71, 114.96, 0, 0, 456.67, 0, 3279.19, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Gabriel Ferreira e Silva (428.285.308-50)
  ('fa6fa24f-86ae-4995-885a-abe2bf044d6e', '2026-05-01', 1993.57, 0, false, false, 1993.57, 156.65, 0, 0, 0, 156.65, 0, 1836.92, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Gislaine Cristina de Souza (309.203.427-95)
  ('95462e94-2e2c-49a8-93be-64cf7bf2b8fa', '2026-05-01', 1604.49, 0, false, false, 1604.49, 121.63, 0, 0, 0, 121.63, 0, 1482.86, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Haniery Marques Fernandes (446.994.837-39)
  ('7d3212be-1901-41f1-9610-7470966c8912', '2026-05-01', 1892.67, 89.47, false, false, 1892.67, 147.57, 0, 0, 0, 147.57, 0, 1745.1, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Hellen Alves Lemes (996.309.611-56)
  ('6484fcf0-d257-4aa2-b0d2-f1f4c9a0da1a', '2026-05-01', 3051.36, 502, false, false, 3051.36, 259.57, 27.22, 0, 0, 286.79, 0, 2764.57, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Inês Vieira de Souza (234.828.352-25)
  ('fcee1877-031e-4af6-8db2-a0c415917096', '2026-05-01', 2067.19, 188.65, false, false, 2255.84, 178.7, 0, 0, 0, 178.7, 0, 2077.14, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Janaína Maria Nunes (957.190.299-31)
  ('acd9411d-1b3a-4563-9b98-605e384b921d', '2026-05-01', 4407.6, 0, false, false, 4407.6, 426.66, 220.22, 0, 0, 646.88, 0, 3760.72, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Janete de Freitas Rodrigues (027.178.455-50)
  ('e0ca33e5-1bfa-4338-ba87-ba7e0b67ec36', '2026-05-01', 1631, 0, false, false, 2131, 122.47, 0, 0, 25.9, 148.37, 0, 1982.63, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Jean Divino de Jesus (584.351.474-95)
  ('80a2945a-74ba-4222-a164-3b85ba8be797', '2026-05-01', 1322.51, 2606.31, false, false, 1322.51, 99.19, 0, 0, 989, 1088.19, 0, 234.32, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Jordana Cristina Silava Gaioso (134.807.391-80)
  ('3c3bbf3f-a78a-454d-aa7c-222351f7ddc0', '2026-05-01', 1103.76, 160, false, false, 1103.76, 82.78, 0, 0, 0, 82.78, 0, 1020.98, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Juliana Vieira Jorge (671.471.299-54)
  ('069f27e4-edcb-492a-bdcc-2c5239bcfa11', '2026-05-01', 1637.95, 0, false, false, 1637.95, 123.09, 0, 0, 0, 123.09, 135.08, 1649.94, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Keila Regina de Oliveira (605.264.165-72)
  ('ddab1596-121d-43cf-8d9f-88a72f5f0b9f', '2026-05-01', 2907.58, 0, false, false, 2907.58, 237.49, 0, 0, 0, 237.49, 0, 2670.09, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Laís Ramos Fernandes (516.144.522-02)
  ('98c86f65-21f6-4c2a-be22-1b62e232e227', '2026-05-01', 2067.19, 0, false, false, 3367.19, 161.72, 0, 0, 311.5, 473.22, 0, 2893.97, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Láyslla Roberta dos Santos Gonçalves (504.369.991-45)
  ('212afc8a-f128-4f01-a2ed-c1ccf54966ef', '2026-05-01', 2067.19, 0, false, false, 4569.08, 384.71, 0, 0, 65, 449.71, 0, 4119.37, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Leia Damasceno de Andrade Apolinario (149.829.745-51)
  ('1c4090f2-b856-4e49-ad9c-0c211ad0a0cd', '2026-05-01', 2067.19, 0, false, false, 2067.19, 161.72, 0, 0, 65, 226.72, 0, 1840.47, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Letícia Dias de Castro (682.338.735-19)
  ('de44bb72-acb9-48e8-9254-208c7ae61fe6', '2026-05-01', 1072.95, 162.25, false, false, 1072.95, 80.47, 0, 0, 0, 80.47, 0, 992.48, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Luciany Maria da Silva (747.502.170-00)
  ('00cdc040-9e64-4692-9aa6-fd4374d2b52a', '2026-05-01', 1637.95, 0, false, false, 1637.95, 123.09, 0, 0, 0, 123.09, 0, 1514.86, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Lucilene Maria Montelo (697.282.239-43)
  ('dbed30cd-5c5f-4681-ae7c-109fe45df43a', '2026-05-01', 2081.31, 0, false, false, 2081.31, 162.99, 0, 0, 0, 162.99, 0, 1918.32, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Lucimar Souza Silva (178.597.796-25)
  ('9966c087-1bb5-4672-9539-eda5f3fc2df1', '2026-05-01', 1637.95, 135.41, false, false, 2474.22, 135.28, 0, 0, 0, 0, 0, 0, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Maria Angélica de Araújo (711.500.304-10)
  ('4bd36eba-f30d-4131-8c0d-19092c412a16', '2026-05-01', 2081.31, 1734.43, false, false, 4262.63, 388.1, 0, 0, 0, 1404.66, 0, 2857.97, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Maria Angélica de Araújo (403.061.691-77)
  ('f2876b31-360a-47c8-9dc2-3d1828c177fa', '2026-05-01', 1754.45, 0, false, false, 1754.45, 133.58, 0, 0, 0, 133.58, 0, 1620.87, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Maria da Conceição Bezerra da Silva (390.543.081-92)
  ('47010573-b717-47bd-a8bd-6a29f6fb1af1', '2026-05-01', 2081.31, 0, false, false, 3719.26, 162.99, 0, 0, 0, 162.99, 0, 3556.27, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Maria Márcia B. Souza (852.107.926-50)
  ('56ccbc6b-de47-47c3-925e-f1588ff60f3a', '2026-05-01', 1637.95, 128.2, false, false, 2083.73, 163.21, 0, 0, 0, 163.21, 0, 1920.52, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Mariana Alves de Deus (279.802.953-82)
  ('ce38cf7e-8cb2-45cf-b544-f0ba6bb7ea7a', '2026-05-01', 1637.95, 229.12, false, false, 3605.02, 123.09, 0, 0, 688.8, 811.89, 67.54, 2860.67, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Mayara Lorrayne da Silva (000.000.000-00)
  ('97d2acaa-4265-456f-a56f-13998385ebe7', '2026-05-01', 34482.74, 4679.24, false, false, 49587.66, 3120.56, 407.58, 0, 388.8, 5411.4, 0, 47036.93, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Miramar Barbosa Silva (839.596.663-65)
  ('677fb135-bf8f-40de-a6b1-6212b1cf2a07', '2026-05-01', 1637.95, 903.34, false, false, 2541.29, 123.09, 0, 0, 0, 123.09, 67.54, 2485.74, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Pedro Junio Dias Rosa (640.900.726-46)
  ('b57f1894-853b-4930-91c0-37ce0e307a1c', '2026-05-01', 2321, 147.7, false, false, 2321, 186.12, 0, 0, 0, 186.12, 0, 2134.88, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Pedro Leandro Oliveira Souza (001.255.176-70)
  ('b4cafcf5-ddf4-4c45-a5dc-3ec575380432', '2026-05-01', 1637.95, 0, false, false, 1637.95, 123.09, 0, 0, 0, 123.09, 0, 1514.86, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Reginalda Canuto Machado Silva (539.700.966-00)
  ('e3a0c8ec-5699-4949-becb-f7627321ee3c', '2026-05-01', 1637.95, 72.87, false, false, 2772.02, 129.95, 0, 0, 0, 129.95, 0, 2642.07, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Renato Dias de Oliveira (634.009.534-82)
  ('c7ffc3a0-cd92-4a77-8702-23e66343f9ff', '2026-05-01', 1116.65, 0, false, false, 1116.65, 83.75, 0, 0, 0, 83.75, 0, 1032.9, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Ricardo Alves Martins (011.098.422-60)
  ('afd750d3-7745-4d0e-8564-6f31da3c8b6e', '2026-05-01', 2990.93, 0, false, false, 2990.93, 252.32, 23.24, 0, 0, 275.56, 0, 2715.37, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Rosângela Maria Dias (914.825.884-98)
  ('47b4d224-1439-4fbd-ade7-faac2190f2bb', '2026-05-01', 1637.95, 127.7, false, false, 2058.57, 134.58, 0, 491.98, 0, 0, 0, 0, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Rossania Brigida R.Ribeiro (517.871.109-23)
  ('5e7d6d74-4ecb-4aed-b8ca-5a2a17b90a7a', '2026-05-01', 4406.23, 0, false, false, 4406.23, 418.37, 0, 0, 0, 418.37, 0, 3987.86, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Saillen Christinna Pereira Couto (511.422.881-10)
  ('77ca716b-1792-41fb-8e0c-119122bc48a5', '2026-05-01', 1582.81, 0, false, false, 1582.81, 118.65, 0, 0, 0, 118.65, 67.54, 1531.7, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Samantha Silva Amorim (408.496.317-85)
  ('52e97ed8-1685-4770-85bf-e47665a851ef', '2026-05-01', 2623.44, 0, false, false, 6123.72, 211.78, 0, 569.76, 0, 781.54, 0, 5342.18, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Selma dos Reis Teixeira Gonçalves (507.869.714-44)
  ('3759af3f-6d39-43ce-ab13-192f6192cb6d', '2026-05-01', 1637.95, 257.31, false, false, 2195.26, 146.25, 0, 365.08, 0, 511.33, 0, 1683.93, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Selma Luiz de Paula (235.877.683-15)
  ('c604b070-dfe4-4962-8e13-9a3b7fd9d60c', '2026-05-01', 1637.95, 100, false, false, 1737.95, 132.09, 0, 0, 0, 0, 0, 0, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Solange Jesus Koga Lima (691.495.504-20)
  ('fc75aed8-c499-40a4-993d-70158d5f6ac7', '2026-05-01', 2066.38, 1710.06, false, false, 5366.64, 446.37, 0, 0, 0, 464.27, 0, 4902.37, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Suzane dos Santos Martins (531.444.029-66)
  ('92ba84b8-96e5-47cb-ad0b-c1d5e1661410', '2026-05-01', 2236.28, 221.54, false, false, 2457.82, 176.94, 0, 0, 0, 0, 0, 0, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Tatiana Vieira da Silva (396.907.474-60)
  ('790fc159-f942-4bee-adbc-8f63cd358720', '2026-05-01', 1637.95, 247.08, false, false, 1885.03, 123.09, 0, 0, 0, 123.09, 0, 1761.94, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Thais Priscilla Souza (731.337.775-48)
  ('6338eff2-d580-42b6-a714-cb7c8854d02a', '2026-05-01', 1637.95, 0, false, false, 1637.95, 123.09, 0, 0, 0, 123.09, 0, 1514.86, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL),
  -- Vanessa Alves Soares (683.502.052-02)
  ('617729e3-d70a-49ac-b9b3-372e24881d7f', '2026-05-01', 1000, 0, false, false, 1000, 75, 0, 0, 0, 75, 0, 925, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Vinicius Ferreira Barbosa (689.322.320-08)
  ('98622bb4-3c70-4f3b-bf1b-6d129e8bd942', '2026-05-01', 1476.5, 106, false, false, 1476.5, 110.74, 0, 0, 0, 110.74, 0, 1365.76, NULL, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0),
  -- Wânia Marques Silva (154.795.576-70)
  ('58bc0eaa-46ee-4bf8-9315-fd2fa10c5996', '2026-05-01', 2084.22, 1692.65, false, false, 3776.87, 341.77, 0, 1052.68, 0, 1394.45, 0, 2382.42, NULL, 0, NULL, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, NULL)
ON CONFLICT (employee_id, reference_month) DO NOTHING;
