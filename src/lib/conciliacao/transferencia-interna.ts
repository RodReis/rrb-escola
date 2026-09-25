/**
 * Casamento de transferência entre contas próprias.
 *
 * Medido em produção em 24/09/2026: 18 pares em 9 meses, TODOS com candidato
 * único e no mesmo dia, somando exatamente o total do grupo de descrição
 * `DÉB.TRANSF.CONTAS DIF.TITULARIDADE` (R$ 86.541,14 em 18 ocorrências).
 *
 * Esta etapa roda ANTES da regra de contraparte de propósito. Um Pix entre os
 * dois CNPJs tem documento preenchido e se repete todo mês; se a regra rodasse
 * primeiro, quem confirmasse a fila tenderia a salvar "CNPJ do Pinguinho ->
 * despesa X", e toda transferência interna viraria despesa nos dois CNPJs.
 *
 * Empate não casa: dois créditos do mesmo valor na janela viram ambíguo, para
 * não ligar dinheiro ao CNPJ errado. A guarda vale para os dois lados: um
 * crédito único disputado por dois débitos (cada um vendo só aquele crédito
 * como candidato) também é ambíguo — sem isso, o primeiro débito na ordem
 * ficava com o par e o segundo sumia silenciosamente na fila "a classificar",
 * sem sinal nenhum de que os dois competiram pelo mesmo dinheiro.
 */

export type MovimentoConta = {
  id: string;
  contaId: string;
  data: string;
  valor: number;
  tipo: "debito" | "credito";
};

export type ParInterno = {
  debitoId: string;
  creditoId: string;
  contaDestinoId: string;
};

export type ParAmbiguo = {
  debitoId: string;
  candidatos: string[];
};

export type ResultadoInterno = {
  pares: ParInterno[];
  ambiguos: ParAmbiguo[];
};

/** Comparação em centavos inteiros: em float, 125479.02 - 125479.01 não dá 0,01. */
const centavos = (v: number) => Math.round(v * 100);

const MS_DIA = 86_400_000;

function dias(a: string, b: string): number {
  return Math.round(
    (new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / MS_DIA,
  );
}

/** Janela em dias corridos. Os 18 pares medidos caíram todos no mesmo dia; 1 cobre a virada. */
export const JANELA_DIAS_INTERNA = 1;

export function detectarTransferenciasInternas(
  debitos: MovimentoConta[],
  creditos: MovimentoConta[],
): ResultadoInterno {
  const pares: ParInterno[] = [];
  const ambiguos: ParAmbiguo[] = [];
  const creditosUsados = new Set<string>();
  const debitosResolvidos = new Set<string>();

  // Data crescente: quando dois débitos iguais disputam créditos, o mais antigo escolhe antes.
  const ordenados = [...debitos].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));

  const candidatosDe = (debito: MovimentoConta) =>
    creditos.filter(
      (c) =>
        !creditosUsados.has(c.id) &&
        c.contaId !== debito.contaId &&
        centavos(c.valor) === centavos(debito.valor) &&
        Math.abs(dias(c.data, debito.data)) <= JANELA_DIAS_INTERNA,
    );

  for (const debito of ordenados) {
    if (debitosResolvidos.has(debito.id)) continue;

    const candidatos = candidatosDe(debito);
    if (candidatos.length === 0) continue;

    // Ambíguo do lado débito: candidatos em contas DIFERENTES. Dois créditos
    // iguais na mesma conta de destino dão no mesmo, e aí o primeiro serve.
    const contasDistintas = new Set(candidatos.map((c) => c.contaId));
    if (contasDistintas.size > 1) {
      ambiguos.push({ debitoId: debito.id, candidatos: candidatos.map((c) => c.id) });
      continue;
    }

    const credito = candidatos[0];

    // Ambíguo do lado crédito: outro débito, ainda não resolvido, cujo ÚNICO
    // candidato também é este crédito. Sem essa checagem, o primeiro débito
    // da ordem levava o par e o rival sumia na fila manual sem aviso.
    const debitosRivais = ordenados.filter((d) => {
      if (d.id === debito.id || debitosResolvidos.has(d.id)) return false;
      const cs = candidatosDe(d);
      return cs.length === 1 && cs[0].id === credito.id;
    });

    if (debitosRivais.length > 0) {
      ambiguos.push({ debitoId: debito.id, candidatos: [credito.id] });
      for (const rival of debitosRivais) {
        ambiguos.push({ debitoId: rival.id, candidatos: [credito.id] });
        debitosResolvidos.add(rival.id);
      }
      continue;
    }

    creditosUsados.add(credito.id);
    debitosResolvidos.add(debito.id);
    pares.push({ debitoId: debito.id, creditoId: credito.id, contaDestinoId: credito.contaId });
  }

  return { pares, ambiguos };
}
