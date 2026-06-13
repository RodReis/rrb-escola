import { createServerClient } from "@/lib/supabase/server";
import type { InssBracket, IrBracket } from "@/lib/folha/engine/brackets-calc";

export type InssBracketRow = InssBracket & { id: string; vigencia_inicio: string };
export type IrBracketRow = IrBracket & { id: string; vigencia_inicio: string };

export async function getBracketsForMonth(dbMonth: string): Promise<{ inss: InssBracketRow[]; ir: IrBracketRow[] }> {
  const supabase = await createServerClient();

  const [vigInss, vigIr] = await Promise.all([
    supabase
      .from("inss_brackets")
      .select("vigencia_inicio")
      .lte("vigencia_inicio", dbMonth)
      .order("vigencia_inicio", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ir_brackets")
      .select("vigencia_inicio")
      .lte("vigencia_inicio", dbMonth)
      .order("vigencia_inicio", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const inssVigencia = vigInss.data?.vigencia_inicio ?? null;
  const irVigencia = vigIr.data?.vigencia_inicio ?? null;

  const [inss, ir] = await Promise.all([
    inssVigencia
      ? supabase
          .from("inss_brackets")
          .select("id, vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir")
          .eq("vigencia_inicio", inssVigencia)
          .order("ordem")
      : Promise.resolve({ data: [], error: null }),
    irVigencia
      ? supabase
          .from("ir_brackets")
          .select("id, vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir, deducao_dependente")
          .eq("vigencia_inicio", irVigencia)
          .order("ordem")
      : Promise.resolve({ data: [], error: null })
  ]);

  return {
    inss: (inss.data ?? []).map((r) => ({ ...r, aliquota: Number(r.aliquota), parcela_deduzir: Number(r.parcela_deduzir), valor_de: Number(r.valor_de), valor_ate: r.valor_ate != null ? Number(r.valor_ate) : null })) as InssBracketRow[],
    ir: (ir.data ?? []).map((r) => ({ ...r, aliquota: Number(r.aliquota), parcela_deduzir: Number(r.parcela_deduzir), deducao_dependente: Number(r.deducao_dependente ?? 0), valor_de: Number(r.valor_de), valor_ate: r.valor_ate != null ? Number(r.valor_ate) : null })) as IrBracketRow[]
  };
}

export async function listBracketVigencias(table: "inss" | "ir"): Promise<string[]> {
  const supabase = await createServerClient();
  const tableName = table === "inss" ? "inss_brackets" : "ir_brackets";
  const { data, error } = await supabase
    .from(tableName)
    .select("vigencia_inicio")
    .order("vigencia_inicio", { ascending: false });
  if (error) throw error;
  const unique = Array.from(new Set((data ?? []).map((r) => r.vigencia_inicio)));
  return unique;
}

export async function listBracketsByVigencia(
  table: "inss" | "ir",
  vigencia: string
): Promise<InssBracketRow[] | IrBracketRow[]> {
  const supabase = await createServerClient();
  if (table === "inss") {
    const { data, error } = await supabase
      .from("inss_brackets")
      .select("id, vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir")
      .eq("vigencia_inicio", vigencia)
      .order("ordem");
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, aliquota: Number(r.aliquota), parcela_deduzir: Number(r.parcela_deduzir), valor_de: Number(r.valor_de), valor_ate: r.valor_ate != null ? Number(r.valor_ate) : null })) as InssBracketRow[];
  } else {
    const { data, error } = await supabase
      .from("ir_brackets")
      .select("id, vigencia_inicio, ordem, valor_de, valor_ate, aliquota, parcela_deduzir, deducao_dependente")
      .eq("vigencia_inicio", vigencia)
      .order("ordem");
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, aliquota: Number(r.aliquota), parcela_deduzir: Number(r.parcela_deduzir), deducao_dependente: Number(r.deducao_dependente ?? 0), valor_de: Number(r.valor_de), valor_ate: r.valor_ate != null ? Number(r.valor_ate) : null })) as IrBracketRow[];
  }
}
