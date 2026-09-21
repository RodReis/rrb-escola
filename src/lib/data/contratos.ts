import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export interface ContratoRow {
  id: string;
  descricao: string;
  contraparte: string | null;
  valor: number;
  dia_vencimento: number;
  categoria_id: string | null;
  categoria_nome: string | null;
  ativo: boolean;
  inicio: string;
  fim: string | null;
}

export async function getContratos(): Promise<ContratoRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("contrato_receita")
    .select("id, descricao, contraparte, valor, dia_vencimento, categoria_id, ativo, inicio, fim, categorias_financeiras(nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("descricao");
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id,
    descricao: c.descricao,
    contraparte: c.contraparte,
    valor: Number(c.valor),
    dia_vencimento: c.dia_vencimento,
    categoria_id: c.categoria_id,
    categoria_nome: c.categorias_financeiras?.nome ?? null,
    ativo: c.ativo,
    inicio: c.inicio,
    fim: c.fim
  }));
}
