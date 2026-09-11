/**
 * Corrige o ano_letivo das matriculas historicas importadas do sistema antigo.
 *
 * PROBLEMA
 * O sistema antigo nao guarda ano letivo, so a data de assinatura da rematricula.
 * Essa data cai em out-dez, porque a rematricula e feita PARA o ano seguinte.
 * O importador (scripts/fix_matriculas.py:119) usou o ano da data como ano_letivo,
 * jogando a matricula um ano para tras. Efeito visivel: a mesma serie aparece
 * duas vezes na "Relacao de Matriculas" (ex.: 3o ANO em 2025 e em 2026).
 *
 * ESTRATEGIA
 * A serie e o dado integro; o ano e o corrompido. Reconstroi o ano letivo pela
 * progressao de series, ancorando na matricula ativa de 2026 (veio da planilha
 * MATRICULADOS2026.xlsx, e confiavel).
 *
 *   1. Agrupa as matriculas do aluno por ordem de serie (mescla duplicatas).
 *   2. Ancora o grupo da serie de 2026 no ano 2026.
 *   3. Caminha para tras: cada serie anterior recebe o ano da ancora menos um.
 *   4. Sem ancora de 2026 (aluno que saiu da escola), ancora na serie de maior
 *      ano_letivo observado.
 *
 * Duplicatas da mesma serie sao mescladas no mesmo ano letivo. Nada e apagado.
 *
 * Uso:
 *   node scripts/corrigir_ano_letivo_matriculas.mjs                      # dry-run
 *   node scripts/corrigir_ano_letivo_matriculas.mjs --csv relatorio.csv  # dry-run + planilha
 *   node scripts/corrigir_ano_letivo_matriculas.mjs --apply              # grava
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ANO_ANCORA = 2026;

function loadEnvFile(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const apply = process.argv.includes("--apply");
const csvArg = process.argv.indexOf("--csv");
const csvPath = csvArg !== -1 ? process.argv[csvArg + 1] : null;

/**
 * Reconstroi o ano letivo de um aluno a partir da progressao de series.
 * Recebe as matriculas do aluno e um Map serie_id -> ordem.
 * Retorna [{ matricula, anoAtual, anoCorrigido, motivo }].
 */
export function reconstruirAnos(matriculas, ordemDaSerie) {
  const ordemDe = (m) => ordemDaSerie.get(m.serie_id) ?? null;
  const comOrdem = matriculas.filter((m) => ordemDe(m) !== null);
  if (comOrdem.length === 0) return [];

  // Linhas da mesma serie sao a mesma etapa escolar: agrupa por ordem.
  const grupos = new Map();
  for (const m of comOrdem) {
    const ordem = ordemDe(m);
    if (!grupos.has(ordem)) grupos.set(ordem, []);
    grupos.get(ordem).push(m);
  }
  const ordens = [...grupos.keys()].sort((a, b) => a - b);

  // Ancora: serie da matricula ativa de 2026. Sem ela, a serie de maior ano.
  const ativa = comOrdem.find((m) => m.ano_letivo === ANO_ANCORA && m.status === "ativa");
  const referencia =
    ativa ?? comOrdem.reduce((a, b) => (b.ano_letivo > a.ano_letivo ? b : a));
  const ordemAncora = ordemDe(referencia);
  const anoAncora = ativa ? ANO_ANCORA : referencia.ano_letivo;

  // Uma serie por ano letivo, caminhando a partir da ancora.
  const idxAncora = ordens.indexOf(ordemAncora);
  const anoDaOrdem = new Map();
  for (let i = 0; i < ordens.length; i++) {
    anoDaOrdem.set(ordens[i], anoAncora + (i - idxAncora));
  }

  // A cadeia acima assume um degrau por serie. Series cadastradas com a mesma
  // ordem (INFANTIL2 e INFANTIL3 hoje compartilham ordem 2) encurtam a cadeia e
  // empurram o inicio do historico para a frente. A data de matricula e o unico
  // dado nao corrompido do passado, entao ela limita o recuo: uma matricula
  // assinada em julho/2021 pertence a 2021 (matricula do ano) ou 2022
  // (rematricula de out-dez), nunca depois disso.
  for (const ordem of ordens) {
    const grupo = grupos.get(ordem);
    const datas = grupo.map((m) => m.data_matricula).filter(Boolean);
    if (datas.length === 0) continue;
    const maisAntiga = datas.sort()[0];
    const [ano, mes] = maisAntiga.split("-").map(Number);
    const tetoPelaData = mes >= 10 ? ano + 1 : ano;
    if (anoDaOrdem.get(ordem) > tetoPelaData) anoDaOrdem.set(ordem, tetoPelaData);
  }

  const resultado = [];
  for (const ordem of ordens) {
    const grupo = grupos.get(ordem);
    const anoCorrigido = anoDaOrdem.get(ordem);
    const motivo = grupo.length > 1 ? "duplicata mesclada" : "ano recalculado";
    for (const m of grupo) {
      resultado.push({ matricula: m, anoAtual: m.ano_letivo, anoCorrigido, motivo });
    }
  }
  return resultado;
}

async function fetchAll(supabase, table, select) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Faltando NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}\n`);

  const series = await fetchAll(supabase, "series", "id,nome,ordem");
  const nomeDaSerie = new Map(series.map((s) => [s.id, s.nome]));
  const ordemDaSerie = new Map(series.map((s) => [s.id, s.ordem]));

  const alunos = await fetchAll(supabase, "alunos", "id,nome");
  const nomeDoAluno = new Map(alunos.map((a) => [a.id, a.nome]));

  const matriculas = await fetchAll(
    supabase,
    "matriculas",
    "id,aluno_id,serie_id,ano_letivo,status,data_matricula",
  );

  const porAluno = new Map();
  for (const m of matriculas) {
    if (!porAluno.has(m.aluno_id)) porAluno.set(m.aluno_id, []);
    porAluno.get(m.aluno_id).push(m);
  }

  const mudancas = [];
  let semAncora = 0;
  for (const [alunoId, lista] of porAluno) {
    const temAncora = lista.some((m) => m.ano_letivo === ANO_ANCORA && m.status === "ativa");
    if (!temAncora) semAncora++;
    for (const item of reconstruirAnos(lista, ordemDaSerie)) {
      if (item.anoCorrigido === item.anoAtual) continue;
      mudancas.push({
        ...item,
        alunoNome: nomeDoAluno.get(alunoId) ?? "?",
        serieNome: nomeDaSerie.get(item.matricula.serie_id) ?? "?",
        temAncora,
      });
    }
  }

  console.log(`Alunos analisados:       ${porAluno.size}`);
  console.log(`Alunos sem ancora 2026:  ${semAncora} (ancorados pela serie mais recente)`);
  console.log(`Matriculas a corrigir:   ${mudancas.length} de ${matriculas.length}\n`);

  for (const c of mudancas.slice(0, 15)) {
    const flag = c.temAncora ? "" : "  [sem ancora]";
    console.log(
      `  ${c.alunoNome.slice(0, 30).padEnd(30)} ${c.serieNome.padEnd(10)} ` +
        `${c.anoAtual} -> ${c.anoCorrigido}  (${c.motivo})${flag}`,
    );
  }
  if (mudancas.length > 15) console.log(`  ... e mais ${mudancas.length - 15} linhas`);

  if (csvPath) {
    const cabecalho = "aluno,serie,ano_atual,ano_corrigido,motivo,tem_ancora,matricula_id";
    const linhas = mudancas.map((c) =>
      [
        `"${c.alunoNome.replace(/"/g, '""')}"`,
        `"${c.serieNome}"`,
        c.anoAtual,
        c.anoCorrigido,
        `"${c.motivo}"`,
        c.temAncora ? "sim" : "nao",
        c.matricula.id,
      ].join(","),
    );
    writeFileSync(csvPath, `﻿${[cabecalho, ...linhas].join("\n")}`, "utf8");
    console.log(`\nRelatorio gravado em ${csvPath}`);
  }

  if (!apply) {
    console.log("\nNada foi gravado. Rode com --apply para aplicar.");
    return;
  }

  let ok = 0;
  const falhas = [];
  for (const c of mudancas) {
    const { error } = await supabase
      .from("matriculas")
      .update({ ano_letivo: c.anoCorrigido })
      .eq("id", c.matricula.id);
    if (error) falhas.push(`${c.alunoNome} / ${c.serieNome}: ${error.message}`);
    else ok++;
  }

  console.log(`\nAtualizadas: ${ok}`);
  if (falhas.length) {
    console.log(`Falhas: ${falhas.length}`);
    for (const f of falhas.slice(0, 10)) console.log(`  ${f}`);
  }
}

if (process.argv[1]?.endsWith("corrigir_ano_letivo_matriculas.mjs")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
