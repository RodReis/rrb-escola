import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";

export interface CategoriaDespesa {
  id: string;
  nome: string;
  ativo: boolean;
}

export type TipoDespesa = "fixa" | "variavel";

export interface DespesaRow {
  id: string;
  competencia: string;
  descricao: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  tipo: TipoDespesa;
  fornecedor: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  comprovante_path: string | null;
  status: "aberta" | "paga" | "cancelada";
  criado_em: string;
}

export interface DespesaFilters {
  categoria_id?: string;
  status?: string[];
  tipo?: TipoDespesa;
}

export async function getCategorias(opts: { onlyAtivos?: boolean } = {}): Promise<CategoriaDespesa[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("categorias_despesa")
    .select("id, nome, ativo")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome");
  if (opts.onlyAtivos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getDespesasMensais(
  competencia: string,
  filters: DespesaFilters = {}
): Promise<DespesaRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("despesas")
    .select(
      "id, competencia, descricao, categoria_id, tipo, fornecedor, valor, data_vencimento, data_pagamento, forma_pagamento, comprovante_path, status, criado_em, categorias_despesa(nome)"
    )
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("competencia", competencia)
    .order("data_vencimento");

  if (filters.categoria_id) q = q.eq("categoria_id", filters.categoria_id);
  if (filters.tipo) q = q.eq("tipo", filters.tipo);
  if (filters.status && filters.status.length > 0) q = q.in("status", filters.status);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    competencia: r.competencia,
    descricao: r.descricao,
    categoria_id: r.categoria_id,
    categoria_nome: r.categorias_despesa?.nome ?? null,
    tipo: (r.tipo ?? "variavel") as TipoDespesa,
    fornecedor: r.fornecedor,
    valor: Number(r.valor),
    data_vencimento: r.data_vencimento,
    data_pagamento: r.data_pagamento,
    forma_pagamento: r.forma_pagamento,
    comprovante_path: r.comprovante_path,
    status: r.status,
    criado_em: r.criado_em
  }));
}

export async function getDespesaById(id: string): Promise<DespesaRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("despesas")
    .select(
      "id, competencia, descricao, categoria_id, tipo, fornecedor, valor, data_vencimento, data_pagamento, forma_pagamento, comprovante_path, status, criado_em, categorias_despesa(nome)"
    )
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    competencia: data.competencia,
    descricao: data.descricao,
    categoria_id: data.categoria_id,
    categoria_nome: (data as any).categorias_despesa?.nome ?? null,
    tipo: ((data as any).tipo ?? "variavel") as TipoDespesa,
    fornecedor: data.fornecedor,
    valor: Number(data.valor),
    data_vencimento: data.data_vencimento,
    data_pagamento: data.data_pagamento,
    forma_pagamento: data.forma_pagamento,
    comprovante_path: data.comprovante_path,
    status: data.status,
    criado_em: data.criado_em
  };
}
