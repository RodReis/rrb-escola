/**
 * Parser dos PDFs de historico escolar (modelo EPG).
 *
 * Uma pagina = um aluno. O PDF traz o historico ACUMULADO: cada coluna da
 * grade e um ano, e a tabela de rodape ("Serie Ano Estabelecimento") diz qual
 * ano/escola corresponde a cada coluna. Anos de escola anterior vem em escala
 * 0-100; anos da EPG em 0-10. Gravamos como esta no documento.
 */

/** Colunas da grade, na ordem em que aparecem no cabecalho do PDF. */
export const COLUNAS = [
  "1º ANO", "2º ANO", "3º ANO", "4º ANO", "5º ANO",
  "6º ANO", "7º ANO", "8º ANO", "9º ANO",
  "CICLO II - D", "CICLO II - E", "CICLO II - F"
];

/**
 * Quais colunas trazem C.H. ao lado da media varia por PDF: o do Fund2 tem
 * "Média x5 + (Média C.H.) x4", o do Medio "Média x6 + (Média C.H.) x3". Em vez
 * de fixar, lemos a sequencia Média/C.H. do proprio cabecalho da grade.
 *
 * Devolve um array alinhado a COLUNAS: true onde a coluna consome 2 tokens.
 */
function lerLayoutColunas(pagina) {
  const inicio = pagina.indexOf("Disciplinas");
  const fim = pagina.indexOf("Total");
  if (inicio === -1 || fim === -1) return COLUNAS.map(() => false);

  // Cabecalho vira uma sequencia de "M" (media) e "C" (carga horaria).
  const seq = [];
  for (const tok of pagina.slice(inicio, fim).matchAll(/Média|C\.H\./g)) {
    seq.push(tok[0] === "Média" ? "M" : "C");
  }

  const comCH = [];
  let i = 0;
  for (let c = 0; c < COLUNAS.length; c += 1) {
    if (seq[i] !== "M") { comCH.push(false); i += 1; continue; }
    const temCH = seq[i + 1] === "C";
    comCH.push(temCH);
    i += temCH ? 2 : 1;
  }
  return comCH;
}

const RESULTADOS = {
  aprovado: "aprovado",
  reprovado: "reprovado",
  cursando: "cursando",
  transferido: "transferido"
};

/**
 * Cidades que aparecem nos historicos. O PDF junta estabelecimento e cidade
 * numa celula so ("ESCOLA MARIA DE LOURDES ABADIA DE GOIÁS"), e ambos sao
 * multi-palavra — so da pra separar sabendo o nome da cidade. Cidade nova nos
 * PDFs: acrescente aqui, senao o ano vai pro relatorio como nao reconhecido.
 */
const CIDADES = [
  "ABADIA DE GOIÁS", "ANICUNS", "APARECIDA DE GOIANIA", "ARAGARÇAS",
  "BARREIRAS", "BELO HORIZONTE", "CONFRESA", "CUIABÁ", "GAMA", "GOIANIRA",
  "GOIÂNIA", "IPANEMA", "ITUMBIARA", "JARAGUÁ", "JATAÍ", "LAGOA SANTA",
  "NATAL", "PALMEIRAS DE GOIÁS", "PARNAMIRIM", "PETROLINA", "PORANGATU",
  "RIO BRANCO", "SANTA BARBARA", "SANTA BÁRBARA DE GOIÁS", "SANTA MARIA",
  "SÃO PAULO", "TRINDADE", "URUAÇU", "VILA VELHA"
].sort((a, b) => b.length - a.length); // mais longa primeiro: "SANTA BÁRBARA DE GOIÁS" antes de "SANTA BARBARA"

/**
 * "ESCOLA MARIA DE LOURDES ABADIA DE GOIÁS" -> escola + cidade.
 * Cidade desconhecida devolve cidade null, e o chamador reporta.
 */
export function separarEstabelecimentoCidade(texto) {
  const alvo = texto.toUpperCase();
  for (const cidade of CIDADES) {
    if (!alvo.endsWith(" " + cidade)) continue;
    return {
      instituicao: limpar(texto.slice(0, texto.length - cidade.length)),
      cidade
    };
  }
  return { instituicao: limpar(texto), cidade: null };
}

function limpar(s) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Celula vazia: "-" (nao cursou) ou "***" (cursou sem nota registrada). */
const VAZIO = new Set(["-", "***"]);

/** "9,6" -> 9.6 | "75" -> 75 | "-" / "***" -> null */
function numero(tok) {
  if (!tok || VAZIO.has(tok)) return null;
  const n = Number(String(tok).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function inteiro(tok) {
  if (!tok || VAZIO.has(tok)) return null;
  const n = parseInt(String(tok).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * O extrator quebra celulas longas em varias linhas ("Med\nia C.H\n."). Junta
 * de volta para as linhas da grade ficarem completas.
 */
function normalizarPagina(texto) {
  return texto
    .replace(/Méd\s*\n?\s*ia/g, "Média")
    .replace(/C\.H\s*\n?\s*\./g, "C.H.")
    .replace(/Tot\s*\n?\s*al/g, "Total")
    .replace(/Reprovad\s*\n?\s*o/g, "Reprovado")
    // Numeros quebrados no meio pela largura da celula: "100,\n0" -> "100,0",
    // "136\n0" -> "1360". Sem isso o digito orfao vira prefixo da linha seguinte.
    .replace(/(\d),\n(\d)/g, "$1,$2")
    .replace(/(\d)\n(\d)\s*\n/g, "$1$2\n");
}

/** Campos de identificacao: o rotulo vem DEPOIS do valor no texto extraido. */
function extrairAluno(pagina) {
  const valorAntesDe = (rotulo) => {
    const re = new RegExp("^(.*)\\n" + rotulo + ":\\s*$", "m");
    const m = pagina.match(re);
    return m ? limpar(m[1]) : null;
  };

  const nome = valorAntesDe("Aluno\\(a\\)");
  const cpf = valorAntesDe("CPF");
  const matricula = valorAntesDe("Matrícula");
  const filiacao = valorAntesDe("Filiação");
  const nascimento = valorAntesDe("Data de Nascimento");
  const naturalidade = valorAntesDe("Naturalidade");

  return {
    nome,
    cpf: cpf ? cpf.replace(/\D/g, "") : null,
    matricula,
    filiacao,
    dataNascimento: nascimento,
    naturalidade
  };
}

/**
 * Rodape: "1º ANO 2025 EPG TRINDADE TRINDADE GO" -> qual ano/escola cada
 * coluna representa. Linhas com "-" sao colunas nao cursadas.
 */
function extrairRodape(pagina) {
  const inicio = pagina.indexOf("Série Ano Estabelecimento");
  if (inicio === -1) return new Map();
  const bloco = pagina.slice(inicio);

  const porColuna = new Map();
  for (const coluna of COLUNAS) {
    const escapada = coluna.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = bloco.match(new RegExp("^" + escapada + "\\s+(.+)$", "m"));
    if (!m) continue;
    const resto = limpar(m[1]);
    if (resto.startsWith("-")) continue;

    // "2025 EPG TRINDADE TRINDADE GO" -> ano + "escola cidade" + uf.
    const mm = resto.match(/^(\d{4})\s+(.+)\s+([A-Z]{2})$/);
    if (!mm) continue;
    const { instituicao, cidade } = separarEstabelecimentoCidade(limpar(mm[2]));
    porColuna.set(coluna, { ano: Number(mm[1]), instituicao, cidade, uf: mm[3] });
  }
  return porColuna;
}

/**
 * Le uma linha da grade e devolve um valor por coluna cursada.
 * Colunas de Fund2 consomem 2 tokens (media + C.H.), as demais 1.
 */
function fatiarLinha(tokens, colunasCursadas, comCH) {
  const valores = new Map();
  let i = 0;
  for (const [idx, coluna] of COLUNAS.entries()) {
    const temCH = comCH[idx];
    const media = tokens[i];
    const ch = temCH ? tokens[i + 1] : undefined;
    i += temCH ? 2 : 1;
    if (!colunasCursadas.has(coluna)) continue;
    valores.set(coluna, { media, ch });
  }
  return valores;
}

/** Linhas de disciplina: nome seguido dos tokens de nota. */
function extrairDisciplinas(pagina, colunasCursadas, comCH) {
  const inicioGrade = pagina.indexOf("Disciplinas");
  const fimGrade = pagina.indexOf("Resultado Final");
  if (inicioGrade === -1 || fimGrade === -1) return [];

  // O cabecalho ocupa varias linhas e termina em "C.H. Total"; as disciplinas
  // comecam depois dele.
  let bloco = pagina.slice(inicioGrade, fimGrade);
  const fimCabecalho = bloco.indexOf("Total");
  if (fimCabecalho !== -1) bloco = bloco.slice(fimCabecalho + "Total".length);
  const linhas = bloco.split("\n");

  const disciplinas = [];
  let pendente = null; // nome de disciplina quebrado em duas linhas

  for (const bruta of linhas) {
    const linha = limpar(bruta);
    if (!linha) continue;

    // "***" no fim do nome marca disciplina sem nota no ano; conta como token.
    const m = linha.match(/^(.+?)\s+((?:(?:\*\*\*|-|[\d.,]+)(?:\s+|$))+)$/);
    if (!m) {
      pendente = pendente ? `${pendente} ${linha}` : linha;
      continue;
    }

    let nome = limpar(m[1]);
    if (pendente) {
      nome = limpar(`${pendente} ${nome}`);
      pendente = null;
    }
    const tokens = m[2].trim().split(/\s+/);
    disciplinas.push({ nome, valores: fatiarLinha(tokens, colunasCursadas, comCH) });
  }
  return disciplinas;
}

/**
 * Linhas "Resultado Final", "Carga Horaria Anual", "Dias Letivos": um token
 * por coluna (nao repetem C.H.). A ultima coluna da C.H. total, ignorada.
 */
function extrairLinhaRotulada(pagina, rotulo, colunasCursadas, parse) {
  const m = pagina.match(new RegExp("^" + rotulo + "\\s+(.+)$", "m"));
  if (!m) return new Map();

  const tokens = limpar(m[1]).split(/\s+/);
  const out = new Map();
  let i = 0;
  for (const coluna of COLUNAS) {
    if (colunasCursadas.has(coluna)) out.set(coluna, parse(tokens[i]));
    i += 1;
  }
  return out;
}

/** Converte uma pagina do PDF no historico de um aluno. */
export function parsearPagina(textoPagina) {
  const pagina = normalizarPagina(textoPagina);
  const aluno = extrairAluno(pagina);
  if (!aluno.nome) return null;

  const rodape = extrairRodape(pagina);
  if (rodape.size === 0) return { aluno, anos: [] };
  const colunasCursadas = new Set(rodape.keys());

  const comCH = lerLayoutColunas(pagina);
  const disciplinas = extrairDisciplinas(pagina, colunasCursadas, comCH);
  const resultados = extrairLinhaRotulada(
    pagina,
    "Resultado Final",
    colunasCursadas,
    (t) => RESULTADOS[String(t ?? "").toLowerCase()] ?? null
  );
  const cargas = extrairLinhaRotulada(pagina, "Carga Horária Anual", colunasCursadas, inteiro);
  const dias = extrairLinhaRotulada(pagina, "Dias Letivos", colunasCursadas, inteiro);

  const anos = [];
  for (const [coluna, info] of rodape) {
    const notas = [];
    let ordem = 0;
    for (const d of disciplinas) {
      const v = d.valores.get(coluna);
      const nota = numero(v?.media);
      const ch = inteiro(v?.ch);
      if (nota === null && ch === null) continue; // disciplina nao cursada nesse ano
      notas.push({ disciplinaNome: d.nome, nota, cargaHoraria: ch, ordem: ordem++ });
    }

    anos.push({
      coluna,
      ano: info.ano,
      serieNome: coluna,
      instituicao: info.instituicao,
      cidade: info.cidade,
      uf: info.uf,
      resultado: resultados.get(coluna) ?? "cursando",
      cargaHoraria: cargas.get(coluna) ?? null,
      diasLetivos: dias.get(coluna) ?? null,
      notas
    });
  }

  return { aluno, anos };
}

/** Parseia cada pagina do PDF (uma pagina = um aluno). */
export function parsearPdf(paginas) {
  return paginas
    .map((p) => (typeof p === "string" ? p : p.text))
    .filter(Boolean)
    .map(parsearPagina)
    .filter(Boolean);
}
