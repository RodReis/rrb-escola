import { createServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import type { TipoProduto } from "@/lib/validation/comercial";

export interface VariacaoRow {
  id: string;
  produto_id: string;
  sku: string | null;
  atributos: Record<string, string>;
  preco_venda: number;
  custo: number;
  estoque_minimo: number;
  ativo: boolean;
}

export interface ProdutoRow {
  id: string;
  nome: string;
  tipo: TipoProduto;
  controla_estoque: boolean;
  ativo: boolean;
  variacoes: VariacaoRow[];
}

export interface VendaRow {
  id: string;
  aluno_id: string | null;
  cliente_nome: string | null;
  status: "rascunho" | "confirmada" | "cancelada";
  data_venda: string;
  desconto: number;
  forma_pagamento: string | null;
  numero_cupom: string | null;
  total: number;
  criado_em: string;
}

function mapVariacao(v: any): VariacaoRow {
  return {
    id: v.id,
    produto_id: v.produto_id,
    sku: v.sku,
    atributos: (v.atributos ?? {}) as Record<string, string>,
    preco_venda: Number(v.preco_venda),
    custo: Number(v.custo),
    estoque_minimo: v.estoque_minimo,
    ativo: v.ativo
  };
}

export async function getProdutos(opts: { onlyAtivos?: boolean } = {}): Promise<ProdutoRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("produto")
    .select("id, nome, tipo, controla_estoque, ativo, produto_variacao(id, produto_id, sku, atributos, preco_venda, custo, estoque_minimo, ativo)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("nome");
  if (opts.onlyAtivos) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    nome: p.nome,
    tipo: p.tipo,
    controla_estoque: p.controla_estoque,
    ativo: p.ativo,
    variacoes: (p.produto_variacao ?? []).map(mapVariacao)
  }));
}

export async function getProdutoById(id: string): Promise<ProdutoRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("produto")
    .select("id, nome, tipo, controla_estoque, ativo, produto_variacao(id, produto_id, sku, atributos, preco_venda, custo, estoque_minimo, ativo)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    nome: data.nome,
    tipo: (data as any).tipo,
    controla_estoque: (data as any).controla_estoque,
    ativo: data.ativo,
    variacoes: ((data as any).produto_variacao ?? []).map(mapVariacao)
  };
}

// Variações ativas com nome do produto — usado no seletor de itens da venda.
export interface VariacaoOption extends VariacaoRow {
  produto_nome: string;
}

export async function getVariacoesAtivas(): Promise<VariacaoOption[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("produto_variacao")
    .select("id, produto_id, sku, atributos, preco_venda, custo, estoque_minimo, ativo, produto(nome)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .eq("ativo", true)
    .order("produto_id");
  if (error) throw error;
  return (data ?? []).map((v: any) => ({
    ...mapVariacao(v),
    produto_nome: v.produto?.nome ?? "—"
  }));
}

export async function getVendas(filters: { status?: string } = {}): Promise<VendaRow[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("venda")
    .select("id, aluno_id, cliente_nome, status, data_venda, desconto, forma_pagamento, numero_cupom, criado_em, venda_item(subtotal)")
    .eq("escola_id", DEFAULT_SCHOOL_ID)
    .order("data_venda", { ascending: false });
  if (filters.status) q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((v: any) => {
    const soma = (v.venda_item ?? []).reduce((acc: number, i: any) => acc + Number(i.subtotal), 0);
    return {
      id: v.id,
      aluno_id: v.aluno_id,
      cliente_nome: v.cliente_nome,
      status: v.status,
      data_venda: v.data_venda,
      desconto: Number(v.desconto),
      forma_pagamento: v.forma_pagamento,
      numero_cupom: v.numero_cupom,
      total: soma - Number(v.desconto),
      criado_em: v.criado_em
    };
  });
}
