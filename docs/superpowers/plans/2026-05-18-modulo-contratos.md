# Módulo de Geração de Documentos (Contratos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar geração de PDF a partir de templates `.docx` na página de matrícula, com armazenamento automático em `documentos_aluno`.

**Architecture:** Server Action busca dados do aluno/matrícula/responsáveis, usa `docxtemplater` + `pizzip` para substituir variáveis `{VARIAVEL}` no template `.docx`, converte para PDF via `jsPDF`, faz upload no Supabase Storage e insere registro em `documentos_aluno`. UI é um select + botão na página `/matriculas/[id]`.

**Tech Stack:** Next.js 14 App Router, Server Actions, docxtemplater, pizzip, jsPDF, Supabase Storage, TypeScript

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/YYYYMMDD_documento_tipos.sql` | Criar | ADD VALUE 'contrato', 'declaracao', 'termo' no enum tipo_documento |
| `public/templates/` | Criar dir | Templates `.docx` convertidos com variáveis `{VAR}` |
| `src/lib/documents/templates.ts` | Criar | Enum TipoTemplate, metadados (nome display, arquivo, tipo_documento DB) |
| `src/lib/documents/variables.ts` | Criar | Tipo DocumentVariables, função buildVariables(matriculaId) |
| `src/lib/documents/generator.ts` | Criar | generateDocx(tipoTemplate, vars) → Buffer .docx; generatePdf(docxBuffer) → Buffer PDF |
| `src/lib/actions/documents-generate.ts` | Criar | Server Action generateDocumentoAction(matriculaId, tipoTemplate) |
| `src/lib/data/documents.ts` | Modificar | Adicionar getMatriculaDocumentos(matriculaId, alunoId) filtrado por tipo |
| `src/components/matriculas/document-generator.tsx` | Criar | UI: select tipo + botão + lista docs gerados |
| `src/app/(app)/matriculas/[id]/page.tsx` | Modificar | Incluir DocumentGenerator no layout da página |

---

## Task 1: Instalar dependências e criar migration

**Files:**
- Modify: `package.json`
- Create: `supabase/migrations/20260518001_documento_tipos.sql`

- [ ] **Step 1: Instalar docxtemplater e pizzip**

```bash
npm install docxtemplater pizzip
npm install --save-dev @types/pizzip
```

Expected: packages adicionados sem conflito. `docxtemplater` e `pizzip` aparecem em `package.json` dependencies.

- [ ] **Step 2: Criar migration para novos valores no enum**

Criar `supabase/migrations/20260518001_documento_tipos.sql`:

```sql
-- Adiciona tipos de documento gerado pelo sistema ao enum tipo_documento
ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'contrato';
ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'declaracao';
ALTER TYPE tipo_documento ADD VALUE IF NOT EXISTS 'termo';
```

- [ ] **Step 3: Aplicar migration localmente**

```bash
npx supabase db push
```

Expected: migration aplicada sem erro. Se usar Supabase remoto direto, aplicar via dashboard SQL editor.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json supabase/migrations/20260518001_documento_tipos.sql
git commit -m "feat(contratos): instala docxtemplater/pizzip; migration tipo_documento"
```

---

## Task 2: Preparar templates .docx

**Files:**
- Create: `public/templates/` (diretório)
- Create: 5 arquivos `.docx` convertidos

- [ ] **Step 1: Converter arquivos .doc → .docx**

Abrir cada arquivo no Microsoft Word e salvar como `.docx` em `public/templates/`:

| Arquivo origem | Salvar como |
|---|---|
| `public/CONTRATO COLÉGIO INTEGRADO.doc` | `public/templates/contrato-colegio-integrado.docx` |
| `public/CONTRATO PINGUINHO DE GENTE.doc` | `public/templates/contrato-pinguinho.docx` |
| `public/DECLARAÇÃO DE TRANSFERÊNCIA.doc` | `public/templates/declaracao-transferencia.docx` |
| `public/TERMO DE RESPONSABILIDADE.doc` | `public/templates/termo-responsabilidade.docx` |
| `public/DECLARAÇÃ FREQUÊNCIA PINGUINHO.doc` | `public/templates/declaracao-frequencia.docx` |

- [ ] **Step 2: Substituir placeholders pelos marcadores docxtemplater**

Em cada template `.docx`, usar Buscar/Substituir (Ctrl+H) no Word para trocar os placeholders existentes pelo formato `{VARIAVEL}`:

| De | Para |
|---|---|
| `NOME_ALUNO` | `{NOME_ALUNO}` |
| `SERIE_ALUNO` | `{SERIE_ALUNO}` |
| `TURNO_ALUNO` | `{TURNO_ALUNO}` |
| `TIPOENSINO_ALUNO` | `{TIPOENSINO_ALUNO}` |
| `RG_PAI_ALUNO` | `{RG_PAI_ALUNO}` |
| `CPF_PAI_ALUNO` | `{CPF_PAI_ALUNO}` |
| `ENDERECO_PAI_ALUNO` | `{ENDERECO_PAI_ALUNO}` |
| `RG_MAE_ALUNO` | `{RG_MAE_ALUNO}` |
| `CPF_MAE_ALUNO` | `{CPF_MAE_ALUNO}` |
| `ENDERECO_MAE_ALUNO` | `{ENDERECO_MAE_ALUNO}` |
| `ENDERECO_RESP` | `{ENDERECO_RESP}` |
| `RAZAO_SOCIAL_EMPRESA` | `{RAZAO_SOCIAL_EMPRESA}` |
| `FANTASIA_EMPRESA` | `{FANTASIA_EMPRESA}` |
| `CIDADE_DATA_EXTENSO` | `{CIDADE_DATA_EXTENSO}` |
| `ANO_LETIVO` | `{ANO_LETIVO}` |

Salvar cada arquivo após substituição.

- [ ] **Step 3: Commit**

```bash
git add public/templates/
git commit -m "feat(contratos): adiciona templates .docx com variáveis docxtemplater"
```

---

## Task 3: Criar módulo de metadados de templates

**Files:**
- Create: `src/lib/documents/templates.ts`

- [ ] **Step 1: Criar arquivo de metadados**

Criar `src/lib/documents/templates.ts`:

```typescript
export const TIPO_TEMPLATE = {
  CONTRATO_COLEGIO: "contrato_colegio",
  CONTRATO_PINGUINHO: "contrato_pinguinho",
  DECLARACAO_FREQUENCIA: "declaracao_frequencia",
  DECLARACAO_TRANSFERENCIA: "declaracao_transferencia",
  TERMO_RESPONSABILIDADE: "termo_responsabilidade",
} as const;

export type TipoTemplate = (typeof TIPO_TEMPLATE)[keyof typeof TIPO_TEMPLATE];

export const TEMPLATE_META: Record<
  TipoTemplate,
  { label: string; arquivo: string; tipoDocumento: string }
> = {
  contrato_colegio: {
    label: "Contrato — Colégio Integrado",
    arquivo: "contrato-colegio-integrado.docx",
    tipoDocumento: "contrato",
  },
  contrato_pinguinho: {
    label: "Contrato — Pinguinho de Gente",
    arquivo: "contrato-pinguinho.docx",
    tipoDocumento: "contrato",
  },
  declaracao_frequencia: {
    label: "Declaração de Frequência",
    arquivo: "declaracao-frequencia.docx",
    tipoDocumento: "declaracao",
  },
  declaracao_transferencia: {
    label: "Declaração de Transferência",
    arquivo: "declaracao-transferencia.docx",
    tipoDocumento: "declaracao",
  },
  termo_responsabilidade: {
    label: "Termo de Responsabilidade",
    arquivo: "termo-responsabilidade.docx",
    tipoDocumento: "termo",
  },
};

export function isTipoTemplate(value: unknown): value is TipoTemplate {
  return Object.values(TIPO_TEMPLATE).includes(value as TipoTemplate);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/documents/templates.ts
git commit -m "feat(contratos): metadados de templates (TipoTemplate, TEMPLATE_META)"
```

---

## Task 4: Criar função buildVariables

**Files:**
- Create: `src/lib/documents/variables.ts`

Esta função busca todos os dados necessários para preencher os templates a partir do ID da matrícula.

- [ ] **Step 1: Criar variables.ts**

Criar `src/lib/documents/variables.ts`:

```typescript
import { createServerClient } from "@/lib/supabase/server";

export type DocumentVariables = {
  NOME_ALUNO: string;
  SERIE_ALUNO: string;
  TURNO_ALUNO: string;
  TIPOENSINO_ALUNO: string;
  ANO_LETIVO: string;
  RG_PAI_ALUNO: string;
  CPF_PAI_ALUNO: string;
  ENDERECO_PAI_ALUNO: string;
  RG_MAE_ALUNO: string;
  CPF_MAE_ALUNO: string;
  ENDERECO_MAE_ALUNO: string;
  ENDERECO_RESP: string;
  RAZAO_SOCIAL_EMPRESA: string;
  FANTASIA_EMPRESA: string;
  CIDADE_DATA_EXTENSO: string;
};

function formatEndereco(e: {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
} | null): string {
  if (!e) return "";
  const parts = [
    e.logradouro,
    e.numero ? `nº ${e.numero}` : null,
    e.complemento,
    e.bairro,
    e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade,
    e.cep,
  ].filter(Boolean);
  return parts.join(", ");
}

function formatDataExtenso(date: Date): string {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `Trindade, ${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
}

export async function buildVariables(matriculaId: string): Promise<DocumentVariables> {
  const supabase = await createServerClient();

  const { data: matricula, error: matError } = await supabase
    .from("matriculas")
    .select(`
      ano_letivo,
      escola_id,
      aluno_id,
      alunos(id, nome),
      series(nome, tipo_ensino),
      turmas(turno),
      escolas(razao_social, nome_fantasia)
    `)
    .eq("id", matriculaId)
    .single();

  if (matError || !matricula) throw new Error("Matrícula não encontrada");

  const alunoId = matricula.aluno_id as string;

  const [responsaveisRes, enderecosRes] = await Promise.all([
    supabase
      .from("responsaveis_aluno")
      .select("nome, cpf, rg, parentesco, responsavel_financeiro")
      .eq("aluno_id", alunoId),
    supabase
      .from("enderecos_aluno")
      .select("*")
      .eq("aluno_id", alunoId)
      .limit(1),
  ]);

  const responsaveis = responsaveisRes.data ?? [];
  const enderecoAluno = enderecosRes.data?.[0] ?? null;

  const pai = responsaveis.find((r) =>
    ["pai", "padrasto"].includes((r.parentesco ?? "").toLowerCase())
  );
  const mae = responsaveis.find((r) =>
    ["mae", "mãe", "madrasta"].includes((r.parentesco ?? "").toLowerCase())
  );
  const respFinanceiro = responsaveis.find((r) => r.responsavel_financeiro) ?? responsaveis[0];

  const escola = Array.isArray(matricula.escolas) ? matricula.escolas[0] : matricula.escolas;
  const aluno = Array.isArray(matricula.alunos) ? matricula.alunos[0] : matricula.alunos;
  const serie = Array.isArray(matricula.series) ? matricula.series[0] : matricula.series;
  const turma = Array.isArray(matricula.turmas) ? matricula.turmas[0] : matricula.turmas;

  const enderecoFormatado = formatEndereco(enderecoAluno);

  return {
    NOME_ALUNO: aluno?.nome ?? "",
    SERIE_ALUNO: serie?.nome ?? "",
    TURNO_ALUNO: (turma?.turno ?? "").toUpperCase(),
    TIPOENSINO_ALUNO: serie?.tipo_ensino ?? "",
    ANO_LETIVO: String(matricula.ano_letivo ?? ""),
    RG_PAI_ALUNO: pai?.rg ?? "",
    CPF_PAI_ALUNO: pai?.cpf ?? "",
    ENDERECO_PAI_ALUNO: enderecoFormatado,
    RG_MAE_ALUNO: mae?.rg ?? "",
    CPF_MAE_ALUNO: mae?.cpf ?? "",
    ENDERECO_MAE_ALUNO: enderecoFormatado,
    ENDERECO_RESP: enderecoFormatado,
    RAZAO_SOCIAL_EMPRESA: escola?.razao_social ?? "",
    FANTASIA_EMPRESA: escola?.nome_fantasia ?? "",
    CIDADE_DATA_EXTENSO: formatDataExtenso(new Date()),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/documents/variables.ts
git commit -m "feat(contratos): buildVariables busca dados do aluno/matrícula para templates"
```

---

## Task 5: Criar gerador de documentos (docxtemplater → PDF)

**Files:**
- Create: `src/lib/documents/generator.ts`

- [ ] **Step 1: Criar generator.ts**

Criar `src/lib/documents/generator.ts`:

```typescript
import path from "path";
import fs from "fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { jsPDF } from "jspdf";
import type { DocumentVariables } from "./variables";
import { TEMPLATE_META, type TipoTemplate } from "./templates";

export function generateDocx(
  tipoTemplate: TipoTemplate,
  variables: DocumentVariables
): Buffer {
  const meta = TEMPLATE_META[tipoTemplate];
  const templatePath = path.join(process.cwd(), "public", "templates", meta.arquivo);
  const content = fs.readFileSync(templatePath);

  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render(variables as unknown as Record<string, string>);

  return doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
}

export function extractTextFromDocx(docxBuffer: Buffer): string {
  const zip = new PizZip(docxBuffer);
  const documentXml = zip.files["word/document.xml"]?.asText() ?? "";
  return documentXml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, "\n")
    .trim();
}

export function generatePdf(text: string, titulo: string): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(titulo, pageWidth / 2, 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const lines = doc.splitTextToSize(text, maxWidth);
  let y = 32;
  const lineHeight = 5;
  const pageHeight = doc.internal.pageSize.getHeight();

  for (const line of lines) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export async function generateDocumentoPdf(
  tipoTemplate: TipoTemplate,
  variables: DocumentVariables
): Promise<{ pdfBuffer: Buffer; nomeArquivo: string }> {
  const meta = TEMPLATE_META[tipoTemplate];
  const docxBuffer = generateDocx(tipoTemplate, variables);
  const text = extractTextFromDocx(docxBuffer);
  const nomeAluno = variables.NOME_ALUNO || "Aluno";
  const anoLetivo = variables.ANO_LETIVO || String(new Date().getFullYear());
  const nomeArquivo = `${meta.label} - ${nomeAluno} - ${anoLetivo}.pdf`;
  const pdfBuffer = generatePdf(text, meta.label);
  return { pdfBuffer, nomeArquivo };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/documents/generator.ts
git commit -m "feat(contratos): generator.ts — docxtemplater + jsPDF para geração de PDF"
```

---

## Task 6: Criar Server Action de geração

**Files:**
- Create: `src/lib/actions/documents-generate.ts`

- [ ] **Step 1: Criar Server Action**

Criar `src/lib/actions/documents-generate.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { buildVariables } from "@/lib/documents/variables";
import { generateDocumentoPdf } from "@/lib/documents/generator";
import { isTipoTemplate, TEMPLATE_META } from "@/lib/documents/templates";

export async function generateDocumentoAction(
  matriculaId: string,
  tipoTemplateRaw: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  await requireSession();

  if (!isTipoTemplate(tipoTemplateRaw)) {
    return { success: false, error: "Tipo de template inválido." };
  }

  const supabase = await createServerClient();

  const { data: matricula, error: matError } = await supabase
    .from("matriculas")
    .select("aluno_id")
    .eq("id", matriculaId)
    .single();

  if (matError || !matricula) {
    return { success: false, error: "Matrícula não encontrada." };
  }

  const alunoId = matricula.aluno_id as string;

  try {
    const variables = await buildVariables(matriculaId);
    const { pdfBuffer, nomeArquivo } = await generateDocumentoPdf(tipoTemplateRaw, variables);

    const safeName = nomeArquivo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${alunoId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos-alunos")
      .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });

    if (uploadError) throw uploadError;

    const meta = TEMPLATE_META[tipoTemplateRaw];

    const { error: insertError } = await supabase.from("documentos_aluno").insert({
      aluno_id: alunoId,
      nome_arquivo: nomeArquivo,
      tipo_documento: meta.tipoDocumento,
      storage_path: storagePath,
      content_type: "application/pdf",
      tamanho_bytes: pdfBuffer.length,
    });

    if (insertError) throw insertError;

    const { data: signed } = await supabase.storage
      .from("documentos-alunos")
      .createSignedUrl(storagePath, 60 * 30);

    revalidatePath(`/matriculas/${matriculaId}`);
    revalidatePath(`/alunos/${alunoId}`);

    return { success: true, url: signed?.signedUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar documento.";
    return { success: false, error: msg };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/documents-generate.ts
git commit -m "feat(contratos): Server Action generateDocumentoAction"
```

---

## Task 7: Adicionar query de documentos filtrada por tipo

**Files:**
- Modify: `src/lib/data/documents.ts`

- [ ] **Step 1: Adicionar função getMatriculaDocumentos**

No arquivo existente `src/lib/data/documents.ts`, adicionar ao final:

```typescript
const TIPOS_GERADOS = ["contrato", "declaracao", "termo"] as const;

export async function getMatriculaDocumentos(alunoId: string): Promise<StudentDocument[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("documentos_aluno")
    .select("*")
    .eq("aluno_id", alunoId)
    .in("tipo_documento", TIPOS_GERADOS)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (item) => {
      const { data: signed } = await supabase.storage
        .from("documentos-alunos")
        .createSignedUrl(item.storage_path, 60 * 30);
      return { ...item, signed_url: signed?.signedUrl ?? null };
    })
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data/documents.ts
git commit -m "feat(contratos): getMatriculaDocumentos filtra docs gerados pelo sistema"
```

---

## Task 8: Criar componente DocumentGenerator

**Files:**
- Create: `src/components/matriculas/document-generator.tsx`

- [ ] **Step 1: Criar componente**

Criar `src/components/matriculas/document-generator.tsx`:

```tsx
"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { generateDocumentoAction } from "@/lib/actions/documents-generate";
import { TIPO_TEMPLATE, TEMPLATE_META, type TipoTemplate } from "@/lib/documents/templates";
import type { StudentDocument } from "@/lib/data/documents";

function sizeLabel(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface Props {
  matriculaId: string;
  documentosIniciais: StudentDocument[];
}

export function DocumentGenerator({ matriculaId, documentosIniciais }: Props) {
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoTemplate>(
    TIPO_TEMPLATE.CONTRATO_COLEGIO
  );
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<StudentDocument[]>(documentosIniciais);

  async function handleGerar() {
    setLoading(true);
    setErro(null);
    try {
      const result = await generateDocumentoAction(matriculaId, tipoSelecionado);
      if (!result.success) {
        setErro(result.error ?? "Erro desconhecido.");
      } else {
        if (result.url) {
          window.open(result.url, "_blank");
        }
        // Refresh lista via revalidatePath — recarregar documentos
        const res = await fetch(`/api/matriculas/${matriculaId}/documentos`);
        if (res.ok) {
          const novos = await res.json();
          setDocumentos(novos);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel className="grid gap-5">
      <h2 className="font-serif text-2xl text-ink">Documentos</h2>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Tipo de documento</span>
          <select
            value={tipoSelecionado}
            onChange={(e) => setTipoSelecionado(e.target.value as TipoTemplate)}
            className="rounded-ui border border-line bg-surface px-3 py-2 text-sm text-ink"
            disabled={loading}
          >
            {Object.values(TIPO_TEMPLATE).map((tipo) => (
              <option key={tipo} value={tipo}>
                {TEMPLATE_META[tipo].label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="accent" onClick={handleGerar} disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Gerando...
            </>
          ) : (
            "Gerar PDF"
          )}
        </Button>
      </div>

      {erro && (
        <p className="rounded-ui border border-clay/30 bg-clay/10 p-3 text-sm text-clay">
          {erro}
        </p>
      )}

      {documentos.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-ink">Documentos gerados</p>
          {documentos.map((doc) => (
            <article
              key={doc.id}
              className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 shrink-0 text-moss" size={18} />
                <div>
                  <strong className="block text-sm text-ink">{doc.nome_arquivo}</strong>
                  <span className="text-xs text-muted">
                    {formatDate(doc.created_at)} · {sizeLabel(doc.tamanho_bytes)}
                  </span>
                </div>
              </div>
              {doc.signed_url && (
                <a
                  href={doc.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1 text-sm font-bold text-brand"
                >
                  <Download size={14} />
                  Baixar
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/matriculas/document-generator.tsx
git commit -m "feat(contratos): componente DocumentGenerator — select + botão + lista"
```

---

## Task 9: Criar API route para refresh de documentos

O componente cliente precisa recarregar a lista após geração. Criar rota mínima.

**Files:**
- Create: `src/app/api/matriculas/[id]/documentos/route.ts`

- [ ] **Step 1: Criar route handler**

Criar `src/app/api/matriculas/[id]/documentos/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";

const TIPOS_GERADOS = ["contrato", "declaracao", "termo"];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await requireSession();
  const supabase = await createServerClient();

  const { data: matricula } = await supabase
    .from("matriculas")
    .select("aluno_id")
    .eq("id", params.id)
    .single();

  if (!matricula) return NextResponse.json([]);

  const { data: docs } = await supabase
    .from("documentos_aluno")
    .select("*")
    .eq("aluno_id", matricula.aluno_id)
    .in("tipo_documento", TIPOS_GERADOS)
    .order("created_at", { ascending: false });

  const docsComUrl = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from("documentos-alunos")
        .createSignedUrl(doc.storage_path, 60 * 30);
      return { ...doc, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json(docsComUrl);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/matriculas/[id]/documentos/route.ts
git commit -m "feat(contratos): API route GET /api/matriculas/[id]/documentos"
```

---

## Task 10: Integrar DocumentGenerator na página de matrícula

**Files:**
- Modify: `src/app/(app)/matriculas/[id]/page.tsx`

- [ ] **Step 1: Ler página atual**

```bash
# Verificar estrutura atual da página
head -80 src/app/\(app\)/matriculas/\[id\]/page.tsx
```

- [ ] **Step 2: Adicionar imports e seção de documentos**

Na página `src/app/(app)/matriculas/[id]/page.tsx`, adicionar:

1. Imports no topo (junto com outros imports):
```typescript
import { DocumentGenerator } from "@/components/matriculas/document-generator";
import { getMatriculaDocumentos } from "@/lib/data/documents";
```

2. No body da função de página (após `getEnrollmentDetail`), buscar documentos:
```typescript
const documentos = await getMatriculaDocumentos(enrollment.aluno_id);
```

3. No JSX, adicionar o componente após a seção de frequência (ou ao final do layout):
```tsx
<DocumentGenerator
  matriculaId={params.id}
  documentosIniciais={documentos}
/>
```

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Expected: sem erros de tipo. Se `enrollment.aluno_id` não existir no tipo, verificar que o select em `getEnrollmentDetail` inclui `aluno_id` — adicionar ao select se necessário.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/matriculas/\[id\]/page.tsx
git commit -m "feat(contratos): integra DocumentGenerator na página de matrícula"
```

---

## Task 11: Teste manual end-to-end

- [ ] **Step 1: Iniciar servidor de desenvolvimento**

```bash
npm run dev
```

- [ ] **Step 2: Verificar que templates existem**

Confirmar que os 5 arquivos `.docx` estão em `public/templates/` com variáveis `{VARIAVEL}` inseridas.

- [ ] **Step 3: Navegar para matrícula existente**

Abrir `http://localhost:3000/matriculas/[ID_DE_MATRICULA_EXISTENTE]`.

Expected: seção "Documentos" aparece com select e botão "Gerar PDF".

- [ ] **Step 4: Gerar contrato**

Selecionar "Contrato — Colégio Integrado" e clicar "Gerar PDF".

Expected:
- Botão mostra spinner "Gerando..."
- Nova aba abre com PDF
- PDF contém nome do aluno, série, turno preenchidos
- Lista de documentos gerados atualiza com novo item + link "Baixar"

- [ ] **Step 5: Verificar armazenamento**

No Supabase dashboard → Storage → `documentos-alunos`: verificar que arquivo PDF aparece.
Em `documentos_aluno`: verificar que registro inserido com `tipo_documento = 'contrato'`.

- [ ] **Step 6: Testar variável faltando**

Usar matrícula de aluno sem responsável pai cadastrado. Gerar contrato. Expected: PDF gerado com campo `{RG_PAI_ALUNO}` vazio (sem erro, sem bloqueio).

- [ ] **Step 7: Commit final**

```bash
git add -A
git commit -m "feat(contratos): módulo completo de geração de documentos/contratos"
```

---

## Notas de Implementação

### Sobre o `escolas` join

A query em `buildVariables` usa `.select("escolas(razao_social, nome_fantasia)")` na tabela `matriculas`. Verificar que a FK `escola_id` tem relação no schema Supabase (deve ter — `DEFAULT_SCHOOL_ID` é usado em todas as queries). Se a relação não estiver configurada, buscar escola separadamente:

```typescript
const { data: escola } = await supabase
  .from("escolas")
  .select("razao_social, nome_fantasia")
  .eq("id", matricula.escola_id)
  .single();
```

### Sobre responsaveis_aluno e campo `parentesco` vs `relacao`

O schema explorado mostra campo `parentesco` em `responsaveis_aluno`. Verificar coluna real na migration `202605130001_initial_schema.sql`. Se for `relacao` em vez de `parentesco`, ajustar em `buildVariables`:

```typescript
// Se coluna for 'relacao':
const pai = responsaveis.find((r) =>
  ["pai", "padrasto"].includes((r.relacao ?? "").toLowerCase())
);
```

### Sobre `rg` em responsaveis_aluno

Schema explorado mostra `cpf` mas não confirmou `rg`. Verificar se coluna `rg` existe. Se não existir, omitir `RG_PAI_ALUNO` e `RG_MAE_ALUNO` do select — campos ficarão vazios no PDF.
