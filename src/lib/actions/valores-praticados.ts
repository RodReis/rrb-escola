"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { SEGMENTOS, type SegmentoSerie } from "@/lib/data/valores-praticados";

function formText(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function formNumber(formData: FormData, key: string): number | null {
  const raw = formText(formData, key);
  if (raw === null) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function readSegmento(formData: FormData): SegmentoSerie {
  const raw = formText(formData, "segmento");
  if (raw && (SEGMENTOS as string[]).includes(raw)) return raw as SegmentoSerie;
  throw new Error("Segmento invalido");
}

function readOrdemFilho(formData: FormData): 1 | 2 | 3 {
  const n = formNumber(formData, "ordem_filho");
  if (n === 1 || n === 2 || n === 3) return n;
  throw new Error("Ordem do filho invalida (1, 2 ou 3)");
}

function readAnoLetivo(formData: FormData): number {
  const n = formNumber(formData, "ano_letivo");
  if (!n || n < 2000 || n > 2100) {
    throw new Error("Ano letivo invalido");
  }
  return Math.trunc(n);
}

export async function upsertValorPraticadoAction(formData: FormData) {
  await requirePermission("valores-praticados", "update");
  const supabase = await createServerClient();

  const anoLetivo = readAnoLetivo(formData);
  const segmento = readSegmento(formData);
  const ordemFilho = readOrdemFilho(formData);
  const valorMatricula = formNumber(formData, "valor_matricula") ?? 0;
  const valorMensalidade = formNumber(formData, "valor_mensalidade") ?? 0;
  const observacao = formText(formData, "observacao");

  await supabase.from("valores_praticados").upsert({
    escola_id: DEFAULT_SCHOOL_ID,
    ano_letivo: anoLetivo,
    segmento,
    ordem_filho: ordemFilho,
    valor_matricula: valorMatricula,
    valor_mensalidade: valorMensalidade,
    observacao,
  }, { onConflict: "escola_id,ano_letivo,segmento,ordem_filho" });

  revalidatePath("/valores-praticados");
}

export async function criarAnoLetivoAction(formData: FormData) {
  await requirePermission("valores-praticados", "create");
  const supabase = await createServerClient();
  const anoLetivo = readAnoLetivo(formData);

  const rows = SEGMENTOS.flatMap((segmento) =>
    ([1, 2, 3] as const).map((ordem) => ({
      escola_id: DEFAULT_SCHOOL_ID,
      ano_letivo: anoLetivo,
      segmento,
      ordem_filho: ordem,
      valor_matricula: 0,
      valor_mensalidade: 0,
    }))
  );

  await supabase
    .from("valores_praticados")
    .upsert(rows, { onConflict: "escola_id,ano_letivo,segmento,ordem_filho", ignoreDuplicates: true });

  revalidatePath("/valores-praticados");
}

export async function removerAnoLetivoAction(formData: FormData) {
  await requirePermission("valores-praticados", "delete");
  const supabase = await createServerClient();
  const anoLetivo = readAnoLetivo(formData);

  await supabase
    .from("valores_praticados")
    .delete()
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ano_letivo", anoLetivo);

  revalidatePath("/valores-praticados");
}
