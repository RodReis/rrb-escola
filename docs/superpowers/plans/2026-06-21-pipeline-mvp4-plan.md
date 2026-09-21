# Plano de Implementação — Pipeline MVP4 (Automação por Regras)

- Data: 2026-06-21
- Spec: `docs/superpowers/specs/2026-06-21-pipeline-mvp4-design.md`
- Pré-requisitos: MVPs 1–3 mergeados; `pipeline_tarefa`, `pipeline_template_whatsapp`, `enviarWhatsappCardAction`, `criarTarefaAction`, `moverCardAction` todos existentes.

---

## Fase 1 — Migration

**Arquivo:** `supabase/migrations/202606210004_pipeline_mvp4.sql`

### 1.1 `pipeline_automacao`

```sql
create table pipeline_automacao (
  id             uuid primary key default gen_random_uuid(),
  escola_id      uuid not null references escolas(id) on delete cascade,
  quadro_id      uuid null references pipeline_quadro(id) on delete cascade,
  coluna_id      uuid null references pipeline_coluna(id) on delete set null,
  tipo           text not null,
  ativo          boolean not null default true,
  params         jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index pipeline_automacao_escola_idx on pipeline_automacao(escola_id, quadro_id, ativo);

-- RLS
alter table pipeline_automacao enable row level security;

create policy "pipeline_automacao_read"
  on pipeline_automacao for select
  using (pipeline_pode('pipeline_admin', 'read'));

create policy "pipeline_automacao_write"
  on pipeline_automacao for all
  using (pipeline_pode('pipeline_admin', 'read'))
  with check (pipeline_pode('pipeline_admin', 'create'));
```

### 1.2 `pipeline_automacao_execucao`

```sql
create table pipeline_automacao_execucao (
  id             uuid primary key default gen_random_uuid(),
  escola_id      uuid not null,
  automacao_id   uuid not null references pipeline_automacao(id) on delete cascade,
  card_id        uuid not null references pipeline_card(id) on delete cascade,
  coluna_id      uuid null,  -- contexto de entrada (para dedupe por entrada)
  executed_at    timestamptz not null default now(),
  resultado      text not null, -- 'ok' | 'erro' | 'ignorado'
  detalhe        text
);

-- dedupe por card (automações "uma_vez")
create unique index pipeline_exec_card_uniq
  on pipeline_automacao_execucao(automacao_id, card_id)
  where coluna_id is null;

-- dedupe por entrada de coluna (automações "uma_vez por entrada")
create unique index pipeline_exec_coluna_uniq
  on pipeline_automacao_execucao(automacao_id, card_id, coluna_id)
  where coluna_id is not null;

create index pipeline_exec_card_idx on pipeline_automacao_execucao(card_id);
create index pipeline_exec_automacao_idx on pipeline_automacao_execucao(automacao_id, executed_at desc);

-- RLS
alter table pipeline_automacao_execucao enable row level security;

create policy "pipeline_exec_read"
  on pipeline_automacao_execucao for select
  using (pipeline_pode('pipeline_admin', 'read'));

-- Inserção via SECURITY DEFINER functions (job + actions)
```

### 1.3 Constraint de tipo válido

```sql
alter table pipeline_automacao
  add constraint pipeline_automacao_tipo_valido check (tipo in (
    'card_parado_cria_tarefa',
    'coluna_entrada_envia_template',
    'coluna_entrada_cria_tarefa',
    'coluna_entrada_solicita_dado',
    'coluna_entrada_muda_status',
    'entrada_etapa_final_boas_vindas',
    'mover_card_condicional'
  ));
```

### 1.4 `pipeline_coluna` — adicionar `solicita_dado`

```sql
-- campo para tipo coluna_entrada_solicita_dado
alter table pipeline_coluna
  add column if not exists campo_obrigatorio text null;
```

> Nota: `coluna_entrada_solicita_dado` é validação na UI (`moverCardAction`), não corre no job.
> Pode ser modelado como automação com `tipo='coluna_entrada_solicita_dado'` OU como campo na coluna.
> Decisão: modelar como campo na coluna (`campo_obrigatorio`) — mais simples, sem necessidade de
> consultar `pipeline_automacao` para validar UI de mover.

---

## Fase 2 — Zod Schemas (`src/lib/validation/pipeline.ts`)

Adicionar após as exportações do MVP3:

```typescript
export const TIPOS_AUTOMACAO = [
  "card_parado_cria_tarefa",
  "coluna_entrada_envia_template",
  "coluna_entrada_cria_tarefa",
  "coluna_entrada_solicita_dado",
  "coluna_entrada_muda_status",
  "entrada_etapa_final_boas_vindas",
  "mover_card_condicional",
] as const;
export type TipoAutomacao = (typeof TIPOS_AUTOMACAO)[number];

// Gatilho por tipo (para a UI distinguir evento vs tempo)
export const AUTOMACAO_GATILHO: Record<TipoAutomacao, "evento" | "tempo"> = {
  card_parado_cria_tarefa:          "tempo",
  coluna_entrada_envia_template:    "evento",
  coluna_entrada_cria_tarefa:       "evento",
  coluna_entrada_solicita_dado:     "evento",
  coluna_entrada_muda_status:       "evento",
  entrada_etapa_final_boas_vindas:  "evento",
  mover_card_condicional:           "evento",
};

// Dedupe por tipo
export const AUTOMACAO_DEDUPE: Record<TipoAutomacao, "card" | "entrada" | "nenhum"> = {
  card_parado_cria_tarefa:          "card",
  coluna_entrada_envia_template:    "entrada",
  coluna_entrada_cria_tarefa:       "entrada",
  coluna_entrada_solicita_dado:     "nenhum",
  coluna_entrada_muda_status:       "nenhum",
  entrada_etapa_final_boas_vindas:  "card",
  mover_card_condicional:           "entrada",
};

// Schema de params por tipo (discriminated union)
const paramsCardParado = z.object({
  dias: z.number().int().min(2).optional(),  // usa coluna.prazo_max_dias se omitido
  titulo: z.string().min(1).max(200),
  assigned_to: z.string().uuid().optional(),
});
const paramsColunaEnviaTemplate = z.object({
  coluna_id: z.string().uuid(),
  template_id: z.string().uuid(),
  variaveis_fontes: z.array(z.enum(FONTES_WPP)).optional(),
});
const paramsColunaGeraTarefa = z.object({
  coluna_id: z.string().uuid(),
  titulo: z.string().min(1).max(200),
  due_em_dias: z.number().int().min(1).optional(),
  assigned_to: z.string().uuid().optional(),
});
const paramsColunaStatusLead = z.object({
  coluna_id: z.string().uuid(),
  status_destino: z.enum(STATUS_LEAD),
});
const paramsBoasVindas = z.object({
  template_id: z.string().uuid(),
});
const paramsMoverCondicional = z.object({
  de_coluna_id: z.string().uuid(),
  para_coluna_id: z.string().uuid(),
});

export const automacaoSchema = z.object({
  quadro_id: z.string().uuid().optional().nullable(),
  tipo: z.enum(TIPOS_AUTOMACAO),
  ativo: z.boolean().default(true),
  params: z.union([
    paramsCardParado,
    paramsColunaEnviaTemplate,
    paramsColunaGeraTarefa,
    paramsColunaStatusLead,
    paramsBoasVindas,
    paramsMoverCondicional,
    z.record(z.unknown()),  // fallback para serialização DB
  ]),
});
export type AutomacaoInput = z.infer<typeof automacaoSchema>;
```

---

## Fase 3 — Server Actions (`src/lib/actions/pipeline.ts`)

### 3.1 Tipos

```typescript
export type Automacao = {
  id: string;
  quadro_id: string | null;
  coluna_id: string | null;
  tipo: TipoAutomacao;
  ativo: boolean;
  params: Record<string, unknown>;
  created_at: string;
};
```

### 3.2 CRUD de automações (admin)

```typescript
getAutomacoesAdmin(quadro_id?: string): Promise<ActionResult<Automacao[]>>
criarAutomacaoAction(input: AutomacaoInput): Promise<ActionResult<undefined>>
editarAutomacaoAction(id: string, input: AutomacaoInput): Promise<ActionResult<undefined>>
toggleAutomacaoAction(id: string, ativo: boolean): Promise<ActionResult<undefined>>
deletarAutomacaoAction(id: string): Promise<ActionResult<undefined>>
```

Padrão idêntico aos outros CRUDs: `getPipelineCtx` → `supabase` → insert/update → `revalidatePath('/pipeline/config')`.

### 3.3 `moverCardAction` — adicionar suporte a `triggered_by_automation`

Adicionar parâmetro opcional:

```typescript
export async function moverCardAction(
  input: MoverCardInput,
  options?: { triggered_by_automation?: boolean }
): Promise<ActionResult>
```

Se `triggered_by_automation === true`, pular a avaliação de automações de evento após persistir.

### 3.4 `avaliarAutomacoesEvento` (chamada interna, não exportada)

```typescript
async function avaliarAutomacoesEvento(
  supabase: SupabaseClient,
  card_id: string,
  para_coluna_id: string,
  escola_id: string,
): Promise<void>
```

1. Busca `pipeline_automacao` com `ativo=true`, `escola_id`, e gatilho de evento (tipos com `AUTOMACAO_GATILHO[tipo] === 'evento'`).
2. Para cada automação elegível (por `coluna_id` ou `etapa_final`):
   - Verifica dedupe em `pipeline_automacao_execucao`
   - Executa ação correspondente
   - Grava `pipeline_automacao_execucao` + `pipeline_card_atividade(tipo='sistema')`
3. Ações de rede (WhatsApp) são disparadas sem `await` (fire-and-forget com `Promise.allSettled`)

Chamada em `moverCardAction` logo após o `insert` de movimentação, antes do `revalidatePath`.

### 3.5 `jobPipelineAutomacoes` (novo arquivo `src/lib/actions/pipeline-jobs.ts`)

```typescript
export type AutomacaoJobResult = {
  automacao_id: string;
  tipo: string;
  cards_afetados: number;
  erros: number;
};

export async function jobPipelineAutomacoes(hoje: Date): Promise<AutomacaoJobResult[]>
```

Estrutura:
1. `createAdminClient()` — sem RLS
2. Busca todas as automações de **tempo** com `ativo=true`
3. Para cada automação:
   - `card_parado_cria_tarefa`: SELECT cards onde `now() - coalesce(ultimo_contato_at, created_at) > interval 'N days'` e sem execução anterior (`LEFT JOIN pipeline_automacao_execucao`)
   - Executa ação para cada card elegível
   - Grava execução + atividade
4. Retorna array de resultados

Registrado em `dispatch/route.ts`:
```typescript
["pipeline_automacoes", () => jobPipelineAutomacoes(hoje)],
```

---

## Fase 4 — Validação `solicita_dado` em `moverCardAction`

A validação de `campo_obrigatorio` na coluna de destino é síncrona e ocorre **antes** de persistir:

```typescript
// Em moverCardAction, antes do update:
const { data: colunaDestino } = await supabase
  .from("pipeline_coluna")
  .select("campo_obrigatorio")
  .eq("id", input.para_coluna_id)
  .single();

if (colunaDestino?.campo_obrigatorio && !input.campo_valor) {
  return { ok: false, error: `Campo obrigatório: ${colunaDestino.campo_obrigatorio}` };
}
```

`moverCardSchema` recebe campo opcional `campo_valor?: string | null`.

Na UI (`board.tsx`), ao tentar mover para coluna com `campo_obrigatorio`, exibir um mini-modal inline para coletar o valor antes de confirmar o `moverCardAction`.

> Simplificação MVP4: o `campo_obrigatorio` pode ser `"data_visita"` etc. A UI de config de colunas
> recebe um campo extra "Campo obrigatório ao entrar" (text, optional). A validação do
> valor é apenas `required` (não-vazio). Sem tipo específico por campo.

---

## Fase 5 — UI de Automações

### 5.1 `src/components/pipeline/config/automacoes-config-client.tsx`

Client component. Props: `automacoes: Automacao[]`, `quadros: { id, nome }[]`, `templates: TemplateWpp[]`, `colunas: { id, nome, quadro_id }[]`, `perfis: { id, nome }[]`.

Lista automações agrupadas por tipo (evento / tempo). Cada item tem:
- Ícone de tipo + label descritivo (ex: "Ao entrar na coluna X → Enviar template Y")
- Toggle ativo/inativo (call `toggleAutomacaoAction`)
- Botão editar / deletar

Modal criar/editar com formulário dinâmico:
- Select de `tipo` (com ícone e descrição do gatilho)
- Campos de `params` variam por tipo (mostrados com `switch (tipo)`)
- Select de `quadro_id` (opcional)

### 5.2 Atualizar `/pipeline/config/page.tsx`

Adicionar:
```typescript
const [automacoesResult, colunasResult] = await Promise.all([
  getAutomacoesAdmin(),
  supabase.from("pipeline_coluna").select("id, nome, quadro_id").eq(...),
]);
```

Renderizar `<AutomacoesConfigClient ... />` após `TemplatesConfigClient`.

### 5.3 Campo `campo_obrigatorio` em `ColunaConfigClient`

Adicionar input "Campo obrigatório ao entrar (opcional)" no formulário de editar coluna.

Call `editarColunaAction` (já existente) com o novo campo.

---

## Fase 6 — Testes

### 6.1 `src/lib/pipeline/automacoes.test.ts`

- `avaliarAutomacoesEvento`: mock supabase + verificar que execução é gravada e ação é chamada
- Dedupe: segunda chamada com mesmo `(automacao_id, card_id)` → ignorada
- `jobPipelineAutomacoes`: mock cards parados > N dias → verifica tarefa criada; segunda execução → dedupe, 0 cards
- Anti-loop: `moverCardAction` com `triggered_by_automation=true` → `avaliarAutomacoesEvento` não é chamada

### 6.2 Critérios de aceite (do spec §8)

1. Mover card para coluna → ação dispara + atividade `tipo='sistema'` gravada
2. Job diário cria tarefa uma única vez (rodar job 2x, confirmar dedupe)
3. Telefone inválido → `resultado='erro'`, outros cards não afetados
4. Toggle `ativo=false` → nenhuma nova execução
5. `jobs_log` recebe resumo do run
6. Gerência bloqueada para não-admin (testar 403)

---

## Fase 7 — typecheck + build

```bash
npm run typecheck && npm run build
```

Build verde antes do PR.

---

## Ordem de execução

```
Fase 1 → Fase 2 → Fase 3.1–3.2 → Fase 3.3–3.5 → Fase 4 → Fase 5 → Fase 6 → Fase 7
```

Fases 3.1–3.2 e Fase 2 podem ser feitas em paralelo.
Fase 4 depende da Fase 1 (nova coluna em `pipeline_coluna`).
Fase 5 depende das Fases 2–3.

---

## Arquivos criados/modificados

| Arquivo | Operação |
|---|---|
| `supabase/migrations/202606210004_pipeline_mvp4.sql` | criar |
| `src/lib/validation/pipeline.ts` | modificar (append) |
| `src/lib/actions/pipeline.ts` | modificar (append CRUD + `avaliarAutomacoesEvento` + `moverCardAction` options) |
| `src/lib/actions/pipeline-jobs.ts` | criar |
| `src/app/api/jobs/dispatch/route.ts` | modificar (adicionar job) |
| `src/components/pipeline/config/automacoes-config-client.tsx` | criar |
| `src/components/pipeline/config/colunas-config-client.tsx` | modificar (campo_obrigatorio) |
| `src/app/(app)/pipeline/config/page.tsx` | modificar (adicionar automacoes + colunas fetch) |
| `src/components/pipeline/board.tsx` | modificar (mini-modal campo_obrigatorio) |
| `src/lib/pipeline/automacoes.test.ts` | criar |
