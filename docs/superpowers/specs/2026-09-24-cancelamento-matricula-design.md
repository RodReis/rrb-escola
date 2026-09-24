# Cancelamento de Matrícula

## Contexto

Hoje não existe um fluxo dedicado de cancelamento: `toggleEnrollmentStatusAction`
alterna `ativa`/`cancelada` sem capturar motivo, sem tocar em `alunos.ativo`,
sem tratar cobranças em aberto e sem oferecer a declaração de transferência.
O índice único `matriculas_aluno_ano_unico` já libera o ano quando o status é
`cancelada` (não libera quando é `transferida`), e `historico_matriculas`
já audita toda troca de status via trigger.

O financeiro do aluno hoje vem de duas origens: cobranças manuais
(`cobrancas.origem = 'manual'`) e cobranças importadas do isaac
(`cobrancas.origem = 'isaac'`, ligadas por `isaac_parcela.aluno_id`). O isaac
é integrado só por importação de arquivo (.xlsx + .pdf), sem API — não é
possível cancelar nada no isaac a partir deste sistema.

Depende da frente **Declarações Pedagógicas** (emite "Transferência — Não
Concluído" ao final do cancelamento).

## Decisões

- Status final continua `cancelada` (não `transferida`) — libera o ano no
  índice único e o motivo "Transferência" no cadastro cobre esse caso.
- Diálogo mostra, só leitura: nome do aluno, série/turma, ano.
- Campos editáveis: Data (padrão hoje), Motivo (lista fechada), Observação
  (livre, obrigatória quando Motivo = "Outro").
- Lista de cobranças em aberto do aluno, com checkbox por cobrança
  (pré-marcadas as que vencem **depois** da data de cancelamento); cada linha
  mostra selo "isaac" quando `origem = 'isaac'`.
- Dois switches **obrigatórios** para confirmar: "A coordenação está ciente
  desse cancelamento de matrícula?" e "A diretoria está ciente desse
  cancelamento de matrícula?".
- Um terceiro switch **não obrigatório** (lembrete), visível só se o aluno
  tiver cobrança de origem isaac: "Cancelada também no isaac?".
- Ao confirmar: cancela a matrícula, cancela as cobranças marcadas, inativa o
  aluno, oferece emitir a declaração.
- Cancelamento no isaac em si **não é automatizável** (sem API) — tratado via
  processo (trava de importação) e aviso na ficha, não via integração.

## Modelo de dados

```sql
alter table matriculas
  add column if not exists cancelamento_data date,
  add column if not exists cancelamento_motivo text
    check (cancelamento_motivo in (
      'transferencia', 'desistencia', 'mudanca_cidade', 'inadimplencia', 'outro'
    )),
  add column if not exists cancelamento_obs text,
  add column if not exists cancelado_por uuid references auth.users(id),
  add column if not exists ciente_coordenacao boolean not null default false,
  add column if not exists ciente_diretoria boolean not null default false,
  add column if not exists isaac_cancelado_confirmado boolean;
  -- null = não aplicável (sem cobrança isaac); false = lembrete pendente;
  -- true = usuário confirmou que cancelou no isaac também.

alter table isaac_parcela
  drop constraint if exists isaac_parcela_motivo_pendencia_check,
  add constraint isaac_parcela_motivo_pendencia_check
    check (motivo_pendencia in (
      'sem_aluno', 'tipo_vaga_incompativel', 'permuta_manual', 'aluno_cancelado'
    ));
```

## RPC `cancelar_matricula`

Transação única (Postgres function), parâmetros: `matricula_id`, `data`,
`motivo`, `obs`, `ciente_coordenacao`, `ciente_diretoria`,
`isaac_cancelado_confirmado` (nullable), `cobranca_ids[]` (as marcadas para
cancelar).

Passos, com validação e rollback se qualquer um falhar:
1. Valida matrícula em status `ativa`.
2. Valida `ciente_coordenacao = true` e `ciente_diretoria = true` — senão
   levanta exceção (a UI já bloqueia antes, isto é defesa em profundidade).
3. Atualiza `matriculas`: status → `cancelada`, grava os campos de
   cancelamento. Trigger existente audita em `historico_matriculas`.
4. Atualiza `cobrancas` das `cobranca_ids` informadas → status `cancelada`.
   Cobranças com PIX Sicoob ativo: cancelar o PIX correspondente antes de
   marcar a cobrança como cancelada (reaproveitar action de cancelamento de
   PIX se existir; se não existir, a UI exibe aviso e a pessoa cancela à
   parte — anotar achado real na fase de implementação).
5. Atualiza `alunos.ativo = false`.

## Importação do isaac — trava de pendência

Em `importar_repasse_isaac`: ao encontrar `aluno_id` cuja matrícula do ano
está `cancelada` e `competencia` posterior a `cancelamento_data`, a parcela
**não gera cobrança** — grava com `cobranca_id = null` e
`motivo_pendencia = 'aluno_cancelado'`, entrando na fila de Pendências isaac
que já existe (mesma UI de `sem_aluno`/`permuta_manual`).

## UI

### Diálogo "Cancelar matrícula"
Aberto pela ficha do aluno e pela lista de alunos (componente compartilhado).
Campos e switches conforme "Decisões". Botão Confirmar desabilitado até os 2
switches obrigatórios estarem marcados. Confirmação final via `useConfirm`
(nunca `confirm()` nativo).

Ao concluir com sucesso: toast de sucesso + botão "Emitir Declaração de
Transferência — Não Concluído" (abre a tela de Emitir da frente de
Declarações, com aluno e modelo pré-selecionados).

### Ficha do aluno
- Selo "Cancelado — {ano}" com motivo e data, ao lado do status atual.
- Aviso visível se existir cobrança em aberto com vencimento após a data do
  cancelamento (isto é, o passo 4 não cobriu tudo — cobrança criada depois,
  por exemplo).

## Fora de escopo

- Qualquer chamada de API ao isaac (não existe).
- Alterar o enum `status_matricula` (não usa `transferida` neste fluxo).
- Reversão/"reativar matrícula cancelada" (fluxo separado, não pedido aqui).

## Testes

- RPC recusa matrícula não-ativa.
- RPC recusa sem os dois ciente marcados.
- RPC cancela exatamente as cobranças passadas em `cobranca_ids`, inativa o
  aluno, e grava todos os campos de auditoria.
- Importação isaac: parcela de aluno cancelado com competência posterior vai
  para pendência com o motivo novo; competência anterior segue fluxo normal.
- `npm run typecheck && npm run build` verdes.

## Critério de aceite

- Diálogo funcional na ficha do aluno e na lista, com os 2 switches
  obrigatórios e o lembrete do isaac.
- Cancelamento grava motivo/data/cientes, cancela cobranças selecionadas,
  inativa o aluno.
- Botão de emitir declaração de transferência aparece após o cancelamento.
- Importação do isaac não gera cobrança indevida para aluno cancelado.
