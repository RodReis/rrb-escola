"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { CertificadoConfig } from "@/lib/data/certificados";
import { CERTIFICADO_DEFAULTS } from "@/lib/documents/certificado-tipos";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Salva os parâmetros padrão do certificado. Recebe objeto tipado em vez de
 * FormData porque leiaute e assinaturas são estruturados — serializá-los em
 * campos planos só para desserializar aqui não ajudaria ninguém.
 *
 * Os valores chegam do cliente, então cada um é saneado: a tela é a origem
 * esperada, não uma garantia.
 */
export async function salvarCertificadoConfigAction(config: CertificadoConfig): Promise<void> {
  await requirePermission("historico", "update");

  const texto = (valor: unknown, padrao: string): string => {
    const limpo = typeof valor === "string" ? valor.trim() : "";
    return limpo === "" ? padrao : limpo;
  };

  const numero = (valor: unknown, padrao: number, min: number, max: number): number => {
    const n = Number(valor);
    if (!Number.isFinite(n)) return padrao;
    return Math.min(max, Math.max(min, n));
  };

  const assinaturas = (Array.isArray(config.assinaturas) ? config.assinaturas : [])
    .map((a) => ({
      nome: typeof a?.nome === "string" ? a.nome.trim() : "",
      cargo: typeof a?.cargo === "string" ? a.cargo.trim() : ""
    }))
    .filter((a) => a.nome !== "" || a.cargo !== "");

  const customizado =
    typeof config.textoCustomizado === "string" && config.textoCustomizado.trim() !== ""
      ? config.textoCustomizado.trim()
      : null;

  const supabase = await createServerClient();
  const { error } = await supabase.from("certificado_config").upsert(
    {
      escola_id: DEFAULT_SCHOOL_ID,
      titulo_certificado: texto(config.tituloCertificado, "Certificado"),
      texto_inicio: texto(config.textoInicio, "A Diretora da"),
      descricao_curso: texto(config.descricaoCurso, "ENSINO MÉDIO"),
      base_legal: texto(config.baseLegal, ""),
      texto_customizado: customizado,
      mostrar_historico: Boolean(config.mostrarHistorico),
      leiaute: {
        orientacao: config.leiaute?.orientacao === "portrait" ? "portrait" : "landscape",
        // Limites frouxos, só para não gerar um PDF impossível: margem que
        // engole a página ou fonte ilegível.
        margemMm: numero(config.leiaute?.margemMm, CERTIFICADO_DEFAULTS.leiaute.margemMm, 5, 40),
        fonteCorpoPt: numero(config.leiaute?.fonteCorpoPt, CERTIFICADO_DEFAULTS.leiaute.fonteCorpoPt, 7, 18),
        mostrarLogos: Boolean(config.leiaute?.mostrarLogos),
        mostrarMoldura: Boolean(config.leiaute?.mostrarMoldura)
      },
      assinaturas
    },
    { onConflict: "escola_id" }
  );
  if (error) throw error;

  revalidatePath("/historico/certificado");
}
