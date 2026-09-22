/**
 * Parser do analítico .xlsx do Meu Arco — parcela a parcela do repasse isaac.
 *
 * Duas abas: "Repasse de Mensalidades" (uma linha por parcela) e "Mudanças"
 * (estornos, cancelamentos e novos contratos, com data).
 *
 * Função pura: recebe as linhas já lidas da planilha (a camada de I/O usa
 * exceljs) e devolve dados validados. Não lê arquivo, não toca banco.
 *
 * Conferido contra os analíticos reais de agosto e setembro/2026 das duas
 * unidades — os totais batem o Aceite B centavo a centavo.
 */

export type TipoProduto = "mensalidade" | "material" | "outro";

export type ParcelaAnalitico = {
  /** "Identificador da parcela". Único no arquivo; base da idempotência. */
  idParcela: string;
  nomeIsaac: string;
  produto: string;
  tipo: TipoProduto;
  /** Competência DA PARCELA (`YYYY-MM`), pode ser anterior à do repasse. */
  competencia: string;
  valorMensalidade: number;
  valorMudanca: number;
  valorBase: number;
  taxa: number;
  valorFinal: number;
  /** "Recebido na escola" | "Cancelado" | "Novo contrato" | ... ; null = parcela normal. */
  tipoMudanca: string | null;
};

export type MudancaAnalitico = {
  idParcela: string;
  nomeIsaac: string;
  produto: string;
  competencia: string;
  valor: number;
  /** ISO `YYYY-MM-DD`, ou null se a planilha não trouxe. */
  dataMudanca: string | null;
  tipo: string;
};

export type TotaisAnalitico = {
  linhas: number;
  mensalidades: number;
  mudancas: number;
  base: number;
  taxa: number;
  final: number;
};

export type AnaliticoIsaac = {
  parcelas: ParcelaAnalitico[];
  mudancas: MudancaAnalitico[];
  totais: TotaisAnalitico;
};

export class AnaliticoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnaliticoInvalidoError";
  }
}

export const ABA_PARCELAS = "Repasse de Mensalidades";
export const ABA_MUDANCAS = "Mudanças";

/** Colunas esperadas, na ordem do arquivo. Validadas pelo NOME, nunca por posição. */
export const COLUNAS_PARCELAS = [
  "Aluno (a)",
  "Produto",
  "Competência",
  "Mensalidades",
  "Mudanças em mensalidades",
  "Valor base para cálculo",
  "Taxa isaac",
  "Valor final",
  "Tipo mudança em mensalidades",
  "Identificador da parcela",
] as const;

export const COLUNAS_MUDANCAS = [
  "Aluno (a)",
  "Produto",
  "Competência",
  "Valor da mudança",
  "Data da mudança",
  "Tipo mudança em mensalidades",
  "Identificador da parcela",
] as const;

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const norm = (s: unknown): string =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * "Agosto/2026" → "2026-08". O isaac escreve o mês por extenso em PT-BR; sem
 * esta conversão a competência entraria como texto livre e quebraria o check
 * `^\d{4}-\d{2}$` da tabela.
 */
export function parseCompetencia(valor: unknown): string {
  const texto = norm(valor);
  const m = /^(\w+)\s*\/\s*(\d{4})$/.exec(texto);
  if (!m || MESES[m[1]] === undefined) {
    throw new AnaliticoInvalidoError(
      `Competência não reconhecida: ${JSON.stringify(String(valor ?? ""))}. Esperado "Mês/AAAA", ex. "Agosto/2026".`,
    );
  }
  return `${m[2]}-${String(MESES[m[1]]).padStart(2, "0")}`;
}

/**
 * Classifica o produto. Os prefixos reais observados nos analíticos:
 *   mensalidade → "Mensalidade - ...", "Anuidade 1º Ano"
 *   material    → "Materia De Apoio Pedagogico ...", "Material Apoio Pedagógico ...",
 *                 "Material Didático"
 * A grafia do isaac é inconsistente ("Materia" sem acento, "Material Apoio" sem
 * "de"), por isso o teste é por prefixo normalizado e não por igualdade.
 */
export function classificarProduto(produto: string): TipoProduto {
  const p = norm(produto);
  if (p.startsWith("mensalidade") || p.startsWith("anuidade")) return "mensalidade";
  if (p.startsWith("materia")) return "material";
  return "outro";
}

function numero(valor: unknown, coluna: string, linha: number): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(n)) {
    throw new AnaliticoInvalidoError(`Linha ${linha}: coluna "${coluna}" não é número: ${JSON.stringify(valor)}.`);
  }
  return n;
}

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

/** "15/07/2026" ou Date → "2026-07-15". Devolve null se não der para ler. */
export function parseDataMudanca(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(valor).trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Confere que o cabeçalho tem as colunas esperadas, pelo nome normalizado, e
 * devolve o índice real de cada uma. Se o isaac reordenar ou renomear, falha
 * aqui com mensagem clara em vez de ler a coluna errada em silêncio.
 */
export function mapearColunas(cabecalho: unknown[], esperadas: readonly string[], aba: string): number[] {
  const presentes = cabecalho.map(norm);
  return esperadas.map((coluna) => {
    const idx = presentes.indexOf(norm(coluna));
    if (idx === -1) {
      throw new AnaliticoInvalidoError(
        `Aba "${aba}": coluna "${coluna}" não encontrada. Colunas do arquivo: ${cabecalho.filter(Boolean).map((c) => JSON.stringify(String(c))).join(", ")}.`,
      );
    }
    return idx;
  });
}

const linhaVazia = (linha: unknown[], idxNome: number): boolean => texto(linha[idxNome]) === "";

export function parseAnaliticoIsaac(
  linhasParcelas: unknown[][],
  linhasMudancas: unknown[][],
): AnaliticoIsaac {
  if (linhasParcelas.length === 0) {
    throw new AnaliticoInvalidoError(`Aba "${ABA_PARCELAS}" vazia.`);
  }

  const cp = mapearColunas(linhasParcelas[0], COLUNAS_PARCELAS, ABA_PARCELAS);
  const [cNome, cProduto, cComp, cMens, cMud, cBase, cTaxa, cFinal, cTipoMud, cId] = cp;

  const parcelas: ParcelaAnalitico[] = [];
  const vistos = new Set<string>();

  for (let i = 1; i < linhasParcelas.length; i++) {
    const linha = linhasParcelas[i];
    // O xlsx vem com centenas de linhas vazias no fim (rowCount conta a grade,
    // não os dados). Sem aluno, não há parcela.
    if (linhaVazia(linha, cNome)) continue;

    const idParcela = texto(linha[cId]);
    if (idParcela === "") {
      throw new AnaliticoInvalidoError(`Linha ${i + 1}: "Identificador da parcela" vazio — sem ele o reimport duplicaria a parcela.`);
    }
    if (vistos.has(idParcela)) {
      throw new AnaliticoInvalidoError(`Identificador de parcela repetido no arquivo: ${idParcela}.`);
    }
    vistos.add(idParcela);

    const produto = texto(linha[cProduto]);
    parcelas.push({
      idParcela,
      nomeIsaac: texto(linha[cNome]),
      produto,
      tipo: classificarProduto(produto),
      competencia: parseCompetencia(linha[cComp]),
      valorMensalidade: numero(linha[cMens], "Mensalidades", i + 1),
      valorMudanca: numero(linha[cMud], "Mudanças em mensalidades", i + 1),
      valorBase: numero(linha[cBase], "Valor base para cálculo", i + 1),
      taxa: numero(linha[cTaxa], "Taxa isaac", i + 1),
      valorFinal: numero(linha[cFinal], "Valor final", i + 1),
      tipoMudanca: texto(linha[cTipoMud]) === "" ? null : texto(linha[cTipoMud]),
    });
  }

  if (parcelas.length === 0) {
    throw new AnaliticoInvalidoError(`Aba "${ABA_PARCELAS}" sem nenhuma linha de parcela.`);
  }

  const mudancas: MudancaAnalitico[] = [];
  if (linhasMudancas.length > 0) {
    const cm = mapearColunas(linhasMudancas[0], COLUNAS_MUDANCAS, ABA_MUDANCAS);
    const [mNome, mProduto, mComp, mValor, mData, mTipo, mId] = cm;
    for (let i = 1; i < linhasMudancas.length; i++) {
      const linha = linhasMudancas[i];
      if (linhaVazia(linha, mNome)) continue;
      mudancas.push({
        idParcela: texto(linha[mId]),
        nomeIsaac: texto(linha[mNome]),
        produto: texto(linha[mProduto]),
        competencia: parseCompetencia(linha[mComp]),
        valor: numero(linha[mValor], "Valor da mudança", i + 1),
        dataMudanca: parseDataMudanca(linha[mData]),
        tipo: texto(linha[mTipo]),
      });
    }
  }

  const soma = (f: (p: ParcelaAnalitico) => number) =>
    Math.round(parcelas.reduce((acc, p) => acc + f(p), 0) * 100) / 100;

  return {
    parcelas,
    mudancas,
    totais: {
      linhas: parcelas.length,
      mensalidades: soma((p) => p.valorMensalidade),
      mudancas: soma((p) => p.valorMudanca),
      base: soma((p) => p.valorBase),
      taxa: soma((p) => p.taxa),
      final: soma((p) => p.valorFinal),
    },
  };
}

export type DivergenciaAnalitico = { o_que: string; esperado: number; obtido: number };

/**
 * Coerência interna do arquivo: base = mensalidades + mudanças, e
 * final = base − taxa. Verificado nos analíticos reais de ago e set/2026.
 */
export function validarAnalitico(analitico: AnaliticoIsaac): DivergenciaAnalitico[] {
  const { totais } = analitico;
  const divergencias: DivergenciaAnalitico[] = [];
  const centavos = (x: number) => Math.round(x * 100);

  const baseEsperada = totais.mensalidades + totais.mudancas;
  if (centavos(baseEsperada) !== centavos(totais.base)) {
    divergencias.push({ o_que: "base ≠ mensalidades + mudanças", esperado: baseEsperada, obtido: totais.base });
  }

  const finalEsperado = totais.base - totais.taxa;
  if (centavos(finalEsperado) !== centavos(totais.final)) {
    divergencias.push({ o_que: "valor final ≠ base − taxa", esperado: finalEsperado, obtido: totais.final });
  }

  return divergencias;
}

/**
 * Uma parcela pode acumular MAIS DE UM tipo de mudança, e o isaac junta os dois
 * na mesma célula separados por barra: "Adicional desc. antecipação / Recebido
 * na escola". Tratar a célula como um rótulo único joga o valor num bucket que
 * não existe no resumo — foi o que fez o total de "Recebido na escola" da
 * Educação Infantil em set/2026 dar −3.224,96 em vez dos −3.874,96 do PDF.
 */
export function separarTiposMudanca(tipoMudanca: string | null): string[] {
  if (tipoMudanca === null) return [];
  return tipoMudanca.split("/").map((t) => t.trim()).filter((t) => t !== "");
}

/**
 * Soma das mudanças por tipo, a partir da coluna "Tipo mudança em mensalidades"
 * da aba principal. É o que casa o analítico com o resumo.
 *
 * Dois cuidados que o dado real impôs:
 *
 * 1. "Novo contrato" tem `Mensalidades = 0` e o valor inteiro em `Mudanças`
 *    (R$ 5.960,00 em set/2026) — somar só a coluna Mensalidades perderia a
 *    receita toda.
 * 2. Tipos compostos contam para CADA tipo que os compõe (ver
 *    `separarTiposMudanca`). Isso significa que a soma dos buckets pode passar
 *    do total de mudanças do arquivo: é agregação para conferir linha a linha
 *    contra o resumo, NUNCA para somar num total.
 */
export function mudancasPorTipo(analitico: AnaliticoIsaac): Map<string, number> {
  const porTipo = new Map<string, number>();
  for (const p of analitico.parcelas) {
    for (const tipo of separarTiposMudanca(p.tipoMudanca)) {
      const atual = porTipo.get(tipo) ?? 0;
      porTipo.set(tipo, Math.round((atual + p.valorMudanca) * 100) / 100);
    }
  }
  return porTipo;
}
