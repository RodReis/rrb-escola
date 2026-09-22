/**
 * Parser do resumo .pdf do Meu Arco — o extrato do repasse isaac.
 *
 * É a ÚNICA fonte de duas coisas que o analítico .xlsx não traz:
 *   - o "Débito da parcela do crédito de curto prazo" (amortização de
 *     empréstimo, não despesa operacional);
 *   - as transferências programadas (dia 05 = 70%, dia 15 = 30%).
 *
 * Conferido contra os resumos reais de setembro/2026 das duas unidades: o
 * analítico de EPG Trindade fecha em 202.402,26 de valor final, e
 * 202.402,26 − 23.146,54 (crédito) = 179.255,72, o total transferido do PDF.
 * Sem este parser, esses 23 mil virariam receita que nunca entrou na conta.
 *
 * Função pura: recebe o texto já extraído (por pdf-parse, na camada de I/O) e
 * devolve dados. Não lê arquivo, não toca banco.
 */

export type GrupoLinha = "recebimento" | "desconto" | "outros";

export type LinhaResumo = {
  grupo: GrupoLinha;
  /** Rótulo exatamente como aparece no PDF, ex. "Taxa isaac". */
  tipo: string;
  /** Com sinal, como o PDF mostra: "- R$ 16.052,69" vira -16052.69. */
  valor: number;
};

export type TransferenciaResumo = {
  /** ISO `YYYY-MM-DD`. */
  data: string;
  valor: number;
};

export type ResumoIsaac = {
  /** Nome da unidade como o isaac escreve. Nunca usado para inferir CNPJ. */
  unidade: string;
  /** Competência DO REPASSE (`YYYY-MM`), não da mensalidade. */
  competencia: string;
  /** Período de atualizações coberto, texto do PDF. Informativo. */
  periodo: string | null;
  linhas: LinhaResumo[];
  transferencias: TransferenciaResumo[];
  total: number;
  /** "307 alunos | 327 cobranças" do cabeçalho. Conferência, nunca valor. */
  alunosInformados: number | null;
  cobrancasInformadas: number | null;
};

export class ResumoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumoInvalidoError";
  }
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const SECAO_PARA_GRUPO: Record<string, GrupoLinha> = {
  recebimentos: "recebimento",
  descontos: "desconto",
  "outros valores": "outros",
};

/**
 * Subtítulos e cabeçalhos de agrupamento que aparecem entre as linhas de valor.
 * Lista explícita (não heurística) para que um rótulo NOVO do isaac apareça
 * como linha desconhecida em vez de ser engolido — a validação de fechamento
 * então acusa, em vez de o dinheiro sumir em silêncio.
 */
const RUIDO = new Set([
  "valores referentes a parcelas de mensalidades",
  "mudancas em mensalidades",
  "credito",
  "debito",
]);

const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "R$ 1.234,56" → 1234.56; "- R$ 890,00" → -890. */
function parseValor(linha: string): number | null {
  const m = /(-\s*)?R\$\s*([\d.]+,\d{2})/.exec(linha);
  if (!m) return null;
  const valor = Number(m[2].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(valor)) return null;
  return m[1] ? -valor : valor;
}

const iso = (ano: number, mes: number, dia: number): string =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

export function parseResumoIsaac(texto: string): ResumoIsaac {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  if (linhas.length === 0) throw new ResumoInvalidoError("Resumo vazio: nenhum texto extraído do PDF.");

  const unidade = linhas[0];
  let competencia: string | null = null;
  let ano: number | null = null;
  let periodo: string | null = null;
  let total: number | null = null;
  let alunosInformados: number | null = null;
  let cobrancasInformadas: number | null = null;
  const parsed: LinhaResumo[] = [];
  const transferencias: TransferenciaResumo[] = [];

  const mPeriodo = /(\d{1,2}) de (\w+) ate (\d{1,2}) de (\w+) de (\d{4})/.exec(norm(texto));
  if (mPeriodo) periodo = `${mPeriodo[1]} de ${mPeriodo[2]} até ${mPeriodo[3]} de ${mPeriodo[4]} de ${mPeriodo[5]}`;

  // Seção corrente. O PDF é sequencial e as seções SOMEM quando vazias — a
  // unidade Educação Infantil não tem "Cancelado" nem "Outros valores" em
  // set/2026 — então nada aqui pode depender de posição de linha.
  let secao: string | null = null;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const n = norm(linha);

    // "Setembro de 2026", sozinha na linha: competência do repasse.
    const mComp = /^(\w+) de (\d{4})$/.exec(n);
    if (mComp && MESES[mComp[1]] !== undefined && competencia === null) {
      ano = Number(mComp[2]);
      competencia = `${ano}-${String(MESES[mComp[1]]).padStart(2, "0")}`;
      continue;
    }

    if (n === "transferencias programadas") { secao = "transferencias"; continue; }
    if (SECAO_PARA_GRUPO[n] !== undefined) { secao = n; continue; }
    if (n === "valor total a ser transferido") { secao = "total"; continue; }

    if (secao === "transferencias") {
      // "5 de Setembro" seguido, na linha de baixo, de "R$ 125.479,01".
      const mData = /^(\d{1,2}) de (\w+)$/.exec(n);
      if (mData && MESES[mData[2]] !== undefined) {
        const valor = parseValor(linhas[i + 1] ?? "");
        if (valor !== null && ano !== null) {
          transferencias.push({ data: iso(ano, MESES[mData[2]], Number(mData[1])), valor });
          i++;
        }
        continue;
      }
    }

    if (secao === "total") {
      const valor = parseValor(linha);
      if (valor !== null) { total = valor; secao = null; }
      continue;
    }

    const mContagem = /^(\d+) alunos \| (\d+) cobrancas$/.exec(n);
    if (mContagem) {
      alunosInformados = Number(mContagem[1]);
      cobrancasInformadas = Number(mContagem[2]);
      continue;
    }

    const grupo = secao === null ? undefined : SECAO_PARA_GRUPO[secao];
    if (grupo === undefined) continue;
    if (RUIDO.has(n)) continue;

    const valor = parseValor(linha);
    if (valor === null) continue;

    // Rótulo = o que vem antes do valor. O PDF separa com tab.
    const tipo = linha.split(/\s*\t\s*|\s{2,}/)[0].replace(/\s*-?\s*R\$.*$/, "").trim();
    if (tipo) parsed.push({ grupo, tipo, valor });
  }

  if (competencia === null) {
    throw new ResumoInvalidoError('Competência não encontrada (esperado uma linha como "Setembro de 2026").');
  }
  if (total === null) {
    throw new ResumoInvalidoError('Total não encontrado (esperada a seção "Valor total a ser transferido").');
  }
  if (parsed.length === 0) {
    throw new ResumoInvalidoError("Nenhuma linha de valor reconhecida — o layout do resumo provavelmente mudou.");
  }
  if (transferencias.length === 0) {
    throw new ResumoInvalidoError('Nenhuma transferência encontrada (esperada a seção "Transferências programadas").');
  }

  return {
    unidade,
    competencia,
    periodo,
    linhas: parsed,
    transferencias,
    total,
    alunosInformados,
    cobrancasInformadas,
  };
}

export type DivergenciaResumo = { o_que: string; esperado: number; obtido: number };

/**
 * Dupla validação. Duas equações independentes sobre a mesma extração: se o
 * layout mudar de um jeito que passe por uma, dificilmente passa pelas duas.
 * Devolve as divergências em vez de lançar — a tela precisa mostrar as duas.
 */
export function validarResumo(resumo: ResumoIsaac): DivergenciaResumo[] {
  const divergencias: DivergenciaResumo[] = [];
  const centavos = (x: number) => Math.round(x * 100);

  const somaLinhas = resumo.linhas.reduce((acc, l) => acc + l.valor, 0);
  if (centavos(somaLinhas) !== centavos(resumo.total)) {
    divergencias.push({ o_que: "soma das linhas ≠ total a transferir", esperado: resumo.total, obtido: somaLinhas });
  }

  const somaTransferencias = resumo.transferencias.reduce((acc, t) => acc + t.valor, 0);
  if (centavos(somaTransferencias) !== centavos(resumo.total)) {
    divergencias.push({ o_que: "soma das transferências ≠ total a transferir", esperado: resumo.total, obtido: somaTransferencias });
  }

  return divergencias;
}

/** Valor de uma linha pelo rótulo exato, ou null. Match exato: nunca aproximar. */
export function linhaPorTipo(resumo: ResumoIsaac, tipo: string): number | null {
  const achada = resumo.linhas.find((l) => norm(l.tipo) === norm(tipo));
  return achada ? achada.valor : null;
}
