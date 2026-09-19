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

/** Map "mat|ano" -> serie normalizada. Pares incompletos sao descartados. */
export function construirIndice(pares) {
  const indice = new Map();
  for (const p of pares) {
    if (!p.mat || !p.ano || !p.serie) continue;
    indice.set(chaveIndice(p.mat, p.ano), normalizarSerie(p.serie));
  }
  return indice;
}

export async function extrairParesDeArquivo(caminho) {
  const { pages } = await new PDFParse({ data: readFileSync(caminho) }).getText();
  const pares = [];
  for (const registro of parsearPdf(pages)) {
    const mat = registro.aluno?.matricula;
    if (!mat) continue;
    for (const ano of registro.anos ?? []) {
      const serie = ano.serie ?? ano.coluna;
      if (ano.ano && serie) pares.push({ mat: String(mat), ano: Number(ano.ano), serie });
    }
  }
  return pares;
}

/** Varre <raiz>/<ano>/*.pdf. Deduplica: o mesmo aluno aparece em varios PDFs. */
export async function extrairParesDePasta(raiz) {
  const vistos = new Set();
  const pares = [];
  for (const pasta of readdirSync(raiz).filter((d) => /^\d{4}$/.test(d))) {
    for (const arquivo of readdirSync(join(raiz, pasta)).filter((f) => f.endsWith(".pdf"))) {
      for (const p of await extrairParesDeArquivo(join(raiz, pasta, arquivo))) {
        const chave = `${p.mat}|${p.ano}|${normalizarSerie(p.serie)}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        pares.push(p);
      }
    }
  }
  return pares;
}
