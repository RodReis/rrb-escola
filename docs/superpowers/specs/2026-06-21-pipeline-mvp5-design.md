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
| status | text not null default 'nao_iniciada' | `nao_iniciada`/`enviada`/`pendente`/`em_analise`/`concluida`/`requer_atencao` |
| necessidade_especial | boolean not null default false | marca aluno atípico |
| necessidade_especial_descricao | text | |
| alergias | text | |
| medicamentos_continuos | text | |
| restricoes_alimentares | text | |
| acomp_psicologico | boolean / text | |
| acomp_fonoaudiologico | boolean / text | |
| acomp_psicopedagogico | boolean / text | |
| historico_desenvolvimento | text | |
| comportamento_social | text | |
| rotina_familiar | text | |
| observacoes_responsaveis | text | |
| observacoes_coordenacao | text | |
| consentimento_em | timestamptz null | LGPD (ver §4) |
| consentimento_por | uuid null → perfis | quem registrou o consentimento |
| termo_versao | text null | versão do termo aceito |
| created_at / updated_at | timestamptz | |

Anexos: tabela `pipeline_anamnese_arquivo` (card_id/anamnese_id, url via `lib/storage`,
nome, tipo, created_at) — mesma proteção de acesso (§3).

**Na promoção (MVP2):** copiar o subconjunto médico para `informacoes_medicas`
(alergia, necessidade_especial, etc.) e setar `pipeline_anamnese.aluno_id`. Os campos
pedagógicos extras (psicopedagógico, desenvolvimento, rotina) permanecem em `pipeline_anamnese`,
agora também acessível por `aluno_id` (histórico).

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

- **Toda leitura** da anamnese (action `getAnamnese`) grava `acao='read'`; gravações `='write'`.
- Sem RLS de escrita pelo usuário comum (inserção via action SECURITY DEFINER); leitura do log
  restrita a admin. Índice `(escola_id, card_id, created_at)`.
- Trade-off aceito: logar leitura adiciona uma escrita por visualização — custo baixo, exigência
  de LGPD para dado médico de menor.

## 6. Indicadores e relatórios (dashboard + export)

Rota `/pipeline/indicadores` (gated por `pipeline`), com cálculo **na leitura** (queries/views;
sem materialização no MVP5). Conjunto inicial:

- Total de leads novos; matrículas confirmadas; cadastros de reserva.
- Cards parados por etapa; tempo médio de atendimento; tempo médio até matrícula.
- Taxa de conversão por origem; atendimentos sem resposta; visitas/entrevistas agendadas.
- Documentos pendentes; anamneses pendentes; motivos de perda mais frequentes.

Fonte: `pipeline_card`, `pipeline_card_movimentacao`, `pipeline_card_atividade`,
`pipeline_reserva`, `pipeline_anamnese`. Indicadores de anamnese só agregados (contagens),
**sem** expor conteúdo sensível.

**Export**: reusar os módulos de PDF/XLSX existentes (`skills`/`lib` de relatórios) para exportar
o painel. Export que inclua dados sensíveis exige `pipeline_sensivel` e gera entrada de auditoria.

## 7. Realtime

A sincronização em tempo real para toda a equipe já é entregue no MVP1 (Supabase Realtime no
board). MVP5 apenas estende a assinatura às novas visões quando aplicável; sem mudança de infra.

## 8. Modelo de dados — resumo

- **Novas tabelas**: `pipeline_anamnese`, `pipeline_anamnese_arquivo`, `pipeline_acesso_log`.
- **Novo módulo RBAC**: `pipeline_sensivel` + seeds de `role_permissoes`.
- **Promoção (MVP2)** passa a espelhar o subconjunto médico em `informacoes_medicas`.
- Sem materialização de indicadores (cálculo na leitura).

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
