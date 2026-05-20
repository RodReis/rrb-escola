# Portaria Facial — Sub-spec 1: Reconhecimento + Embeddings

**Data:** 2026-05-15
**Status:** Aprovado (aguardando revisão final)
**Escopo:** Primeiro dos 4 sub-projetos da Portaria Facial (item 4 do roadmap). Substitui o cadastro biométrico simulado por extração real de embedding facial. Estabelece pgvector + função de match server-side.

## Decomposição do roadmap "Portaria facial"

| Sub-spec | Conteúdo |
|----------|----------|
| **1. Reconhecimento + embeddings (este)** | Provider face-api, pgvector, cadastro com wizard, função/endpoint de match |
| 2. Runtime de portaria | Câmera em loop, captura → match → registra evento, painel de operador |
| 3. Fila WhatsApp | Queue jobs em DB, worker, retry com backoff exponencial, status real |
| 4. Polimento UX portaria | Dashboard real-time, threshold por escola via UI, métricas |

## Contexto

Estado atual:

- Schema já tem `biometrias_aluno`, `consentimentos_biometria`, `eventos_acesso`, `notificacoes_responsavel`, `preferencias_notificacao_aluno`, `dispositivos_acesso`.
- Bucket `biometrias-alunos` privado (RLS aplicada via auth real).
- API: `POST /api/portaria/evento` (registra evento), `GET /api/portaria/biometrias` (sync fotos referência), `GATE_API_TOKEN` auth.
- Componente `student-face-capture.tsx` existe mas é simulado (não extrai embedding real).
- Colunas `embedding_hash`, `embedding_encrypted` vazias.

## Objetivo

1. Cadastro biométrico funcional: wizard 3 fotos → centroid → salvo em `biometrias_aluno.embedding`.
2. Validação de qualidade no cadastro (rosto detectado, centralizado, tamanho, score).
3. Consentimento biométrico (LGPD) obrigatório antes do cadastro.
4. Revogação apaga foto + zera embedding.
5. Endpoint server-side de match via pgvector.
6. Base preparada para sub-spec 2 (runtime câmera).

## Decisões

| # | Tema | Decisão |
|---|------|---------|
| 0 | Decomposição | Este = sub-spec 1 de 4. Demais ficam para depois. |
| 1 | Provider | `@vladmandic/face-api` (browser local, sem custo externo) |
| 2 | Local extração | Browser do operador |
| 3 | Armazenamento | pgvector, coluna `embedding vector(128)` em `biometrias_aluno` |
| 4 | Modelo | SSD MobileNet v1 (detector) + FaceNet (128D) + Landmark68 |
| 5 | Múltiplas fotos | Centroid de 3 capturas |
| 6 | Fluxo cadastro | Wizard 3 etapas (câmera live) + upload fallback |
| 7 | Validação | Completa: rosto detectado, score ≥ 0.7, tamanho ≥ 100px, centralizado |
| 8 | Consentimento | Gate UI obrigatório + upload termo opcional |
| 9 | Revogação | Desativa flag + apaga foto + zera embedding (LGPD) |
| 10 | Endpoint match | `POST /api/portaria/match` server-side (pgvector) |
| 11 | Threshold | Env var `GATE_MATCH_THRESHOLD` (default 0.6) |

## Schema

Migration: `supabase/migrations/202605180001_face_embeddings.sql`.

```sql
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

Observações:

- Coluna `embedding_hash` e `embedding_encrypted` ficam como deprecated (não removidas para preservar histórico). Sub-spec 4 ou cleanup futuro pode dropá-las.
- Índice `ivfflat` adequado até ~10k rows. `lists=100` é heuristic comum.
- Função `match_biometria` retorna no máximo 1 row (best match abaixo do threshold).

## Dependências

```json
"@vladmandic/face-api": "^1.7.x"
```

**Modelos** copiados manualmente para `public/face-models/`:

- `ssd_mobilenetv1_model-shard1`
- `ssd_mobilenetv1_model-weights_manifest.json`
- `face_landmark_68_model-shard1`
- `face_landmark_68_model-weights_manifest.json`
- `face_recognition_model-shard1`, `-shard2`
- `face_recognition_model-weights_manifest.json`

Total: ~6MB. Documentar fonte em `public/face-models/README.md`.

## Helpers face-api

### `src/lib/face/face-api-loader.ts` (client)

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

### `src/lib/face/extract-embedding.ts` (client)

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

### `src/lib/face/centroid.ts` (puro)

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

## Server actions

### `src/lib/actions/biometrics.ts`

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

## API match

### `src/app/api/portaria/match/route.ts`

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
    return NextResponse.json({ error: "embedding inválido (esperado array 128)" }, { status: 400 });
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

Endpoint `GET /api/portaria/biometrias` é mantido para compatibilidade. Documentação atualizada para deprecá-lo em favor de `POST /match` na versão futura.

## UI cadastro

### Componente principal

`src/components/students/biometric-enrollment.tsx` (client) — controla estados:

1. `consent` — exibe `<BiometricConsentForm>` se ainda sem autorização ativa.
2. `idle` — botão "Iniciar cadastro facial".
3. `capturing` — wizard de 3 etapas via `<FaceCaptureStep>`.
4. `review` — preview das 3 capturas + cálculo centroid.
5. `saving` — chama `saveBiometryAction` (server function via fetch).
6. `done` — confirmação visual.

Inclui também botão "Refazer cadastro" (volta para `idle`, mantém consentimento) e "Revogar consentimento" (executa `setConsentAction` com `autorizado=false`).

### `<FaceCaptureStep>`

- `getUserMedia({ video: true })` → renderiza `<video>` + canvas overlay.
- Loop `requestAnimationFrame` (throttled a 250ms) → `extractEmbedding(video)` → status em tempo real (texto + cor da borda).
- Quando estado válido + operador clica "Capturar":
  1. Snapshot via `<canvas>` (foto JPEG via `toDataURL`).
  2. Re-extrair embedding da canvas para garantir match com foto salva.
  3. Armazenar `{ embedding, score, fotoBase64 }` no estado.
- Avança automaticamente.

### `<FaceUploadFallback>`

- 3 inputs `type="file"` (JPEG/PNG).
- Cada upload: `<img>` em memória → `extractEmbedding(img)` → status.
- Mostra preview + estado de validação.
- Botão "Confirmar" só ativa com 3 capturas válidas.

### Etapa `review`

- 3 thumbnails das capturas.
- `centroid = computeCentroid([e1, e2, e3])`.
- `scoreMedio = (s1 + s2 + s3) / 3`.
- Foto principal = a com maior score individual.
- Botão "Salvar biometria" → chama `saveBiometryAction({ alunoId, embedding: centroid, scoreMedio, fotoBase64 })` via fetch para Server Action.

### `<BiometricConsentForm>`

```tsx
<form action={setConsentAction} className="grid gap-3">
  <input type="hidden" name="aluno_id" value={alunoId} />
  <label>
    Responsável que autoriza
    <select name="responsavel_id" required>
      {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
    </select>
  </label>
  <label className="flex items-start gap-2 text-sm">
    <input type="checkbox" name="autorizado" value="true" required />
    <span>Autorizo coleta, armazenamento e uso da biometria facial do aluno conforme a LGPD para controle de acesso na portaria.</span>
  </label>
  <label>Observação<textarea name="observacao" rows={2} /></label>
  <button className="ds-button ds-button-primary" type="submit">Salvar consentimento</button>
</form>
```

### Upload de termo (opcional)

Reaproveita `<StudentDocumentsPanel>` para anexar PDF de termo assinado. Sem implementação especial neste spec — operador anexa pelo painel de documentos existente. Campo `termo_documento_id` permanece null por enquanto (sub-spec futuro pode ligar via UI dedicada).

### Integração em `/alunos/[id]/editar`

```tsx
<Panel>
  <h2>Biometria facial (LGPD)</h2>
  <BiometricEnrollment
    alunoId={params.id}
    responsaveis={detail.responsaveis}
    consentimento={detail.consentimento}
    biometriaAtiva={detail.biometriaAtiva}
    fotoReferenciaSignedUrl={detail.fotoSigned}
  />
</Panel>
```

Server Component resolve `detail` via novo data fetcher `getStudentBiometryData(alunoId)` em `src/lib/data/biometrics.ts`.

## Tratamento de erros

- `setConsentAction`: redirect com `?erro=...` em validações; sem deletar storage de erro.
- `saveBiometryAction`: throws com mensagem clara; client captura e exibe alert inline.
- `extractEmbedding`: retorna union discriminada com `error` codificado:
  - `no_face` → "Nenhum rosto detectado. Aproxime-se da câmera."
  - `multiple_faces` → "Vários rostos detectados. Apenas o aluno deve aparecer."
  - `low_score` → "Foto pouco nítida. Melhore iluminação."
  - `too_small` → "Rosto muito pequeno. Aproxime-se."
  - `off_center` → "Centralize o rosto no quadro."
- Câmera negada (getUserMedia rejected) → fallback automático para upload + mensagem.
- API match: 400 (embedding inválido), 500 (erro SQL), 200 com `match: null` (sem correspondência).

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Modelo 6MB lento na 1ª carga | Browser cacheia. Loader mostra progress. |
| Performance pgvector ivfflat | `lists=100` adequado até ~10k. Função filtra por escola_id antes do vector op. Reindex se crescer. |
| Falsos positivos | Threshold env (default 0.6 conservador). Centroid reduz variância. |
| Falsos negativos | Score mínimo 0.7 + centralização garantem qualidade. Refazer cadastro fácil. |
| LGPD: dado biométrico vazado | Storage privado (RLS). Embedding nunca exposto via API. Revogação apaga foto + zera vetor. |
| getUserMedia exige HTTPS | localhost permite sem HTTPS. Produção precisa de HTTPS. Documentar README. |
| Consentimento sem responsável | Form exige `responsavel_id`. Bloqueia + mensagem se aluno sem responsáveis cadastrados. |
| `embedding_hash`/`embedding_encrypted` legados | Manter colunas, marcar deprecated. Limpeza em spec futuro. |

## Checklist de verificação manual

- [ ] `npm run typecheck` + `npm run build` + `npm run lint` passam
- [ ] Migration aplica clean
- [ ] Extensão `vector` ativa
- [ ] `match_biometria` callable via RPC
- [ ] Modelos face-api carregam (`public/face-models/` populado)
- [ ] Aluno sem consentimento: cadastro bloqueado
- [ ] Consentimento exige responsável + checkbox
- [ ] Câmera abre em `/alunos/[id]/editar`
- [ ] Cadastro: 3 capturas válidas → centroid → save
- [ ] Foto enviada para `biometrias-alunos`
- [ ] Validação rejeita: no_face, multiple_faces, low_score, too_small, off_center
- [ ] Fallback upload com 3 fotos do disco funciona
- [ ] Refazer cadastro substitui ativo anterior (desativa)
- [ ] Revogar consentimento apaga foto + zera embedding + ativo=false
- [ ] `POST /api/portaria/match` válido retorna match correto
- [ ] `POST /api/portaria/match` embedding ruim retorna 400
- [ ] `POST /api/portaria/match` sem token retorna 401
- [ ] Threshold env respeitado
- [ ] Match não retorna aluno com consentimento revogado

## Fora de escopo

Próximos sub-specs:

- **Sub-spec 2:** runtime câmera de portaria consome `/match` (loop captura, decisão liberar, registra evento).
- **Sub-spec 3:** fila WhatsApp com retry/backoff.
- **Sub-spec 4:** dashboard real-time + threshold por escola via UI.

Outros (futuros):

- Liveness detection (anti-spoof foto vs pessoa).
- Reconhecimento multi-rosto simultâneo.
- Re-treinamento periódico.
- Remoção das colunas legadas `embedding_hash` / `embedding_encrypted`.

## Fases de implementação

1. **Schema + extensão** — migration pgvector, função match_biometria.
2. **Setup face-api** — instalar dep, copiar modelos para public/, loader + helpers.
3. **Server actions** — setConsentAction, saveBiometryAction.
4. **API match** — POST /api/portaria/match.
5. **UI cadastro** — BiometricEnrollment + sub-componentes + integração na ficha.
6. **Verificação manual** + cleanup.
