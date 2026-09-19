/**
 * Compara o ano_letivo das matriculas com o historico escolar oficial.
 *
 * Read-only: nao grava nada. Serve para medir a divergencia antes e depois
 * da correcao, e para gerar a planilha que a secretaria confere.
 *
 * Uso:
 *   node scripts/conferir_ano_letivo.mjs "C:/.../histo"
 *   node scripts/conferir_ano_letivo.mjs "C:/.../histo" --producao
 *   node scripts/conferir_ano_letivo.mjs "C:/.../histo" --csv relatorio.csv
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  extrairParesDePasta, construirIndice, chaveIndice, normalizarSerie
} from "./lib/historico-pdf-indice.mjs";

const ESCOLA_ID = "00000000-0000-0000-0000-000000000001";
const INFANTIL = /INFANTIL|MATERNAL|BERC|CRECHE|PRE/;

/**
 * Le .env.local. Com --producao fica com a ULTIMA ocorrencia de cada chave
 * (o bloco cloud), senao com a PRIMEIRA (o bloco local) — mesma regra dos
 * outros scripts do projeto, que protege contra apontar para producao sem querer.
 */
export function lerEnv(producao) {
  const caminho = resolve(process.cwd(), ".env.local");
  if (!existsSync(caminho)) throw new Error("Falta .env.local");
  const env = {};
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (producao || env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** PostgREST devolve no maximo 1000 linhas por requisicao. */
export async function lerTudo(query) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await query().range(de, de + 999);
    if (error) throw error;
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  return linhas;
}

export function classificar(matricula, indice, matriculasNoPdf) {
  const mat = String(matricula.codigo ?? "");
  if (!matriculasNoPdf.has(mat)) return { classe: "aluno-fora-do-pdf" };
  const serieBase = normalizarSerie(matricula.serie);
  const seriePdf = indice.get(chaveIndice(mat, matricula.ano_letivo));
  if (!seriePdf) {
    return { classe: INFANTIL.test(serieBase) ? "ausente-infantil" : "ausente-outro" };
  }
  if (seriePdf === serieBase) return { classe: "confere" };
  return { classe: "conflito", seriePdf };
}

/** Em que ano o PDF diz que o aluno cursou esta serie? */
export function anoCorretoSegundoPdf(mat, serieNormalizada, indice) {
  const anos = [];
  for (const [chave, serie] of indice) {
    const [m, ano] = chave.split("|");
    if (m === mat && serie === serieNormalizada) anos.push(Number(ano));
  }
  return anos.length === 1 ? anos[0] : null;
}

async function main() {
  const pastaPdfs = process.argv[2];
  if (!pastaPdfs) throw new Error("Informe a pasta dos PDFs");
  const producao = process.argv.includes("--producao");
  const csv = process.argv.find((a) => a.startsWith("--csv"))
    ? process.argv[process.argv.indexOf("--csv") + 1]
    : null;

  const env = lerEnv(producao);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  console.log(`Base: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(producao ? "*** PRODUCAO (somente leitura) ***\n" : "Local\n");

  const indice = construirIndice(await extrairParesDePasta(pastaPdfs));
  if (indice.size === 0) {
    throw new Error(
      `Nenhum par lido dos PDFs. A pasta "${pastaPdfs}" nao contem subpastas ` +
      `no formato <ano> com arquivos .pdf dentro. Verifique o caminho.`
    );
  }
  const matriculasNoPdf = new Set([...indice.keys()].map((k) => k.split("|")[0]));
  console.log(`PDFs: ${indice.size} pares, ${matriculasNoPdf.size} alunos\n`);

  const matriculas = await lerTudo(() =>
    db.from("matriculas")
      .select("id, ano_letivo, data_matricula, alunos(matricula_codigo), series(nome)")
      .eq("escola_id", ESCOLA_ID)
  );

  const contagem = {};
  const conflitos = [];
  for (const m of matriculas) {
    const registro = {
      id: m.id,
      codigo: m.alunos?.matricula_codigo,
      serie: m.series?.nome,
      ano_letivo: m.ano_letivo,
      data_matricula: m.data_matricula
    };
    const r = classificar(registro, indice, matriculasNoPdf);
    contagem[r.classe] = (contagem[r.classe] ?? 0) + 1;
    if (r.classe === "conflito") {
      conflitos.push({
        ...registro,
        serie_pdf: r.seriePdf,
        ano_correto: anoCorretoSegundoPdf(
          String(registro.codigo), normalizarSerie(registro.serie), indice
        )
      });
    }
  }

  const comparaveis = matriculas.length - (contagem["aluno-fora-do-pdf"] ?? 0);
  const confere = contagem["confere"] ?? 0;
  const pctConfere = comparaveis > 0 ? (100 * confere / comparaveis).toFixed(1) : "0.0";
  console.log(`total de matriculas      : ${matriculas.length}`);
  console.log(`comparaveis com o PDF    : ${comparaveis}`);
  console.log(`  conferem               : ${confere} (${pctConfere}%)`);
  console.log(`  conflito de serie      : ${contagem["conflito"] ?? 0}`);
  console.log(`  ausente (infantil)     : ${contagem["ausente-infantil"] ?? 0}  [PDF nao cobre o nivel]`);
  console.log(`  ausente (outro nivel)  : ${contagem["ausente-outro"] ?? 0}`);

  const corrigiveis = conflitos.filter((c) => c.ano_correto !== null);
  console.log(`\nconflitos com ano determinavel pelo PDF: ${corrigiveis.length} de ${conflitos.length}`);

  const pares = {};
  for (const c of corrigiveis) {
    const k = `${normalizarSerie(c.serie)} (${c.ano_letivo}) -> PDF diz ${c.ano_correto}`;
    pares[k] = (pares[k] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(pares).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(4)}  ${k}`);
  }

  if (csv) {
    const cabecalho = "matricula,serie_base,ano_base,data_matricula,serie_pdf,ano_correto\n";
    const linhas = conflitos
      .map((c) => [c.codigo, c.serie, c.ano_letivo, c.data_matricula, c.serie_pdf, c.ano_correto ?? ""].join(","))
      .join("\n");
    writeFileSync(csv, cabecalho + linhas);
    console.log(`\nCSV: ${csv} (${conflitos.length} linhas)`);
  }
}

// Guarda o main() porque a proxima task importa lerEnv, lerTudo e anoCorretoSegundoPdf
// daqui — sem isto o relatorio inteiro rodaria no import. Mesmo padrao de
// scripts/remover_matriculas_duplicadas.mjs:185.
if (process.argv[1]?.endsWith("conferir_ano_letivo.mjs")) {
  main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });
}
