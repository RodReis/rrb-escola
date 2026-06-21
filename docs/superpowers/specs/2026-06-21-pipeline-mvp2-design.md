# Pipeline Kanban — Design MVP2 (Dados educacionais, Reserva, Promoção, RBAC)

- Data: 2026-06-21
- Status: aprovado para implementação
- Pré-requisito: `2026-06-21-pipeline-mvp1-design.md` e a migration `202606210001_pipeline_mvp1.sql`.

## 1. Objetivo e decisões

Transformar o Kanban básico (MVP1) em ferramenta de gestão de captação: dados educacionais,
cadastro de reserva com leitura de vaga real, conversão de lead em aluno/matrícula, perfis
ampliados e gestão de quadros/colunas pela UI.

Decisões firmadas (brainstorming):

1. **Promoção**: função SQL transacional `pipeline_promover_card` (SECURITY DEFINER), chamada via `supabase.rpc()` por uma Server Action. Atomicidade garantida no banco.
2. **Reserva**: tabela `pipeline_reserva` **opcional** (1:1 com card), criada apenas quando o card entra na coluna "Cadastro de Reserva". `pipeline_lead.serie_interesse` continua como rascunho inicial; `pipeline_reserva.serie_id`/`turma_id` são a fonte de verdade para a matrícula.
3. **Perfis**: role nova `coordenacao` com `pipeline` + `pipeline_admin` full — incluindo promoção. A promoção valida dados mínimos antes de executar.
4. **CRUD de quadros/colunas**: tela separada `/pipeline/config`, gated por `pipeline_admin`.
5. **Capacidade**: lida de `turmas.capacidade`; vagas = capacidade − matrículas ativas (cálculo na leitura via view/função, sem contador armazenado).

## 2. Promoção lead → aluno/matrícula

Função SQL `pipeline_promover_card(p_card_id uuid, p_usuario_id uuid)` (SECURITY DEFINER, transacional), chamada por `promoverCardAction` em `src/lib/actions/pipeline.ts` via `supabase.rpc()`.

### Validação mínima (antes de qualquer insert)

A promoção exige os seguintes dados presentes no card — se qualquer um faltar, retorna `{ ok: false, error: "<mensagem>" }` sem gravar nada:

| Dado | Origem | Motivo |
|---|---|---|
| `pipeline_lead.nome` | lead | coluna `NOT NULL` em `alunos` |
| ≥1 responsável com `nome` | `pipeline_lead_responsavel` | `responsaveis_aluno.nome` NOT NULL |
| `pipeline_reserva.serie_id` | reserva | necessário para `matriculas.serie_id` |
| `pipeline_reserva.turma_id` | reserva | necessário para `matriculas.turma_id` |

### Passos atômicos

1. Carrega card + lead + responsáveis + reserva; valida escola_id.
2. **Idempotência**: se `pipeline_card.aluno_id` já preenchido, retorna `{ ok: true }` sem duplicar.
3. Executa validação mínima (acima). Aborta se falhar.
4. Gera `matricula_codigo` via sequence: `'MAT' || extract(year from now()) || lpad(nextval('pipeline_matricula_seq')::text, 5, '0')`.
5. Insere `alunos` com `escola_id` do card (não `DEFAULT_SCHOOL_ID` — corrige pendência N4 do MVP1).
6. Insere em paralelo: `enderecos_aluno` (campos nulos aceitáveis), `contatos_aluno` (do primeiro responsável), `responsaveis_aluno` (todos os responsáveis), `informacoes_medicas` (defaults false), `autorizacoes_aluno` (defaults false).
7. Insere `matriculas` com `serie_id`/`turma_id`/`ano_letivo` da `pipeline_reserva`, status `ativa`.
8. Atualiza card: `aluno_id`, `status_lead = 'convertido'`, `coluna_id` = primeira coluna com `etapa_final = true`.
9. Registra `pipeline_card_atividade` tipo `sistema`: `"Convertido em matrícula <codigo>"`.

Erros abortat a transação inteira. O snapshot do lead não é apagado (auditoria). Após `convertido` o lead fica somente-leitura na UI.

### Server Action

```typescript
export async function promoverCardAction(card_id: string): Promise<ActionResult<{ matricula_codigo: string }>>
```

- Checa `requirePermission('pipeline_admin', 'create')` antes de chamar o RPC.
- Retorna `{ ok: true, data: { matricula_codigo } }` ou `{ ok: false, error }`.
- Em sucesso: `revalidatePath('/pipeline')` + `revalidatePath('/alunos')`.

## 3. Reserva e leitura de vaga

### Tabela `pipeline_reserva`

```sql
card_id                    uuid not null unique references pipeline_card(id) on delete cascade
escola_id                  uuid not null references escolas(id)
serie_id                   uuid null references series(id)
turma_id                   uuid null references turmas(id)
prioridade                 int not null default 0
status_vaga                text  -- aguardando|disponivel|responsavel_contactado|aguardando_resposta|convertido|desistiu|sem_retorno
data_entrada_reserva       date
previsao_disponibilidade   date null
interesse_confirmado       boolean not null default false
observacoes_secretaria     text
created_at / updated_at    timestamptz
```

RLS por `escola_id` + `pipeline_pode('pipeline', 'read')`.

### Cálculo de vagas (na leitura)

Função SQL `pipeline_turma_vagas(p_turma_id uuid, p_ano_letivo int)` retorna:

```sql
SELECT
  t.capacidade,
  count(m.id) FILTER (WHERE m.status = 'ativa') AS matriculas_ativas,
  t.capacidade - count(m.id) FILTER (WHERE m.status = 'ativa') AS vagas_restantes
FROM turmas t
LEFT JOIN matriculas m ON m.turma_id = t.id AND m.ano_letivo = p_ano_letivo
WHERE t.id = p_turma_id
GROUP BY t.capacidade
```

Exposta como Server Action `getVagasTurma(turma_id, ano_letivo)` para exibição na UI.

A reserva **não** bloqueia quando lotada — todo provável aluno entra em análise independente de vaga.

### UX da reserva

Seção "Reserva" aparece no `CardModal` quando `status_lead = 'reserva'` ou quando a coluna tem `etapa_final = false` e `nome` contém "Reserva" (heurística simples, sem hardcode de ID).

Fluxo na UI:
1. Usuário seleciona série → carrega turmas daquela série.
2. Ao selecionar turma → exibe vagas restantes (verde se > 0, âmbar se = 0 mas não bloqueia).
3. Salva `pipeline_reserva` com `criarOuAtualizarReservaAction`.

### Server Actions de reserva

```typescript
criarOuAtualizarReservaAction(card_id, input: ReservaInput): ActionResult<void>
getVagasTurma(turma_id: string, ano_letivo: number): ActionResult<{ capacidade; matriculas_ativas; vagas_restantes }>
getSeriesEscola(): ActionResult<Serie[]>
getTurmasPorSerie(serie_id: string): ActionResult<Turma[]>
```

## 4. Dados educacionais (extensão do lead)

Novas colunas em `pipeline_lead` (adicionadas via migration MVP2, todas nuláveis):

| coluna | tipo | nota |
|---|---|---|
| escola_anterior | text | |
| motivo_transferencia | text | |
| situacao_escolar | text | `regular`/`transferencia`/`abandono`/`conclusao` |
| observacoes_pedagogicas | text | |
| documentos_pendentes | text[] | checklist simples; integração com `documentos_aluno` só pós-promoção |

Os campos `serie_interesse`/`turno`/`ano_letivo` em `pipeline_lead` continuam como rascunho inicial. A fonte de verdade para a matrícula é `pipeline_reserva`.

Esses campos aparecem no `CardModal` numa seção "Dados Educacionais" expansível, editável via `editarCardAction` (que já existe — só adicionar os novos campos ao schema Zod).

## 5. RBAC — dois módulos + role `coordenacao`

### Dois módulos

| módulo | escopo | ações |
|---|---|---|
| `pipeline` | CRUD de cards, leads, responsáveis, notas | pode_ler/criar/editar/deletar |
| `pipeline_admin` | quadros, colunas, promoção | pode_ler/criar/editar/deletar |

### Seeds de permissão

| role | pipeline | pipeline_admin |
|---|---|---|
| `admin` | full | full |
| `secretaria` | full | full |
| `coordenacao` (nova) | full | full |

### Helper SQL

```sql
create or replace function pipeline_pode(p_modulo text, p_acao text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1
    from perfis p
    join role_permissoes rp on rp.role_id = p.role_id
    join modulos m on m.id = rp.modulo_id
    where p.user_id = auth.uid()
      and m.codigo = p_modulo
      and case p_acao
            when 'read'   then rp.pode_ler
            when 'create' then rp.pode_criar
            when 'update' then rp.pode_editar
            when 'delete' then rp.pode_deletar
          end
  )
$$;
```

Usado nas RLS policies em substituição ao hardcode `perfil in ('admin','secretaria')`.

### Refatoração do enforcement (resolve pendência N2 do MVP1)

- `requirePipelineSession()` → removido; ações de card passam a usar `requirePermission('pipeline', 'read')` (padrão existente em `session.ts`).
- Ações de card: `requirePermission('pipeline', acao)`.
- Promoção + CRUD quadros/colunas: `requirePermission('pipeline_admin', acao)`.
- RLS policies: trocam `perfil in ('admin','secretaria')` por `pipeline_pode('pipeline','read')`.

## 6. CRUD de quadros e colunas — `/pipeline/config`

Rota protegida por `pipeline_admin:read`. Estrutura:

```
src/app/(app)/pipeline/
  page.tsx          (board — existente)
  config/
    page.tsx        (listagem de quadros)
    [quadro_id]/
      page.tsx      (colunas do quadro + reordenação)
```

### Tela de quadros (`/pipeline/config`)

- Lista quadros da escola (ativos + arquivados separados).
- Criar quadro: modal com `nome`, `descricao`, `tipo` (captacao/rematricula/reserva), `ordem`.
- Editar: mesmo modal.
- Arquivar: `ativo = false` (soft delete). Botão de restaurar para arquivados.

### Tela de colunas (`/pipeline/config/[quadro_id]`)

- Lista colunas reordenável por drag-and-drop (reutiliza `@dnd-kit` + `calcularOrdem`).
- Criar/editar coluna: painel lateral com `nome`, cor (picker dos 8 tokens `color-pipeline-*`), `prazo_max_dias`, `etapa_final`.
- Excluir: só permitido se a coluna não tiver cards (`count = 0`). Caso contrário, exibe erro.

### Validação Zod (novos schemas em `src/lib/validation/pipeline.ts`)

```typescript
quadroSchema      // nome, descricao, tipo, ordem, ativo
colunaAdminSchema // nome, cor, ordem, prazo_max_dias, etapa_final
reservaSchema     // card_id, serie_id, turma_id, prioridade, status_vaga, ...
```

### Server Actions (adicionadas em `src/lib/actions/pipeline.ts`)

```typescript
// Quadros
criarQuadroAction(input: QuadroInput): ActionResult<{ id: string }>
editarQuadroAction(quadro_id, input: QuadroInput): ActionResult<void>
arquivarQuadroAction(quadro_id): ActionResult<void>
getQuadrosEscola(): ActionResult<Quadro[]>

// Colunas
criarColunaAction(input: ColunaInput): ActionResult<{ id: string }>
editarColunaAction(coluna_id, input: ColunaInput): ActionResult<void>
excluirColunaAction(coluna_id): ActionResult<void>
reordenarColunasAction(ordens: { id: string; ordem: number }[]): ActionResult<void>
```

## 7. Modelo de dados — resumo das mudanças

- **Nova tabela**: `pipeline_reserva` (§3).
- **Novas colunas**: `pipeline_lead` + 5 campos educacionais (§4).
- **Nova sequence**: `pipeline_matricula_seq` para geração de `matricula_codigo`.
- **Nova função SQL**: `pipeline_turma_vagas(turma_id, ano_letivo)` (§3).
- **Nova função SQL**: `pipeline_promover_card(card_id, usuario_id)` (§2).
- **Nova função SQL**: `pipeline_pode(modulo, acao)` (§5).
- **RBAC**: role `coordenacao`, módulo `pipeline_admin`, seeds de `role_permissoes` (§5).
- **RLS refatoradas**: todas as policies pipeline usam `pipeline_pode()` (§5).
- **Tokens N1**: `color-pipeline-*` já definidos no MVP1 (resolvido).

## 8. Critérios de aceite

1. `pipeline_promover_card` cria aluno + responsáveis + matrícula em transação; em erro nada é gravado; chamada repetida não duplica.
2. Promoção usa `escola_id` do card (não `DEFAULT_SCHOOL_ID`).
3. Promoção sem dados mínimos (nome do lead, responsável, série, turma) retorna erro claro sem gravar.
4. Ao selecionar série/turma na reserva, a UI mostra vagas restantes; turma lotada não impede a reserva.
5. Usuário `coordenacao` consegue mover, criar, promover e gerenciar quadros.
6. Usuário sem `pipeline` (ex.: `professor`) é bloqueado no servidor (RLS + action), não só na UI.
7. Enforcement consulta `role_permissoes` via `pipeline_pode()` — não mais hardcoded.
8. CRUD de quadros/colunas funciona; excluir coluna com cards retorna erro.
9. Reordenação de colunas por drag-and-drop persiste corretamente.
10. `npm run typecheck && npm run build` verdes; `npm run test` cobrindo promoção (idempotência, validação mínima) e ocupação de turma.

## 9. Dependências e pendências herdadas do MVP1

- **N1** ✓ — tokens `color-pipeline-*` definidos no MVP1.
- **N2** ✓ — enforcement refatorado neste MVP2 (§5).
- **N3** ✓ — rota `/pipeline` entregue no MVP1.
- **N4** ✓ — promoção usa `escola_id` do card (§2).

## 10. Fora de escopo do MVP2

WhatsApp (MVP3), motor de regras/automação + scheduler (MVP4), anamnese/dados sensíveis,
indicadores/relatórios (MVP5), integração de `documentos_aluno` antes da promoção, lock de
edição simultânea.
