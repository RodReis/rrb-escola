"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { sicoobProvider } from "@/lib/sicoob/provider";
import { validarOrigemPix } from "@/lib/tesouraria/origem";
import { enviarWhatsApp } from "@/lib/whatsapp/send";
import type { OrigemRecebimento } from "@/lib/pagamentos/provider";

export type GerarPixResult =
  | { ok: true; copiaCola: string; txid: string; expiraEm: string | null }
  | { ok: false; reason: string };

export async function gerarPixOrigemAction(input: {
  origemTipo: OrigemRecebimento;
  origemId?: string | null;
  contaId?: string | null;
  valor?: number;
  descricao?: string;
  devedorNome?: string | null;
  devedorDoc?: string | null;
}): Promise<GerarPixResult> {
  const session = await requirePermission("financeiro.tesouraria", "create");
  if (input.origemTipo === "venda") {
    await requirePermission("comercial.vendas", "update");
  }
  if (input.origemTipo === "lancamento") {
    await requirePermission("financeiro.lancamentos", "update");
  }
  const supabase = await createServerClient();

  let contaQuery = supabase
    .from("contas_bancarias")
    .select("id, chave_pix")
    .eq("escola_id", session.profile.escola_id)
    .eq("provedor", "sicoob")
    .eq("ativo", true);

  contaQuery = input.contaId ? contaQuery.eq("id", input.contaId) : contaQuery.limit(1);
  const { data: conta } = await contaQuery.maybeSingle();

  if (!conta?.chave_pix) return { ok: false, reason: "Conta Sicoob ativa sem chave Pix" };

  const { data: existente } = input.origemId ? await supabase
    .from("pix_cobranca")
    .select("txid, pix_copia_cola, expira_em")
    .eq("escola_id", session.profile.escola_id)
    .eq("origem_tipo", input.origemTipo)
    .eq("origem_id", input.origemId)
    .eq("status", "ativa")
    .gt("expira_em", new Date().toISOString())
    .maybeSingle() : { data: null };

  if (existente?.pix_copia_cola) {
    return {
      ok: true,
      copiaCola: existente.pix_copia_cola,
      txid: existente.txid,
      expiraEm: existente.expira_em,
    };
  }

  let cobranca: {
    id: string;
    escola_id: string;
    aluno_id?: string;
    descricao: string;
    valor_final: number | string;
    data_vencimento?: string | null;
    status?: string;
  } | null = null;
  let responsavel = {
    nome: input.devedorNome ?? "Pagador",
    cpf: input.devedorDoc ?? null,
    email: null as string | null,
    celular: null as string | null,
  };

  if (input.origemTipo === "cobranca") {
    const charge = await supabase
      .from("cobrancas")
      .select("id, escola_id, aluno_id, descricao, valor_final, data_vencimento, status")
      .eq("id", input.origemId)
      .eq("escola_id", session.profile.escola_id)
      .maybeSingle();

    cobranca = charge.data;
    if (!cobranca) return { ok: false, reason: "Cobrança não encontrada" };
    if (cobranca.status === "paga" || cobranca.status === "cancelada") {
      return { ok: false, reason: "Cobrança já está paga ou cancelada" };
    }

    const resp = await supabase
      .from("responsaveis_aluno")
      .select("nome, cpf, email, celular")
      .eq("aluno_id", cobranca.aluno_id)
      .eq("responsavel_financeiro", true)
      .maybeSingle();

    if (!resp.data?.nome || !resp.data.cpf) {
      return { ok: false, reason: "Responsável financeiro precisa de nome e CPF" };
    }
    responsavel = resp.data;
  } else if (input.origemTipo === "venda") {
    const vendaResp = await supabase
      .from("venda")
      .select("id, escola_id, cliente_nome, status, desconto, venda_item(subtotal)")
      .eq("id", input.origemId)
      .eq("escola_id", session.profile.escola_id)
      .maybeSingle();

    const venda = vendaResp.data as
      | {
          id: string;
          escola_id: string;
          cliente_nome: string | null;
          status: string;
          desconto: number | string;
          venda_item?: { subtotal: number | string }[];
        }
      | null;
    if (!venda) return { ok: false, reason: "Venda não encontrada" };
    if (venda.status !== "rascunho") return { ok: false, reason: "Venda precisa estar em rascunho para gerar Pix" };

    const totalItens = (venda.venda_item ?? []).reduce((acc, item) => acc + Number(item.subtotal), 0);
    const total = totalItens - Number(venda.desconto);
    cobranca = {
      id: venda.id,
      escola_id: venda.escola_id,
      descricao: `Venda ${venda.id.slice(0, 8)}`,
      valor_final: total,
    };
    responsavel = {
      nome: venda.cliente_nome ?? input.devedorNome ?? "Pagador",
      cpf: input.devedorDoc ?? null,
      email: null,
      celular: null,
    };
  } else if (input.origemTipo === "lancamento") {
    const lancamentoResp = await supabase
      .from("lancamento_financeiro")
      .select("id, escola_id, tipo, descricao, valor, status, contraparte")
      .eq("id", input.origemId)
      .eq("escola_id", session.profile.escola_id)
      .maybeSingle();

    const lancamento = lancamentoResp.data as
      | {
          id: string;
          escola_id: string;
          tipo: string;
          descricao: string;
          valor: number | string;
          status: string;
          contraparte: string | null;
        }
      | null;
    if (!lancamento) return { ok: false, reason: "Lançamento não encontrado" };
    if (lancamento.tipo !== "receita") return { ok: false, reason: "Pix só pode receber lançamento de receita" };
    if (lancamento.status !== "aberta") return { ok: false, reason: "Lançamento precisa estar aberto" };

    cobranca = {
      id: lancamento.id,
      escola_id: lancamento.escola_id,
      descricao: lancamento.descricao,
      valor_final: lancamento.valor,
    };
    responsavel = {
      nome: lancamento.contraparte ?? input.devedorNome ?? "Pagador",
      cpf: input.devedorDoc ?? null,
      email: null,
      celular: null,
    };
  } else {
    if (!input.valor || !input.descricao) {
      return { ok: false, reason: "Pix avulso precisa de valor e descrição" };
    }
    cobranca = {
      id: input.origemId ?? crypto.randomUUID(),
      escola_id: session.profile.escola_id,
      descricao: input.descricao,
      valor_final: input.valor,
    };
  }

  if (!cobranca) return { ok: false, reason: "Origem inválida" };

  const origemValida = validarOrigemPix({
    origemTipo: input.origemTipo,
    origemId: input.origemId ?? null,
    valor: Number(cobranca.valor_final),
    descricao: cobranca.descricao,
    devedorNome: responsavel.nome,
    devedorDoc: responsavel.cpf,
  });
  if (!origemValida.ok) return origemValida;

  const pix = await sicoobProvider.criarCobranca({
    cobranca,
    responsavel,
    conta,
    origemTipo: input.origemTipo,
    origemId: input.origemId,
    tipo: "pix_imediato",
  });

  if (!pix.ok) return pix;
  if (!pix.data.pix_copia_cola) {
    return { ok: false, reason: "Sicoob não retornou copia-e-cola Pix" };
  }

  const { error } = await supabase.from("pix_cobranca").insert({
    escola_id: session.profile.escola_id,
    conta_id: conta.id,
    origem_tipo: input.origemTipo,
    origem_id: input.origemId ?? null,
    txid: pix.data.id_externo,
    valor: Number(cobranca.valor_final),
    devedor_nome: responsavel.nome,
    devedor_doc: responsavel.cpf,
    descricao: cobranca.descricao,
    pix_copia_cola: pix.data.pix_copia_cola,
    location: pix.data.pix_location,
    status: "ativa",
    expira_em: pix.data.expira_em,
    payload: pix.data.payload,
  });

  if (error) return { ok: false, reason: error.message };

  revalidatePath("/financeiro/tesouraria/cobrancas-pix");
  revalidatePath("/financeiro");

  return {
    ok: true,
    copiaCola: pix.data.pix_copia_cola,
    txid: pix.data.id_externo,
    expiraEm: pix.data.expira_em ?? null,
  };
}

export async function gerarPixAction(cobrancaId: string): Promise<GerarPixResult> {
  await requirePermission("financeiro.cobrancas", "update");
  return gerarPixOrigemAction({ origemTipo: "cobranca", origemId: cobrancaId });
}

export async function gerarPixCobrancaFormAction(formData: FormData) {
  const result = await gerarPixOrigemAction({
    origemTipo: "avulso",
    valor: Number(String(formData.get("valor") ?? "0").replace(",", ".")),
    descricao: String(formData.get("descricao") ?? ""),
    devedorNome: String(formData.get("devedor_nome") ?? "Pagador"),
    devedorDoc: String(formData.get("devedor_doc") ?? ""),
    contaId: String(formData.get("conta_id") ?? "") || null,
  });
  if (!result.ok) throw new Error(result.reason);
  revalidatePath("/financeiro/tesouraria/cobrancas-pix");
}

export async function enviarPixWhatsAppAction(cobrancaId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const session = await requirePermission("financeiro.cobrancas", "update");
  const supabase = await createServerClient();
  const templateName = process.env.META_TEMPLATE_PIX;
  if (!templateName) return { ok: false, reason: "META_TEMPLATE_PIX ausente" };

  const pix = await gerarPixAction(cobrancaId);
  if (!pix.ok) return pix;

  const { data: cobranca } = await supabase
    .from("cobrancas")
    .select("id, aluno_id, descricao, valor_final, data_vencimento, alunos(nome)")
    .eq("id", cobrancaId)
    .eq("escola_id", session.profile.escola_id)
    .maybeSingle();

  if (!cobranca) return { ok: false, reason: "Cobrança não encontrada" };

  const { data: responsavel } = await supabase
    .from("responsaveis_aluno")
    .select("celular, telefone")
    .eq("aluno_id", cobranca.aluno_id)
    .eq("responsavel_financeiro", true)
    .maybeSingle();

  const telefone = responsavel?.celular ?? responsavel?.telefone;
  if (!telefone) return { ok: false, reason: "Responsável financeiro sem telefone" };

  const aluno = Array.isArray(cobranca.alunos) ? cobranca.alunos[0] : cobranca.alunos;
  const result = await enviarWhatsApp({
    telefone,
    templateName,
    variaveis: [
      aluno?.nome ?? "Aluno",
      cobranca.descricao,
      Number(cobranca.valor_final).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      pix.copiaCola,
    ],
    textoLog: `Pix ${cobranca.descricao}: ${pix.copiaCola}`,
    alunoId: cobranca.aluno_id,
    referenciaTipo: "cobranca_pix",
    referenciaId: cobranca.id,
  });

  if (!result.ok) return result;
  return { ok: true };
}
