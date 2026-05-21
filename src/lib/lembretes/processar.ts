import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCHOOL_ID, money } from "@/lib/constants";
import { enviarWhatsApp } from "@/lib/whatsapp/send";
import { resolverLembretesPendentes } from "./detectar";

const TEMPLATE_LEMBRETE = process.env.META_TEMPLATE_LEMBRETE ?? "lembrete_cobranca";
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

  // forcarReenvio → não ignora já enviados.
  const pendentes = await resolverLembretesPendentes(supabase, escolaId, !opts.forcarReenvio);
  const lote = pendentes.slice(0, LIMITE_LOTE);

  let enviados = 0;
  let falhas = 0;

  for (const p of lote) {
    const valorFmt = money.format(p.valor);
    const vencimentoFmt = dataBR(p.vencimento);

    // Variáveis do template lembrete_cobranca, na ordem {{1}}..{{4}}:
    // responsável, aluno, valor, vencimento.
    const variaveis = [p.responsavelNome, p.alunoNome, valorFmt, vencimentoFmt];

    // Texto legível para o log (a Meta renderiza o template; guardamos uma versão local).
    const textoLog = `Lembrete: mensalidade de ${p.alunoNome} (${p.descricao}) ${valorFmt}, vencida em ${vencimentoFmt}.`;

    const resultado = await enviarWhatsApp(
      {
        telefone: p.telefone,
        templateName: TEMPLATE_LEMBRETE,
        variaveis,
        textoLog,
        alunoId: p.alunoId,
        referenciaTipo: "lembrete_cobranca",
        referenciaId: p.cobrancaId,
      },
      supabase,
    );

    if (resultado.ok) enviados += 1;
    else falhas += 1;
  }

  return { processados: lote.length, enviados, falhas };
}
