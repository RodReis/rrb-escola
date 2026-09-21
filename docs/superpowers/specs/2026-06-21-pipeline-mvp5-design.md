# Pipeline Kanban — Design MVP5 (Anamnese, LGPD, Permissões finas, Indicadores)

- Data: 2026-06-21
- Status: aprovado para planejamento (depende do MVP1–MVP4)
- Pré-requisitos: specs MVP1–MVP4; `informacoes_medicas`, RBAC (`modulos`/`role_permissoes`),
  `lib/storage`, módulos de relatórios/PDF/XLSX existentes.

## 1. Objetivo e decisões

Ampliar o pipeline para o processo pedagógico sensível e dar visão gerencial: anamnese
(com foco em alunos atípicos / necessidades especiais), proteção de dados sensíveis com
auditoria, consentimento LGPD, permissões finas e indicadores/relatórios.

Decisões firmadas (brainstorming):

1. **Anamnese preenchida internamente** pela equipe (sem link público para o responsável).
2. **Dados sensíveis em módulo RBAC separado + log de acesso** (toda leitura auditada).
3. **Consentimento obrigatório** antes de registrar a anamnese.
4. **Indicadores: dashboard in-app + export** (PDF/Excel).
5. Foco da anamnese: alunos/**alunos atípicos** (necessidades especiais) — campos refletem isso.

## 2. Anamnese — `pipeline_anamnese`

Tabela 1:1 com card (lead ainda não é aluno). Mais rica que `informacoes_medicas` (que cobre só
o subconjunto médico do aluno).

| coluna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| escola_id | uuid not null → escolas | |
| card_id | uuid not null unique → pipeline_card (cascade) | |
| aluno_id | uuid null → alunos | preenchido após promoção (espelho) |
| status | text not null default 'nao_iniciada' | ver §2.1 — fluxo de status |
| necessidade_especial | boolean not null default false | marca aluno atípico |
| necessidade_especial_descricao | text | |
| alergias | text | |
| medicamentos_continuos | text | |
| restricoes_alimentares | text | |
| acomp_psicologico | boolean not null default false | |
| acomp_psicologico_descricao | text | |
| acomp_fonoaudiologico | boolean not null default false | |
| acomp_fonoaudiologico_descricao | text | |
| acomp_psicopedagogico | boolean not null default false | |
| acomp_psicopedagogico_descricao | text | |
| historico_desenvolvimento | text | |
| comportamento_social | text | |
| rotina_familiar | text | |
| observacoes_responsaveis | text | |
| observacoes_coordenacao | text | |
| consentimento_em | timestamptz null | LGPD (ver §4) |
| consentimento_por | uuid null → perfis | quem registrou o consentimento |
| termo_versao | text null | versão do termo aceito (ex: "v1") |
| created_at / updated_at | timestamptz | |

### 2.1 Fluxo de status (MVP5)

Status `enviada` e `pendente` estão reservados para o fluxo de auto-preenchimento pelo
responsável (fora do escopo MVP5). No MVP5 apenas os seguintes status e transições são usados:

```text
nao_iniciada ──► em_analise ──► concluida
                    │               │
                    └──► requer_atencao ◄─┘
```

- `nao_iniciada` → `em_analise`: automático ao salvar qualquer campo (primeira gravação).
- `em_analise` → `concluida`: botão manual da coordenação ("Concluir anamnese").
- Qualquer status → `requer_atencao`: botão manual ("Requer atenção") — sinaliza para a equipe.
- `requer_atencao` → `em_analise`: botão manual ("Retomar análise").

A UI exibe um badge de status + botões de transição conforme o estado atual.

### 2.2 Anexos — `pipeline_anamnese_arquivo`

| coluna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| escola_id | uuid not null | |
| anamnese_id | uuid not null → pipeline_anamnese (cascade) | |
| card_id | uuid not null → pipeline_card | desnormalizado para facilitar acesso sem join |
| nome | text not null | nome original do arquivo |
| url | text not null | path no bucket Supabase Storage |
| mime_type | text | |
| created_at | timestamptz | |

**Bucket Storage:** `pipeline-anamnese` (privado, não público). Download via presigned URL
gerada pela action `getAnamneseArquivoUrl`, que também grava `acao='read'` no log de auditoria.
Upload: action `uploadAnamneseArquivo` exige `pipeline_sensivel`.

### 2.3 Espelhamento na promoção

A função SQL `pipeline_promover_card` (em `202606210002_pipeline_mvp2.sql`) insere em
`informacoes_medicas` com defaults. O MVP5 adiciona ao MVP2 o espelhamento do subconjunto médico
da anamnese.

Mapeamento confirmado pelo schema de `informacoes_medicas`:

| `pipeline_anamnese` | `informacoes_medicas` |
|---|---|
| `alergias IS NOT NULL AND alergias != ''` | `alergia = true` |
| `alergias` | `alergia_descricao` |
| `necessidade_especial` | `necessidade_especial` |
| `necessidade_especial_descricao` | `necessidade_especial_descricao` |
| `medicamentos_continuos IS NOT NULL` | `remedio_especial = true` |
| `medicamentos_continuos` | `remedio_especial_descricao` |
| `acomp_psicologico OR acomp_fonoaudiologico OR acomp_psicopedagogico` | `necessita_apoio = true` |
| concat dos acompanhamentos | `necessita_apoio_descricao` |

A promoção é via RPC `pipeline_promover_card`. O MVP5 adiciona um `UPDATE informacoes_medicas`
logo após o `INSERT ... on conflict do nothing`, dentro da mesma transação PL/pgSQL:

```sql
-- após inserir informacoes_medicas
update informacoes_medicas im
set
  alergia               = (v_anamnese.alergias is not null and v_anamnese.alergias <> ''),
  alergia_descricao     = v_anamnese.alergias,
  necessidade_especial  = v_anamnese.necessidade_especial,
  necessidade_especial_descricao = v_anamnese.necessidade_especial_descricao,
  remedio_especial      = (v_anamnese.medicamentos_continuos is not null and v_anamnese.medicamentos_continuos <> ''),
  remedio_especial_descricao = v_anamnese.medicamentos_continuos,
  necessita_apoio       = (v_anamnese.acomp_psicologico or v_anamnese.acomp_fonoaudiologico or v_anamnese.acomp_psicopedagogico),
  necessita_apoio_descricao = nullif(trim(
    coalesce(case when v_anamnese.acomp_psicologico then 'Psicológico: ' || coalesce(v_anamnese.acomp_psicologico_descricao,'') end, '') || ' ' ||
    coalesce(case when v_anamnese.acomp_fonoaudiologico then 'Fonoaudiológico: ' || coalesce(v_anamnese.acomp_fonoaudiologico_descricao,'') end, '') || ' ' ||
    coalesce(case when v_anamnese.acomp_psicopedagogico then 'Psicopedagógico: ' || coalesce(v_anamnese.acomp_psicopedagogico_descricao,'') end, '')
  ), '')
where im.aluno_id = v_aluno_id;
-- somente executa se anamnese existe (v_anamnese not null)
```

`v_anamnese` é `null` se o card não tem anamnese preenchida — o bloco é condicional.

## 3. Permissões finas e proteção de dados sensíveis

Novo módulo RBAC `pipeline_sensivel` (`pode_ler/criar/editar/deletar`), **separado** de
`pipeline`/`pipeline_admin`:

| role | pipeline_sensivel |
|---|---|
| `admin` | full |
| `coordenacao` | full |
| `secretaria` | nenhum (padrão) — ajustável por escola |

RLS de `pipeline_anamnese` e `pipeline_anamnese_arquivo` usa `pipeline_pode('pipeline_sensivel', …)`
(o helper criado no MVP2). Quem tem `pipeline`/`pipeline_admin` mas não `pipeline_sensivel` vê o
card, mas **não** a anamnese.

## 4. Consentimento LGPD (obrigatório)

- Registrar a anamnese exige `consentimento_em` preenchido. A Server Action `salvarAnamnese`
  rejeita gravação de campos sensíveis sem consentimento (`{ ok:false, error:'Consentimento pendente' }`).
- O consentimento é registrado pela equipe (interno) com `consentimento_por` + `termo_versao`.
- Política de retenção/anonimização: anamnese de lead `perdido` há mais de N meses é candidata a
  anonimização (job futuro; fora do MVP5, registrar como pendência).

## 5. Auditoria de acesso (`pipeline_acesso_log`)

Nova tabela append-only:

| coluna | tipo |
|---|---|
| id | uuid pk |
| escola_id | uuid not null |
| usuario_id | uuid not null → perfis |
| card_id | uuid not null → pipeline_card |
| recurso | text not null (`anamnese` \| `anamnese_arquivo`) |
| acao | text not null (`read` \| `write`) |
| created_at | timestamptz default now() |

- **Auditoria lazy:** o log é gravado quando o usuário **abre a aba de anamnese** no card-modal
  (action `getAnamnese` chamada sob demanda). Abrir o modal sem clicar na aba não gera log.
- `getAnamnese` grava `acao='read'`; `salvarAnamnese` grava `acao='write'`;
  `getAnamneseArquivoUrl` grava `acao='read'` com `recurso='anamnese_arquivo'`.
- Inserção via SECURITY DEFINER na action (sem RLS de escrita pelo usuário). Leitura do log
  restrita a `pipeline_sensivel` com `pode_ler`.
- Índice em `(escola_id, card_id, created_at)`.
- Trade-off aceito: 1 write por visualização — custo baixo; exigência LGPD para dado médico de menor.

## 6. Indicadores e relatórios (dashboard + export)

Rota `/pipeline/indicadores` (gated por `pipeline`), com cálculo **na leitura** (queries diretas;
sem materialização no MVP5). Todos os filtros incluem `date_trunc` com período de 30/90/180 dias
para limitar o scan em `pipeline_card_movimentacao`. Conjunto inicial:

- Total de leads novos; matrículas confirmadas; cadastros de reserva.
- Cards parados por etapa; tempo médio de atendimento; tempo médio até matrícula.
- Taxa de conversão por origem; atendimentos sem resposta; visitas/entrevistas agendadas.
- Documentos pendentes; anamneses pendentes (contagem, **sem** expor conteúdo); motivos de perda.

Fonte: `pipeline_card`, `pipeline_card_movimentacao`, `pipeline_card_atividade`,
`pipeline_reserva`, `pipeline_anamnese` (só contagens agregadas).

**Módulos de export existentes (confirmados):**

| módulo | caminho | lib |
| --- | --- | --- |
| PDF genérico | `src/lib/documents/print-pdf.ts` | mammoth + window.print |
| PDF com tabelas | `src/lib/folha/holerite-pdf.ts` | jsPDF + jspdf-autotable |
| XLSX | `src/lib/folha/pacote-contador.ts` | ExcelJS |

Para o dashboard de captação, o MVP5 cria `src/lib/pipeline/indicadores-export.ts` seguindo o
padrão `holerite-pdf.ts` (jsPDF) para PDF e `pacote-contador.ts` (ExcelJS) para XLSX. Export que
inclua dados sensíveis exige `pipeline_sensivel` e grava entrada de auditoria via
`pipeline_acesso_log`.

## 7. Realtime

A sincronização em tempo real para toda a equipe já é entregue no MVP1 (Supabase Realtime no
board). MVP5 apenas estende a assinatura às novas visões quando aplicável; sem mudança de infra.

## 8. Modelo de dados — resumo

- **Novas tabelas**: `pipeline_anamnese`, `pipeline_anamnese_arquivo`, `pipeline_acesso_log`.
- **Novo módulo RBAC**: `pipeline_sensivel` + seeds de `role_permissoes`.
- **Novo bucket Storage**: `pipeline-anamnese` (privado).
- **Alteração em função existente**: `pipeline_promover_card` recebe bloco de espelhamento
  em `informacoes_medicas` (condicional — só executa se anamnese existe).
- Sem materialização de indicadores (cálculo na leitura com filtros de período).

## 9. Critérios de aceite

1. Usuário com `pipeline` mas sem `pipeline_sensivel` vê o card e **não** vê a anamnese
   (bloqueado no servidor — RLS + action).
2. Salvar anamnese sem consentimento é rejeitado; com consentimento, grava e registra `write`.
3. Abrir a anamnese grava `pipeline_acesso_log` com `acao='read'` (auditável).
4. Promoção espelha o subconjunto médico em `informacoes_medicas` e mantém os extras pedagógicos.
5. Dashboard de indicadores bate com os dados (conferência por amostragem) e não expõe conteúdo
   sensível; export gera PDF/Excel e, se sensível, exige `pipeline_sensivel` + auditoria.
6. `typecheck` + `build` verdes; testes de RLS do módulo sensível e do bloqueio por consentimento.

## 10. Riscos

- **Vazamento de dado sensível em indicadores/export** → indicadores só agregados; export
  sensível atrás de `pipeline_sensivel` + auditoria.
- **Custo de logar leitura** → aceitável; mitigar com índice e retenção do log.
- **Campos pedagógicos sem destino pós-promoção** em `informacoes_medicas` → resolvido mantendo
  `pipeline_anamnese` acessível por `aluno_id`.
- **Retenção/anonimização** de anamnese de leads perdidos → job de retenção fica como pendência
  pós-MVP5.

## 11. Fora de escopo do MVP5

Link público de auto-preenchimento da anamnese pelo responsável; inbound de WhatsApp; job de
anonimização/retenção; materialização de indicadores.
