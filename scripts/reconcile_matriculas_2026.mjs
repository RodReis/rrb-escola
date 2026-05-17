// Reconcilia série/turma/turno de matrículas 2026 a partir de
// public/MATRICULADOS2026.xlsx.
// Spec: docs/superpowers/specs/2026-05-17-reconciliar-matriculas-2026-design.md
// Plan: docs/superpowers/plans/2026-05-17-reconciliar-matriculas-2026.md
//
// Uso:
//   node scripts/reconcile_matriculas_2026.mjs            # dry-run
//   node scripts/reconcile_matriculas_2026.mjs --apply    # aplica

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseMatriculadosXlsx } from "./lib/parse-matriculados-xlsx.mjs";
import { mapTurmaHeader } from "./lib/turma-mapper.mjs";
import { normalizeName } from "./lib/normalize-name.mjs";

const ANO_LETIVO = 2026;
const XLSX_PATH = "public/MATRICULADOS2026.xlsx";
const REPORT_DIR = "docs/pdfs";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltando NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const mode = apply ? "APPLY" : "DRY-RUN";

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

async function loadEscolaId() {
  const { data, error } = await supabase
    .from("escolas")
    .select("id, nome")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  if (!data?.length) throw new Error("Nenhuma escola encontrada em escolas");
  return { id: data[0].id, nome: data[0].nome };
}

async function loadAlunos(escola_id) {
  const out = [];
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("alunos")
      .select("id, nome")
      .eq("escola_id", escola_id)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function loadSeries(escola_id) {
  const { data, error } = await supabase
    .from("series")
    .select("id, nome")
    .eq("escola_id", escola_id);
  if (error) throw error;
  return data ?? [];
}

async function loadTurmas(escola_id) {
  const { data, error } = await supabase
    .from("turmas")
    .select("id, serie_id, nome, ano_letivo, turno")
    .eq("escola_id", escola_id)
    .eq("ano_letivo", ANO_LETIVO);
  if (error) throw error;
  return data ?? [];
}

async function loadMatriculas(escola_id) {
  const out = [];
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("matriculas")
      .select("id, aluno_id, serie_id, turma_id, ano_letivo, status")
      .eq("escola_id", escola_id)
      .eq("ano_letivo", ANO_LETIVO)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main() {
  console.log(`Modo: ${mode}`);
  console.log(`Planilha: ${XLSX_PATH}`);

  const escola = await loadEscolaId();
  console.log(`Escola: ${escola.nome} (${escola.id})`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const planilha = parseMatriculadosXlsx(wb);
  console.log(`Linhas planilha: ${planilha.length}`);

  const [alunos, series, turmas, matriculas] = await Promise.all([
    loadAlunos(escola.id),
    loadSeries(escola.id),
    loadTurmas(escola.id),
    loadMatriculas(escola.id)
  ]);
  console.log(
    `DB: alunos=${alunos.length} series=${series.length} turmas=${turmas.length} matriculas2026=${matriculas.length}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
