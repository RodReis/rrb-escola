-- "Desfazer transferência" voltava os dois lançamentos para pendente, mas
-- nada persistia "isto não é transferência, não tente de novo" — no próximo
-- carregamento da página o pipeline (classificarDebitos) reclassificava o
-- MESMO par, porque ele só olha valor/data/conta, sem memória de decisão
-- humana anterior.
--
-- pareamento_recusado marca o débito (a perna que o usuário via e desfez) e
-- é filtrado ANTES de entrar no pipeline, tanto no sync (aplicar-pipeline.ts)
-- quanto na tela (data/debitos.ts) — detectarTransferenciasInternas continua
-- pura, sem saber que essa marca existe.
alter table extrato_bancario
  add column if not exists pareamento_recusado boolean not null default false;
