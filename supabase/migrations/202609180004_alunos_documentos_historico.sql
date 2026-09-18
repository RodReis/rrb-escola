-- Campos de identificacao que o historico escolar imprime e que a ficha do
-- aluno nao guardava. Vinham em branco no PDF mesmo quando o documento de
-- origem os tinha.
alter table alunos add column if not exists nacionalidade text;
alter table alunos add column if not exists orgao_expedidor text;
alter table alunos add column if not exists data_expedicao date;
