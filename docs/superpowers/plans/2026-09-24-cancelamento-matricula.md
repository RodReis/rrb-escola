# Cancelamento de Matrícula Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fluxo dedicado de cancelamento de matrícula no meio do ano — diálogo na ficha do aluno e na lista, captura motivo/data/cientes, cancela cobranças selecionadas, inativa o aluno, trava a importação isaac para não gerar cobrança indevida, e oferece emissão da declaração de transferência. Relatório separado lista quem saiu no ano.

**Architecture:** RPC transacional `cancelar_matricula` (Postgres function, `security definer`) faz a gravação atômica (matrícula + cobranças + aluno). Server Action fina só valida input e chama a RPC. Diálogo client component compartilhado entre ficha do aluno e lista de matrículas. Trava de importação isaac entra na função pura `decidirPendencia` (TypeScript), não na RPC — é onde a decisão de pendência já mora hoje.

**Tech Stack:** Next.js 14 Server Actions, Supabase Postgres (RPC plpgsql), Zod, Vitest, `useConfirm` (nunca `confirm()` nativo).

**Spec:** `docs/superpowers/specs/2026-09-24-cancelamento-matricula-design.md`

## Global Constraints

- Status final da matrícula cancelada continua `cancelada` (nunca `transferida`) — o índice único parcial `matriculas_aluno_ano_unico` (`where status <> 'cancelada'`) já libera o ano letivo nesse status.
- Dois switches "ciente coordenação"/"ciente diretoria" são **obrigatórios** — RPC recusa gravar sem os dois `true`, mesmo que a UI já bloqueie antes (defesa em profundidade).
- Confirmação final do diálogo via `useConfirm` (`src/components/ui/confirm-dialog.tsx`) — nunca `confirm()` nativo.
- Nenhuma chamada de API ao isaac (não existe). Cancelamento no isaac é só lembrete/checkbox informativo.
- Cancelamento de PIX Sicoob: **não existe action de cancelamento de PIX no código atual** (verificado em `src/lib/actions/sicoob.ts` — só emissão). A UI mostra aviso "cancele o PIX manualmente no Sicoob" para cobrança com PIX ativo, em vez de tentar automatizar (YAGNI — não construir integração nova nesta frente).
- A trava de importação isaac (parcela de aluno cancelado não vira cobrança) entra na função pura já existente `decidirPendencia` em `src/lib/isaac/preparar-importacao.ts`, não na RPC `importar_repasse_isaac` — é lá que toda decisão de pendência já é tomada hoje (a RPC só grava o que o TypeScript decidiu).
- Evento "não renovação" (matrícula ausente no ano seguinte) não grava nada novo — nenhuma task deste plano cria campo ou registro para esse caso.
- Toda cor via token/classe Tailwind — sem hex/rgb cru (CLAUDE.md do projeto).

## Review Focus

- **Matrícula já cancelada ou concluída, tentando cancelar de novo** — RPC precisa recusar (`status <> 'ativa'`) com mensagem clara, não silenciosamente sobrescrever data/motivo.
- **Aluno com múltiplas matrículas no histórico (anos anteriores) tentando cancelar a de um ano passado** — a ficha do aluno só oferece o botão para a matrícula do ano corrente; a RPC não distingue ano, então o teste garante que cancelar uma matrícula de ano anterior também funciona (a UI é que restringe, não o banco).
- **Cobrança com pagamento parcial marcada para cancelar** — cancelar a cobrança não deve apagar pagamento já registrado; só muda `cobrancas.status`, nunca mexe em `pagamentos`.
- **Parcela isaac de aluno cancelado chegando com competência anterior à data de cancelamento** — não deve virar pendência; só o motivo `aluno_cancelado` é novo para competência posterior.
- **Motivo "Outro" sem observação preenchida** — a spec exige observação obrigatória só nesse caso; validação client-side E na Server Action (nunca confiar só no client).

---

### Task 1: Migration — colunas de cancelamento em `matriculas` e motivo novo em `isaac_parcela`

**Files:**
- Create: `supabase/migrations/202609240011_cancelamento_matricula.sql`
- Test: manual via `supabase db reset --local` (migrations não têm suite própria; validação é a migration aplicar sem erro)

**Interfaces:**
- Produces: colunas `matriculas.cancelamento_data` (date), `matriculas.cancelamento_motivo` (text, check constraint), `matriculas.cancelamento_obs` (text), `matriculas.cancelado_por` (uuid, references `perfis(id)`), `matriculas.ciente_coordenacao` (boolean not null default false), `matriculas.ciente_diretoria` (boolean not null default false), `matriculas.isaac_cancelado_confirmado` (boolean, nullable); `isaac_parcela.motivo_pendencia` check constraint estendido com `'aluno_cancelado'`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/202609240011_cancelamento_matricula.sql
--
-- Cancelamento de matrícula no meio do ano (evento 2, distinto de
-- "não renovação" — ver docs/superpowers/specs/2026-09-24-cancelamento-matricula-design.md).
-- `cancelado_por` referencia `perfis(id)` (não `auth.users`), mesmo padrão de
-- `pagamentos.registrado_por` e `isaac_repasse.importado_por` já usados no
-- schema — session.profile.id é o id de `perfis`, não de `auth.users`.

alter table matriculas
  add column if not exists cancelamento_data date,
  add column if not exists cancelamento_motivo text,
  add column if not exists cancelamento_obs text,
  add column if not exists cancelado_por uuid references perfis(id) on delete set null,
  add column if not exists ciente_coordenacao boolean not null default false,
  add column if not exists ciente_diretoria boolean not null default false,
  add column if not exists isaac_cancelado_confirmado boolean;

alter table matriculas
  drop constraint if exists matriculas_cancelamento_motivo_check,
  add constraint matriculas_cancelamento_motivo_check
    check (cancelamento_motivo is null or cancelamento_motivo in (
      'transferencia', 'desistencia', 'mudanca_cidade', 'inadimplencia', 'outro'
    ));

alter table isaac_parcela
  drop constraint if exists isaac_parcela_motivo_pendencia_check,
  add constraint isaac_parcela_motivo_pendencia_check
    check (motivo_pendencia is null or motivo_pendencia in (
      'sem_aluno', 'tipo_vaga_incompativel', 'permuta_manual', 'aluno_cancelado'
    ));
```

- [ ] **Step 2: Aplicar local e verificar**

Run: `supabase db reset --local`
Expected: reset completo sem erro, migration aparece no log de aplicação.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202609240011_cancelamento_matricula.sql
git commit -m "feat(matriculas): adiciona colunas de cancelamento e motivo aluno_cancelado no isaac"
```

---

### Task 2: RPC `cancelar_matricula`

**Files:**
- Create: `supabase/migrations/202609240012_rpc_cancelar_matricula.sql`
- Test: `src/lib/actions/matriculas-cancelamento.test.ts` (testa via Server Action da Task 3, que chama a RPC — a RPC em si não tem runner de teste SQL no projeto; segue padrão de `rematriculate`, testado indiretamente via `rematricularLoteAction`)

**Interfaces:**
- Consumes: colunas da Task 1.
- Produces: função SQL `cancelar_matricula(p_matricula_id uuid, p_data date, p_motivo text, p_obs text, p_ciente_coordenacao boolean, p_ciente_diretoria boolean, p_isaac_cancelado_confirmado boolean, p_cobranca_ids uuid[]) returns jsonb` — retorna `{ok: true}` ou `{ok: false, error: string}`, nunca lança exceção para o cliente HTTP (mesmo padrão de `importar_repasse_isaac`).

- [ ] **Step 1: Escrever a RPC**

```sql
-- supabase/migrations/202609240012_rpc_cancelar_matricula.sql
--
-- Cancela matrícula ativa no meio do ano: transação única, tudo ou nada.
-- Espelha o padrão de importar_repasse_isaac (security definer, retorna
-- jsonb com ok/error, nunca lança exceção pro cliente).

create or replace function cancelar_matricula(
  p_matricula_id uuid,
  p_data date,
  p_motivo text,
  p_obs text,
  p_ciente_coordenacao boolean,
  p_ciente_diretoria boolean,
  p_isaac_cancelado_confirmado boolean,
  p_cobranca_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil     perfis%rowtype;
  v_matricula  matriculas%rowtype;
begin
  select * into v_perfil from current_perfil();
  if v_perfil.id is null then
    return jsonb_build_object('ok', false, 'error', 'Sessão sem perfil ativo.');
  end if;

  select * into v_matricula
  from matriculas
  where id = p_matricula_id and escola_id = v_perfil.escola_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Matrícula não encontrada.');
  end if;

  if v_matricula.status <> 'ativa' then
    return jsonb_build_object('ok', false, 'error', 'Matrícula não está ativa.');
  end if;

  if not p_ciente_coordenacao or not p_ciente_diretoria then
    return jsonb_build_object('ok', false, 'error', 'Confirme ciência da coordenação e da diretoria.');
  end if;

  if p_motivo not in ('transferencia', 'desistencia', 'mudanca_cidade', 'inadimplencia', 'outro') then
    return jsonb_build_object('ok', false, 'error', 'Motivo inválido.');
  end if;

  update matriculas set
    status = 'cancelada',
    cancelamento_data = p_data,
    cancelamento_motivo = p_motivo,
    cancelamento_obs = p_obs,
    cancelado_por = v_perfil.id,
    ciente_coordenacao = p_ciente_coordenacao,
    ciente_diretoria = p_ciente_diretoria,
    isaac_cancelado_confirmado = p_isaac_cancelado_confirmado
  where id = p_matricula_id;

  -- Cancela só as cobranças explicitamente marcadas — nunca mexe em
  -- pagamentos já registrados (cobrança cancelada mantém seu histórico).
  if p_cobranca_ids is not null and array_length(p_cobranca_ids, 1) > 0 then
    update cobrancas set status = 'cancelada'
    where id = any(p_cobranca_ids)
      and escola_id = v_perfil.escola_id
      and aluno_id = v_matricula.aluno_id;
  end if;

  update alunos set ativo = false
  where id = v_matricula.aluno_id and escola_id = v_perfil.escola_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function cancelar_matricula(uuid, date, text, text, boolean, boolean, boolean, uuid[]) to authenticated;
```

- [ ] **Step 2: Aplicar local**

Run: `supabase db reset --local`
Expected: reset completo sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202609240012_rpc_cancelar_matricula.sql
git commit -m "feat(matriculas): rpc cancelar_matricula transacional"
```

---

### Task 3: Validação, data layer e Server Action de cancelamento

**Files:**
- Create: `src/lib/validation/cancelamento.ts`
- Create: `src/lib/data/cancelamento.ts`
- Create: `src/lib/actions/cancelamento.ts`
- Test: `src/lib/validation/cancelamento.test.ts`
- Test: `src/lib/actions/cancelamento.test.ts`

**Interfaces:**
- Produces:
  - `MOTIVOS_CANCELAMENTO = ["transferencia", "desistencia", "mudanca_cidade", "inadimplencia", "outro"] as const`
  - `CancelamentoMatriculaSchema` (zod): `{ matriculaId: string, data: string, motivo: (typeof MOTIVOS_CANCELAMENTO)[number], obs: string, cienteCoordenacao: boolean, cienteDiretoria: boolean, isaacCanceladoConfirmado: boolean | null, cobrancaIds: string[] }`, com `superRefine` exigindo `obs` não-vazia quando `motivo === "outro"`, e recusando `cienteCoordenacao`/`cienteDiretoria` false.
  - `listarCobrancasAbertasParaCancelamento(alunoId: string, dataCancelamento: string): Promise<{ id: string; descricao: string; competencia: string; valorFinal: number; dataVencimento: string; origem: "manual" | "isaac"; preSelecionada: boolean }[]>` em `src/lib/data/cancelamento.ts` — `preSelecionada` é `true` quando `dataVencimento > dataCancelamento`.
  - `cancelarMatriculaAction(formData: FormData): Promise<{ ok: boolean; error?: string }>` em `src/lib/actions/cancelamento.ts` — parseia FormData com o schema, chama `requirePermission("matriculas", "update")`, chama a RPC `cancelar_matricula`, `revalidatePath` em `/matriculas`, `/alunos/${alunoId}` e `/alunos/${alunoId}/editar`.

- [ ] **Step 1: Escrever o teste de validação (falha)**

```typescript
// src/lib/validation/cancelamento.test.ts
import { describe, it, expect } from "vitest";
import { CancelamentoMatriculaSchema } from "./cancelamento";

describe("CancelamentoMatriculaSchema", () => {
  const base = {
    matriculaId: "11111111-1111-1111-1111-111111111111",
    data: "2026-09-24",
    motivo: "transferencia" as const,
    obs: "",
    cienteCoordenacao: true,
    cienteDiretoria: true,
    isaacCanceladoConfirmado: null,
    cobrancaIds: [],
  };

  it("aceita motivo transferencia sem observacao", () => {
    expect(CancelamentoMatriculaSchema.safeParse(base).success).toBe(true);
  });

  it("recusa motivo outro sem observacao", () => {
    const result = CancelamentoMatriculaSchema.safeParse({ ...base, motivo: "outro", obs: "" });
    expect(result.success).toBe(false);
  });

  it("aceita motivo outro com observacao preenchida", () => {
    const result = CancelamentoMatriculaSchema.safeParse({ ...base, motivo: "outro", obs: "Pedido da família por escrito." });
    expect(result.success).toBe(true);
  });

  it("recusa sem ciencia da coordenacao", () => {
    const result = CancelamentoMatriculaSchema.safeParse({ ...base, cienteCoordenacao: false });
    expect(result.success).toBe(false);
  });

  it("recusa sem ciencia da diretoria", () => {
    const result = CancelamentoMatriculaSchema.safeParse({ ...base, cienteDiretoria: false });
    expect(result.success).toBe(false);
  });

  it("recusa motivo fora da lista fechada", () => {
    const result = CancelamentoMatriculaSchema.safeParse({ ...base, motivo: "capricho" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/validation/cancelamento.test.ts`
Expected: FAIL — módulo `./cancelamento` não existe.

- [ ] **Step 3: Implementar o schema**

```typescript
// src/lib/validation/cancelamento.ts
import { z } from "zod";

export const MOTIVOS_CANCELAMENTO = [
  "transferencia",
  "desistencia",
  "mudanca_cidade",
  "inadimplencia",
  "outro",
] as const;

export type MotivoCancelamento = (typeof MOTIVOS_CANCELAMENTO)[number];

export const MOTIVO_CANCELAMENTO_LABEL: Record<MotivoCancelamento, string> = {
  transferencia: "Transferência",
  desistencia: "Desistência",
  mudanca_cidade: "Mudança de cidade",
  inadimplencia: "Inadimplência",
  outro: "Outro",
};

export const CancelamentoMatriculaSchema = z
  .object({
    matriculaId: z.string().uuid(),
    data: z.string().min(1, "Informe a data do cancelamento."),
    motivo: z.enum(MOTIVOS_CANCELAMENTO),
    obs: z.string(),
    cienteCoordenacao: z.literal(true, {
      errorMap: () => ({ message: "Confirme ciência da coordenação." }),
    }),
    cienteDiretoria: z.literal(true, {
      errorMap: () => ({ message: "Confirme ciência da diretoria." }),
    }),
    isaacCanceladoConfirmado: z.boolean().nullable(),
    cobrancaIds: z.array(z.string().uuid()),
  })
  .superRefine((data, ctx) => {
    if (data.motivo === "outro" && data.obs.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Observação é obrigatória quando o motivo é \"Outro\".",
        path: ["obs"],
      });
    }
  });

export type CancelamentoMatriculaInput = z.infer<typeof CancelamentoMatriculaSchema>;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/validation/cancelamento.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Escrever data layer (sem teste dedicado — leitura simples, coberta pelo teste da action)**

```typescript
// src/lib/data/cancelamento.ts
import { createServerClient } from "@/lib/supabase/server";

export type CobrancaParaCancelamento = {
  id: string;
  descricao: string;
  competencia: string;
  valorFinal: number;
  dataVencimento: string;
  origem: "manual" | "isaac";
  preSelecionada: boolean;
};

/**
 * Cobranças em aberto/parciais do aluno, para o passo de selecionar quais
 * cancelar junto com a matrícula. Pré-marca as que vencem DEPOIS da data de
 * cancelamento (spec: "pré-marcadas as que vencem depois da data").
 */
export async function listarCobrancasAbertasParaCancelamento(
  alunoId: string,
  dataCancelamento: string
): Promise<CobrancaParaCancelamento[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cobrancas")
    .select("id, descricao, competencia, valor_final, data_vencimento, origem")
    .eq("aluno_id", alunoId)
    .in("status", ["aberta", "parcial"])
    .order("data_vencimento");

  if (error) throw new Error("Não foi possível carregar as cobranças do aluno.");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    descricao: row.descricao as string,
    competencia: row.competencia as string,
    valorFinal: row.valor_final as number,
    dataVencimento: row.data_vencimento as string,
    origem: row.origem as "manual" | "isaac",
    preSelecionada: (row.data_vencimento as string) > dataCancelamento,
  }));
}
```

- [ ] **Step 6: Escrever o teste da Server Action (falha)**

```typescript
// src/lib/actions/cancelamento.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePermissionMock, rpcMock, revalidatePathMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  rpcMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requirePermission: requirePermissionMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import { cancelarMatriculaAction } from "./cancelamento";

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    matriculaId: "11111111-1111-1111-1111-111111111111",
    alunoId: "22222222-2222-2222-2222-222222222222",
    data: "2026-09-24",
    motivo: "transferencia",
    obs: "",
    cienteCoordenacao: "on",
    cienteDiretoria: "on",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  requirePermissionMock.mockReset().mockResolvedValue({ profile: { id: "perfil-1", escola_id: "escola-1" } });
  rpcMock.mockReset();
  revalidatePathMock.mockReset();
});

describe("cancelarMatriculaAction", () => {
  it("chama a RPC com os campos mapeados e revalida as rotas", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await cancelarMatriculaAction(buildFormData());

    expect(result).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith("cancelar_matricula", expect.objectContaining({
      p_matricula_id: "11111111-1111-1111-1111-111111111111",
      p_motivo: "transferencia",
      p_ciente_coordenacao: true,
      p_ciente_diretoria: true,
    }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/matriculas");
    expect(revalidatePathMock).toHaveBeenCalledWith("/alunos/22222222-2222-2222-2222-222222222222");
  });

  it("recusa sem ciencia da coordenacao antes de chamar a RPC", async () => {
    const result = await cancelarMatriculaAction(buildFormData({ cienteCoordenacao: "" }));

    expect(result.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("recusa motivo outro sem observacao antes de chamar a RPC", async () => {
    const result = await cancelarMatriculaAction(buildFormData({ motivo: "outro", obs: "" }));

    expect(result.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("repassa o error retornado pela RPC", async () => {
    rpcMock.mockResolvedValue({ data: { ok: false, error: "Matrícula não está ativa." }, error: null });

    const result = await cancelarMatriculaAction(buildFormData());

    expect(result).toEqual({ ok: false, error: "Matrícula não está ativa." });
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/lib/actions/cancelamento.test.ts`
Expected: FAIL — módulo `./cancelamento` não existe.

- [ ] **Step 8: Implementar a Server Action**

```typescript
// src/lib/actions/cancelamento.ts
"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { CancelamentoMatriculaSchema } from "@/lib/validation/cancelamento";
import { formText, formBoolean } from "@/lib/utils";

export async function cancelarMatriculaAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requirePermission("matriculas", "update");

  const alunoId = formText(formData, "alunoId");
  const isaacRaw = formText(formData, "isaacCanceladoConfirmado");

  const parsed = CancelamentoMatriculaSchema.safeParse({
    matriculaId: formText(formData, "matriculaId"),
    data: formText(formData, "data"),
    motivo: formText(formData, "motivo"),
    obs: formText(formData, "obs") ?? "",
    cienteCoordenacao: formBoolean(formData, "cienteCoordenacao"),
    cienteDiretoria: formBoolean(formData, "cienteDiretoria"),
    isaacCanceladoConfirmado: isaacRaw === undefined || isaacRaw === "" ? null : isaacRaw === "on",
    cobrancaIds: formData.getAll("cobrancaIds").map(String),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("cancelar_matricula", {
    p_matricula_id: parsed.data.matriculaId,
    p_data: parsed.data.data,
    p_motivo: parsed.data.motivo,
    p_obs: parsed.data.obs || null,
    p_ciente_coordenacao: parsed.data.cienteCoordenacao,
    p_ciente_diretoria: parsed.data.cienteDiretoria,
    p_isaac_cancelado_confirmado: parsed.data.isaacCanceladoConfirmado,
    p_cobranca_ids: parsed.data.cobrancaIds,
  });

  if (error) return { ok: false, error: "Erro ao cancelar matrícula. Tente novamente." };
  const rpcResult = data as { ok: boolean; error?: string };
  if (!rpcResult.ok) return { ok: false, error: rpcResult.error };

  revalidatePath("/matriculas");
  if (alunoId) {
    revalidatePath(`/alunos/${alunoId}`);
    revalidatePath(`/alunos/${alunoId}/editar`);
  }
  return { ok: true };
}
```

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run src/lib/actions/cancelamento.test.ts src/lib/validation/cancelamento.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 10: Commit**

```bash
git add src/lib/validation/cancelamento.ts src/lib/validation/cancelamento.test.ts src/lib/data/cancelamento.ts src/lib/actions/cancelamento.ts src/lib/actions/cancelamento.test.ts
git commit -m "feat(matriculas): validacao, data layer e action de cancelamento"
```

---

### Task 4: Diálogo "Cancelar matrícula" (componente compartilhado)

**Files:**
- Create: `src/components/matriculas/cancelar-matricula-dialog.tsx`
- Create: `src/components/matriculas/cancelar-matricula-dialog.test.tsx`

**Interfaces:**
- Consumes: `cancelarMatriculaAction` (Task 3), `listarCobrancasAbertasParaCancelamento` (Task 3, chamada via um endpoint leve — ver Step 3), `MOTIVOS_CANCELAMENTO`/`MOTIVO_CANCELAMENTO_LABEL` (Task 3), `useConfirm` (`src/components/ui/confirm-dialog.tsx`).
- Produces: `<CancelarMatriculaDialog matriculaId={string} alunoId={string} alunoNome={string} serieNome={string} turmaNome={string} anoLetivo={number} temCobrancaIsaac={boolean} open={boolean} onOpenChange={(open: boolean) => void} onSuccess={() => void} />` — client component, usado tanto na ficha do aluno (Task 5) quanto na lista de matrículas (Task 6).

**Nota de design:** o diálogo é um form completo (data/motivo/obs/checkboxes/lista de cobranças), não um simples confirm — por isso é um componente próprio com seu próprio backdrop/modal, e usa `useConfirm` só para a confirmação final antes de submeter (conforme spec: "Confirmação final via `useConfirm`").

- [ ] **Step 1: Escrever o teste do componente**

```typescript
// src/components/matriculas/cancelar-matricula-dialog.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { cancelarMatriculaActionMock, useConfirmMock } = vi.hoisted(() => ({
  cancelarMatriculaActionMock: vi.fn(),
  useConfirmMock: vi.fn(),
}));

vi.mock("@/lib/actions/cancelamento", () => ({ cancelarMatriculaAction: cancelarMatriculaActionMock }));
vi.mock("@/components/ui/confirm-dialog", () => ({ useConfirm: () => useConfirmMock }));

import { CancelarMatriculaDialog } from "./cancelar-matricula-dialog";

beforeEach(() => {
  cancelarMatriculaActionMock.mockReset().mockResolvedValue({ ok: true });
  useConfirmMock.mockReset().mockResolvedValue(true);
});

function renderDialog(props: Partial<React.ComponentProps<typeof CancelarMatriculaDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  render(
    <CancelarMatriculaDialog
      matriculaId="11111111-1111-1111-1111-111111111111"
      alunoId="22222222-2222-2222-2222-222222222222"
      alunoNome="Ana Souza"
      serieNome="5º Ano"
      turmaNome="A"
      anoLetivo={2026}
      temCobrancaIsaac={false}
      open={true}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      {...props}
    />
  );
  return { onOpenChange, onSuccess };
}

describe("CancelarMatriculaDialog", () => {
  it("botao Confirmar comeca desabilitado sem os dois cientes marcados", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled();
  });

  it("habilita Confirmar so depois de marcar os dois switches obrigatorios", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText(/coordenação está ciente/i));
    fireEvent.click(screen.getByLabelText(/diretoria está ciente/i));
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeEnabled();
  });

  it("nao mostra switch do isaac quando temCobrancaIsaac é false", () => {
    renderDialog({ temCobrancaIsaac: false });
    expect(screen.queryByLabelText(/cancelada também no isaac/i)).not.toBeInTheDocument();
  });

  it("mostra switch do isaac quando temCobrancaIsaac é true", () => {
    renderDialog({ temCobrancaIsaac: true });
    expect(screen.getByLabelText(/cancelada também no isaac/i)).toBeInTheDocument();
  });

  it("chama a action e onSuccess apos confirmar com sucesso", async () => {
    const { onSuccess } = renderDialog();
    fireEvent.click(screen.getByLabelText(/coordenação está ciente/i));
    fireEvent.click(screen.getByLabelText(/diretoria está ciente/i));
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(cancelarMatriculaActionMock).toHaveBeenCalled());
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("nao chama a action quando useConfirm resolve false", async () => {
    useConfirmMock.mockResolvedValue(false);
    renderDialog();
    fireEvent.click(screen.getByLabelText(/coordenação está ciente/i));
    fireEvent.click(screen.getByLabelText(/diretoria está ciente/i));
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

    await waitFor(() => expect(useConfirmMock).toHaveBeenCalled());
    expect(cancelarMatriculaActionMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/matriculas/cancelar-matricula-dialog.test.tsx`
Expected: FAIL — módulo `./cancelar-matricula-dialog` não existe.

- [ ] **Step 3: Implementar o componente**

```tsx
// src/components/matriculas/cancelar-matricula-dialog.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cancelarMatriculaAction } from "@/lib/actions/cancelamento";
import { MOTIVOS_CANCELAMENTO, MOTIVO_CANCELAMENTO_LABEL, type MotivoCancelamento } from "@/lib/validation/cancelamento";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { CobrancaParaCancelamento } from "@/lib/data/cancelamento";

type Props = {
  matriculaId: string;
  alunoId: string;
  alunoNome: string;
  serieNome: string;
  turmaNome: string;
  anoLetivo: number;
  temCobrancaIsaac: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function CancelarMatriculaDialog({
  matriculaId,
  alunoId,
  alunoNome,
  serieNome,
  turmaNome,
  anoLetivo,
  temCobrancaIsaac,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const confirm = useConfirm();
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState<MotivoCancelamento>("transferencia");
  const [obs, setObs] = useState("");
  const [cienteCoordenacao, setCienteCoordenacao] = useState(false);
  const [cienteDiretoria, setCienteDiretoria] = useState(false);
  const [isaacConfirmado, setIsaacConfirmado] = useState(false);
  const [cobrancas, setCobrancas] = useState<CobrancaParaCancelamento[]>([]);
  const [cobrancaIdsSelecionadas, setCobrancaIdsSelecionadas] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Recarrega a lista de cobranças toda vez que o diálogo abre ou a data muda —
  // a pré-seleção depende da data de cancelamento escolhida.
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    fetch(`/api/cancelamento/cobrancas?aluno_id=${alunoId}&data=${data}`)
      .then((r) => r.json())
      .then((rows: CobrancaParaCancelamento[]) => {
        if (cancelado) return;
        setCobrancas(rows);
        setCobrancaIdsSelecionadas(new Set(rows.filter((r) => r.preSelecionada).map((r) => r.id)));
      });
    return () => {
      cancelado = true;
    };
  }, [open, alunoId, data]);

  if (!open || typeof window === "undefined") return null;

  const obsObrigatoria = motivo === "outro";
  const podeConfirmar = cienteCoordenacao && cienteDiretoria && (!obsObrigatoria || obs.trim().length > 0);

  function toggleCobranca(id: string) {
    setCobrancaIdsSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmar() {
    const ok = await confirm({
      title: "Cancelar matrícula",
      message: `Confirma o cancelamento da matrícula de "${alunoNome}"? Esta ação inativa o aluno.`,
      confirmLabel: "Cancelar matrícula",
      variant: "danger",
    });
    if (!ok) return;

    setSubmitting(true);
    setErro(null);
    const fd = new FormData();
    fd.set("matriculaId", matriculaId);
    fd.set("alunoId", alunoId);
    fd.set("data", data);
    fd.set("motivo", motivo);
    fd.set("obs", obs);
    if (cienteCoordenacao) fd.set("cienteCoordenacao", "on");
    if (cienteDiretoria) fd.set("cienteDiretoria", "on");
    if (temCobrancaIsaac) fd.set("isaacCanceladoConfirmado", isaacConfirmado ? "on" : "");
    for (const id of cobrancaIdsSelecionadas) fd.append("cobrancaIds", id);

    const result = await cancelarMatriculaAction(fd);
    setSubmitting(false);
    if (!result.ok) {
      setErro(result.error ?? "Erro ao cancelar matrícula.");
      return;
    }
    onOpenChange(false);
    onSuccess();
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg rounded-[10px] border border-line bg-surface p-6 shadow-lift">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-ink/40 hover:bg-muted hover:text-ink"
          aria-label="Fechar"
        >
          <X size={14} />
        </button>

        <p className="text-sm font-semibold text-ink">Cancelar matrícula</p>
        <p className="mt-1 text-sm text-ink/70">
          {alunoNome} — {serieNome} {turmaNome} — {anoLetivo}
        </p>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            Data do cancelamento
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="ds-input"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Motivo
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoCancelamento)} className="ds-input">
              {MOTIVOS_CANCELAMENTO.map((m) => (
                <option key={m} value={m}>{MOTIVO_CANCELAMENTO_LABEL[m]}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            Observação {obsObrigatoria ? "(obrigatória)" : "(opcional)"}
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} className="ds-input" rows={2} />
          </label>

          {cobrancas.length > 0 ? (
            <div className="grid gap-1 text-sm">
              <p className="font-medium text-ink">Cobranças em aberto</p>
              {cobrancas.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={cobrancaIdsSelecionadas.has(c.id)}
                    onChange={() => toggleCobranca(c.id)}
                  />
                  <span className="flex-1">{c.descricao} — {c.competencia} — R$ {c.valorFinal.toFixed(2)}</span>
                  {c.origem === "isaac" ? <span className="ds-badge">isaac</span> : null}
                </label>
              ))}
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cienteCoordenacao} onChange={(e) => setCienteCoordenacao(e.target.checked)} />
            A coordenação está ciente desse cancelamento de matrícula?
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cienteDiretoria} onChange={(e) => setCienteDiretoria(e.target.checked)} />
            A diretoria está ciente desse cancelamento de matrícula?
          </label>

          {temCobrancaIsaac ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isaacConfirmado} onChange={(e) => setIsaacConfirmado(e.target.checked)} />
              Cancelada também no isaac?
            </label>
          ) : null}

          {erro ? <p className="text-sm text-danger">{erro}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="ds-button ds-button-secondary text-xs">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!podeConfirmar || submitting}
            onClick={handleConfirmar}
            className="ds-button text-xs bg-danger text-white hover:bg-danger/90 disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/matriculas/cancelar-matricula-dialog.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/matriculas/cancelar-matricula-dialog.tsx src/components/matriculas/cancelar-matricula-dialog.test.tsx
git commit -m "feat(matriculas): dialogo compartilhado de cancelamento de matricula"
```

---

### Task 5: Rota de API para cobranças do diálogo + botão na ficha do aluno

**Files:**
- Create: `src/app/api/cancelamento/cobrancas/route.ts`
- Modify: `src/components/students/student-header-actions.tsx`
- Modify: `src/app/(app)/alunos/[id]/page.tsx:14-21` (passar `matriculaAtiva` completo, incluindo série/turma/ano, para o header)
- Test: `src/app/api/cancelamento/cobrancas/route.test.ts`

**Interfaces:**
- Consumes: `listarCobrancasAbertasParaCancelamento` (Task 3), `requirePermission` (`src/lib/auth/session.ts`), `CancelarMatriculaDialog` (Task 4).
- Produces: `GET /api/cancelamento/cobrancas?aluno_id=<uuid>&data=<yyyy-mm-dd>` retorna `CobrancaParaCancelamento[]` como JSON.

- [ ] **Step 1: Escrever o teste da rota**

```typescript
// src/app/api/cancelamento/cobrancas/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePermissionMock, listarMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  listarMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/lib/data/cancelamento", () => ({ listarCobrancasAbertasParaCancelamento: listarMock }));

import { GET } from "./route";

beforeEach(() => {
  requirePermissionMock.mockReset().mockResolvedValue({});
  listarMock.mockReset().mockResolvedValue([{ id: "c1", descricao: "Mensalidade", competencia: "2026-09", valorFinal: 500, dataVencimento: "2026-10-05", origem: "manual", preSelecionada: true }]);
});

describe("GET /api/cancelamento/cobrancas", () => {
  it("retorna as cobrancas do aluno", async () => {
    const req = new Request("http://localhost/api/cancelamento/cobrancas?aluno_id=aluno-1&data=2026-09-24");
    const res = await GET(req);
    const body = await res.json();

    expect(listarMock).toHaveBeenCalledWith("aluno-1", "2026-09-24");
    expect(body).toHaveLength(1);
  });

  it("retorna 400 sem aluno_id", async () => {
    const req = new Request("http://localhost/api/cancelamento/cobrancas?data=2026-09-24");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/api/cancelamento/cobrancas/route.test.ts`
Expected: FAIL — módulo `./route` não existe.

- [ ] **Step 3: Implementar a rota**

```typescript
// src/app/api/cancelamento/cobrancas/route.ts
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { listarCobrancasAbertasParaCancelamento } from "@/lib/data/cancelamento";

export async function GET(request: Request) {
  await requirePermission("matriculas", "update");

  const url = new URL(request.url);
  const alunoId = url.searchParams.get("aluno_id");
  const data = url.searchParams.get("data");
  if (!alunoId || !data) {
    return NextResponse.json({ error: "aluno_id e data são obrigatórios." }, { status: 400 });
  }

  const cobrancas = await listarCobrancasAbertasParaCancelamento(alunoId, data);
  return NextResponse.json(cobrancas);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/app/api/cancelamento/cobrancas/route.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Adicionar o botão na ficha do aluno**

Ler `src/app/(app)/alunos/[id]/page.tsx:17-21` — hoje `matriculaAtivaPayload` só carrega `{id, codigo}`. Estender para incluir série/turma/ano (já disponíveis em `activeEnrollment`), e passar para `StudentHeaderActions`:

```typescript
// src/app/(app)/alunos/[id]/page.tsx — trecho substituído (linhas 18-21)
  const matriculaAtivaForDocs = student.matriculas.find((m) => m.status === "ativa") ?? null;
  const matriculaAtivaPayload = matriculaAtivaForDocs
    ? {
        id: matriculaAtivaForDocs.id,
        codigo: matriculaAtivaForDocs.codigo ?? null,
        serieNome: matriculaAtivaForDocs.series?.nome ?? "",
        turmaNome: matriculaAtivaForDocs.turmas?.nome ?? "",
        anoLetivo: matriculaAtivaForDocs.ano_letivo,
      }
    : null;
```

```tsx
// src/components/students/student-header-actions.tsx — reescrito
"use client";

import { useState } from "react";
import { XCircle, FileOutput } from "lucide-react";
import { exportStudentPdf } from "@/components/pdf/export-student-button";
import { QuickDocumentActions } from "@/components/students/quick-document-actions";
import { CancelarMatriculaDialog } from "@/components/matriculas/cancelar-matricula-dialog";
import { ButtonLink } from "@/components/ui/button";
import type { StudentSheet } from "@/lib/types";

type MatriculaAtiva = { id: string; codigo: string | null; serieNome: string; turmaNome: string; anoLetivo: number };
type TemplateLite = { id: string; nome: string; categoria?: string | null };

export function StudentHeaderActions({
  student,
  matriculaAtiva,
  templates,
}: {
  student: StudentSheet;
  matriculaAtiva: MatriculaAtiva | null;
  templates: TemplateLite[];
}) {
  const [dialogAberto, setDialogAberto] = useState(false);

  return (
    <>
      <QuickDocumentActions
        matriculaAtiva={matriculaAtiva}
        templates={templates}
        onExportFichaPdf={() => exportStudentPdf(student)}
      />
      {matriculaAtiva ? (
        <button
          type="button"
          onClick={() => setDialogAberto(true)}
          className="ds-button ds-button-secondary text-xs text-danger"
        >
          <XCircle size={14} /> Cancelar Matrícula
        </button>
      ) : null}
      {matriculaAtiva ? (
        <CancelarMatriculaDialog
          matriculaId={matriculaAtiva.id}
          alunoId={student.id}
          alunoNome={student.nome}
          serieNome={matriculaAtiva.serieNome}
          turmaNome={matriculaAtiva.turmaNome}
          anoLetivo={matriculaAtiva.anoLetivo}
          temCobrancaIsaac={false}
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          onSuccess={() => window.location.reload()}
        />
      ) : null}
    </>
  );
}
```

Nota: `temCobrancaIsaac` fixo em `false` aqui é intencional para esta task — o switch fica escondido até a Task 4/5 saberem se o aluno tem cobrança isaac; refinar isso exigiria buscar cobranças antes de abrir o diálogo, o que já acontece dentro do próprio diálogo (Step 3 da Task 4, `useEffect`). Ajuste: o diálogo já sabe quais cobranças existem via seu próprio fetch — deriva `temCobrancaIsaac` internamente a partir de `cobrancas.some(c => c.origem === "isaac")` em vez de receber por prop. **Correção aplicada nesta mesma task**: remover a prop `temCobrancaIsaac` da interface pública do diálogo (Task 4) e computar internamente.

- [ ] **Step 6: Ajustar `CancelarMatriculaDialog` para computar `temCobrancaIsaac` internamente**

Em `src/components/matriculas/cancelar-matricula-dialog.tsx` (Task 4), remover a prop `temCobrancaIsaac` de `Props` e da chamada em `StudentHeaderActions`, e substituir a condição de exibição do switch por:

```typescript
const temCobrancaIsaac = cobrancas.some((c) => c.origem === "isaac");
```

Atualizar o teste da Task 4 (`cancelar-matricula-dialog.test.tsx`) para não passar `temCobrancaIsaac` e, nos dois testes que hoje o setam via prop, mockar o `fetch` global para retornar cobranças com/sem `origem: "isaac"` em vez de passar a prop diretamente.

- [ ] **Step 7: Rodar toda a suíte afetada**

Run: `npx vitest run src/components/matriculas src/app/api/cancelamento src/components/students`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/cancelamento/cobrancas/route.ts src/app/api/cancelamento/cobrancas/route.test.ts src/components/students/student-header-actions.tsx "src/app/(app)/alunos/[id]/page.tsx" src/components/matriculas/cancelar-matricula-dialog.tsx src/components/matriculas/cancelar-matricula-dialog.test.tsx
git commit -m "feat(alunos): botao Cancelar Matricula na ficha do aluno"
```

---

### Task 6: Botão na lista/grid de matrículas

**Files:**
- Modify: `src/components/matriculas/matriculas-table.tsx`

**Interfaces:**
- Consumes: `CancelarMatriculaDialog` (Task 4/5).

- [ ] **Step 1: Ler o arquivo atual**

Ler `src/components/matriculas/matriculas-table.tsx` inteiro antes de editar — já usa `toggleEnrollmentStatusAction` (grep confirmou em Task 0 de investigação) para o ícone atual de ativar/cancelar por linha. Localizar essa linha de ação.

- [ ] **Step 2: Substituir a ação de cancelamento rápido pelo diálogo completo**

Adicionar estado local `matriculaParaCancelar: { id: string; alunoId: string; alunoNome: string; serieNome: string; turmaNome: string; anoLetivo: number } | null` no componente da tabela (client component — verificar `"use client"` no topo do arquivo antes de adicionar `useState`). Trocar o botão que hoje chama `toggleEnrollmentStatusAction` com `status=cancelada` para abrir o diálogo em vez de togglar direto:

```tsx
// dentro do componente da tabela, substituindo o botao de cancelar por linha
<button
  type="button"
  onClick={() => setMatriculaParaCancelar({
    id: matricula.id,
    alunoId: matricula.aluno_id,
    alunoNome: matricula.alunos?.nome ?? "",
    serieNome: matricula.series?.nome ?? "",
    turmaNome: matricula.turmas?.nome ?? "",
    anoLetivo: matricula.ano_letivo,
  })}
  title="Cancelar matrícula"
  aria-label="Cancelar matrícula"
  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-danger hover:bg-danger/10"
>
  <XCircle size={15} />
</button>
```

E no final do JSX da tabela (fora do `<table>`, como irmão):

```tsx
{matriculaParaCancelar ? (
  <CancelarMatriculaDialog
    matriculaId={matriculaParaCancelar.id}
    alunoId={matriculaParaCancelar.alunoId}
    alunoNome={matriculaParaCancelar.alunoNome}
    serieNome={matriculaParaCancelar.serieNome}
    turmaNome={matriculaParaCancelar.turmaNome}
    anoLetivo={matriculaParaCancelar.anoLetivo}
    open={true}
    onOpenChange={(open) => { if (!open) setMatriculaParaCancelar(null); }}
    onSuccess={() => { setMatriculaParaCancelar(null); router.refresh(); }}
  />
) : null}
```

Se a tabela não for `"use client"`, adicionar a diretiva no topo (necessário para `useState`) — verificar primeiro se já é client component antes de assumir.

- [ ] **Step 3: `npm run typecheck`**

Run: `npm run typecheck`
Expected: sem erros novos relacionados a este arquivo.

- [ ] **Step 4: Commit**

```bash
git add src/components/matriculas/matriculas-table.tsx
git commit -m "feat(matriculas): botao Cancelar Matricula na lista de matriculas"
```

---

### Task 7: Trava de importação isaac — `decidirPendencia` recusa parcela de aluno cancelado

**Files:**
- Modify: `src/lib/isaac/preparar-importacao.ts:16-141`
- Modify: `src/lib/data/isaac.ts` (buscar dado de cancelamento junto do cadastro de alunos)
- Test: `src/lib/isaac/preparar-importacao.test.ts`

**Interfaces:**
- Consumes: `matriculas.cancelamento_data` (Task 1).
- Produces: `AlunoCadastro` ganha campo `matriculaCanceladaEm: string | null` (data de cancelamento da matrícula do ano corrente, ou `null` se não houver cancelamento); `MotivoPendencia` ganha `"aluno_cancelado"`; `decidirPendencia` recusa parcela de mensalidade cuja `competencia` seja posterior a `matriculaCanceladaEm`.

- [ ] **Step 1: Escrever o teste (falha)**

```typescript
// adicionar em src/lib/isaac/preparar-importacao.test.ts (arquivo já existe — Task 7 só acrescenta casos)
import { describe, it, expect } from "vitest";
import { decidirPendencia } from "./preparar-importacao";
import type { AlunoCadastro } from "./preparar-importacao";
import type { ParcelaAnalitico } from "./parse-analitico";

function parcela(overrides: Partial<ParcelaAnalitico> = {}): ParcelaAnalitico {
  return {
    idParcela: "p1",
    nomeIsaac: "ANA SOUZA",
    produto: "Mensalidade",
    tipo: "mensalidade",
    competencia: "2026-10",
    valorMensalidade: 500,
    valorMudanca: 0,
    valorBase: 500,
    taxa: 36.5,
    valorFinal: 463.5,
    tipoMudanca: null,
    ...overrides,
  } as ParcelaAnalitico;
}

function aluno(overrides: Partial<AlunoCadastro> = {}): AlunoCadastro {
  return {
    id: "aluno-1",
    nomeNormalizado: "ana souza",
    tipoVaga: "NORMAL",
    valorMensalidadePraticado: 500,
    matriculaCanceladaEm: null,
    ...overrides,
  };
}

describe("decidirPendencia — aluno_cancelado", () => {
  it("recusa mensalidade com competencia posterior ao cancelamento", () => {
    const motivo = decidirPendencia(parcela({ competencia: "2026-10" }), aluno({ matriculaCanceladaEm: "2026-09-15" }));
    expect(motivo).toBe("aluno_cancelado");
  });

  it("aceita mensalidade com competencia anterior ao cancelamento", () => {
    const motivo = decidirPendencia(parcela({ competencia: "2026-09" }), aluno({ matriculaCanceladaEm: "2026-09-15" }));
    expect(motivo).toBeNull();
  });

  it("nao afeta aluno sem cancelamento", () => {
    const motivo = decidirPendencia(parcela({ competencia: "2026-10" }), aluno({ matriculaCanceladaEm: null }));
    expect(motivo).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/isaac/preparar-importacao.test.ts`
Expected: FAIL — `AlunoCadastro` não tem `matriculaCanceladaEm`, `decidirPendencia` não trata `aluno_cancelado`, tipo `MotivoPendencia` não inclui o valor.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/isaac/preparar-importacao.ts — edições

// linha 25, substituir:
export type MotivoPendencia = "sem_aluno" | "tipo_vaga_incompativel" | "permuta_manual" | "aluno_cancelado";

// linhas 44-50, substituir o tipo AlunoCadastro:
export type AlunoCadastro = {
  id: string;
  /** Já normalizado com `normalizarNomeIsaac` — os dois lados têm que usar a mesma função. */
  nomeNormalizado: string;
  tipoVaga: TipoVaga | null;
  valorMensalidadePraticado: number | null;
  /** Data (YYYY-MM-DD) do cancelamento da matrícula do ano corrente, ou null se ativa/sem cancelamento. */
  matriculaCanceladaEm: string | null;
};

// dentro de decidirPendencia (linha ~120), adicionar checagem antes do retorno final:
export function decidirPendencia(
  parcela: ParcelaAnalitico,
  aluno: AlunoCadastro | null,
): MotivoPendencia | null {
  if (aluno === null) return "sem_aluno";
  if (parcela.tipo !== "mensalidade") return null;
  if (parcela.valorBase <= 0) return null;

  // Competencia é "YYYY-MM"; cancelamento_data é "YYYY-MM-DD". Compara por
  // prefixo de mes: competencia posterior ao mes do cancelamento nao gera
  // cobranca — a escola nao deveria mais receber por esse aluno.
  if (aluno.matriculaCanceladaEm && parcela.competencia > aluno.matriculaCanceladaEm.slice(0, 7)) {
    return "aluno_cancelado";
  }

  const tipoVaga = aluno.tipoVaga ?? "NORMAL";

  if (tipoVaga === "PERMUTA") return "permuta_manual";
  if (SEM_MENSALIDADE_NO_ISAAC.has(tipoVaga)) return "tipo_vaga_incompativel";

  return null;
}
```

Localizar em `src/lib/data/isaac.ts` a função que monta `AlunoCadastro[]` (busca em `alunos` para casamento de nomes) e estender a query para trazer `matriculas.cancelamento_data` da matrícula do ano corrente, mapeando para `matriculaCanceladaEm`. Ler o arquivo inteiro antes de editar — a query exata depende do formato hoje usado (join com `matriculas`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/isaac/preparar-importacao.test.ts`
Expected: PASS (todos os testes, incluindo os 3 novos e os pré-existentes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/isaac/preparar-importacao.ts src/lib/isaac/preparar-importacao.test.ts src/lib/data/isaac.ts
git commit -m "feat(isaac): trava parcela de aluno cancelado com competencia posterior"
```

---

### Task 8: Relatório "Saídas do ano"

**Files:**
- Create: `src/lib/data/saidas-ano.ts`
- Create: `src/app/(app)/matriculas/saidas/page.tsx`
- Modify: `src/lib/auth/permissions.ts` (rota nova → módulo `matriculas`)
- Modify: `src/components/layout/topbar.tsx` (link no menu, dentro do grupo Acadêmico/Secretaria — seguir padrão do link de `/matriculas` já existente)
- Test: `src/lib/data/saidas-ano.test.ts`

**Interfaces:**
- Consumes: colunas de cancelamento (Task 1), `MOTIVO_CANCELAMENTO_LABEL` (Task 3).
- Produces: `listarSaidasDoAno(anoLetivo: number): Promise<{ id: string; alunoNome: string; serieNome: string; turmaNome: string; motivo: string; motivoLabel: string; data: string; cienteCoordenacao: boolean; cienteDiretoria: boolean }[]>`.

- [ ] **Step 1: Escrever o teste (falha)**

```typescript
// src/lib/data/saidas-ano.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(async () => ({ from: fromMock })) }));

import { listarSaidasDoAno } from "./saidas-ano";

beforeEach(() => {
  fromMock.mockReset();
});

describe("listarSaidasDoAno", () => {
  it("filtra por ano letivo e cancelamento_data preenchida", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: "m1",
        cancelamento_motivo: "transferencia",
        cancelamento_data: "2026-04-10",
        ciente_coordenacao: true,
        ciente_diretoria: true,
        alunos: { nome: "Ana Souza" },
        series: { nome: "5º Ano" },
        turmas: { nome: "A" },
      }],
      error: null,
    });
    const not = vi.fn().mockReturnValue({ order });
    const eq2 = vi.fn().mockReturnValue({ not });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    fromMock.mockReturnValue({ select });

    const result = await listarSaidasDoAno(2026);

    expect(select).toHaveBeenCalled();
    expect(eq1).toHaveBeenCalledWith("ano_letivo", 2026);
    expect(eq2).toHaveBeenCalledWith("status", "cancelada");
    expect(not).toHaveBeenCalledWith("cancelamento_data", "is", null);
    expect(result).toEqual([{
      id: "m1",
      alunoNome: "Ana Souza",
      serieNome: "5º Ano",
      turmaNome: "A",
      motivo: "transferencia",
      motivoLabel: "Transferência",
      data: "2026-04-10",
      cienteCoordenacao: true,
      cienteDiretoria: true,
    }]);
  });

  it("nao inclui matricula concluida sem cancelamento_data (nao renovacao)", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const not = vi.fn().mockReturnValue({ order });
    const eq2 = vi.fn().mockReturnValue({ not });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    fromMock.mockReturnValue({ select });

    const result = await listarSaidasDoAno(2026);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/data/saidas-ano.test.ts`
Expected: FAIL — módulo `./saidas-ano` não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/data/saidas-ano.ts
import { createServerClient } from "@/lib/supabase/server";
import { MOTIVO_CANCELAMENTO_LABEL, type MotivoCancelamento } from "@/lib/validation/cancelamento";

export type SaidaAno = {
  id: string;
  alunoNome: string;
  serieNome: string;
  turmaNome: string;
  motivo: string;
  motivoLabel: string;
  data: string;
  cienteCoordenacao: boolean;
  cienteDiretoria: boolean;
};

/**
 * Matrículas canceladas no meio do ano (evento 2) — nunca inclui quem só
 * não renovou (evento 1, sem cancelamento_data). Ver seção "Dois eventos
 * diferentes" da spec.
 */
export async function listarSaidasDoAno(anoLetivo: number): Promise<SaidaAno[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("matriculas")
    .select("id, cancelamento_motivo, cancelamento_data, ciente_coordenacao, ciente_diretoria, alunos(nome), series(nome), turmas(nome)")
    .eq("ano_letivo", anoLetivo)
    .eq("status", "cancelada")
    .not("cancelamento_data", "is", null)
    .order("cancelamento_data", { ascending: false });

  if (error) throw new Error("Não foi possível carregar as saídas do ano.");

  return (data ?? []).map((row: Record<string, unknown>) => {
    const motivo = row.cancelamento_motivo as MotivoCancelamento;
    return {
      id: row.id as string,
      alunoNome: (row.alunos as { nome: string })?.nome ?? "",
      serieNome: (row.series as { nome: string })?.nome ?? "",
      turmaNome: (row.turmas as { nome: string })?.nome ?? "",
      motivo,
      motivoLabel: MOTIVO_CANCELAMENTO_LABEL[motivo] ?? motivo,
      data: row.cancelamento_data as string,
      cienteCoordenacao: row.ciente_coordenacao as boolean,
      cienteDiretoria: row.ciente_diretoria as boolean,
    };
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/data/saidas-ano.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Criar a page**

```tsx
// src/app/(app)/matriculas/saidas/page.tsx
import { requirePermission } from "@/lib/auth/session";
import { listarSaidasDoAno } from "@/lib/data/saidas-ano";
import { Badge } from "@/components/ui/badge";

export default async function SaidasAnoPage({ searchParams }: { searchParams: { ano?: string } }) {
  await requirePermission("matriculas", "read");
  const anoLetivo = searchParams.ano ? parseInt(searchParams.ano, 10) : new Date().getFullYear();
  const saidas = await listarSaidasDoAno(anoLetivo);

  const contagemPorMotivo = saidas.reduce<Record<string, number>>((acc, s) => {
    acc[s.motivoLabel] = (acc[s.motivoLabel] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-6 p-6">
      <header>
        <p className="ds-kicker">Acadêmico / Matrículas</p>
        <h1 className="font-display text-3xl text-ink">Saídas do ano — {anoLetivo}</h1>
        <p className="mt-2 text-sm text-muted">
          {Object.entries(contagemPorMotivo).map(([label, n]) => `${n} ${label.toLowerCase()}`).join(", ") || "Nenhuma saída registrada."}
        </p>
      </header>

      <table className="ds-table">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Série/Turma</th>
            <th>Motivo</th>
            <th>Data</th>
            <th>Ciente coordenação</th>
            <th>Ciente diretoria</th>
          </tr>
        </thead>
        <tbody>
          {saidas.map((s) => (
            <tr key={s.id}>
              <td>{s.alunoNome}</td>
              <td>{s.serieNome} {s.turmaNome}</td>
              <td>{s.motivoLabel}</td>
              <td>{s.data}</td>
              <td>{s.cienteCoordenacao ? <Badge tone="green">✓</Badge> : "—"}</td>
              <td>{s.cienteDiretoria ? <Badge tone="green">✓</Badge> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Registrar a rota no RBAC**

Ler `src/lib/auth/permissions.ts` em torno da linha 141 (`"/matriculas": "matriculas"`) e adicionar logo abaixo:

```typescript
"/matriculas/saidas": "matriculas",
```

- [ ] **Step 7: Adicionar link no menu**

Ler `src/components/layout/topbar.tsx`, localizar o array que já lista o link de `/matriculas`, e adicionar um item irmão "Saídas do ano" apontando para `/matriculas/saidas`, seguindo exatamente o mesmo formato de objeto dos itens vizinhos (não inventar um shape novo).

- [ ] **Step 8: `npm run typecheck`**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/saidas-ano.ts src/lib/data/saidas-ano.test.ts "src/app/(app)/matriculas/saidas/page.tsx" src/lib/auth/permissions.ts src/components/layout/topbar.tsx
git commit -m "feat(matriculas): relatorio de saidas do ano"
```

---

### Task 9: Botão "Emitir Declaração de Transferência" após cancelamento

**Files:**
- Modify: `src/components/matriculas/cancelar-matricula-dialog.tsx` (adicionar estado pós-sucesso)
- Test: `src/components/matriculas/cancelar-matricula-dialog.test.tsx` (acrescentar caso)

**Interfaces:**
- Consumes: rota `/declaracoes/emitir` (frente Declarações Pedagógicas, já mergeada neste worktree via `worktree-declaracoes-pedagogicas`), que aceita `?aluno=` e `?modelo=` como query params — **verificar a assinatura exata lendo `src/app/(app)/declaracoes/emitir/page.tsx` antes de montar a URL, nesta task, porque o parâmetro pode se chamar diferente**.

- [ ] **Step 1: Ler a página de emissão para confirmar os query params aceitos**

Ler `src/app/(app)/declaracoes/emitir/page.tsx` (existe no worktree — veio do merge da frente 2) e `src/components/declaracoes/declaracao-emissao-form.tsx` para confirmar exatamente quais `searchParams` a tela já lê (ex.: `?aluno=`, `?ano=`) e se aceita pré-selecionar um modelo por código/id via query string. Se não aceitar pré-seleção de modelo, o link abre só com aluno pré-selecionado — não adicionar um parâmetro novo que a tela não lê (YAGNI: a spec pede "aluno e modelo pré-selecionados", mas se o suporte a modelo não existir ainda, documentar como gap conhecido em vez de inventar um contrato que a tela não implementa).

- [ ] **Step 2: Adicionar o teste do estado pós-sucesso**

```typescript
// acrescentar em src/components/matriculas/cancelar-matricula-dialog.test.tsx
it("mostra link para emitir declaracao apos cancelar com sucesso", async () => {
  renderDialog();
  fireEvent.click(screen.getByLabelText(/coordenação está ciente/i));
  fireEvent.click(screen.getByLabelText(/diretoria está ciente/i));
  fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));

  await waitFor(() => expect(screen.getByRole("link", { name: /emitir declaração/i })).toBeInTheDocument());
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/components/matriculas/cancelar-matricula-dialog.test.tsx`
Expected: FAIL — link ainda não existe.

- [ ] **Step 4: Implementar o estado pós-sucesso**

Em `cancelar-matricula-dialog.tsx`, adicionar `const [sucesso, setSucesso] = useState(false)`. Em `handleConfirmar`, ao invés de fechar o diálogo direto no sucesso, setar `setSucesso(true)` e manter o diálogo aberto mostrando um link substituindo o form:

```tsx
{sucesso ? (
  <div className="grid gap-3">
    <p className="text-sm text-ink">Matrícula cancelada com sucesso.</p>
    <a
      href={`/declaracoes/emitir?aluno=${alunoId}`}
      className="ds-button ds-button-primary text-xs w-fit"
    >
      Emitir Declaração de Transferência — Não Concluído
    </a>
    <button type="button" onClick={() => { onOpenChange(false); onSuccess(); }} className="ds-button ds-button-secondary text-xs w-fit">
      Fechar
    </button>
  </div>
) : (
  /* form existente, inalterado */
)}
```

Ajustar `handleConfirmar` para não chamar `onOpenChange(false)`/`onSuccess()` diretamente no sucesso — só `setSucesso(true)`; `onSuccess` (que hoje faz `router.refresh()`/recarrega a lista) passa a ser chamado só quando a pessoa clicar "Fechar".

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/components/matriculas/cancelar-matricula-dialog.test.tsx`
Expected: PASS (7 testes).

- [ ] **Step 6: Commit**

```bash
git add src/components/matriculas/cancelar-matricula-dialog.tsx src/components/matriculas/cancelar-matricula-dialog.test.tsx
git commit -m "feat(matriculas): link para emitir declaracao de transferencia apos cancelamento"
```

---

### Task 10: Selo "Cancelado — {ano}" e aviso de cobrança pendente na ficha do aluno

**Files:**
- Modify: `src/lib/data/students.ts` (`getStudentSheet` — incluir campos de cancelamento na query de matrículas)
- Modify: `src/components/students/student-sheet.tsx` (ou onde o status da matrícula é exibido — ler antes de editar)
- Test: `src/lib/data/students.test.ts` (se já existir; senão, cobrir via teste de componente do selo)

**Interfaces:**
- Consumes: `matriculas.cancelamento_data`/`cancelamento_motivo` (Task 1), `MOTIVO_CANCELAMENTO_LABEL` (Task 3), `listarCobrancasAbertasParaCancelamento` (Task 3, reaproveitada para checar cobrança pendente pós-cancelamento).

- [ ] **Step 1: Ler os arquivos atuais**

Ler `src/lib/data/students.ts` (função `getStudentSheet`, já parcialmente lida na investigação — conferir a query completa de `matriculas` dentro dela) e `src/components/students/student-sheet.tsx` para localizar onde o `Badge` de status da matrícula já é renderizado (mesmo padrão do `activeEnrollment.status` visto em `src/app/(app)/alunos/[id]/page.tsx:44`).

- [ ] **Step 2: Estender a query de `getStudentSheet` com os campos de cancelamento**

Adicionar `cancelamento_data, cancelamento_motivo` à seleção de `matriculas` dentro de `getStudentSheet` (mesma tabela já selecionada, só mais colunas — não é join novo).

- [ ] **Step 3: Escrever o teste do selo (componente ou snapshot simples)**

```typescript
// acrescentar em src/components/students/student-sheet.test.tsx (criar se não existir)
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudentSheetView } from "./student-sheet";

function buildStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: "aluno-1",
    nome: "Ana Souza",
    matricula_codigo: "0001",
    matriculas: [{
      id: "m1",
      status: "cancelada",
      ano_letivo: 2026,
      cancelamento_data: "2026-04-10",
      cancelamento_motivo: "transferencia",
      series: { nome: "5º Ano" },
      turmas: { nome: "A" },
    }],
    ...overrides,
  };
}

describe("StudentSheetView — selo de cancelamento", () => {
  it("mostra selo Cancelado com ano quando a matricula tem cancelamento_data", () => {
    render(<StudentSheetView student={buildStudent() as never} fotoSrc={null} geradoEm={new Date()} />);
    expect(screen.getByText(/cancelado.*2026/i)).toBeInTheDocument();
  });

  it("nao mostra selo quando a matricula esta ativa", () => {
    const student = buildStudent({
      matriculas: [{ id: "m1", status: "ativa", ano_letivo: 2026, cancelamento_data: null, cancelamento_motivo: null, series: { nome: "5º Ano" }, turmas: { nome: "A" } }],
    });
    render(<StudentSheetView student={student as never} fotoSrc={null} geradoEm={new Date()} />);
    expect(screen.queryByText(/cancelado/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run src/components/students/student-sheet.test.tsx`
Expected: FAIL — selo ainda não existe.

- [ ] **Step 5: Implementar o selo**

No ponto onde `student-sheet.tsx` já renderiza a matrícula (ler o arquivo real para achar a posição exata — não adivinhar estrutura), adicionar, ao lado do badge de status existente:

```tsx
{matricula.cancelamento_data ? (
  <Badge tone="red">
    Cancelado — {new Date(matricula.cancelamento_data).getFullYear()}
    {matricula.cancelamento_motivo ? ` (${MOTIVO_CANCELAMENTO_LABEL[matricula.cancelamento_motivo as MotivoCancelamento]})` : ""}
  </Badge>
) : null}
```

Importar `MOTIVO_CANCELAMENTO_LABEL` e `MotivoCancelamento` de `@/lib/validation/cancelamento`.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/components/students/student-sheet.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 7: Aviso de cobrança pendente pós-cancelamento**

Na mesma página `src/app/(app)/alunos/[id]/page.tsx`, para a matrícula mais recente com `cancelamento_data` preenchida, chamar `listarCobrancasAbertasParaCancelamento(student.id, matricula.cancelamento_data)` (Task 3) e, se o resultado não for vazio, renderizar um aviso:

```tsx
{cobrancasPendentesPosCancelamento.length > 0 ? (
  <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
    Existem {cobrancasPendentesPosCancelamento.length} cobrança(s) em aberto com vencimento após o
    cancelamento da matrícula. Revise se devem ser canceladas manualmente.
  </div>
) : null}
```

Chamar essa busca só quando `matriculaAtivaForDocs` for `null` (matrícula cancelada é a mais recente, não a ativa) e `student.matriculas` tiver alguma com `cancelamento_data` — ler `getStudentSheet` para confirmar o shape de retorno de `student.matriculas` antes de escrever essa condição, em vez de assumir.

- [ ] **Step 8: `npm run typecheck`**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/students.ts src/components/students/student-sheet.tsx src/components/students/student-sheet.test.tsx "src/app/(app)/alunos/[id]/page.tsx"
git commit -m "feat(alunos): selo de cancelamento e aviso de cobranca pendente na ficha"
```

---

### Task 11: Verificação final

**Files:** nenhum arquivo novo — só validação.

- [ ] **Step 1: Rodar a suíte inteira**

Run: `npm run test`
Expected: todos os testes novos passando. Falha conhecida e pré-existente: `conferencia-planilha.test.ts` (fixture externa ausente, `public/11714876000116.xlsx`) — não relacionada a este plano, documentar no ledger se aparecer.

- [ ] **Step 2: Typecheck e build**

Run: `npm run typecheck && npm run build`
Expected: ambos verdes.

- [ ] **Step 3: Smoke test manual (documentar como pendente se não houver navegador disponível na execução)**

Roteiro: abrir ficha de um aluno com matrícula ativa → clicar "Cancelar Matrícula" → preencher motivo "Outro" sem observação → confirmar que o botão Confirmar permanece desabilitado até marcar os 2 switches e preencher observação → confirmar → verificar que o aluno aparece inativo na lista e a matrícula com status cancelada → acessar `/matriculas/saidas` e confirmar que a saída aparece → clicar "Emitir Declaração" e confirmar que abre a tela de emissão com o aluno pré-selecionado.

- [ ] **Step 4: Commit final (se houver ajustes de smoke test)**

```bash
git add -A
git commit -m "chore(matriculas): ajustes finais de verificacao do cancelamento de matricula"
```
