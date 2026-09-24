-- Modelos de declaracao pedagogica: texto editavel com parametros [CHAVE],
-- resolvidos por resolverDeclaracao() (src/lib/documents/declaracao-resolver.ts).
-- Motor novo, paralelo ao de .docx (templates_documentos) que continua
-- existindo para contratos/termos.

create table if not exists public.declaracao_modelos (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  codigo serial,
  nome text not null,
  titulo text not null,
  texto text not null,
  fecho text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists declaracao_modelos_escola_idx on declaracao_modelos (escola_id);

alter table declaracao_modelos enable row level security;

create policy declaracao_modelos_service on declaracao_modelos
  for all to service_role using (true) with check (true);

create policy declaracao_modelos_escola on declaracao_modelos
  for all to authenticated
  using (escola_id = (select escola_id from current_perfil()))
  with check (escola_id = (select escola_id from current_perfil()));

grant select, insert, update, delete on declaracao_modelos to authenticated;

-- Seed: 4 modelos-base, escola padrao do sistema (single-tenant hoje).
insert into declaracao_modelos (escola_id, nome, titulo, texto, fecho)
select
  e.id,
  v.nome, v.titulo, v.texto, v.fecho
from escolas e
cross join (values
  (
    'Declaração de Frequência',
    'DECLARAÇÃO',
    'Declaramos para os devidos fins e a pedido da parte interessada, que o(a) aluno(a) [NOME_ALUNO] de matrícula número [MATRICULA], filho(a) de [FILIACAO], nascido(a) em [DATA_NASCIMENTO], natural de [CIDADE] - [UF], possui frequência regular nesta instituição de ensino, neste ano letivo de [ANO_LETIVO], cursando o(a) [SERIE_CORRENTE], no turno [TURNO].',
    'Secretaria da(o) [EMPRESA], em [DATA_POR_EXTENSO_SEM_CIDADE]'
  ),
  (
    'Declaração de Matrícula',
    'DECLARAÇÃO',
    'Declaramos para os devidos fins e a pedido da parte interessada, que o(a) aluno(a) [NOME_ALUNO] de matrícula número [MATRICULA], filho(a) de [FILIACAO], nascido(a) em [DATA_NASCIMENTO], natural de [CIDADE] - [UF], encontra-se regularmente matriculado(a) nesta instituição de ensino, neste ano letivo de [ANO_LETIVO], cursando o(a) [SERIE_CORRENTE], no turno [TURNO].',
    'Secretaria da(o) [EMPRESA], em [DATA_POR_EXTENSO_SEM_CIDADE]'
  ),
  (
    'Declaração de Transferência — Concluído',
    'DECLARAÇÃO DE TRANSFERÊNCIA',
    'Declaramos para os devidos fins e a pedido da parte interessada, que o(a) aluno(a) [NOME_ALUNO] de matrícula número [MATRICULA], filho(a) de [FILIACAO], nascido(a) em [DATA_NASCIMENTO], natural de [CIDADE] - [UF], aluno(a) desta instituição de ensino, concluiu o(a) [SERIE_CORRENTE] e requereu sua transferência na presente data, tendo o direito de matricular-se no(a) [PROXIMA_SERIE].

Este documento é válido por 30(trinta) dias, findo os quais será substituído pelo Histórico Escolar.',
    '[DATA_POR_EXTENSO_COM_CIDADE]'
  ),
  (
    'Declaração de Transferência — Não Concluído',
    'DECLARAÇÃO DE TRANSFERÊNCIA',
    'Declaramos para os devidos fins e a pedido da parte interessada, que o(a) aluno(a) [NOME_ALUNO] de matrícula número [MATRICULA], filho(a) de [FILIACAO], nascido(a) em [DATA_NASCIMENTO], natural de [CIDADE] - [UF], aluno(a) desta instituição de ensino, requereu sua transferência na presente data, tendo o direito de cursar o(a) [SERIE_CORRENTE].

Este documento é válido por 30(trinta) dias, findo os quais será substituído pelo Histórico Escolar.',
    '[DATA_POR_EXTENSO_COM_CIDADE]'
  )
) as v(nome, titulo, texto, fecho)
where not exists (
  select 1 from declaracao_modelos dm where dm.escola_id = e.id and dm.nome = v.nome
);
