# Portaria Facial — Sub-spec 1: Reconhecimento + Embeddings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o cadastro biométrico simulado por extração real de embedding facial via `@vladmandic/face-api` no browser, persistir vetor centroid de 3 fotos em coluna pgvector, expor endpoint `POST /api/portaria/match` para o futuro runtime da câmera, e cobrir LGPD com consentimento + revogação.

**Architecture:** Migração habilita pgvector e adiciona coluna `embedding vector(128)` em `biometrias_aluno` + função SQL `match_biometria`. Lib face-api carrega no browser (modelos servidos por `public/face-models/`). Helpers `extractEmbedding` e `computeCentroid` extraem e combinam 3 capturas. Server actions `setConsentAction` e `saveBiometryAction` registram consentimento/biometria. Componente `<BiometricEnrollment>` (client) substitui o `<StudentFaceCapture>` simulado.

**Tech Stack:** Next.js 14.2.35 (App Router), Supabase Postgres + pgvector, TypeScript, `@vladmandic/face-api` 1.7.x, Tailwind, jspdf (já no projeto).

**Spec:** `docs/superpowers/specs/2026-05-15-portaria-facial-1-reconhecimento-design.md`

---

## File Structure

### Novos arquivos

- `supabase/migrations/202605180001_face_embeddings.sql` — pgvector extension, colunas, índice, função `match_biometria`.
- `public/face-models/README.md` — descreve modelos baixados e fonte.
- `public/face-models/*` — 7 arquivos de modelo face-api (binários + manifests). Copiados manualmente.
- `src/lib/face/face-api-loader.ts` — carrega 3 redes no client (idempotente).
- `src/lib/face/extract-embedding.ts` — extrai embedding com validações.
- `src/lib/face/centroid.ts` — `computeCentroid` + `vectorToPgString` (puros).
- `src/lib/actions/biometrics.ts` — `setConsentAction`, `saveBiometryAction`.
- `src/lib/data/biometrics.ts` — `getStudentBiometryData(alunoId)`.
- `src/app/api/portaria/match/route.ts` — POST endpoint.
- `src/components/students/biometric-enrollment.tsx` — componente principal (client).
- `src/components/students/biometric-consent-form.tsx` — form de consentimento (server, com action).
- `src/components/students/face-capture-step.tsx` — wizard step com câmera (client).
- `src/components/students/face-upload-fallback.tsx` — upload de 3 fotos do disco (client).

### Arquivos modificados

- `package.json` — adiciona `@vladmandic/face-api`.
- `src/app/(app)/alunos/[id]/editar/page.tsx` — substitui `<StudentGatePanel>` por nova `<BiometricEnrollment>` (mantém `<StudentGatePanel>` para preferências de notificação se necessário; ver Task 19).
- `src/lib/data/gate.ts` ou outro consumer de `getStudentGateSettings` — manter compatibilidade.

### Arquivos preservados

- `src/components/students/student-face-capture.tsx` — atual simulado. Substituído pela nova `BiometricEnrollment`. Após validação manual, **deletado** na Task 19.
- `src/app/api/portaria/biometrias/route.ts` — endpoint legado mantido (compatibilidade).
- `src/lib/actions/gate.ts` (`uploadStudentFaceReferenceAction`, `deactivateStudentFaceReferenceAction`) — removidos na Task 19.

---

## Fase 1 — Schema

### Task 1: Migration pgvector + colunas

**Files:**
- Create: `supabase/migrations/202605180001_face_embeddings.sql`

- [ ] **Step 1: Criar arquivo**

```sql
-- Portaria facial sub-spec 1: pgvector + embedding column + match function.

create extension if not exists vector;

alter table biometrias_aluno
  add column if not exists embedding vector(128),
  add column if not exists score_qualidade numeric(5,3);

create index if not exists biometrias_aluno_embedding_idx
  on biometrias_aluno using ivfflat (embedding vector_l2_ops)
  with (lists = 100)
  where ativo = true and embedding is not null;

alter table consentimentos_biometria
  add column if not exists termo_documento_id uuid references documentos_aluno(id) on delete set null;
```

- [ ] **Step 2: Aplicar localmente**

Run: `npx supabase db reset`
Expected: clean. Migration nova entre as últimas. Re-aplicar `npm run seed:auth`.

- [ ] **Step 3: Confirmar extensão ativa**

Run:
```
npx supabase db execute --local "select extname, extversion from pg_extension where extname = 'vector';"
```
Expected: 1 linha com `vector`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/202605180001_face_embeddings.sql
git commit -m "feat(db): enable pgvector and add embedding column on biometrias_aluno"
```

---

### Task 2: Função match_biometria

**Files:**
- Modify: `supabase/migrations/202605180001_face_embeddings.sql`

- [ ] **Step 1: Append função**

```sql
create or replace function match_biometria(
  p_embedding vector(128),
  p_threshold numeric default 0.6,
  p_escola_id uuid default null
)
returns table (
  biometria_id uuid,
  aluno_id uuid,
  matricula_codigo text,
  nome text,
  distancia float,
  confianca numeric
) as $$
  select
    b.id as biometria_id,
    b.aluno_id,
    a.matricula_codigo,
    a.nome,
    (b.embedding <-> p_embedding)::float as distancia,
    round((1 - (b.embedding <-> p_embedding) / 2)::numeric * 100, 2) as confianca
  from biometrias_aluno b
  join alunos a on a.id = b.aluno_id
  join consentimentos_biometria c on c.aluno_id = b.aluno_id
  where b.ativo = true
    and b.embedding is not null
    and a.ativo = true
    and c.autorizado = true
    and (p_escola_id is null or a.escola_id = p_escola_id)
    and (b.embedding <-> p_embedding) < p_threshold
  order by b.embedding <-> p_embedding asc
  limit 1;
$$ language sql stable security definer set search_path = public, extensions;

grant execute on function match_biometria(vector, numeric, uuid) to authenticated, service_role;
```

- [ ] **Step 2: Aplicar e testar**

Run: `npx supabase db reset` (clean).
Run sanity-test (deve retornar 0 linhas — ainda não há biometrias com embedding):
```
npx supabase db execute --local "
  select * from match_biometria(
    ('[' || array_to_string(array(select '0'::text from generate_series(1,128)), ',') || ']')::vector(128),
    0.6,
    '00000000-0000-0000-0000-000000000001'
  );
"
```
Expected: 0 linhas, sem erro de execução.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202605180001_face_embeddings.sql
git commit -m "feat(db): add match_biometria SQL function"
```

---

## Fase 2 — Setup face-api

### Task 3: Instalar dependência

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar**

Run: `npm install @vladmandic/face-api`
Expected: `package.json` recebe entrada em `dependencies`. `package-lock.json` atualizado.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @vladmandic/face-api dependency"
```

---

### Task 4: Provisionar modelos face-api

**Files:**
- Create: `public/face-models/README.md`
- Create: `public/face-models/ssd_mobilenetv1_model-shard1`
- Create: `public/face-models/ssd_mobilenetv1_model-shard2` (se aplicável)
- Create: `public/face-models/ssd_mobilenetv1_model-weights_manifest.json`
- Create: `public/face-models/face_landmark_68_model-shard1`
- Create: `public/face-models/face_landmark_68_model-weights_manifest.json`
- Create: `public/face-models/face_recognition_model-shard1`
- Create: `public/face-models/face_recognition_model-shard2`
- Create: `public/face-models/face_recognition_model-weights_manifest.json`

- [ ] **Step 1: Criar diretório**

Run: `mkdir -p public/face-models`

- [ ] **Step 2: Baixar arquivos**

Os modelos vivem em `https://github.com/vladmandic/face-api/tree/master/model`. Baixar (via `curl` ou navegador) os 9 arquivos listados acima. Tamanho total ~6MB.

Run (PowerShell — repetir por arquivo):
```powershell
$base = "https://raw.githubusercontent.com/vladmandic/face-api/master/model"
$files = @(
  "ssd_mobilenetv1_model-shard1",
  "ssd_mobilenetv1_model-shard2",
  "ssd_mobilenetv1_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  "face_landmark_68_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2",
  "face_recognition_model-weights_manifest.json"
)
foreach ($f in $files) {
  Invoke-WebRequest "$base/$f" -OutFile "public/face-models/$f"
}
```

Alguns modelos têm apenas 1 shard; se um download retornar 404 (sem `shard2`), continuar.

- [ ] **Step 3: Criar README**

Criar `public/face-models/README.md`:
```markdown
# face-api models

Modelos de `@vladmandic/face-api` usados pelo cadastro biométrico (browser).

Fonte: https://github.com/vladmandic/face-api/tree/master/model

Necessários:
- ssd_mobilenetv1_model-*
- face_landmark_68_model-*
- face_recognition_model-*

Total: ~6 MB. Não comitar como LFS — arquivos pequenos e raramente atualizados.
```

- [ ] **Step 4: Verificar files**

Run: `ls public/face-models/`
Expected: arquivos listados (manifest + shards).

- [ ] **Step 5: Commit**

```bash
git add public/face-models
git commit -m "chore(face): vendor face-api models in public/"
```

---

### Task 5: Loader (client)

**Files:**
- Create: `src/lib/face/face-api-loader.ts`

- [ ] **Step 1: Escrever**

```ts
"use client";
import * as faceapi from "@vladmandic/face-api";

let loaded = false;
let loadingPromise: Promise<void> | null = null;

export async function ensureFaceModels() {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const url = "/face-models";
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(url),
      faceapi.nets.faceLandmark68Net.loadFromUri(url),
      faceapi.nets.faceRecognitionNet.loadFromUri(url)
    ]);
    loaded = true;
  })();
  return loadingPromise;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/face/face-api-loader.ts
git commit -m "feat(face): add idempotent face-api model loader"
```

---

### Task 6: extract-embedding com validações

**Files:**
- Create: `src/lib/face/extract-embedding.ts`

- [ ] **Step 1: Escrever**

```ts
"use client";
import * as faceapi from "@vladmandic/face-api";
import { ensureFaceModels } from "./face-api-loader";

export type ExtractionResult =
  | { ok: true; embedding: number[]; score: number; box: { x: number; y: number; width: number; height: number } }
  | { ok: false; error: "no_face" | "multiple_faces" | "low_score" | "off_center" | "too_small"; detail?: string };

const MIN_SCORE = 0.7;
const MIN_FACE_PX = 100;

export async function extractEmbedding(image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<ExtractionResult> {
  await ensureFaceModels();
  const detections = await faceapi
    .detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) return { ok: false, error: "no_face" };
  if (detections.length > 1) return { ok: false, error: "multiple_faces" };
  const det = detections[0];
  if (det.detection.score < MIN_SCORE) return { ok: false, error: "low_score", detail: `score=${det.detection.score.toFixed(2)}` };
  const box = det.detection.box;
  if (box.width < MIN_FACE_PX || box.height < MIN_FACE_PX) return { ok: false, error: "too_small", detail: `${Math.round(box.width)}x${Math.round(box.height)}` };

  const imgW = "videoWidth" in image ? image.videoWidth : "width" in image ? image.width : 0;
  const imgH = "videoHeight" in image ? image.videoHeight : "height" in image ? image.height : 0;
  if (imgW && imgH) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const offX = Math.abs(cx - imgW / 2) / imgW;
    const offY = Math.abs(cy - imgH / 2) / imgH;
    if (offX > 0.25 || offY > 0.25) return { ok: false, error: "off_center" };
  }

  return {
    ok: true,
    embedding: Array.from(det.descriptor),
    score: det.detection.score,
    box: { x: box.x, y: box.y, width: box.width, height: box.height }
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/face/extract-embedding.ts
git commit -m "feat(face): add extractEmbedding with quality validations"
```

---

### Task 7: Centroid helper (puro)

**Files:**
- Create: `src/lib/face/centroid.ts`

- [ ] **Step 1: Escrever**

```ts
export function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) throw new Error("no embeddings");
  const dim = embeddings[0].length;
  const sum = new Array(dim).fill(0);
  for (const e of embeddings) {
    for (let i = 0; i < dim; i++) sum[i] += e[i];
  }
  return sum.map((v) => v / embeddings.length);
}

export function vectorToPgString(vec: number[]): string {
  return `[${vec.map((v) => v.toFixed(6)).join(",")}]`;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/face/centroid.ts
git commit -m "feat(face): add centroid + pgvector serialization helpers"
```

---

## Fase 3 — Server actions

### Task 8: setConsentAction

**Files:**
- Create: `src/lib/actions/biometrics.ts`

- [ ] **Step 1: Escrever inicial (só consent)**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { formText } from "@/lib/utils";

export async function setConsentAction(formData: FormData) {
  await requireSession();
  const alunoId = formText(formData, "aluno_id");
  const responsavelId = formText(formData, "responsavel_id");
  const autorizado = formText(formData, "autorizado") === "true";
  const observacao = formText(formData, "observacao");
  if (!alunoId) redirect(`/alunos?erro=id`);

  const supabase = await createServerClient();
  await supabase.from("consentimentos_biometria").upsert(
    {
      aluno_id: alunoId,
      autorizado,
      responsavel_id: responsavelId,
      data_consentimento: autorizado ? new Date().toISOString() : null,
      data_revogacao: autorizado ? null : new Date().toISOString(),
      observacao
    },
    { onConflict: "aluno_id" }
  );

  if (!autorizado) {
    const { data: bios } = await supabase
      .from("biometrias_aluno")
      .select("id, foto_referencia_path")
      .eq("aluno_id", alunoId)
      .eq("ativo", true);

    for (const bio of bios ?? []) {
      if (bio.foto_referencia_path) {
        await supabase.storage.from("biometrias-alunos").remove([bio.foto_referencia_path]);
      }
      await supabase
        .from("biometrias_aluno")
        .update({
          ativo: false,
          embedding: null,
          embedding_hash: null,
          embedding_encrypted: null,
          foto_referencia_path: null,
          data_revogacao: new Date().toISOString()
        })
        .eq("id", bio.id);
    }
  }

  revalidatePath(`/alunos/${alunoId}/editar`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/biometrics.ts
git commit -m "feat(biometrics): add setConsentAction with revocation cleanup"
```

---

### Task 9: saveBiometryAction

**Files:**
- Modify: `src/lib/actions/biometrics.ts`

- [ ] **Step 1: Append**

```ts
type SaveBiometryInput = {
  alunoId: string;
  embedding: number[];
  scoreMedio: number;
  fotoBase64: string;
};

export async function saveBiometryAction(input: SaveBiometryInput) {
  await requireSession();
  if (!input.alunoId) throw new Error("aluno_id requerido");
  if (input.embedding.length !== 128) throw new Error("embedding deve ter 128 dimensoes");

  const supabase = await createServerClient();

  const { data: consent } = await supabase
    .from("consentimentos_biometria")
    .select("autorizado")
    .eq("aluno_id", input.alunoId)
    .maybeSingle();
  if (!consent?.autorizado) throw new Error("consentimento ausente ou revogado");

  const base64Body = input.fotoBase64.replace(/^data:image\/\w+;base64,/, "");
  const fotoBuffer = Buffer.from(base64Body, "base64");
  const path = `${input.alunoId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("biometrias-alunos")
    .upload(path, fotoBuffer, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;

  await supabase
    .from("biometrias_aluno")
    .update({ ativo: false })
    .eq("aluno_id", input.alunoId)
    .eq("ativo", true);

  const vectorLiteral = `[${input.embedding.map((v) => v.toFixed(6)).join(",")}]`;
  const { error: insertError } = await supabase.from("biometrias_aluno").insert({
    aluno_id: input.alunoId,
    modelo: "face-api/ssd-mobilenetv1+facenet-128",
    embedding: vectorLiteral,
    score_qualidade: input.scoreMedio,
    foto_referencia_path: path,
    ativo: true,
    criado_por: "operador-web"
  });
  if (insertError) throw insertError;

  revalidatePath(`/alunos/${input.alunoId}/editar`);
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/biometrics.ts
git commit -m "feat(biometrics): add saveBiometryAction"
```

---

### Task 10: Data fetcher

**Files:**
- Create: `src/lib/data/biometrics.ts`

- [ ] **Step 1: Escrever**

```ts
import { createServerClient } from "@/lib/supabase/server";
import { getSignedFotoUrl } from "@/lib/storage/photos";

export type BiometryActive = {
  id: string;
  data_cadastro: string;
  score_qualidade: number | null;
  foto_referencia_path: string | null;
};

export type StudentBiometryData = {
  responsaveis: Array<{ id: string; nome: string }>;
  consentimento: { autorizado: boolean; responsavel_id: string | null; data_consentimento: string | null; observacao: string | null } | null;
  biometriaAtiva: BiometryActive | null;
  fotoReferenciaSignedUrl: string | null;
};

async function signedBiometryPhotoUrl(path: string | null) {
  if (!path) return null;
  // Reaproveita o helper de fotos genéricas para gerar URL temporária (assumindo bucket distinto).
  // Como o helper aponta para alunos-fotos, criamos signed URL via cliente direto.
  const supabase = await createServerClient();
  const { data } = await supabase.storage.from("biometrias-alunos").createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

export async function getStudentBiometryData(alunoId: string): Promise<StudentBiometryData> {
  const supabase = await createServerClient();
  const [responsaveis, consentimento, biometria] = await Promise.all([
    supabase.from("responsaveis_aluno").select("id, nome").eq("aluno_id", alunoId),
    supabase.from("consentimentos_biometria").select("autorizado, responsavel_id, data_consentimento, observacao").eq("aluno_id", alunoId).maybeSingle(),
    supabase.from("biometrias_aluno").select("id, data_cadastro, score_qualidade, foto_referencia_path").eq("aluno_id", alunoId).eq("ativo", true).maybeSingle()
  ]);

  const bio = biometria.data;
  const signed = await signedBiometryPhotoUrl(bio?.foto_referencia_path ?? null);

  return {
    responsaveis: responsaveis.data ?? [],
    consentimento: consentimento.data ?? null,
    biometriaAtiva: bio ?? null,
    fotoReferenciaSignedUrl: signed
  };
}
```

Note: `getSignedFotoUrl` import deixado mas não usado — remover se lint reclamar. Versão acima usa cliente direto para `biometrias-alunos`.

Limpar import órfão se necessário e re-typecheck.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa (remover `getSignedFotoUrl` import se não usado).

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/biometrics.ts
git commit -m "feat(data): add getStudentBiometryData"
```

---

## Fase 4 — API match

### Task 11: POST /api/portaria/match

**Files:**
- Create: `src/app/api/portaria/match/route.ts`

- [ ] **Step 1: Escrever**

```ts
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { isGateRequestAuthorized, unauthorizedGateResponse } from "@/lib/server/gate-api-auth";
// service role: chamada pela API /api/portaria/* (autenticada por GATE_API_TOKEN)
import { createAdminClient } from "@/lib/supabase/admin";

type MatchPayload = {
  embedding?: number[];
};

export async function POST(request: NextRequest) {
  if (!isGateRequestAuthorized(request)) return unauthorizedGateResponse();

  const payload = (await request.json()) as MatchPayload;
  if (!Array.isArray(payload.embedding) || payload.embedding.length !== 128) {
    return NextResponse.json({ error: "embedding invalido (esperado array 128)" }, { status: 400 });
  }

  const threshold = Number(process.env.GATE_MATCH_THRESHOLD ?? 0.6);
  const vector = `[${payload.embedding.map((v) => Number(v).toFixed(6)).join(",")}]`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_biometria", {
    p_embedding: vector,
    p_threshold: threshold,
    p_escola_id: DEFAULT_SCHOOL_ID
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ ok: true, match: null });

  const best = data[0];
  return NextResponse.json({
    ok: true,
    match: {
      biometria_id: best.biometria_id,
      aluno_id: best.aluno_id,
      matricula_codigo: best.matricula_codigo,
      nome: best.nome,
      distancia: best.distancia,
      confianca: best.confianca
    },
    threshold
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Smoke test**

Run (PowerShell):
```powershell
$body = @{
  embedding = (0..127 | ForEach-Object { 0.0 })
} | ConvertTo-Json
$resp = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/portaria/match" `
  -Headers @{ Authorization = "Bearer dev-gate-token-change-me" } `
  -ContentType "application/json" `
  -Body $body
$resp
```

Esperado: `{ ok: true, match: null, threshold: 0.6 }` (sem biometrias com embedding ainda).

(Pode pular se dev server não está rodando — typecheck cobre.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portaria/match/route.ts
git commit -m "feat(api): add POST /api/portaria/match using pgvector"
```

---

## Fase 5 — UI cadastro

### Task 12: BiometricConsentForm

**Files:**
- Create: `src/components/students/biometric-consent-form.tsx`

- [ ] **Step 1: Escrever**

```tsx
import { setConsentAction } from "@/lib/actions/biometrics";

type Props = {
  alunoId: string;
  responsaveis: Array<{ id: string; nome: string }>;
  consentimento: { autorizado: boolean; observacao: string | null } | null;
};

export function BiometricConsentForm({ alunoId, responsaveis, consentimento }: Props) {
  if (responsaveis.length === 0) {
    return (
      <p className="text-sm text-clay">
        Cadastre um responsavel antes de coletar consentimento biometrico (LGPD).
      </p>
    );
  }
  return (
    <form action={setConsentAction} className="grid gap-3 rounded-ui border border-line bg-muted/30 p-3">
      <input type="hidden" name="aluno_id" value={alunoId} />
      <label className="text-sm">
        Responsavel que autoriza
        <select name="responsavel_id" required>
          {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="autorizado" value="true" defaultChecked={consentimento?.autorizado ?? false} required />
        <span>Autorizo coleta, armazenamento e uso da biometria facial do aluno conforme a LGPD para controle de acesso na portaria.</span>
      </label>
      <label className="text-sm">
        Observacao
        <textarea name="observacao" rows={2} defaultValue={consentimento?.observacao ?? ""} />
      </label>
      <button className="ds-button ds-button-primary w-fit" type="submit">Salvar consentimento</button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/components/students/biometric-consent-form.tsx
git commit -m "feat(biometrics): add BiometricConsentForm"
```

---

### Task 13: FaceCaptureStep (câmera live)

**Files:**
- Create: `src/components/students/face-capture-step.tsx`

- [ ] **Step 1: Escrever**

```tsx
"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { extractEmbedding, type ExtractionResult } from "@/lib/face/extract-embedding";

export type CaptureResult = { embedding: number[]; score: number; fotoBase64: string };

type Props = {
  label: string;
  hint: string;
  onCaptured: (result: CaptureResult) => void;
};

const errorMessages: Record<Exclude<ExtractionResult, { ok: true }>["error"], string> = {
  no_face: "Nenhum rosto detectado. Aproxime-se da camera.",
  multiple_faces: "Varios rostos detectados. Apenas o aluno deve aparecer.",
  low_score: "Foto pouco nitida. Melhore a iluminacao.",
  too_small: "Rosto muito pequeno. Aproxime-se.",
  off_center: "Centralize o rosto no quadro."
};

export function FaceCaptureStep({ label, hint, onCaptured }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<string>("Iniciando camera...");
  const [valid, setValid] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus("Posicione o rosto");
        tick();
      } catch {
        setStatus("Camera nao disponivel. Use upload de fotos.");
      }
    }

    async function tick() {
      if (cancelled) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        const r = await extractEmbedding(v);
        if (cancelled) return;
        if (r.ok) {
          setStatus("Rosto detectado. Clique em Capturar.");
          setValid(true);
        } else {
          setStatus(errorMessages[r.error]);
          setValid(false);
        }
      }
      timer = window.setTimeout(tick, 250);
    }

    start();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function handleCapture() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      const r = await extractEmbedding(canvas);
      if (!r.ok) {
        setStatus(errorMessages[r.error]);
        return;
      }
      const fotoBase64 = canvas.toDataURL("image/jpeg", 0.9);
      onCaptured({ embedding: r.embedding, score: r.score, fotoBase64 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-panel border border-line bg-surface p-4">
      <div>
        <p className="ds-kicker">{label}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <div className="aspect-video overflow-hidden rounded-ui border border-line bg-ink">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-sm font-bold ${valid ? "text-moss" : "text-clay"}`}>{status}</span>
        <button
          className="ds-button ds-button-primary px-4 py-2 text-xs disabled:opacity-50"
          type="button"
          disabled={!valid || busy}
          onClick={handleCapture}
        >
          Capturar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/components/students/face-capture-step.tsx
git commit -m "feat(biometrics): add FaceCaptureStep client component"
```

---

### Task 14: FaceUploadFallback

**Files:**
- Create: `src/components/students/face-upload-fallback.tsx`

- [ ] **Step 1: Escrever**

```tsx
"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { extractEmbedding } from "@/lib/face/extract-embedding";
import type { CaptureResult } from "./face-capture-step";

type Slot = { result: CaptureResult | null; error: string | null; previewUrl: string | null };

type Props = {
  onComplete: (captures: CaptureResult[]) => void;
};

const errorMessages: Record<string, string> = {
  no_face: "Nenhum rosto detectado.",
  multiple_faces: "Multiplos rostos.",
  low_score: "Foto pouco nitida.",
  too_small: "Rosto muito pequeno.",
  off_center: "Rosto fora do centro."
};

export function FaceUploadFallback({ onComplete }: Props) {
  const [slots, setSlots] = useState<Slot[]>([
    { result: null, error: null, previewUrl: null },
    { result: null, error: null, previewUrl: null },
    { result: null, error: null, previewUrl: null }
  ]);
  const inputs = useRef<Array<HTMLInputElement | null>>([null, null, null]);

  async function handleFile(idx: number, file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("falha ao carregar"));
      img.src = url;
    });
    const r = await extractEmbedding(img);
    setSlots((prev) => {
      const next = [...prev];
      if (r.ok) {
        const fotoBase64 = toDataUrl(img);
        next[idx] = { result: { embedding: r.embedding, score: r.score, fotoBase64 }, error: null, previewUrl: url };
      } else {
        next[idx] = { result: null, error: errorMessages[r.error] ?? r.error, previewUrl: url };
      }
      return next;
    });
  }

  function toDataUrl(img: HTMLImageElement): string {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  const allValid = slots.every((s) => s.result !== null);

  return (
    <div className="grid gap-3 rounded-panel border border-line bg-surface p-4">
      <div>
        <p className="ds-kicker">Upload de fotos</p>
        <p className="text-sm text-muted">Selecione 3 fotos do aluno (frontal, leve esquerda, leve direita).</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {slots.map((slot, idx) => (
          <div key={idx} className="grid gap-2 rounded-ui border border-line p-2 text-sm">
            <strong>Foto {idx + 1}</strong>
            <input
              ref={(el) => { inputs.current[idx] = el; }}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(idx, f); }}
            />
            {slot.previewUrl ? (
              <img src={slot.previewUrl} alt={`Foto ${idx + 1}`} className="h-32 w-full rounded-ui object-cover" />
            ) : null}
            {slot.result ? <span className="text-moss">OK (score {slot.result.score.toFixed(2)})</span> : null}
            {slot.error ? <span className="text-clay">{slot.error}</span> : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="ds-button ds-button-primary w-fit disabled:opacity-50"
        disabled={!allValid}
        onClick={() => onComplete(slots.map((s) => s.result!))}
      >
        Confirmar 3 fotos
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/components/students/face-upload-fallback.tsx
git commit -m "feat(biometrics): add FaceUploadFallback client component"
```

---

### Task 15: BiometricEnrollment principal

**Files:**
- Create: `src/components/students/biometric-enrollment.tsx`

- [ ] **Step 1: Escrever**

```tsx
"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BiometricConsentForm } from "./biometric-consent-form";
import { FaceCaptureStep, type CaptureResult } from "./face-capture-step";
import { FaceUploadFallback } from "./face-upload-fallback";
import { computeCentroid } from "@/lib/face/centroid";
import { saveBiometryAction, setConsentAction } from "@/lib/actions/biometrics";

type Props = {
  alunoId: string;
  responsaveis: Array<{ id: string; nome: string }>;
  consentimento: { autorizado: boolean; observacao: string | null } | null;
  biometriaAtiva: { id: string; data_cadastro: string; score_qualidade: number | null } | null;
  fotoReferenciaSignedUrl: string | null;
};

type Phase = "consent" | "idle" | "capturing" | "uploading" | "review" | "saving" | "done" | "error";

const stepLabels = [
  { label: "Foto 1 — frontal", hint: "Olhe diretamente para a camera." },
  { label: "Foto 2 — leve esquerda", hint: "Vire o rosto cerca de 20° para a esquerda." },
  { label: "Foto 3 — leve direita", hint: "Vire o rosto cerca de 20° para a direita." }
];

export function BiometricEnrollment({ alunoId, responsaveis, consentimento, biometriaAtiva, fotoReferenciaSignedUrl }: Props) {
  const router = useRouter();
  const consentAtivo = consentimento?.autorizado === true;
  const [phase, setPhase] = useState<Phase>(consentAtivo ? "idle" : "consent");
  const [stepIndex, setStepIndex] = useState(0);
  const [captures, setCaptures] = useState<CaptureResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCaptured(r: CaptureResult) {
    const next = [...captures, r];
    setCaptures(next);
    if (next.length >= 3) setPhase("review");
    else setStepIndex(stepIndex + 1);
  }

  async function handleSave() {
    setPhase("saving");
    setError(null);
    try {
      const centroid = computeCentroid(captures.map((c) => c.embedding));
      const scoreMedio = captures.reduce((s, c) => s + c.score, 0) / captures.length;
      const best = [...captures].sort((a, b) => b.score - a.score)[0];
      await saveBiometryAction({
        alunoId,
        embedding: centroid,
        scoreMedio,
        fotoBase64: best.fotoBase64
      });
      setPhase("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar biometria");
      setPhase("error");
    }
  }

  function reset() {
    setCaptures([]);
    setStepIndex(0);
    setPhase("idle");
    setError(null);
  }

  function revoke() {
    const fd = new FormData();
    fd.set("aluno_id", alunoId);
    fd.set("autorizado", "false");
    fd.set("observacao", "Revogado pelo operador");
    startTransition(() => {
      setConsentAction(fd);
    });
  }

  if (phase === "consent" || !consentAtivo) {
    return <BiometricConsentForm alunoId={alunoId} responsaveis={responsaveis} consentimento={consentimento} />;
  }

  return (
    <div className="grid gap-4">
      {biometriaAtiva && phase === "idle" ? (
        <div className="grid gap-3 rounded-panel border border-line bg-surface p-4 md:grid-cols-[180px_1fr_auto]">
          <div className="h-44 w-44 overflow-hidden rounded-ui border border-line bg-paper">
            {fotoReferenciaSignedUrl ? <img src={fotoReferenciaSignedUrl} alt="Referencia" className="h-full w-full object-cover" /> : null}
          </div>
          <div>
            <p className="ds-kicker">Biometria ativa</p>
            <p className="mt-1 text-sm">Cadastrada em {new Date(biometriaAtiva.data_cadastro).toLocaleString("pt-BR")}.</p>
            <p className="text-sm">Score medio: {biometriaAtiva.score_qualidade ?? "—"}.</p>
          </div>
          <div className="grid gap-2">
            <button className="ds-button ds-button-secondary" type="button" onClick={() => setPhase("capturing")}>Refazer cadastro</button>
            <button className="ds-button ds-button-ghost text-clay" type="button" onClick={revoke} disabled={pending}>Revogar consentimento</button>
          </div>
        </div>
      ) : null}

      {phase === "idle" && !biometriaAtiva ? (
        <div className="grid gap-3">
          <p className="text-sm">Consentimento ativo. Pronto para cadastrar biometria.</p>
          <div className="flex flex-wrap gap-2">
            <button className="ds-button ds-button-primary" type="button" onClick={() => setPhase("capturing")}>Iniciar cadastro com camera</button>
            <button className="ds-button ds-button-secondary" type="button" onClick={() => setPhase("uploading")}>Usar upload de fotos</button>
            <button className="ds-button ds-button-ghost text-clay" type="button" onClick={revoke} disabled={pending}>Revogar consentimento</button>
          </div>
        </div>
      ) : null}

      {phase === "capturing" ? (
        <div className="grid gap-3">
          <p className="text-sm">Etapa {captures.length + 1} de 3.</p>
          <FaceCaptureStep
            key={stepIndex}
            label={stepLabels[stepIndex].label}
            hint={stepLabels[stepIndex].hint}
            onCaptured={handleCaptured}
          />
          <button type="button" className="ds-button ds-button-ghost w-fit" onClick={() => setPhase("uploading")}>Mudar para upload</button>
        </div>
      ) : null}

      {phase === "uploading" ? (
        <FaceUploadFallback
          onComplete={(results) => {
            setCaptures(results);
            setPhase("review");
          }}
        />
      ) : null}

      {phase === "review" ? (
        <div className="grid gap-3 rounded-panel border border-line bg-surface p-4">
          <p className="ds-kicker">Revisao</p>
          <div className="grid gap-2 md:grid-cols-3">
            {captures.map((c, idx) => (
              <div key={idx}>
                <img src={c.fotoBase64} alt={`Foto ${idx + 1}`} className="h-40 w-full rounded-ui object-cover" />
                <p className="mt-1 text-xs text-muted">Score {c.score.toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="ds-button ds-button-primary" type="button" onClick={handleSave}>Salvar biometria</button>
            <button className="ds-button ds-button-secondary" type="button" onClick={reset}>Refazer</button>
          </div>
        </div>
      ) : null}

      {phase === "saving" ? <p className="text-sm">Salvando...</p> : null}
      {phase === "done" ? <p className="text-sm text-moss">Biometria cadastrada.</p> : null}
      {phase === "error" ? (
        <div className="grid gap-2 rounded-ui border border-clay bg-clay/10 p-3 text-sm text-clay">
          <span>{error}</span>
          <button type="button" className="ds-button ds-button-secondary w-fit" onClick={reset}>Voltar</button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add src/components/students/biometric-enrollment.tsx
git commit -m "feat(biometrics): add BiometricEnrollment client component"
```

---

### Task 16: Integrar em /alunos/[id]/editar

**Files:**
- Modify: `src/app/(app)/alunos/[id]/editar/page.tsx`

- [ ] **Step 1: Atualizar imports e dados**

Adicionar import:
```ts
import { BiometricEnrollment } from "@/components/students/biometric-enrollment";
import { getStudentBiometryData } from "@/lib/data/biometrics";
```

Estender `Promise.all`:
```tsx
const [student, documents, gateSettings, biometry] = await Promise.all([
  getStudentSheet(params.id),
  getStudentDocuments(params.id),
  getStudentGateSettings(params.id),
  getStudentBiometryData(params.id)
]);
```

Inserir o painel logo após `<StudentGatePanel>` (ou substituir partes simuladas — decisão final na Task 19; aqui apenas adiciona):

```tsx
<section className="rounded-panel border border-line bg-surface p-5">
  <h2 className="mb-3 font-serif text-2xl text-ink">Biometria facial (LGPD)</h2>
  <BiometricEnrollment
    alunoId={student.id}
    responsaveis={biometry.responsaveis}
    consentimento={biometry.consentimento}
    biometriaAtiva={biometry.biometriaAtiva}
    fotoReferenciaSignedUrl={biometry.fotoReferenciaSignedUrl}
  />
</section>
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck`
Run: `npm run build`
Expected: ambos passam.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/alunos/[id]/editar/page.tsx"
git commit -m "feat(biometrics): integrate BiometricEnrollment on student edit page"
```

---

## Fase 6 — Validação manual e cleanup

### Task 17: Smoke teste manual

(Manual; usuário roda e marca itens.)

- [ ] **Step 1: Dev server up**

Run: `npm run dev`

- [ ] **Step 2: Testar consentimento**

- Logar como admin.
- Abrir `/alunos/[id-do-aluno-seed]/editar`.
- Ver painel "Biometria facial (LGPD)" — form de consentimento.
- Salvar consentimento. UI deve mostrar próximo estado (idle).

- [ ] **Step 3: Testar wizard câmera**

- Clicar "Iniciar cadastro com câmera".
- Garantir HTTPS (localhost permitido) — browser pedirá permissão de câmera.
- Aguardar carga dos modelos (~6MB, primeira vez).
- Capturar 3 fotos seguindo prompts.
- Revisar → "Salvar biometria".
- Aguardar refresh → painel mostra "Biometria ativa".

- [ ] **Step 4: Testar upload fallback**

- Reset (Refazer cadastro).
- Clicar "Usar upload de fotos".
- Selecionar 3 imagens válidas → confirmar → save.

- [ ] **Step 5: Testar revogação**

- Clicar "Revogar consentimento".
- UI volta ao form de consentimento.
- Verificar via Studio: `biometrias_aluno.ativo=false`, `embedding=null`, foto removida do bucket.

- [ ] **Step 6: Testar API match**

Run (PowerShell):
```powershell
# Pega o embedding mais recente
$row = npx supabase db execute --local "select embedding from biometrias_aluno where ativo = true and embedding is not null order by data_cadastro desc limit 1;"
# Manual: copiar o vetor e usar no body
```

OU testar via SQL direto:
```
npx supabase db execute --local "
  select * from match_biometria(
    (select embedding from biometrias_aluno where ativo = true and embedding is not null order by data_cadastro desc limit 1),
    0.6,
    '00000000-0000-0000-0000-000000000001'
  );
"
```
Expected: retorna 1 linha com o próprio aluno (distância ≈ 0).

- [ ] **Step 7: Anotar issues**

Continuar para Task 18.

---

### Task 18: Verificação final (typecheck + build + lint)

- [ ] **Step 1: Tudo passa**

Run:
```
npm run typecheck
npm run lint
npm run build
```
Expected: clean.

- [ ] **Step 2: Audit createAdminClient**

Run (Grep): `createAdminClient` em `src/`.
Expected: cada chamada tem comentário `// service role:` justificando.

- [ ] **Step 3: Commit fechamento**

```bash
git commit --allow-empty -m "chore: portaria facial sub-spec 1 implementation complete"
```

---

### Task 19: Remoção do componente simulado (cleanup)

**Files:**
- Delete: `src/components/students/student-face-capture.tsx`
- Modify: `src/lib/actions/gate.ts` (remover `uploadStudentFaceReferenceAction`, `deactivateStudentFaceReferenceAction` se não usados em outro lugar)
- Modify: `src/components/students/student-gate-panel.tsx` (se renderiza `<StudentFaceCapture>`, remover)

- [ ] **Step 1: Grep usos**

Run (Grep): `StudentFaceCapture` em `src/`.
Run (Grep): `uploadStudentFaceReferenceAction` em `src/`.
Run (Grep): `deactivateStudentFaceReferenceAction` em `src/`.

Anotar arquivos.

- [ ] **Step 2: Remover usos**

- Em `student-gate-panel.tsx`, se renderiza `<StudentFaceCapture>`, remover import + uso.
- Em `gate.ts`, remover as 2 actions se não usadas em mais lugar nenhum.

- [ ] **Step 3: Deletar arquivo do componente**

Run: `Remove-Item src/components/students/student-face-capture.tsx`

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck` && `npm run build`
Expected: passam.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(biometrics): remove simulated StudentFaceCapture and obsolete actions"
```

---

## Fora de escopo

Próximos sub-specs:

- **Sub-spec 2:** runtime câmera de portaria que consome `/api/portaria/match`.
- **Sub-spec 3:** fila WhatsApp com retry/backoff.
- **Sub-spec 4:** dashboard real-time + threshold por escola via UI.

Outros (futuros):

- Anti-spoof / liveness.
- Reconhecimento multi-rosto simultâneo.
- Remoção das colunas legadas `embedding_hash`, `embedding_encrypted`.
