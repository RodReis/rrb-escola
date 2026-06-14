"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { DEFAULT_SCHOOL_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { formBoolean, formNumber, formText } from "@/lib/utils";
import { produtoSchema, variacaoSchema, vendaSchema, vendaItemSchema } from "@/lib/validation/comercial";

const PRODUTOS = "/comercial/produtos";
const VENDAS = "/comercial/vendas";

// ---------------------------------------------------------------- Produtos ---

export async function createProdutoAction(formData: FormData) {
  await requirePermission("comercial.produtos", "create");
  const parsed = produtoSchema.safeParse({
    nome: formText(formData, "nome"),
    tipo: formText(formData, "tipo"),
    controla_estoque: formBoolean(formData, "controla_estoque"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) {
    redirect(`${PRODUTOS}/novo?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("produto")
    .insert({ ...parsed.data, escola_id: DEFAULT_SCHOOL_ID })
    .select("id")
    .single();
  if (error) redirect(`${PRODUTOS}/novo?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(PRODUTOS);
  redirect(`${PRODUTOS}/${data.id}/editar`);
}

export async function updateProdutoAction(formData: FormData) {
  await requirePermission("comercial.produtos", "update");
  const id = formText(formData, "id");
  if (!id) redirect(`${PRODUTOS}?erro=id`);
  const parsed = produtoSchema.safeParse({
    nome: formText(formData, "nome"),
    tipo: formText(formData, "tipo"),
    controla_estoque: formBoolean(formData, "controla_estoque"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) {
    redirect(`${PRODUTOS}/${id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("produto")
    .update(parsed.data)
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`${PRODUTOS}/${id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(PRODUTOS);
  redirect(`${PRODUTOS}/${id}/editar`);
}

export async function createVariacaoAction(formData: FormData) {
  await requirePermission("comercial.produtos", "update");
  const produto_id = formText(formData, "produto_id");
  if (!produto_id) redirect(`${PRODUTOS}?erro=produto_id`);

  const parsed = variacaoSchema.safeParse({
    sku: formText(formData, "sku"),
    atributos: {},
    preco_venda: formNumber(formData, "preco_venda"),
    custo: formNumber(formData, "custo"),
    estoque_minimo: formNumber(formData, "estoque_minimo"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) {
    redirect(`${PRODUTOS}/${produto_id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("produto_variacao")
    .insert({ ...parsed.data, produto_id, escola_id: DEFAULT_SCHOOL_ID });
  if (error) redirect(`${PRODUTOS}/${produto_id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(`${PRODUTOS}/${produto_id}/editar`);
  redirect(`${PRODUTOS}/${produto_id}/editar`);
}

export async function updateVariacaoAction(formData: FormData) {
  await requirePermission("comercial.produtos", "update");
  const id = formText(formData, "id");
  const produto_id = formText(formData, "produto_id");
  if (!id || !produto_id) redirect(`${PRODUTOS}?erro=id`);

  const parsed = variacaoSchema.safeParse({
    sku: formText(formData, "sku"),
    atributos: {},
    preco_venda: formNumber(formData, "preco_venda"),
    custo: formNumber(formData, "custo"),
    estoque_minimo: formNumber(formData, "estoque_minimo"),
    ativo: formBoolean(formData, "ativo")
  });
  if (!parsed.success) {
    redirect(`${PRODUTOS}/${produto_id}/editar?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "validacao")}`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("produto_variacao")
    .update(parsed.data)
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`${PRODUTOS}/${produto_id}/editar?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(`${PRODUTOS}/${produto_id}/editar`);
  redirect(`${PRODUTOS}/${produto_id}/editar`);
}

export async function deleteVariacaoAction(formData: FormData) {
  await requirePermission("comercial.produtos", "delete");
  const id = formText(formData, "id");
  const produto_id = formText(formData, "produto_id");
  if (!id || !produto_id) redirect(`${PRODUTOS}?erro=id`);

  const supabase = await createServerClient();
  // delete restrito por FK se houver venda_item/movimento referenciando — nesse
  // caso o banco bloqueia (on delete restrict) e a action devolve o erro.
  const { error } = await supabase
    .from("produto_variacao")
    .delete()
    .eq("id", id)
    .eq("escola_id", DEFAULT_SCHOOL_ID);
  if (error) redirect(`${PRODUTOS}/${produto_id}/editar?erro=${encodeURIComponent("Nao foi possivel excluir (variacao em uso?)")}`);

  revalidatePath(`${PRODUTOS}/${produto_id}/editar`);
  redirect(`${PRODUTOS}/${produto_id}/editar`);
}

// ------------------------------------------------------------------ Vendas ---

// Cria venda (rascunho) + itens. itens vêm como JSON no campo "itens".
export async function createVendaAction(formData: FormData) {
  const session = await requirePermission("comercial.vendas", "create");

  const parsedVenda = vendaSchema.safeParse({
    aluno_id: formText(formData, "aluno_id"),
    cliente_nome: formText(formData, "cliente_nome"),
    data_venda: formText(formData, "data_venda"),
    desconto: formNumber(formData, "desconto"),
    forma_pagamento: formText(formData, "forma_pagamento"),
    numero_cupom: formText(formData, "numero_cupom"),
    evento_id: formText(formData, "evento_id"),
    observacao: formText(formData, "observacao")
  });
  if (!parsedVenda.success) {
    redirect(`${VENDAS}/nova?erro=${encodeURIComponent(parsedVenda.error.issues[0]?.message ?? "validacao")}`);
  }

  // itens
  const rawItens = formText(formData, "itens");
  let itens: unknown[];
  try {
    itens = JSON.parse(rawItens ?? "[]");
  } catch {
    redirect(`${VENDAS}/nova?erro=itens_invalidos`);
  }
  const itensParsed = vendaItemSchema.array().min(1, "Adicione ao menos um item").safeParse(itens);
  if (!itensParsed.success) {
    redirect(`${VENDAS}/nova?erro=${encodeURIComponent(itensParsed.error.issues[0]?.message ?? "itens_invalidos")}`);
  }

  const supabase = await createServerClient();
  const { data: venda, error: errVenda } = await supabase
    .from("venda")
    .insert({
      ...parsedVenda.data,
      status: "rascunho",
      escola_id: DEFAULT_SCHOOL_ID,
      criado_por: session.profile.id
    })
    .select("id")
    .single();
  if (errVenda) redirect(`${VENDAS}/nova?erro=${encodeURIComponent(errVenda.message)}`);

  const itensInsert = itensParsed.data.map((i) => ({ ...i, venda_id: venda.id }));
  const { error: errItens } = await supabase.from("venda_item").insert(itensInsert);
  if (errItens) {
    // rollback do cabeçalho órfão
    await supabase.from("venda").delete().eq("id", venda.id).eq("escola_id", DEFAULT_SCHOOL_ID);
    redirect(`${VENDAS}/nova?erro=${encodeURIComponent(errItens.message)}`);
  }

  revalidatePath(VENDAS);
  redirect(`${VENDAS}?destaque=${venda.id}`);
}

// Confirma venda via RPC (atômica, gera receita).
export async function confirmarVendaAction(formData: FormData) {
  await requirePermission("comercial.vendas", "update");
  const id = formText(formData, "id");
  if (!id) redirect(`${VENDAS}?erro=id`);

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("confirmar_venda", { p_venda_id: id });
  if (error) redirect(`${VENDAS}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(VENDAS);
  redirect(`${VENDAS}?confirmada=${id}`);
}

// Cancela venda via RPC (marca lançamentos cancelados).
export async function cancelarVendaAction(formData: FormData) {
  await requirePermission("comercial.vendas", "update");
  const id = formText(formData, "id");
  if (!id) redirect(`${VENDAS}?erro=id`);

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("cancelar_venda", { p_venda_id: id });
  if (error) redirect(`${VENDAS}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath(VENDAS);
}
