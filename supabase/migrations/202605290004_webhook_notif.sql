-- Configuracao de webhook por escola: chamado quando notificacao critica e criada
-- Atualmente envia POST com payload JSON; escola conecta Make/Zapier/N8N depois

alter table escolas
  add column if not exists webhook_url text,
  add column if not exists webhook_ativo boolean not null default false;

comment on column escolas.webhook_url is 'URL externa que recebe POST quando notificacao critica e criada';
comment on column escolas.webhook_ativo is 'Habilita envio de webhook';
