/**
 * Indexa os PDFs de historico escolar como fonte de verdade do ano letivo.
 *
 * O sistema antigo nao guarda ano letivo; o PDF de historico guarda, porque
 * lista a trajetoria do aluno ano a ano. Esse indice e o criterio objetivo
 * para decidir em que ano o aluno cursou cada serie.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PDFParse } from "pdf-parse";
import { parsearPdf } from "./historico-pdf.mjs";

/** Maiuscula sem acento, espacos colapsados: casa "1ª Série" com "1A SERIE". */
export function normalizarSerie(nome) {
  return String(nome ?? "")
    .replace(/ª/g, "A")
    .replace(/º/g, "O")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function chaveIndice(matricula, ano) {
  return `${String(matricula)}|${ano}`;
}

/**
 * Map "mat|ano" -> serie normalizada. Pares incompletos sao descartados.
 * Conflitos (mesmo mat|ano com series diferentes) sao detectados via
 * construirIndiceComConflitos; este metodo delega a ele.
 */
export function construirIndice(pares) {
  const { indice } = construirIndiceComConflitos(pares);
  return indice;
}

/**
 * Constroi o indice e reporta conflitos encontrados.
 * Conflito = dois pares com mesmo mat|ano mas series normalizadas diferentes.
 *
 * Devolve { indice: Map<string, string>, conflitos: Array<{chave, series}> }
 * onde cada conflito lista as series distintas encontradas para a mesma chave.
 */
export function construirIndiceComConflitos(pares) {
  const indice = new Map();
  const conflituosos = new Map(); // mat|ano -> Set de series normalizadas
  const conflitos = [];

  for (const p of pares) {
    if (!p.mat || !p.ano || !p.serie) continue;
    const chave = chaveIndice(p.mat, p.ano);
    const seriNorm = normalizarSerie(p.serie);

    if (!indice.has(chave)) {
      // Primeira vez que vemos essa chave
      indice.set(chave, seriNorm);
      conflituosos.set(chave, new Set([seriNorm]));
    } else {
      // Ja temos essa chave: verifica se serie e a mesma
      const seriesVistas = conflituosos.get(chave);
      if (!seriesVistas.has(seriNorm)) {
        // Nova serie para essa chave = conflito
        seriesVistas.add(seriNorm);
        if (!conflitos.some((c) => c.chave === chave)) {
          conflitos.push({ chave, series: Array.from(seriesVistas) });
        }
      }
      // Segue com o primeiro valor que achou (nao sobrescreve)
    }
  }

  return { indice, conflitos };
}

/**
 * Extrai pares mat|ano|serie de registros parseados (formato parsearPdf).
 * Testavel: nao acessa filesystem.
 */
export function extrairParesDePdfParsed(registros) {
  const pares = [];
  for (const registro of registros) {
    const mat = registro.aluno?.matricula;
    if (!mat) continue;
    for (const ano of registro.anos ?? []) {
      const serie = ano.serie ?? ano.coluna;
      if (ano.ano && serie) pares.push({ mat: String(mat), ano: Number(ano.ano), serie });
    }
  }
  return pares;
}

/**
 * Deduplica pares: mantém apenas a primeira ocorrência de cada
 * mat|ano|serie (normalizada). Usado quando o mesmo aluno aparece em
 * múltiplos PDFs (transferência, rematrícula, etc).
 *
 * Nota: mesmo mat|ano com SÉRIES DIFERENTES não são deduplicados —
 * são pares distintos, e conflitos são detectados por construirIndiceComConflitos.
 */
export function deduplicarPares(pares) {
  const vistos = new Set();
  const dedupados = [];
  for (const p of pares) {
    const chave = `${p.mat}|${p.ano}|${normalizarSerie(p.serie)}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    dedupados.push(p);
  }
  return dedupados;
}

export async function extrairParesDeArquivo(caminho) {
  const { pages } = await new PDFParse({ data: readFileSync(caminho) }).getText();
  return extrairParesDePdfParsed(parsearPdf(pages));
}

/** Varre <raiz>/<ano>/*.pdf. Deduplica: o mesmo aluno aparece em varios PDFs. */
export async function extrairParesDePasta(raiz) {
  const pares = [];
  for (const pasta of readdirSync(raiz).filter((d) => /^\d{4}$/.test(d))) {
    for (const arquivo of readdirSync(join(raiz, pasta)).filter((f) => f.endsWith(".pdf"))) {
      pares.push(...(await extrairParesDeArquivo(join(raiz, pasta, arquivo))));
    }
  }
  return deduplicarPares(pares);
}
