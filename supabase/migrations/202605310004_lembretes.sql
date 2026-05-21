-- Lembretes de inadimplência: configuração na tabela escolas.

alter table escolas
  add column if not exists lembrete_auto_ativo boolean not null default false;

alter table escolas
  add column if not exists lembrete_template text;

-- Template de fábrica para escolas que ainda não têm um definido.
update escolas
set lembrete_template = 'Olá {responsavel}, a mensalidade de {aluno} ({descricao}) no valor de {valor}, vencida em {vencimento}, está em aberto há {dias_atraso} dia(s). Por favor, regularize. Em caso de dúvida, entre em contato.'
where lembrete_template is null;
