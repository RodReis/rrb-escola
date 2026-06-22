# Pipeline Kanban — Plano de Implementação MVP5

- Spec: `docs/superpowers/specs/2026-06-21-pipeline-mvp5-design.md`
- Data: 2026-06-21
- Pré-requisitos: MVP1–MVP4 aplicados; `supabase db push` das migrations MVP1–MVP4

---

## Fase 1 — Migration

**Arquivo:** `supabase/migrations/202606210005_pipeline_mvp5.sql`

### 1.1 Módulo RBAC `pipeline_sensivel`

```sql
-- Módulo
insert into modulos (codigo, nome, descricao)
values ('pipeline_sensivel', 'Pipeline Sensível', 'Anamnese e dados pedagógicos sensíveis')
on conflict (codigo) do nothing;

-- Seeds de role_permissoes
-- admin: full
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values ('admin', 'pipeline_sensivel', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do update
  set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = true;

-- coordenacao: full
insert into role_permissoes (role_codigo, modulo_codigo, pode_ler, pode_criar, pode_editar, pode_deletar)
values ('coordenacao', 'pipeline_sensivel', true, true, true, true)
on conflict (role_codigo, modulo_codigo) do update
  set pode_ler = true, pode_criar = true, pode_editar = true, pode_deletar = true;

-- secretaria: nenhum (não inserir — ausência = sem acesso)
```

### 1.2 Tabela `pipeline_anamnese`

```sql
create table pipeline_anamnese (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  card_id uuid not null unique references pipeline_card(id) on delete cascade,
  aluno_id uuid null references alunos(id) on delete set null,
  status text not null default 'nao_iniciada',
  necessidade_especial boolean not null default false,
  necessidade_especial_descricao text,
  alergias text,
  medicamentos_continuos text,
  restricoes_alimentares text,
  acomp_psicologico boolean not null default false,
  acomp_psicologico_descricao text,
  acomp_fonoaudiologico boolean not null default false,
  acomp_fonoaudiologico_descricao text,
  acomp_psicopedagogico boolean not null default false,
  acomp_psicopedagogico_descricao text,
  historico_desenvolvimento text,
  comportamento_social text,
  rotina_familiar text,
  observacoes_responsaveis text,
  observacoes_coordenacao text,
  consentimento_em timestamptz null,
  consentimento_por uuid null references perfis(id) on delete set null,
  termo_versao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pipeline_anamnese add constraint pipeline_anamnese_status_valido
  check (status in ('nao_iniciada','enviada','pendente','em_analise','concluida','requer_atencao'));

alter table pipeline_anamnese enable row level security;

create policy pipeline_anamnese_rw on pipeline_anamnese for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_sensivel', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_sensivel', 'create'));

grant select, insert, update on pipeline_anamnese to authenticated;
```

### 1.3 Tabela `pipeline_anamnese_arquivo`

```sql
create table pipeline_anamnese_arquivo (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references escolas(id) on delete cascade,
  anamnese_id uuid not null references pipeline_anamnese(id) on delete cascade,
  card_id uuid not null references pipeline_card(id) on delete cascade,
  nome text not null,
  url text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

alter table pipeline_anamnese_arquivo enable row level security;

create policy pipeline_anamnese_arquivo_rw on pipeline_anamnese_arquivo for all to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_sensivel', 'read'))
  with check (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_sensivel', 'create'));

grant select, insert, delete on pipeline_anamnese_arquivo to authenticated;
```

### 1.4 Tabela `pipeline_acesso_log` (append-only)

```sql
create table pipeline_acesso_log (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null,
  usuario_id uuid not null references perfis(id) on delete cascade,
  card_id uuid not null references pipeline_card(id) on delete cascade,
  recurso text not null,
  acao text not null,
  created_at timestamptz not null default now()
);

alter table pipeline_acesso_log add constraint pipeline_acesso_log_recurso_valido
  check (recurso in ('anamnese', 'anamnese_arquivo'));
alter table pipeline_acesso_log add constraint pipeline_acesso_log_acao_valida
  check (acao in ('read', 'write'));

create index pipeline_acesso_log_idx on pipeline_acesso_log (escola_id, card_id, created_at);

alter table pipeline_acesso_log enable row level security;

-- Leitura: somente quem tem pipeline_sensivel:read
create policy pipeline_acesso_log_read on pipeline_acesso_log for select to authenticated
  using (escola_id = (select escola_id from current_perfil())
    and pipeline_pode('pipeline_sensivel', 'read'));

-- Escrita: via action SECURITY DEFINER — usuário comum não insere diretamente
-- (sem policy de insert = RLS bloqueia insert direto; insert só por função privilegiada)

grant select on pipeline_acesso_log to authenticated;
```

### 1.5 Alterar `pipeline_promover_card` — espelhamento

A função já existe em `202606210002_pipeline_mvp2.sql`. Criar `create or replace function`
com o bloco adicional após o step 10 (insert informacoes_medicas), condicional a `v_anamnese`:

```sql
create or replace function pipeline_promover_card(p_card_id uuid, p_usuario_id uuid)
returns jsonb language plpgsql security definer as $$
-- ... corpo existente intacto até o step 10 ...

  -- 10) Informações médicas (defaults)
  insert into informacoes_medicas (aluno_id)
  values (v_aluno_id)
  on conflict (aluno_id) do nothing;

  -- 10b) Espelhar anamnese → informacoes_medicas (se existir)
  declare
    v_anamnese pipeline_anamnese%rowtype;
  begin
    select * into v_anamnese
    from pipeline_anamnese
    where card_id = p_card_id;

    if found then
      update informacoes_medicas im
      set
        alergia = (v_anamnese.alergias is not null and v_anamnese.alergias <> ''),
        alergia_descricao = v_anamnese.alergias,
        necessidade_especial = v_anamnese.necessidade_especial,
        necessidade_especial_descricao = v_anamnese.necessidade_especial_descricao,
        remedio_especial = (v_anamnese.medicamentos_continuos is not null and v_anamnese.medicamentos_continuos <> ''),
        remedio_especial_descricao = v_anamnese.medicamentos_continuos,
        necessita_apoio = (v_anamnese.acomp_psicologico or v_anamnese.acomp_fonoaudiologico or v_anamnese.acomp_psicopedagogico),
        necessita_apoio_descricao = nullif(trim(
          coalesce(case when v_anamnese.acomp_psicologico then 'Psicológico: ' || coalesce(v_anamnese.acomp_psicologico_descricao,'') end, '') || ' ' ||
          coalesce(case when v_anamnese.acomp_fonoaudiologico then 'Fonoaudiológico: ' || coalesce(v_anamnese.acomp_fonoaudiologico_descricao,'') end, '') || ' ' ||
          coalesce(case when v_anamnese.acomp_psicopedagogico then 'Psicopedagógico: ' || coalesce(v_anamnese.acomp_psicopedagogico_descricao,'') end, '')
        ), '')
      where im.aluno_id = v_aluno_id;

      -- Setar aluno_id na anamnese (histórico)
      update pipeline_anamnese
      set aluno_id = v_aluno_id, updated_at = now()
      where card_id = p_card_id;
    end if;
  end;
-- ... resto do corpo intacto ...
$$;
```

> **Atenção:** Recriar o corpo completo da função copiando do arquivo MVP2 e inserindo o bloco 10b.
> O `declare` aninhado é PL/pgSQL válido dentro de um `begin...end` interno.

---

## Fase 2 — Zod + tipos

**Arquivo:** `src/lib/validation/pipeline.ts` (append)

```typescript
// Status da anamnese
export const STATUS_ANAMNESE = [
  'nao_iniciada', 'enviada', 'pendente',
  'em_analise', 'concluida', 'requer_atencao',
] as const;
export type StatusAnamnese = (typeof STATUS_ANAMNESE)[number];

// Schema de salvamento (exige consentimento para gravar campos sensíveis)
export const salvarAnamneseSchema = z.object({
  card_id: z.string().uuid(),
  // consentimento obrigatório
  consentimento_em: z.string().datetime(),
  consentimento_por: z.string().uuid(),
  termo_versao: z.string().default('v1'),
  // campos clínicos/pedagógicos (todos opcionais — usuário pode salvar parcialmente)
  necessidade_especial: z.boolean().optional(),
  necessidade_especial_descricao: z.string().max(2000).optional().nullable(),
  alergias: z.string().max(2000).optional().nullable(),
  medicamentos_continuos: z.string().max(2000).optional().nullable(),
  restricoes_alimentares: z.string().max(2000).optional().nullable(),
  acomp_psicologico: z.boolean().optional(),
  acomp_psicologico_descricao: z.string().max(1000).optional().nullable(),
  acomp_fonoaudiologico: z.boolean().optional(),
  acomp_fonoaudiologico_descricao: z.string().max(1000).optional().nullable(),
  acomp_psicopedagogico: z.boolean().optional(),
  acomp_psicopedagogico_descricao: z.string().max(1000).optional().nullable(),
  historico_desenvolvimento: z.string().max(3000).optional().nullable(),
  comportamento_social: z.string().max(3000).optional().nullable(),
  rotina_familiar: z.string().max(3000).optional().nullable(),
  observacoes_responsaveis: z.string().max(3000).optional().nullable(),
  observacoes_coordenacao: z.string().max(3000).optional().nullable(),
});
export type SalvarAnamneseInput = z.infer<typeof salvarAnamneseSchema>;

export const mudarStatusAnamneseSchema = z.object({
  card_id: z.string().uuid(),
  novo_status: z.enum(['em_analise', 'concluida', 'requer_atencao']),
});
```

---

## Fase 3 — Server Actions de anamnese

**Arquivo:** `src/lib/actions/pipeline-anamnese.ts` (novo)

```typescript
"use server";
// Exports: getAnamnese, salvarAnamnese, mudarStatusAnamnese,
//          uploadAnamneseArquivo, getAnamneseArquivoUrl, deletarAnamneseArquivo
```

### 3.1 `getAnamnese(card_id)`

1. `requirePermission('pipeline_sensivel', 'read')` → ctx
2. Busca `pipeline_anamnese` + `pipeline_anamnese_arquivo` where `card_id`
3. Grava `pipeline_acesso_log` via `createAdminClient()` (sem RLS) com `acao='read'`
4. Retorna `ActionResult<{ anamnese, arquivos }>`

### 3.2 `salvarAnamnese(input: SalvarAnamneseInput)`

1. `requirePermission('pipeline_sensivel', 'create')` → ctx
2. Parse via `salvarAnamneseSchema`
3. Upsert em `pipeline_anamnese`:
   - Se não existe: `status = 'em_analise'` (primeira gravação)
   - Se existe: mantém status atual (não altera)
4. Grava `pipeline_acesso_log` com `acao='write'`
5. `revalidatePath('/pipeline')`
6. Retorna `ActionResult`

### 3.3 `mudarStatusAnamnese(input)`

1. `requirePermission('pipeline_sensivel', 'edit')` → ctx
2. Parse via `mudarStatusAnamneseSchema`
3. Valida transição permitida:
   - `em_analise` → `concluida` | `requer_atencao`
   - `requer_atencao` → `em_analise`
   - `concluida` → `requer_atencao`
4. Update `pipeline_anamnese.status + updated_at`
5. Retorna `ActionResult`

### 3.4 `uploadAnamneseArquivo(card_id, file: File)`

1. `requirePermission('pipeline_sensivel', 'create')` → ctx
2. Valida tamanho (máx 10MB) e mime_type (pdf, imagens)
3. Upload para bucket `pipeline-anamnese` via `supabase.storage.from('pipeline-anamnese').upload(path, file)`
4. Busca `anamnese_id` para o card (deve existir)
5. Insere em `pipeline_anamnese_arquivo`
6. Grava `pipeline_acesso_log` com `acao='write'`, `recurso='anamnese_arquivo'`
7. Retorna `ActionResult`

### 3.5 `getAnamneseArquivoUrl(arquivo_id)`

1. `requirePermission('pipeline_sensivel', 'read')` → ctx
2. Busca `pipeline_anamnese_arquivo` pelo id + valida `escola_id`
3. Gera presigned URL: `supabase.storage.from('pipeline-anamnese').createSignedUrl(path, 60)`
4. Grava `pipeline_acesso_log` com `acao='read'`, `recurso='anamnese_arquivo'`
5. Retorna `ActionResult<{ url }>`

### 3.6 `deletarAnamneseArquivo(arquivo_id)`

1. `requirePermission('pipeline_sensivel', 'delete')` → ctx
2. Busca arquivo + valida escola
3. `supabase.storage.from('pipeline-anamnese').remove([path])`
4. Delete em `pipeline_anamnese_arquivo`
5. Retorna `ActionResult`

---

## Fase 4 — Actions de indicadores

**Arquivo:** `src/lib/actions/pipeline-indicadores.ts` (novo)

```typescript
"use server";
// Exports: getIndicadoresPipeline
```

### 4.1 `getIndicadoresPipeline(periodo: 30 | 90 | 180)`

1. `requirePermission('pipeline', 'read')` → ctx com `escola_id`
2. Executar queries paralelas via `Promise.all`:
   - **Captação**: total de cards criados no período; por coluna de origem
   - **Conversão**: cards promovidos (matrícula confirmada) no período; reservas
   - **Parados**: cards sem movimentação há > `prazo_max_dias`; por coluna
   - **Atendimento**: tempo médio entre criação e promoção (de `pipeline_card_movimentacao`)
   - **Documentos pendentes**: count de cards com `docs_status != 'completo'`
   - **Anamneses**: count por status — `nao_iniciada`, `em_analise`, `concluida`, `requer_atencao`
   - **Motivos de perda**: top 5 de `motivo_perda` de cards `perdidos`
3. Todas as queries filtradas por `escola_id` e `date_trunc('day', created_at) >= now() - interval 'N days'`
4. Retorna `ActionResult<IndicadoresPipeline>`

```typescript
export type IndicadoresPipeline = {
  periodo: 30 | 90 | 180;
  captacao: { total: number; por_origem: { origem: string; total: number }[] };
  conversao: { matriculas: number; reservas: number; taxa_pct: number };
  parados: { total: number; por_coluna: { coluna: string; total: number }[] };
  tempo_medio_atendimento_dias: number | null;
  documentos_pendentes: number;
  anamneses: Record<StatusAnamnese, number>;
  motivos_perda: { motivo: string; total: number }[];
};
```

---

## Fase 5 — Export PDF/XLSX

**Arquivo:** `src/lib/pipeline/indicadores-export.ts` (novo)

- `exportarIndicadoresPDF(dados: IndicadoresPipeline): Uint8Array`
  - Segue padrão de `src/lib/folha/holerite-pdf.ts` (jsPDF + autotable)
  - Seções: Captação, Conversão, Parados por Coluna, Atendimento, Anamneses, Motivos de Perda
  - Rodapé com escola + período + data de geração

- `exportarIndicadoresXLSX(dados: IndicadoresPipeline): Buffer`
  - Segue padrão de `src/lib/folha/pacote-contador.ts` (ExcelJS)
  - Uma aba por seção de indicador

---

## Fase 6 — UI: Anamnese no card-modal

### 6.1 Aba "Anamnese" no card-modal

**Arquivo:** `src/components/pipeline/card-modal/anamnese-tab.tsx` (novo, `"use client"`)

Props: `card_id: string`

Comportamento:
- Ao montar: chama `getAnamnese(card_id)` via `useEffect` (lazy — só se o usuário clicar na aba)
- Estado local: `loading`, `anamnese | null`, `arquivos[]`
- Se `anamnese === null` (não existe): mostra formulário de consentimento primeiro
  - Inputs: data de consentimento (default: hoje), termo versão (default: "v1"), checkbox confirma
  - Botão "Registrar consentimento e iniciar anamnese" → chama `salvarAnamnese` com campos vazios + consentimento
- Se consentimento registrado: exibe formulário com todas as seções:
  1. **Saúde**: alergias, medicamentos contínuos, restrições alimentares
  2. **Necessidade especial**: toggle + textarea descricao
  3. **Acompanhamentos**: psicológico, fonoaudiológico, psicopedagógico (toggle + textarea cada)
  4. **Desenvolvimento**: historico_desenvolvimento, comportamento_social, rotina_familiar
  5. **Observações**: observacoes_responsaveis, observacoes_coordenacao
- Botões de salvamento: "Salvar rascunho" (apenas `salvarAnamnese`)
- Badge de status + botões de transição no topo:
  - `em_analise`: botão "Concluir" → `mudarStatusAnamnese('concluida')` | botão "Requer atenção"
  - `concluida`: botão "Requer atenção" → `mudarStatusAnamnese('requer_atencao')`
  - `requer_atencao`: botão "Retomar análise" → `mudarStatusAnamnese('em_analise')`
- Seção de **Anexos**: lista de arquivos + botão upload (input file) + delete por item
- Se usuário não tem `pipeline_sensivel`: exibe mensagem "Sem acesso a dados sensíveis"

### 6.2 Integrar aba no card-modal existente

Encontrar `src/components/pipeline/card-modal/` e adicionar tab "Anamnese" condicionada ao
módulo `pipeline_sensivel`. A visibilidade da aba deve ser determinada server-side (prop `podeVerAnamnese`)
— não expor o conteúdo na hydration inicial.

---

## Fase 7 — UI: Dashboard de indicadores

**Arquivo:** `src/app/(app)/pipeline/indicadores/page.tsx` (novo)

```typescript
// Server Component
// requirePermission('pipeline', 'read')
// Passa período (query param ?periodo=30|90|180) e chama getIndicadoresPipeline()
// Renderiza IndicadoresDashboard (Client Component) com dados SSR
```

**Arquivo:** `src/components/pipeline/indicadores-dashboard.tsx` (novo, `"use client"`)

- Seletor de período (30/90/180 dias) → `router.push` com query param
- Cards de métricas: total captação, matrículas, reservas, taxa conversão
- Tabela parados por coluna
- Gráfico simples de motivos de perda (lista ordenada)
- Seção anamneses: contagem por status (barras ou pills)
- Botões export: "PDF" → download via `exportarIndicadoresPDF`, "Excel" → download via `exportarIndicadoresXLSX`

**Topbar:** Adicionar link "Indicadores" na nav do pipeline (hardcoded, conforme padrão do projeto — ver memory `project_menu_hardcoded.md`).

---

## Fase 8 — Testes

**Arquivo:** `src/lib/pipeline/anamnese.test.ts` (novo)

Cenários prioritários:

1. **Bloqueio sem consentimento**: `salvarAnamnese` sem `consentimento_em` → `{ ok:false }`
2. **Consentimento válido**: `salvarAnamnese` com consentimento → persiste + grava log `write`
3. **Auditoria de leitura**: `getAnamnese` → grava log `read`
4. **Transição de status válida**: `em_analise` → `concluida` → OK
5. **Transição inválida**: `nao_iniciada` → `concluida` → rejeitado
6. **RLS `pipeline_sensivel`**: usuário sem módulo → `getAnamnese` → erro de permissão

> Usar mocks de Supabase + `requirePermission` seguindo padrão dos testes existentes.

---

## Fase 9 — Qualidade

```bash
npm run typecheck   # zero erros
npm run build       # sucesso
```

Commit por fase: `feat(pipeline): <fase descricao>`

---

## Ordem de execução

| # | Fase | Arquivo principal | Depende de |
| --- | --- | --- | --- |
| 1 | Migration | `202606210005_pipeline_mvp5.sql` | — |
| 2 | Zod + tipos | `src/lib/validation/pipeline.ts` | — |
| 3 | Actions anamnese | `src/lib/actions/pipeline-anamnese.ts` | 1, 2 |
| 4 | Actions indicadores | `src/lib/actions/pipeline-indicadores.ts` | 1 |
| 5 | Export PDF/XLSX | `src/lib/pipeline/indicadores-export.ts` | 4 |
| 6 | UI anamnese | `src/components/pipeline/card-modal/anamnese-tab.tsx` | 3 |
| 7 | UI indicadores | `src/app/(app)/pipeline/indicadores/page.tsx` | 4, 5 |
| 8 | Testes | `src/lib/pipeline/anamnese.test.ts` | 3 |
| 9 | Qualidade | — | todas |

Fases 1–2 podem ser feitas em paralelo. Fases 3–4 podem ser feitas em paralelo (dependem de 1+2).
Fases 5–7 dependem das actions respectivas. Fase 8 pode ser feita junto à fase 6.
