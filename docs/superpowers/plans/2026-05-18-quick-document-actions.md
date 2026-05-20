# Quick Document Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate daily document generation (declarations, terms) from the matrícula tab to one-click buttons in the student's profile header. Show a "Matricular aluno" CTA when the student has no active enrollment.

**Architecture:** New client component `QuickDocumentActions` lives in the student profile header. It reads the student's active enrollment from the server page, calls the existing `generateDocxAction`, downloads the resulting `.docx` via a shared client util, and shows feedback via `sonner` toasts. The matrículas page accepts an `aluno_id` query param to pre-select the student in the new-matrícula form. The existing `/matriculas/[id]?tab=documentos` flow stays intact as an intentional redundancy.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase, Tailwind, lucide-react, docxtemplater (already wired), sonner (new).

**Spec:** `docs/superpowers/specs/2026-05-18-quick-document-actions-design.md`

**Testing note:** Project has no UI test framework. All testing is manual via dev server. Each task ends with explicit manual verification steps and a commit.

---

## File Structure

**New files:**
- `src/lib/documents/download-client.ts` — `downloadBase64Docx(base64, nomeArquivo)` util
- `src/components/ui/toaster.tsx` — themed `<Toaster />` wrapper around sonner
- `src/components/students/quick-document-actions.tsx` — client component with 3 quick buttons + "Mais ▾" dropdown + matricular CTA

**Modified files:**
- `package.json` — add `sonner` dependency
- `src/app/layout.tsx` — mount `<Toaster />`
- `src/app/(app)/alunos/[id]/page.tsx` — compute `matriculaAtiva`, render `<QuickDocumentActions />` in header, remove `<ExportStudentButton />` from header (it moves into the dropdown)
- `src/app/(app)/matriculas/page.tsx` — accept `searchParams.aluno_id`, pass to `StudentCombobox`, add `id="nova-matricula"` anchor, auto-scroll when param present
- `src/components/students/student-documents-panel.tsx` — add "Gerado"/"Enviado" badge per document
- `src/components/matriculas/document-generator.tsx` — refactor to call `downloadBase64Docx` (no behavior change)

**Inalterados:** `generateDocxAction`, `buildVariables`, `templates.ts`, `generator.ts`, tab Documentos em `/matriculas/[id]`.

---

## Task 1: Install sonner and wire global Toaster

**Files:**
- Modify: `package.json`
- Create: `src/components/ui/toaster.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install sonner**

Run:
```
npm install sonner@^1.7.0
```
Expected: `sonner` added to `dependencies` in `package.json`, no other changes.

- [ ] **Step 2: Create themed Toaster wrapper**

Create `src/components/ui/toaster.tsx`:

```tsx
"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-ui border border-line bg-surface text-ink shadow-soft",
          title: "font-semibold text-ink",
          description: "text-muted",
          success: "border-moss/40",
          error: "border-clay/40",
        },
      }}
    />
  );
}
```

- [ ] **Step 3: Mount Toaster in root layout**

Modify `src/app/layout.tsx`. Replace the existing `<body>` element:

```tsx
import { Toaster } from "@/components/ui/toaster";
// ...existing imports

// inside RootLayout:
<body className="antialiased font-sans">
  {children}
  <Toaster />
</body>
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`. Open any page. Open browser devtools console and run:
```js
import("sonner").then(m => m.toast.success("hello"))
```
Expected: toast appears top-right with the configured styling. Close it. Stop dev server.

- [ ] **Step 5: Commit**

```
git add package.json package-lock.json src/components/ui/toaster.tsx src/app/layout.tsx
git commit -m "feat(ui): add sonner toaster mounted globally"
```

---

## Task 2: Extract download util

**Files:**
- Create: `src/lib/documents/download-client.ts`
- Modify: `src/components/matriculas/document-generator.tsx`

- [ ] **Step 1: Create download util**

Create `src/lib/documents/download-client.ts`:

```ts
"use client";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function downloadBase64Docx(base64: string, nomeArquivo: string): void {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: DOCX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Refactor DocumentGenerator to use the util**

Modify `src/components/matriculas/document-generator.tsx`.

Replace lines 43-50 (the manual blob/download logic):

```tsx
const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = result.nomeArquivo;
a.click();
URL.revokeObjectURL(url);
```

with:

```tsx
downloadBase64Docx(result.base64, result.nomeArquivo);
```

Add import at top of file:

```tsx
import { downloadBase64Docx } from "@/lib/documents/download-client";
```

- [ ] **Step 3: Manual verification**

Run `npm run dev`. Navigate to `/matriculas/<any-id>?tab=documentos`. Generate any template. Confirm `.docx` downloads as before. Stop dev server.

- [ ] **Step 4: Commit**

```
git add src/lib/documents/download-client.ts src/components/matriculas/document-generator.tsx
git commit -m "refactor(documents): extract downloadBase64Docx util"
```

---

## Task 3: Create QuickDocumentActions component (matrícula ativa branch)

**Files:**
- Create: `src/components/students/quick-document-actions.tsx`

This task creates the component but doesn't render it anywhere yet. Task 5 wires it into the page.

- [ ] **Step 1: Create the component**

Create `src/components/students/quick-document-actions.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { generateDocxAction } from "@/lib/actions/documents-generate";
import { downloadBase64Docx } from "@/lib/documents/download-client";
import { TIPO_TEMPLATE, type TipoTemplate } from "@/lib/documents/templates";

type MatriculaAtiva = { id: string; codigo: string | null };

type Props = {
  alunoId: string;
  matriculaAtiva: MatriculaAtiva | null;
  onExportFichaPdf?: () => void;
};

const QUICK: Array<{ tipo: TipoTemplate; label: string }> = [
  { tipo: TIPO_TEMPLATE.DECLARACAO_FREQUENCIA, label: "Decl. Frequência" },
  { tipo: TIPO_TEMPLATE.DECLARACAO_TRANSFERENCIA, label: "Decl. Transferência" },
  { tipo: TIPO_TEMPLATE.TERMO_RESPONSABILIDADE, label: "Termo Resp." },
];

const MORE: Array<{ tipo: TipoTemplate; label: string }> = [
  { tipo: TIPO_TEMPLATE.TERMO_RESPONSABILIDADE_INTEGRADO, label: "Termo Responsabilidade — Integrado" },
  { tipo: TIPO_TEMPLATE.CONTRATO_PINGUINHO, label: "Contrato — Pinguinho" },
  { tipo: TIPO_TEMPLATE.CONTRATO_COLEGIO, label: "Contrato — Colégio Integrado" },
];

export function QuickDocumentActions({ alunoId, matriculaAtiva, onExportFichaPdf }: Props) {
  const [loadingTipo, setLoadingTipo] = useState<TipoTemplate | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function handleGerar(tipo: TipoTemplate) {
    if (!matriculaAtiva) return;
    if (loadingTipo) return;
    setLoadingTipo(tipo);
    try {
      const res = await generateDocxAction(matriculaAtiva.id, tipo);
      if (!res.success || !res.base64 || !res.nomeArquivo) {
        toast.error(res.error ?? "Erro ao gerar documento.");
        return;
      }
      downloadBase64Docx(res.base64, res.nomeArquivo);
      toast.success(`Documento gerado: ${res.nomeArquivo}`);
    } finally {
      setLoadingTipo(null);
      setDropdownOpen(false);
    }
  }

  if (!matriculaAtiva) {
    return (
      <ButtonLink
        href={`/matriculas?aluno_id=${alunoId}`}
        variant="primary"
        className="gap-1"
      >
        <Plus size={14} />
        Matricular aluno
      </ButtonLink>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-1.5 rounded-ui border border-gold/40 bg-surface px-2.5 py-1.5"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        Gerar:
      </span>
      {QUICK.map(({ tipo, label }) => (
        <Button
          key={tipo}
          variant="accent"
          onClick={() => handleGerar(tipo)}
          disabled={loadingTipo !== null}
          className="!py-1.5 !px-2.5 text-xs"
        >
          {loadingTipo === tipo ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <FileText size={12} />
          )}
          {label}
        </Button>
      ))}
      <div className="relative">
        <Button
          variant="secondary"
          onClick={() => setDropdownOpen((v) => !v)}
          disabled={loadingTipo !== null}
          className="!py-1.5 !px-2.5 text-xs"
        >
          Mais
          <ChevronDown size={12} />
        </Button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-ui border border-line bg-surface p-1.5 shadow-soft">
            <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              Mais documentos
            </p>
            {MORE.map(({ tipo, label }) => (
              <button
                key={tipo}
                type="button"
                onClick={() => handleGerar(tipo)}
                disabled={loadingTipo !== null}
                className="flex w-full items-center gap-2 rounded-ui px-2.5 py-2 text-left text-sm text-ink hover:bg-subtleHover disabled:opacity-50"
              >
                {loadingTipo === tipo ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileText size={14} className="text-moss" />
                )}
                {label}
              </button>
            ))}
            {onExportFichaPdf && (
              <>
                <div className="my-1 border-t border-line" />
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    onExportFichaPdf();
                  }}
                  className="flex w-full items-center gap-2 rounded-ui px-2.5 py-2 text-left text-sm italic text-muted hover:bg-subtleHover"
                >
                  ⬇ Exportar ficha (PDF)
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run:
```
npm run typecheck
```
Expected: no errors related to the new file. Pre-existing errors in unrelated files (if any) can be ignored, but no new errors introduced.

- [ ] **Step 3: Commit**

```
git add src/components/students/quick-document-actions.tsx
git commit -m "feat(students): add QuickDocumentActions component"
```

---

## Task 4: Wrap ExportStudentButton so QuickDocumentActions can trigger it

The existing `ExportStudentButton` renders its own button. We need to expose its `exportPdf` callback so the dropdown item can fire it without rendering a second button.

**Files:**
- Modify: `src/components/pdf/export-student-button.tsx`
- Create: `src/components/students/student-header-actions.tsx`

- [ ] **Step 1: Refactor ExportStudentButton to export the function**

Modify `src/components/pdf/export-student-button.tsx`. Extract the inner `exportPdf` body into an exported helper and keep the button component intact:

Replace the file body with:

```tsx
"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download } from "lucide-react";
import type { StudentSheet } from "@/lib/types";

function value(text: unknown) {
  return text ? String(text) : "";
}

export function exportStudentPdf(student: StudentSheet) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const address = student.enderecos_aluno[0];
  const medical = student.informacoes_medicas;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Ficha do Aluno", 105, 9, { align: "center" });

  autoTable(doc, {
    startY: 12,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1, lineColor: 0, lineWidth: 0.2, textColor: 0 },
    headStyles: { fillColor: [232, 232, 232], textColor: 0, halign: "center" },
    body: [
      [{ content: "Dados do Aluno", colSpan: 4, styles: { halign: "center", fontStyle: "bold", fillColor: [232, 232, 232] } }],
      [`Matricula\n${student.matricula_codigo}`, `Nome\n${student.nome}`, `Sexo\n${value(student.sexo)}`, `Dt. Nascimento\n${value(student.data_nascimento)}`],
      [`Naturalidade\n${value(student.naturalidade)}`, `Celular\n${value(student.celular)}`, `CPF\n${value(student.cpf)}`, `RG\n${value(student.rg)}`],
      [{ content: `Endereco\n${value(address?.logradouro)}`, colSpan: 2 }, `Cidade\n${value(address?.cidade)}-${value(address?.uf)}`, `CEP\n${value(address?.cep)}`],
      [`E-Mail\n${value(student.email)}`, `Cod. INEP\n${value(student.codigo_inep)}`, `Etnia\n${value(student.etnia)}`, `Informacoes adicionais\n${value(student.informacoes_adicionais)}`]
    ]
  });

  autoTable(doc, {
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1, lineColor: 0, lineWidth: 0.2, textColor: 0 },
    head: [["Nome", "CPF", "Telefone", "Celular", "Parentesco", "E-Mail"]],
    body: student.responsaveis_aluno.map((item) => [
      item.nome,
      value(item.cpf),
      value(item.telefone),
      value(item.celular),
      value(item.parentesco),
      value(item.email)
    ])
  });

  autoTable(doc, {
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1, lineColor: 0, lineWidth: 0.2, textColor: 0 },
    head: [["Codigo", "Ano", "Serie", "Turma", "Plano", "Status", "Data", "Idade"]],
    body: student.matriculas.map((item) => [
      value(item.codigo),
      value(item.ano_letivo),
      value(item.series?.nome),
      value(item.turmas?.nome),
      value(item.planos?.nome),
      value(item.status),
      value(item.data_matricula),
      value(item.idade_na_matricula)
    ])
  });

  autoTable(doc, {
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1, lineColor: 0, lineWidth: 0.2, textColor: 0 },
    body: [
      [{ content: "Informacoes Medicas", colSpan: 4, styles: { halign: "center", fontStyle: "bold", fillColor: [232, 232, 232] } }],
      [`Alergia: ${medical?.alergia ? "( X )" : "(  )"}`, `Portador Nec. Especiais: ${medical?.necessidade_especial ? "( X )" : "(  )"}`, `Nec. Apoio/Recurso: ${medical?.necessita_apoio ? "( X )" : "(  )"}`, `Possui Doenca Grave: ${medical?.doenca_grave ? "( X )" : "(  )"}`],
      [`Medico\n${value(medical?.medico)}`, `Telefone\n${value(medical?.telefone_medico)}`, `Plano de Saude\n${value(medical?.plano_saude)}`, `Telefone\n${value(medical?.telefone_plano)}`]
    ]
  });

  doc.save(`ficha-${student.matricula_codigo}.pdf`);
}

export function ExportStudentButton({ student }: { student: StudentSheet }) {
  return (
    <button onClick={() => exportStudentPdf(student)} className="ds-button ds-button-secondary">
      <Download size={16} />
      Exportar PDF
    </button>
  );
}
```

- [ ] **Step 2: Create StudentHeaderActions wrapper**

Create `src/components/students/student-header-actions.tsx`:

```tsx
"use client";

import { exportStudentPdf } from "@/components/pdf/export-student-button";
import { QuickDocumentActions } from "@/components/students/quick-document-actions";
import type { StudentSheet } from "@/lib/types";

type MatriculaAtiva = { id: string; codigo: string | null };

export function StudentHeaderActions({
  student,
  matriculaAtiva,
}: {
  student: StudentSheet;
  matriculaAtiva: MatriculaAtiva | null;
}) {
  return (
    <QuickDocumentActions
      alunoId={student.id}
      matriculaAtiva={matriculaAtiva}
      onExportFichaPdf={() => exportStudentPdf(student)}
    />
  );
}
```

- [ ] **Step 3: Type-check**

Run:
```
npm run typecheck
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```
git add src/components/pdf/export-student-button.tsx src/components/students/student-header-actions.tsx
git commit -m "refactor(students): expose exportStudentPdf + wrapper for header actions"
```

---

## Task 5: Wire QuickDocumentActions into student profile header

**Files:**
- Modify: `src/app/(app)/alunos/[id]/page.tsx`

- [ ] **Step 1: Replace header action buttons**

Modify `src/app/(app)/alunos/[id]/page.tsx`. Replace the imports and header action block.

Replace the existing imports near the top:

```tsx
import { ExportStudentButton } from "@/components/pdf/export-student-button";
```

with:

```tsx
import { StudentHeaderActions } from "@/components/students/student-header-actions";
```

Then change the right-side action block in the `<header>` (currently includes `Voltar`, `Boletim`, `Editar`, `<ExportStudentButton />`) to compute `matriculaAtiva` from the already-loaded `student.matriculas` and render the new actions component.

Above the `return`:

```tsx
const matriculaAtiva = student.matriculas.find((m) => m.status === "ativa") ?? null;
const matriculaAtivaPayload = matriculaAtiva
  ? { id: matriculaAtiva.id, codigo: matriculaAtiva.codigo ?? null }
  : null;
```

Replace the right-side `<div className="flex flex-wrap gap-2">` block with:

```tsx
<div className="flex flex-wrap items-center gap-2">
  <ButtonLink href="/alunos" variant="secondary">Voltar</ButtonLink>
  <ButtonLink href={`/alunos/${student.id}/boletim`} variant="secondary">Boletim</ButtonLink>
  <ButtonLink href={`/alunos/${student.id}/editar`} variant="primary">Editar</ButtonLink>
  <StudentHeaderActions student={student} matriculaAtiva={matriculaAtivaPayload} />
</div>
```

- [ ] **Step 2: Type-check**

Run:
```
npm run typecheck
```
Expected: no new errors.

- [ ] **Step 3: Manual verification — happy path**

Run `npm run dev`. Open `/alunos/<id>` for a student with an active matrícula.

Verify:
- 3 quick buttons appear: "Decl. Frequência", "Decl. Transferência", "Termo Resp."
- "Mais ▾" dropdown opens on click; contains 3 more templates + separator + "Exportar ficha (PDF)"
- Click "Decl. Frequência": `.docx` downloads, success toast appears top-right.
- Click "Exportar ficha (PDF)": PDF downloads as before (no toast — uses existing jsPDF flow).

- [ ] **Step 4: Manual verification — sem matrícula ativa**

Open `/alunos/<id>` for a student whose only matrículas have status `cancelada`/`transferida`/`concluida`, or who has no matrículas at all.

Verify:
- Quick buttons disappear.
- Single button "➕ Matricular aluno" appears in their place.
- Clicking it navigates to `/matriculas?aluno_id=<id>`.

Stop dev server.

- [ ] **Step 5: Commit**

```
git add src/app/(app)/alunos/[id]/page.tsx
git commit -m "feat(students): mount QuickDocumentActions in profile header"
```

---

## Task 6: Pre-select aluno + scroll anchor on /matriculas

**Files:**
- Modify: `src/app/(app)/matriculas/page.tsx`

- [ ] **Step 1: Accept aluno_id, pass to combobox, add anchor + scroll**

Modify `src/app/(app)/matriculas/page.tsx`.

Update the signature/destructure of `searchParams`:

```tsx
const { status = "", nome = "", aluno_id = "" } = await searchParams;
```

Compute the pre-selected student (after `getAcademicData` resolves):

```tsx
const alunoPre = aluno_id
  ? alunos.find((a) => a.id === aluno_id) ?? null
  : null;
```

Add a `<script>` for scroll just inside the `return`'s root element (before `<PageHeader>` is fine):

```tsx
{alunoPre && (
  <script
    dangerouslySetInnerHTML={{
      __html:
        "document.getElementById('nova-matricula')?.scrollIntoView({behavior:'smooth',block:'start'});",
    }}
  />
)}
```

Add `id="nova-matricula"` to the `<Panel>` wrapping the new-matrícula form:

```tsx
<Panel id="nova-matricula" className="grid gap-5">
```

Pass `defaultValue` to `StudentCombobox` (replace the existing `<StudentCombobox alunos={alunos} />` inside the new-matrícula form):

```tsx
<StudentCombobox
  alunos={alunos}
  defaultValue={
    alunoPre
      ? { id: alunoPre.id, nome: alunoPre.nome, matricula_codigo: alunoPre.matricula_codigo }
      : undefined
  }
/>
```

- [ ] **Step 2: Panel id confirmed**

`src/components/ui/card.tsx` already spreads `...props` onto the underlying `<section>`, so `id="nova-matricula"` is forwarded as-is. No change needed.

- [ ] **Step 3: Type-check**

Run:
```
npm run typecheck
```
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`.

- Open `/matriculas?aluno_id=<valid-id>` directly. Verify: page scrolls to "Nova matrícula" panel; `StudentCombobox` shows aluno's name pre-filled.
- Open `/matriculas?aluno_id=invalid-uuid`. Verify: page loads normally; combobox is empty; no error.
- From a student without active matrícula at `/alunos/<id>`, click "Matricular aluno". Verify: lands at `/matriculas?aluno_id=<id>` with combobox pre-filled and scrolled to form.

Stop dev server.

- [ ] **Step 5: Commit**

```
git add src/app/(app)/matriculas/page.tsx
git commit -m "feat(matriculas): pre-select aluno + scroll anchor via ?aluno_id"
```

---

## Task 7: "Gerado" / "Enviado" badge on StudentDocumentsPanel

**Files:**
- Modify: `src/components/students/student-documents-panel.tsx`

- [ ] **Step 1: Add badge based on tipo_documento**

Modify `src/components/students/student-documents-panel.tsx`.

Add import at top (alongside existing imports):

```tsx
import { Badge } from "@/components/ui/badge";
```

Add helper at top of the file (above the component):

```tsx
const GENERATED_TIPOS = new Set(["contrato", "declaracao", "termo"]);

function origemBadge(tipo: string) {
  return GENERATED_TIPOS.has(tipo) ? "generated" : "uploaded";
}
```

Inside the `documents.map((document) => ...)` render, locate the `<article>` block (currently shows `nome_arquivo` + `tipo_documento` / size). Replace the inner `<div>` containing the file icon + name + meta line with:

```tsx
<div className="flex items-start gap-3">
  <FileText className="mt-1 text-moss" size={18} />
  <div className="grid gap-1">
    <strong className="block text-sm text-ink">{document.nome_arquivo}</strong>
    <div className="flex items-center gap-2 text-xs text-muted">
      <span>{document.tipo_documento} / {sizeLabel(document.tamanho_bytes)}</span>
      {origemBadge(document.tipo_documento) === "generated" ? (
        <Badge tone="green">Gerado</Badge>
      ) : (
        <Badge tone="gray">Enviado</Badge>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 2: Type-check**

Run:
```
npm run typecheck
```
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev`.

- Open `/alunos/<id>` for a student with at least one generated doc (declaração/termo/contrato) and one uploaded doc (certidão, etc.). If none exist, generate one via the new header button first, then upload any PDF via the existing upload form.
- Confirm generated docs show a green "Gerado" badge; uploaded docs show a gray "Enviado" badge.

Stop dev server.

- [ ] **Step 4: Commit**

```
git add src/components/students/student-documents-panel.tsx
git commit -m "feat(students): badge Gerado/Enviado em documentos anexados"
```

---

## Task 8: End-to-end manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full happy-path walkthrough**

Run `npm run dev`. With a student that has an active matrícula:

1. Open `/alunos/<id>`.
2. For each of the 3 quick buttons (Decl. Frequência, Decl. Transferência, Termo Resp.):
   - Click. Confirm spinner appears on that button; others remain enabled-but-disabled-via-loading.
   - `.docx` downloads.
   - Success toast appears top-right with the filename.
   - Document appears in "Documentos anexados" panel below with badge "Gerado".
3. Open "Mais ▾" dropdown. For each of the 3 templates (Termo Integrado, Contrato Pinguinho, Contrato Colégio):
   - Click. Same expected behavior as quick buttons. Dropdown closes after click.
4. Open "Mais ▾" dropdown. Click "Exportar ficha (PDF)". Confirm PDF downloads (no toast — uses existing jsPDF path).
5. Click outside the dropdown to close. Open it again and press `Esc`. Confirm it closes.

- [ ] **Step 2: Sem-matrícula path**

With a student whose matrículas are all non-`ativa` (or no matrícula at all):

1. Open `/alunos/<id>`.
2. Confirm only "➕ Matricular aluno" appears (no quick buttons, no dropdown).
3. Click it. Confirm landing at `/matriculas?aluno_id=<id>`, combobox pre-filled, scrolled to form.

- [ ] **Step 3: Error path**

Simulate a server error. Easiest method: temporarily edit `src/lib/actions/documents-generate.ts` to `throw new Error("simulated")` at the top of the `try` block. Restart dev server. Click any quick button. Confirm an error toast appears with the message. Restore the file.

- [ ] **Step 4: Redundancy intact**

Open `/matriculas/<id>?tab=documentos`. Confirm the original `DocumentGenerator` still works (select template, click "Baixar .docx", file downloads).

- [ ] **Step 5: Stop dev server, commit checklist outcome**

If everything passed, no commit needed. If you made a fix during smoke test, commit it with a clear message describing the fix.

---

## Self-review summary

- Spec section "Decisões de produto" #1-6 all map to tasks above.
- Spec section "Layout" — Task 3 (component) + Task 5 (mount).
- Spec section "Arquitetura > Componentes novos" — Tasks 1, 2, 3.
- Spec section "Arquitetura > Arquivos modificados" — Tasks 1 (layout, package.json), 2 (document-generator), 5 (alunos/[id]/page), 6 (matriculas/page), 7 (student-documents-panel).
- Spec section "Edge cases" — all covered by either existing action (rollback, naming) or component logic (disabled while loading, dropdown close, sem-matrícula branch).
- Spec section "Testing" — Task 8 covers the manual checklist.
- Spec section "Fora de escopo" — respected; no bulk gen, no template editor, no notifications.

Type consistency: `MatriculaAtiva = { id: string; codigo: string | null }` is the single shape used in Tasks 3, 4, 5. `TipoTemplate` comes from existing `src/lib/documents/templates.ts`.
