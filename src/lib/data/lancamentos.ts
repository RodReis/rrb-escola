import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { TipoLancamento, ClasseDespesa } from "@/lib/validation/lancamentos";

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: TipoLancamento;
  ativo: boolean;
}

export interface LancamentoRow {
  id: string;
  tipo: TipoLancamento;
  classe_despesa: ClasseDespesa | null;
  competencia: string;
  descricao: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  contraparte: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  comprovante_path: string | null;
  status: "aberta" | "paga" | "cancelada";
  origem_tipo: string;
  criado_em: string;
}

export interface LancamentoFilters {
  tipo?: TipoLancamento;
  categoria_id?: string;
  status?: string[];
  classe_despesa?: ClasseDespesa;
}

const SELECT_COLS =
  "id, tipo, classe_despesa, competencia, descricao, categoria_id, contraparte, valor, data_vencimento, data_pagamento, forma_pagamento, comprovante_path, status, origem_tipo, criado_em, categorias_financeiras(nome)";

function mapRow(r: any): LancamentoRow {
  return {
    id: r.id,
    tipo: r.tipo,
    classe_despesa: r.classe_despesa ?? null,
    competencia: r.competencia,
    descricao: r.descricao,
    categoria_id: r.categoria_id,
    categoria_nome: r.categorias_financeiras?.nome ?? null,
    contraparte: r.contraparte,
    valor: Number(r.valor),
    data_vencimento: r.data_vencimento,
    data_pagamento: r.data_pagamento,
    forma_pagamento: r.forma_pagamento,
    comprovante_path: r.comprovante_path,
    status: r.status,
    origem_tipo: r.origem_tipo,
    criado_em: r.criado_em
  };
}

export async function getCategoriasFinanceiras(
  opts: { tipo?: TipoLancamento; onlyAtivos?: boolean } = {}
): Promise<CategoriaFinanceira[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("categorias_financeiras")
    .select("id, nome, tipo, ativo")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome");
  if (opts.tipo) q = q.eq("tipo", opts.tipo);
  if (opts.onlyAtivos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getLancamentosMensais(
  competencia: string,
  filters: LancamentoFilters = {}
): Promise<LancamentoRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("lancamento_financeiro")
    .select(SELECT_COLS)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("competencia", competencia)
    .order("data_vencimento");

  if (filters.tipo) q = q.eq("tipo", filters.tipo);
  if (filters.categoria_id) q = q.eq("categoria_id", filters.categoria_id);
  if (filters.classe_despesa) q = q.eq("classe_despesa", filters.classe_despesa);
  if (filters.status && filters.status.length > 0) q = q.in("status", filters.status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getLancamentoById(id: string): Promise<LancamentoRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("lancamento_financeiro")
    .select(SELECT_COLS)
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data);
}
