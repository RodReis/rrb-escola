# Re-matrícula Individual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Re-matricular" button in the student sheet and enrollment detail that creates next-year enrollment atomically via a Supabase RPC.

**Architecture:** A PL/pgSQL function `rematriculate(uuid)` runs the INSERT + UPDATE in one transaction. A server action wraps it with guards and redirects. Two UI entry points (client components) call the action.

**Tech Stack:** Next.js App Router, Supabase (local Docker), server actions (`"use server"`), `useRouter` + `toast` (sonner) on the client side.

---

## File Map

| File | Role |
|---|---|
| `supabase/migrations/202605200002_rematriculate_rpc.sql` | PL/pgSQL function `rematriculate(uuid)` |
| `src/lib/actions/academics.ts` | Add `rematricularAlunoAction` |
| `src/components/students/reenroll-button.tsx` | New `"use client"` button for ficha do aluno |
| `src/app/(app)/alunos/[id]/page.tsx` | Pass `matriculaAtivaId` to `ReenrollButton` |
| `src/app/(app)/matriculas/[id]/page.tsx` | Add `ReenrollButton` in header + banner if `?rematricula=1` |

---

## Task 1: Supabase RPC migration

**Files:**
- Create: `supabase/migrations/202605200002_rematriculate_rpc.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/202605200002_rematriculate_rpc.sql

CREATE OR REPLACE FUNCTION rematriculate(p_matricula_id uuid)
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

  SELECT * INTO v_next_serie
  FROM series
  WHERE escola_id = v_mat.escola_id
    AND ativo = true
    AND ordem > (SELECT ordem FROM series WHERE id = v_mat.serie_id)
  ORDER BY ordem ASC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_next_serie'; END IF;

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

GRANT EXECUTE ON FUNCTION rematriculate(uuid) TO authenticated, service_role;
```

- [ ] **Step 2: Apply migration**

```powershell
cd "c:\Desenv\Projetos\rrb-escola"
npx supabase db push
```

Expected: `supabase/migrations/202605200002_rematriculate_rpc.sql` applied, no errors.

- [ ] **Step 3: Smoke test in Supabase Studio**

Open Studio → SQL editor. Run:
```sql
-- Should fail with 'not_found'
SELECT rematriculate('00000000-0000-0000-0000-000000000000');
```
Expected: error message containing `not_found`.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/202605200002_rematriculate_rpc.sql
git commit -m "feat(db): add rematriculate RPC function"
```

---

## Task 2: Server action `rematricularAlunoAction`

**Files:**
- Modify: `src/lib/actions/academics.ts`

- [ ] **Step 1: Add action at end of file**

Open `src/lib/actions/academics.ts`. The file uses `"use server"` at top, imports `revalidatePath`, `requirePermission`, `DEFAULT_SCHOOL_ID`, `createServerClient`. Add at the end:

```typescript
export async function rematricularAlunoAction(matriculaId: string): Promise<{ error?: string; novaMatriculaId?: string }> {
  await requirePermission("matriculas", "write");
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc("rematriculate", { p_matricula_id: matriculaId });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("not_found")) return { error: "Matrícula não encontrada." };
    if (msg.includes("not_active")) return { error: "Só é possível re-matricular matrículas ativas." };
    if (msg.includes("no_next_serie")) return { error: "Não há série seguinte cadastrada. Cadastre a próxima série antes de re-matricular." };
    if (msg.includes("already_enrolled")) {
      return { error: `Aluno já possui matrícula ativa para o próximo ano letivo.` };
    }
    return { error: "Erro ao processar re-matrícula. Tente novamente." };
  }

  revalidatePath("/matriculas");
  revalidatePath("/alunos");

  return { novaMatriculaId: data as string };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 20
```

Expected: no errors related to `academics.ts`.

- [ ] **Step 3: Commit**

```powershell
git add src/lib/actions/academics.ts
git commit -m "feat(actions): rematricularAlunoAction via Supabase RPC"
```

---

## Task 3: `ReenrollButton` client component

**Files:**
- Create: `src/components/students/reenroll-button.tsx`

- [ ] **Step 1: Create component**

```typescript
// src/components/students/reenroll-button.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { rematricularAlunoAction } from "@/lib/actions/academics";

type Props = { matriculaId: string };

export function ReenrollButton({ matriculaId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await rematricularAlunoAction(matriculaId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.push(`/matriculas/${result.novaMatriculaId}?rematricula=1`);
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="ds-button ds-button-secondary disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
      Re-matricular
    </button>
  );
}
```

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/components/students/reenroll-button.tsx
git commit -m "feat(ui): ReenrollButton client component"
```

---

## Task 4: Ficha do aluno — add button to header

**Files:**
- Modify: `src/app/(app)/alunos/[id]/page.tsx`

- [ ] **Step 1: Add import and button**

In `src/app/(app)/alunos/[id]/page.tsx`, add import at top (line ~5):

```typescript
import { ReenrollButton } from "@/components/students/reenroll-button";
```

Then in the header buttons `<div>` (around line 40–51), add the `ReenrollButton` after the Editar button and before `StudentHeaderActions`:

Find this block:
```tsx
          <ButtonLink href={`/alunos/${student.id}/editar`} variant="primary">
            <Pencil size={14} /> Editar
          </ButtonLink>
          <StudentHeaderActions student={student} matriculaAtiva={matriculaAtivaPayload} templates={templatesLite} />
```

Replace with:
```tsx
          <ButtonLink href={`/alunos/${student.id}/editar`} variant="primary">
            <Pencil size={14} /> Editar
          </ButtonLink>
          {matriculaAtivaPayload ? <ReenrollButton matriculaId={matriculaAtivaPayload.id} /> : null}
          <StudentHeaderActions student={student} matriculaAtiva={matriculaAtivaPayload} templates={templatesLite} />
```

- [ ] **Step 2: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add src/app/(app)/alunos/[id]/page.tsx
git commit -m "feat(alunos): add Re-matricular button to student sheet header"
```

---

## Task 5: Detalhe da matrícula — button + banner

**Files:**
- Modify: `src/app/(app)/matriculas/[id]/page.tsx`

- [ ] **Step 1: Add import**

In `src/app/(app)/matriculas/[id]/page.tsx`, add import at top (after existing imports):

```typescript
import { ReenrollButton } from "@/components/students/reenroll-button";
```

- [ ] **Step 2: Update function signature to include `rematricula` search param**

The page already has `searchParams: Promise<Record<string, string>>`. Destructure `rematricula` alongside `tab`:

Find:
```typescript
  const { tab = "cadastro" } = await searchParams;
```

Replace with:
```typescript
  const { tab = "cadastro", rematricula } = await searchParams;
```

- [ ] **Step 3: Add button to header**

In the header `<div className="flex flex-wrap gap-2">` block (around line 74–79):

Find:
```tsx
          {student?.id ? <ButtonLink href={`/alunos/${student.id}`} variant="primary">Ficha do aluno</ButtonLink> : null}
```

Replace with:
```tsx
          {student?.id ? <ButtonLink href={`/alunos/${student.id}`} variant="primary">Ficha do aluno</ButtonLink> : null}
          {enrollment.status === "ativa" ? <ReenrollButton matriculaId={enrollment.id} /> : null}
```

- [ ] **Step 4: Add success banner**

After the closing `</header>` tag (around line 81) and before `{/* KPIs */}`, add:

```tsx
      {rematricula === "1" && (
        <div className="rounded-ui border border-moss/40 bg-moss/10 px-4 py-3 text-sm text-moss mx-6 mt-4">
          Matrícula {enrollment.ano_letivo} criada com sucesso. Atribua a turma e confirme o plano.
        </div>
      )}
```

- [ ] **Step 5: TypeScript check**

```powershell
npx tsc --noEmit 2>&1 | Select-Object -First 20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```powershell
git add src/app/(app)/matriculas/[id]/page.tsx
git commit -m "feat(matriculas): Re-matricular button and confirmation banner"
```

---

## Task 6: Manual smoke test

- [ ] **Step 1: Start dev server**

```powershell
npm run dev
```

- [ ] **Step 2: Test happy path from ficha do aluno**

1. Navigate to `/alunos/[id]` for a student with `status = 'ativa'` enrollment.
2. Verify "Re-matricular" button is visible next to "Editar".
3. Click "Re-matricular".
4. Verify redirect to `/matriculas/[nova-id]?rematricula=1`.
5. Verify green banner "Matrícula {ano+1} criada com sucesso. Atribua a turma e confirme o plano."
6. Verify old enrollment now shows `status = 'concluida'` in Supabase Studio.

- [ ] **Step 3: Test from detalhe da matrícula**

1. Navigate to `/matriculas/[id]` for an `ativa` enrollment.
2. Verify "Re-matricular" button is visible next to "Ficha do aluno".
3. Click — verify same redirect + banner.

- [ ] **Step 4: Test guard — already enrolled**

1. Try re-matricular again on the same old enrollment (now `concluida`).
2. Button should not appear (status ≠ ativa).

- [ ] **Step 5: Test guard — no next serie**

1. In Supabase Studio, temporarily set the student's current série as the highest `ordem`.
2. Click "Re-matricular" from ficha.
3. Verify `toast.error` with "Não há série seguinte cadastrada...".
4. Revert the change.

- [ ] **Step 6: Commit if any fixes needed**

```powershell
git add -p
git commit -m "fix(rematricula): <describe fix>"
```
