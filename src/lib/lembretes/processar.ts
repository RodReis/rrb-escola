import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCHOOL_ID, money } from "@/lib/constants";
import { enviarWhatsApp } from "@/lib/whatsapp/send";
import { montarMensagem } from "./montar-mensagem";
import { resolverLembretesPendentes } from "./detectar";

const TEMPLATE_FALLBACK =
  "Olá {responsavel}, a mensalidade de {aluno} ({descricao}) no valor de {valor}, vencida em {vencimento}, está em aberto há {dias_atraso} dia(s). Por favor, regularize.";
const LIMITE_LOTE = 50;

export type ResultadoLembretes = {
  processados: number;
  enviados: number;
  falhas: number;
};

function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export async function processarLembretes(
  opts: { forcarReenvio: boolean },
  escolaId: string = DEFAULT_SCHOOL_ID,
): Promise<ResultadoLembretes> {
  const supabase = createAdminClient();

  // Template da escola (com fallback se nulo).
  const { data: escola } = await supabase
    .from("escolas")
    .select("lembrete_template")
    .eq("id", escolaId)
    .maybeSingle();
  const template = escola?.lembrete_template || TEMPLATE_FALLBACK;

  // forcarReenvio → não ignora já enviados.
  const pendentes = await resolverLembretesPendentes(supabase, escolaId, !opts.forcarReenvio);
  const lote = pendentes.slice(0, LIMITE_LOTE);

  let enviados = 0;
  let falhas = 0;

  for (const p of lote) {
    const mensagem = montarMensagem(template, {
      responsavel: p.responsavelNome,
      aluno: p.alunoNome,
      descricao: p.descricao,
      valor: money.format(p.valor),
      vencimento: dataBR(p.vencimento),
      diasAtraso: p.diasAtraso,
    });

    const resultado = await enviarWhatsApp({
      telefone: p.telefone,
      mensagem,
      alunoId: p.alunoId,
      referenciaTipo: "lembrete_cobranca",
      referenciaId: p.cobrancaId,
    });

    if (resultado.ok) enviados += 1;
    else falhas += 1;
  }

  return { processados: lote.length, enviados, falhas };
}
