insert into escolas (id, nome, cnpj, telefone, email, endereco, cidade, uf, cep)
values (
  '00000000-0000-0000-0000-000000000001',
  'RRB Escola',
  '00.000.000/0001-00',
  '(62) 3333-0000',
  'secretaria@rrbescola.local',
  'Rua Principal, 100',
  'Goiânia',
  'GO',
  '74000-000'
)
on conflict (id) do nothing;

insert into series (id, escola_id, nome, ordem)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '1º Ano', 1),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '2º Ano', 2),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '3º Ano', 3),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '4º Ano', 4),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '5º Ano', 5)
on conflict (escola_id, nome) do nothing;

insert into turmas (id, escola_id, serie_id, nome, ano_letivo, turno, capacidade)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'A', 2026, 'matutino', 30),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'B', 2026, 'vespertino', 30),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'B', 2026, 'matutino', 30)
on conflict (escola_id, serie_id, nome, ano_letivo) do nothing;

insert into planos (id, escola_id, nome, descricao, valor_matricula, valor_mensalidade, quantidade_parcelas, dia_vencimento)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Mensalidade 2026', 'Plano padrao de mensalidade escolar', 250.00, 680.00, 12, 10)
on conflict (escola_id, nome) do nothing;

insert into alunos (
  id, escola_id, matricula_codigo, nome, sexo, data_nascimento, naturalidade, celular, cpf, rg,
  certidao_livro, certidao_folha, certidao_numero, etnia, informacoes_adicionais
) values (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '1361',
  'ALICE CABRINY ALVES DE ALMEIDA',
  'Feminino',
  '2016-02-29',
  'GOIÂNIA-GO',
  null,
  '077.337.491-40',
  '4698953',
  '43933',
  '144',
  '175',
  'Parda',
  'DIA 15'
) on conflict (escola_id, matricula_codigo) do nothing;

insert into enderecos_aluno (aluno_id, logradouro, cidade, uf, cep, principal)
values ('40000000-0000-0000-0000-000000000001', 'FAZENDA CABECEIRA DOS BURITIS ÁREA RURAL DE TRINDADE FAZENDA FAZENDINHA', 'TRINDADE', 'GO', '75393-899', true);

insert into contatos_aluno (aluno_id, nome, celular, parentesco, principal)
values ('40000000-0000-0000-0000-000000000001', 'Polyana', '(62)98471-4813', 'MAE', true);

insert into responsaveis_aluno (aluno_id, nome, cpf, celular, parentesco, email, responsavel_financeiro, responsavel_pedagogico)
values
  ('40000000-0000-0000-0000-000000000001', 'Daniel Flávio Cabriny de Almeida Costa', null, null, 'Pai', null, false, true),
  ('40000000-0000-0000-0000-000000000001', 'Polyana Alves Bernardo Cabriny', '022.725.371-03', '(62)98471-4813', 'Mãe', 'polyanaalves_bernardo@hotmail.com', true, true);

insert into pessoas_autorizadas (aluno_id, nome)
values ('40000000-0000-0000-0000-000000000001', 'Responsável cadastrado');

insert into informacoes_medicas (aluno_id, plano_saude)
values ('40000000-0000-0000-0000-000000000001', 'UNIMED')
on conflict (aluno_id) do nothing;

insert into autorizacoes_aluno (aluno_id, nao_entregar_boletim, assinar_comunicados, requerer_prova_substitutiva)
values ('40000000-0000-0000-0000-000000000001', false, false, false)
on conflict (aluno_id) do nothing;

insert into matriculas (escola_id, aluno_id, serie_id, turma_id, plano_id, codigo, data_matricula, ano_letivo, idade_na_matricula, status)
values
  ('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '1361-2026', '2025-11-04', 2026, 9, 'ativa'),
  ('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '1361-2025', '2024-10-28', 2025, 8, 'concluida');

insert into cobrancas (escola_id, aluno_id, plano_id, descricao, competencia, numero_parcela, valor_original, data_vencimento, status)
values
  ('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Mensalidade Maio/2026', '2026-05', 5, 680.00, '2026-05-10', 'aberta'),
  ('00000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Mensalidade Abril/2026', '2026-04', 4, 680.00, '2026-04-10', 'paga');
