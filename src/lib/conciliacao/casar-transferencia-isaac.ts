/**
 * Casamento das transferências do repasse isaac com créditos do extrato.
 *
 * O repasse não chega num crédito único: são duas transferências (hoje dia 05
 * com 70% e dia 15 com 30%), então cada uma é casada separadamente. Somar as
 * duas e procurar um crédito só nunca acharia nada.
 *
 * Função pura: recebe as transferências pendentes e os créditos disponíveis,
 * devolve o que casa. Quem lê e grava é o sync.
 *
 * Ref: docs/superpowers/specs/2026-09-21-financeiro-isaac-multicnpj-design.md
 */

export type TransferenciaPendente = {
  id: string;
  repasseId: string;
  dataPrevista: string;
  valor: number;
  /** company_id da unidade isaac: o crédito tem que cair na conta daquele CNPJ. */
  companyId: string | null;
};

export type CreditoExtrato = {
  id: string;
  contaId: string;
  /** company_id da conta bancária. Null = conta ainda não classificada. */
  companyId: string | null;
  data: string;
  valor: number;
  descricao: string;
};

export type CasamentoTransferencia = {
  transferenciaId: string;
  extratoId: string;
  valor: number;
  /** Dias entre a data prevista e a do crédito. Informativo. */
  defasagemDias: number;
};

export type AlertaTransferencia = {
  transferenciaId: string;
  dataPrevista: string;
  valorEsperado: number;
  tipo: "sem_credito" | "ambiguo";
  detalhe: string;
};

export type ResultadoCasamento = {
  casamentos: CasamentoTransferencia[];
  alertas: AlertaTransferencia[];
};

/**
 * Tolerância de 1 centavo, comparada em centavos INTEIROS.
 *
 * Em float, `Math.abs(125479.02 - 125479.01)` dá 0.010000000009313226 — maior
 * que 0.01 — e um crédito com um centavo de diferença deixaria de casar. Os
 * dois lados vêm de numeric(12,2), então arredondar para centavo é exato.
 */
const TOLERANCIA_CENTAVOS = 1;

const centavos = (valor: number): number => Math.round(valor * 100);

const MS_DIA = 86_400_000;

function dias(a: string, b: string): number {
  return Math.round(
    (new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / MS_DIA,
  );
}

/**
 * Janela de tolerância em dias corridos. O spec pede ±3 dias ÚTEIS; como o
 * repasse cai em dia fixo (05 e 15) e o atraso real observado é de fim de
 * semana, 5 dias corridos cobrem o mesmo intervalo sem precisar de calendário
 * de feriados — que o sistema não tem.
 */
export const JANELA_DIAS = 5;

/**
 * Casa cada transferência com no máximo um crédito.
 *
 * Regras, nesta ordem:
 *  - valor igual dentro da tolerância;
 *  - crédito na conta do MESMO CNPJ da unidade (quando ambos os lados têm
 *    company_id — conta sem empresa classificada não bloqueia, só não filtra);
 *  - dentro da janela de dias em torno da data prevista;
 *  - um crédito só pode ser usado por uma transferência.
 *
 * Empate NÃO casa automaticamente: dois créditos do mesmo valor na janela
 * viram alerta. As duas parcelas do repasse têm valores diferentes (70/30), mas
 * duas unidades podem repassar o mesmo valor no mesmo dia, e escolher errado
 * ligaria o dinheiro ao CNPJ errado.
 */
export function casarTransferenciasIsaac(
  transferencias: TransferenciaPendente[],
  creditos: CreditoExtrato[],
): ResultadoCasamento {
  const casamentos: CasamentoTransferencia[] = [];
  const alertas: AlertaTransferencia[] = [];
  const usados = new Set<string>();

  // Menor defasagem primeiro: se duas transferências disputam o mesmo crédito,
  // fica com quem tem a data mais próxima.
  const ordenadas = [...transferencias].sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista));

  for (const transferencia of ordenadas) {
    const candidatos = creditos.filter((credito) => {
      if (usados.has(credito.id)) return false;
      if (Math.abs(centavos(credito.valor) - centavos(transferencia.valor)) > TOLERANCIA_CENTAVOS) return false;
      if (
        transferencia.companyId !== null &&
        credito.companyId !== null &&
        credito.companyId !== transferencia.companyId
      ) {
        return false;
      }
      return Math.abs(dias(credito.data, transferencia.dataPrevista)) <= JANELA_DIAS;
    });

    if (candidatos.length === 0) {
      alertas.push({
        transferenciaId: transferencia.id,
        dataPrevista: transferencia.dataPrevista,
        valorEsperado: transferencia.valor,
        tipo: "sem_credito",
        detalhe: `Nenhum crédito de ${transferencia.valor.toFixed(2)} até ${JANELA_DIAS} dias de ${transferencia.dataPrevista}.`,
      });
      continue;
    }

    if (candidatos.length > 1) {
      alertas.push({
        transferenciaId: transferencia.id,
        dataPrevista: transferencia.dataPrevista,
        valorEsperado: transferencia.valor,
        tipo: "ambiguo",
        detalhe: `${candidatos.length} créditos do mesmo valor na janela. Concilie à mão para não ligar ao CNPJ errado.`,
      });
      continue;
    }

    const escolhido = candidatos[0];
    usados.add(escolhido.id);
    casamentos.push({
      transferenciaId: transferencia.id,
      extratoId: escolhido.id,
      valor: escolhido.valor,
      defasagemDias: dias(escolhido.data, transferencia.dataPrevista),
    });
  }

  return { casamentos, alertas };
}

/**
 * Transferência vencida sem crédito. Usado pela tela para mostrar o que já
 * deveria ter caído e não caiu — silêncio aqui seria dinheiro não recebido
 * passando despercebido.
 */
export function transferenciasAtrasadas(
  transferencias: TransferenciaPendente[],
  hoje: string,
): TransferenciaPendente[] {
  return transferencias.filter((t) => dias(hoje, t.dataPrevista) > JANELA_DIAS);
}
