# Re-matrícula em Lote — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wizard em `/matriculas/rematricula-lote` que permite secretária re-matricular todos os alunos elegíveis de uma turma de uma vez, com série destino escolhida e resultado detalhado por aluno.

**Architecture:** Wizard server-side de 3 steps via query params GET + 1 Server Action POST. Cada step é Server Component. Action itera matrículas chamando RPC `rematriculate` por aluno (tolerante a falhas individuais), salva resultado em cookie e redireciona para página de resultado.

**Tech Stack:** Next.js 15 App Router, Server Components, Server Actions, Supabase (PostgreSQL RPC), TypeScript, Tailwind CSS, `cookies()` do `next/headers`.

---

## File Map

| Arquivo | Criar/Modificar | Responsabilidade |
|---------|-----------------|-----------------|
| `supabase/migrations/202605200003_rematriculate_serie_dest.sql` | Criar | Adiciona `p_serie_dest_id uuid DEFAULT NULL` à RPC |
| `src/lib/data/enrollments.ts` | Modificar | Adicionar `listAlunosCandidatosLote` |
| `src/lib/actions/academics.ts` | Modificar | Adicionar `rematricularLoteAction` |
| `src/app/(app)/matriculas/rematricula-lote/page.tsx` | Criar | Wizard controller — roteia para step correto |
| `src/app/(app)/matriculas/rematricula-lote/resultado/page.tsx` | Criar | Lê cookie e exibe summary ok/erros |
| `src/components/matriculas/rematricula-lote-step1.tsx` | Criar | Form: ano letivo + turma |
| `src/components/matriculas/rematricula-lote-step2.tsx` | Criar | Form: série destino |
| `src/components/matriculas/rematricula-lote-step3.tsx` | Criar | Lista alunos candidatos + checkboxes + submit |

---

## Task 1: Migration — atualizar RPC `rematriculate`

**Files:**
- Create: `supabase/migrations/202605200003_rematriculate_serie_dest.sql`

A RPC atual aceita só `p_matricula_id`. Lote precisa passar série destino explícita. Adicionamos `p_serie_dest_id uuid DEFAULT NULL` — retrocompatível (chamadas individuais existentes não mudam).

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/202605200003_rematriculate_serie_dest.sql
CREATE OR REPLACE FUNCTION rematriculate(
  p_matricula_id  uuid,
  p_serie_dest_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mat        matriculas%ROWTYPE;
  v_next_serie series%ROWTYPE;
  v_nova_id    uuid;
BEGIN
  SELECT * INTO v_mat FROM matriculas WHERE id = p_matricula_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_mat.status <> 'ativa' THEN RAISE EXCEPTION 'not_active'; END IF;

  IF p_serie_dest_id IS NOT NULL THEN
    SELECT * INTO v_next_serie
    FROM series
    WHERE id = p_serie_dest_id
      AND escola_id = v_mat.escola_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_serie_dest'; END IF;
  ELSE
    SELECT * INTO v_next_serie
    FROM series
    WHERE escola_id = v_mat.escola_id
      AND ativo = true
      AND ordem > (SELECT ordem FROM series WHERE id = v_mat.serie_id)
    ORDER BY ordem ASC
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'no_next_serie'; END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM matriculas
    WHERE aluno_id = v_mat.aluno_id
      AND ano_letivo = v_mat.ano_letivo + 1
      AND status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'already_enrolled';
  END IF;

  INSERT INTO matriculas (aluno_id, escola_id, serie_id, plano_id, ano_letivo, data_matricula, status)
  VALUES (v_mat.aluno_id, v_mat.escola_id, v_next_serie.id, v_mat.plano_id,
          v_mat.ano_letivo + 1, CURRENT_DATE, 'ativa')
  RETURNING id INTO v_nova_id;

  UPDATE matriculas SET status = 'concluida' WHERE id = p_matricula_id;

  RETURN v_nova_id;
END;
$$;

GRANT EXECUTE ON FUNCTION rematriculate(uuid, uuid) TO authenticated, service_role;
```

- [ ] **Step 2: Aplicar migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` com o conteúdo acima.  
Verificar que não há erro de compilação.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202605200003_rematriculate_serie_dest.sql
git commit -m "feat(db): add p_serie_dest_id param to rematriculate RPC"
```

---

## Task 2: Data layer — `listAlunosCandidatosLote`

**Files:**
- Modify: `src/lib/data/enrollments.ts`

Adicionar função que retorna alunos de uma turma com matrícula ativa no `ano_letivo` informado E sem matrícula ativa em `ano_letivo+1`.

- [ ] **Step 1: Adicionar função em `src/lib/data/enrollments.ts`**

Adicionar ao final do arquivo:

```typescript
export type AlunoLoteRow = {
  id: string;
  nome: string;
  matricula_id: string;
};

export async function listAlunosCandidatosLote(
  turma_id: string,
  ano_letivo: number
): Promise<AlunoLoteRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("matriculas")
    .select("id, alunos!inner(id, nome)")
    .eq("turma_id", turma_id)
    .eq("ano_letivo", ano_letivo)
    .eq("status", "ativa")
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  if (error) throw error;

  const candidatos = data ?? [];

  // Filter out students already enrolled next year
  const alunoIds = candidatos.map((m) => (m.alunos as { id: string; nome: string }).id);
  if (alunoIds.length === 0) return [];

  const { data: jaMatriculados, error: err2 } = await supabase
    .from("matriculas")
    .select("aluno_id")
    .in("aluno_id", alunoIds)
    .eq("ano_letivo", ano_letivo + 1)
    .eq("status", "ativa")
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  if (err2) throw err2;

  const jaMatriculadosSet = new Set((jaMatriculados ?? []).map((m) => m.aluno_id));

  return candidatos
    .filter((m) => !jaMatriculadosSet.has((m.alunos as { id: string; nome: string }).id))
    .map((m) => ({
      id: (m.alunos as { id: string; nome: string }).id,
      nome: (m.alunos as { id: string; nome: string }).nome,
      matricula_id: m.id,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data/enrollments.ts
git commit -m "feat(data): add listAlunosCandidatosLote query"
```

---

## Task 3: Server Action — `rematricularLoteAction`

**Files:**
- Modify: `src/lib/actions/academics.ts`

Action recebe `FormData` com `matricula_ids[]`, `serie_dest_id`, `ano_letivo`. Itera via RPC, coleta ok/erros, salva em cookie, redireciona.

- [ ] **Step 1: Adicionar imports no topo de `src/lib/actions/academics.ts`**

Verificar que `cookies` já está importado. Se não, adicionar:

```typescript
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
```

`redirect` já deve estar importado — confirmar antes de duplicar.

- [ ] **Step 2: Adicionar `rematricularLoteAction` ao final de `src/lib/actions/academics.ts`**

```typescript
export type RematricularLoteResultado = {
  anoDestino: number;
  ok: { nome: string; novaMatriculaId: string }[];
  errors: { nome: string; motivo: string }[];
};

export async function rematricularLoteAction(formData: FormData) {
  await requirePermission("matriculas", "create");

  const serieDestId = formData.get("serie_dest_id") as string;
  const anoLetivo = parseInt(formData.get("ano_letivo") as string, 10);
  const matriculaIds = formData.getAll("matricula_ids") as string[];

  if (!serieDestId || !anoLetivo || matriculaIds.length === 0) {
    return;
  }

  const supabase = await createServerClient();

  // Fetch nome map to avoid N+1
  const { data: nomeData } = await supabase
    .from("matriculas")
    .select("id, alunos!inner(nome)")
    .in("id", matriculaIds)
    .eq("escola_id", DEFAULT_SCHOOL_ID);

  const nomeMap: Record<string, string> = {};
  for (const row of nomeData ?? []) {
    nomeMap[row.id] = (row.alunos as { nome: string }).nome;
  }

  const resultado: RematricularLoteResultado = {
    anoDestino: anoLetivo + 1,
    ok: [],
    errors: [],
  };

  for (const matriculaId of matriculaIds) {
    const nome = nomeMap[matriculaId] ?? "Aluno desconhecido";
    const { data, error } = await supabase.rpc("rematriculate", {
      p_matricula_id: matriculaId,
      p_serie_dest_id: serieDestId,
    });

    if (error) {
      const msg = error.message ?? "";
      let motivo = "Erro inesperado";
      if (msg.includes("not_found")) motivo = "Matrícula não encontrada";
      else if (msg.includes("not_active")) motivo = "Matrícula não está ativa";
      else if (msg.includes("already_enrolled")) motivo = `Já possui matrícula ativa em ${anoLetivo + 1}`;
      else if (msg.includes("invalid_serie_dest")) motivo = "Série destino inválida";
      resultado.errors.push({ nome, motivo });
    } else {
      resultado.ok.push({ nome, novaMatriculaId: data as string });
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("rematricula_lote_result", JSON.stringify(resultado), {
    maxAge: 60,
    httpOnly: true,
    path: "/",
  });

  revalidatePath("/matriculas");
  revalidatePath("/alunos");
  redirect("/matriculas/rematricula-lote/resultado");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/academics.ts
git commit -m "feat(actions): add rematricularLoteAction with per-student error handling"
```

---

## Task 4: Step components

**Files:**
- Create: `src/components/matriculas/rematricula-lote-step1.tsx`
- Create: `src/components/matriculas/rematricula-lote-step2.tsx`
- Create: `src/components/matriculas/rematricula-lote-step3.tsx`

Cada step é Server Component que renderiza um form GET (steps 1 e 2) ou POST (step 3).

- [ ] **Step 1: Criar `src/components/matriculas/rematricula-lote-step1.tsx`**

```typescript
import { Panel } from "@/components/ui/card";
import { getAcademicData } from "@/lib/data/lookups";

export async function RematricularLoteStep1() {
  const { turmas } = await getAcademicData();
  const currentYear = new Date().getFullYear();

  // Collect distinct years from turmas
  const anos = [...new Set(turmas.map((t) => Number(t.ano_letivo)))].sort((a, b) => b - a);

  return (
    <Panel className="grid gap-6 max-w-lg">
      <div>
        <p className="ds-kicker">Passo 1 de 3</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Selecione turma e ano letivo</h2>
        <p className="mt-1 text-sm text-ink/60">
          Serão listados apenas alunos com matrícula ativa na turma selecionada
          que ainda não foram re-matriculados para o próximo ano.
        </p>
      </div>

      <form method="GET" className="grid gap-4">
        <input type="hidden" name="step" value="2" />

        <label>
          Ano letivo origem
          <select name="ano" required defaultValue={currentYear}>
            {anos.map((ano) => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </label>

        <label>
          Turma
          <select name="turma_id" required>
            <option value="">Selecione…</option>
            {turmas
              .filter((t) => t.ativo)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ano_letivo} — {(t.series as { nome: string } | null)?.nome} — {t.nome}
                </option>
              ))}
          </select>
        </label>

        <button type="submit" className="ds-button ds-button-primary justify-self-start">
          Próximo →
        </button>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 2: Criar `src/components/matriculas/rematricula-lote-step2.tsx`**

```typescript
import { Panel } from "@/components/ui/card";
import { getAcademicData } from "@/lib/data/lookups";

type Props = {
  ano: number;
  turma_id: string;
};

export async function RematricularLoteStep2({ ano, turma_id }: Props) {
  const { series, turmas } = await getAcademicData();
  const turma = turmas.find((t) => t.id === turma_id);

  return (
    <Panel className="grid gap-6 max-w-lg">
      <div>
        <p className="ds-kicker">Passo 2 de 3</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Selecione a série destino</h2>
        <p className="mt-1 text-sm text-ink/60">
          Turma: <strong>{turma?.nome ?? turma_id}</strong> · Ano: <strong>{ano}</strong>
        </p>
      </div>

      <form method="GET" className="grid gap-4">
        <input type="hidden" name="step" value="3" />
        <input type="hidden" name="ano" value={ano} />
        <input type="hidden" name="turma_id" value={turma_id} />

        <label>
          Série destino (ano {ano + 1})
          <select name="serie_dest_id" required>
            <option value="">Selecione…</option>
            {series
              .filter((s) => s.ativo)
              .map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
          </select>
        </label>

        <div className="flex gap-3">
          <a
            href={`/matriculas/rematricula-lote?step=1`}
            className="ds-button ds-button-secondary"
          >
            ← Voltar
          </a>
          <button type="submit" className="ds-button ds-button-primary">
            Próximo →
          </button>
        </div>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 3: Criar `src/components/matriculas/rematricula-lote-step3.tsx`**

```typescript
import { Panel } from "@/components/ui/card";
import { rematricularLoteAction } from "@/lib/actions/academics";
import { listAlunosCandidatosLote } from "@/lib/data/enrollments";

type Props = {
  ano: number;
  turma_id: string;
  serie_dest_id: string;
};

export async function RematricularLoteStep3({ ano, turma_id, serie_dest_id }: Props) {
  const candidatos = await listAlunosCandidatosLote(turma_id, ano);

  if (candidatos.length === 0) {
    return (
      <Panel className="grid gap-4 max-w-lg">
        <p className="ds-kicker">Passo 3 de 3</p>
        <p className="text-sm text-ink/60">
          Nenhum aluno elegível nesta turma para re-matrícula. Todos já possuem
          matrícula ativa em {ano + 1} ou a turma não tem alunos ativos.
        </p>
        <a
          href="/matriculas/rematricula-lote?step=1"
          className="ds-button ds-button-secondary justify-self-start"
        >
          ← Recomeçar
        </a>
      </Panel>
    );
  }

  return (
    <Panel className="grid gap-6 max-w-2xl">
      <div>
        <p className="ds-kicker">Passo 3 de 3</p>
        <h2 className="mt-1 text-xl font-bold text-ink">Confirme os alunos</h2>
        <p className="mt-1 text-sm text-ink/60">
          {candidatos.length} aluno{candidatos.length !== 1 ? "s" : ""} elegível
          {candidatos.length !== 1 ? "s" : ""}. Desmarque os que não devem ser re-matriculados.
        </p>
      </div>

      <form action={rematricularLoteAction} className="grid gap-4">
        <input type="hidden" name="ano_letivo" value={ano} />
        <input type="hidden" name="serie_dest_id" value={serie_dest_id} />

        <div className="divide-y divide-line rounded-ui border border-line">
          {candidatos.map((aluno) => (
            <label
              key={aluno.matricula_id}
              className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface-raised"
            >
              <input
                type="checkbox"
                name="matricula_ids"
                value={aluno.matricula_id}
                defaultChecked
                className="h-4 w-4"
              />
              <span className="text-sm text-ink">{aluno.nome}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          <a
            href={`/matriculas/rematricula-lote?step=2&ano=${ano}&turma_id=${turma_id}`}
            className="ds-button ds-button-secondary"
          >
            ← Voltar
          </a>
          <button type="submit" className="ds-button ds-button-primary">
            Re-matricular {candidatos.length} aluno{candidatos.length !== 1 ? "s" : ""}
          </button>
        </div>
      </form>
    </Panel>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/matriculas/rematricula-lote-step1.tsx \
        src/components/matriculas/rematricula-lote-step2.tsx \
        src/components/matriculas/rematricula-lote-step3.tsx
git commit -m "feat(ui): rematricula lote step components (1, 2, 3)"
```

---

## Task 5: Wizard page controller

**Files:**
- Create: `src/app/(app)/matriculas/rematricula-lote/page.tsx`

Lê `searchParams`, valida, roteia para step correto. Params inválidos redirecionam para step 1.

- [ ] **Step 1: Criar `src/app/(app)/matriculas/rematricula-lote/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { RematricularLoteStep1 } from "@/components/matriculas/rematricula-lote-step1";
import { RematricularLoteStep2 } from "@/components/matriculas/rematricula-lote-step2";
import { RematricularLoteStep3 } from "@/components/matriculas/rematricula-lote-step3";

export default async function RematricularLotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requirePermission("matriculas", "create");
  const params = await searchParams;
  const step = params.step ?? "1";

  const ano = parseInt(params.ano ?? "", 10);
  const turma_id = params.turma_id ?? "";
  const serie_dest_id = params.serie_dest_id ?? "";

  // Guard: step 2 requires ano + turma_id
  if (step === "2" && (!ano || !turma_id)) {
    redirect("/matriculas/rematricula-lote?step=1");
  }

  // Guard: step 3 requires ano + turma_id + serie_dest_id
  if (step === "3" && (!ano || !turma_id || !serie_dest_id)) {
    redirect("/matriculas/rematricula-lote?step=1");
  }

  const stepLabel: Record<string, string> = {
    "1": "Turma e ano",
    "2": "Série destino",
    "3": "Confirmar alunos",
  };

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico", href: "/" },
          { label: "Matrículas", href: "/matriculas" },
          { label: "Re-matrícula em lote" },
        ]}
        title="Re-matrícula em lote"
        description={`Passo ${step}: ${stepLabel[step] ?? ""}`}
      />

      {step === "1" && <RematricularLoteStep1 />}
      {step === "2" && <RematricularLoteStep2 ano={ano} turma_id={turma_id} />}
      {step === "3" && (
        <RematricularLoteStep3
          ano={ano}
          turma_id={turma_id}
          serie_dest_id={serie_dest_id}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/matriculas/rematricula-lote/page.tsx"
git commit -m "feat(matriculas): rematricula lote wizard page controller"
```

---

## Task 6: Página de resultado

**Files:**
- Create: `src/app/(app)/matriculas/rematricula-lote/resultado/page.tsx`

Lê cookie `rematricula_lote_result`, exibe tabelas ok/erros, limpa cookie via `Response` headers (não há API direta — setar `maxAge: 0` sobrescreve o cookie existente).

- [ ] **Step 1: Criar `src/app/(app)/matriculas/rematricula-lote/resultado/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import type { RematricularLoteResultado } from "@/lib/actions/academics";

export default async function RematricularLoteResultadoPage() {
  await requirePermission("matriculas", "read");

  const cookieStore = await cookies();
  const raw = cookieStore.get("rematricula_lote_result")?.value;

  if (!raw) {
    redirect("/matriculas/rematricula-lote?step=1");
  }

  let resultado: RematricularLoteResultado;
  try {
    resultado = JSON.parse(raw) as RematricularLoteResultado;
  } catch {
    redirect("/matriculas/rematricula-lote?step=1");
  }

  // Clear cookie
  cookieStore.set("rematricula_lote_result", "", { maxAge: 0, path: "/" });

  const { anoDestino, ok, errors } = resultado;

  return (
    <div className="grid gap-8">
      <PageHeader
        breadcrumb={[
          { label: "Acadêmico", href: "/" },
          { label: "Matrículas", href: "/matriculas" },
          { label: "Re-matrícula em lote — Resultado" },
        ]}
        title="Resultado da re-matrícula em lote"
        description={`${ok.length} re-matriculados · ${errors.length} erros`}
      />

      <div className="grid gap-6 max-w-3xl">
        {ok.length > 0 && (
          <Panel className="grid gap-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 size={18} />
              <span className="font-semibold">{ok.length} aluno{ok.length !== 1 ? "s" : ""} re-matriculado{ok.length !== 1 ? "s" : ""} com sucesso</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink/50">
                  <th className="pb-2 font-medium">Aluno</th>
                  <th className="pb-2 font-medium text-right">Nova matrícula</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ok.map((row) => (
                  <tr key={row.novaMatriculaId}>
                    <td className="py-2 text-ink">{row.nome}</td>
                    <td className="py-2 text-right">
                      <a
                        href={`/matriculas/${row.novaMatriculaId}`}
                        className="text-brand hover:underline"
                      >
                        Ver matrícula →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {errors.length > 0 && (
          <Panel className="grid gap-4">
            <div className="flex items-center gap-2 text-danger">
              <XCircle size={18} />
              <span className="font-semibold">{errors.length} erro{errors.length !== 1 ? "s" : ""}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink/50">
                  <th className="pb-2 font-medium">Aluno</th>
                  <th className="pb-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {errors.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 text-ink">{row.nome}</td>
                    <td className="py-2 text-ink/60">{row.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        <div className="flex gap-3">
          <ButtonLink href={`/matriculas?ano=${anoDestino}`} variant="primary">
            Ver matrículas {anoDestino}
          </ButtonLink>
          <ButtonLink href="/matriculas/rematricula-lote?step=1" variant="secondary">
            Nova re-matrícula em lote
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/matriculas/rematricula-lote/resultado/page.tsx"
git commit -m "feat(matriculas): rematricula lote resultado page"
```

---

## Task 7: Link de acesso na página de matrículas

**Files:**
- Modify: `src/app/(app)/matriculas/page.tsx`

Adicionar botão "Re-matricular em lote" no header da página de matrículas para descoberta da feature.

- [ ] **Step 1: Adicionar ButtonLink no PageHeader de `src/app/(app)/matriculas/page.tsx`**

Localizar o `<PageHeader` na página e adicionar `actions` prop com o botão:

```typescript
// Adicionar import se ainda não existir:
import { RefreshCcw } from "lucide-react";

// No PageHeader, adicionar actions:
actions={
  <ButtonLink href="/matriculas/rematricula-lote?step=1" variant="secondary">
    <RefreshCcw size={14} /> Re-matricular em lote
  </ButtonLink>
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/matriculas/page.tsx"
git commit -m "feat(matriculas): add link to rematricula lote wizard"
```

---

## Self-Review Notes

- `RematricularLoteResultado` é exportado de `academics.ts` e importado em `resultado/page.tsx` — tipo consistente.
- `listAlunosCandidatosLote` retorna `AlunoLoteRow[]` com `matricula_id` — step 3 usa `aluno.matricula_id` para checkboxes — consistente.
- Action recebe `matricula_ids` (plural, `getAll`) — step 3 usa `name="matricula_ids"` — consistente.
- Cookie `rematricula_lote_result` setado na action com `maxAge: 60`, lido e zerado (`maxAge: 0`) na página resultado.
- Guards de params: step 2 sem `ano`/`turma_id` → step 1; step 3 sem qualquer param → step 1; resultado sem cookie → step 1.
- RPC `rematriculate` com assinatura `(uuid, uuid)` precisa de `GRANT` separado (incluso na migration).
