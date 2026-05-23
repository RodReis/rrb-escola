// scripts/reset_matriculas_2026.mjs
//
// Reset completo das matrículas 2026: apaga matriculas + cobrancas + pagamentos
// + turmas 2026 + series não-alvo, e recria a partir de public/MATRICULADOS2026.xlsx.
//
// Spec: docs/superpowers/specs/2026-05-23-reset-matriculas-planilha-design.md
// Plan: docs/superpowers/plans/2026-05-23-reset-matriculas-planilha.md
//
// Uso:
//   node scripts/reset_matriculas_2026.mjs                          # dry-run
//   node scripts/reset_matriculas_2026.mjs --apply --i-have-backup  # aplica

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseMatriculadosXlsx } from "./lib/parse-matriculados-xlsx.mjs";
import { normalizeName } from "./lib/normalize-name.mjs";
import {
  mapHeaderToTarget,
  SERIES_ALVO,
  TURMAS_ALVO
} from "./lib/reset-matriculas-mapper.mjs";

const ANO_LETIVO = 2026;
const XLSX_PATH = "public/MATRICULADOS2026.xlsx";
const PLANO_NOME = "Mensalidade 2026";

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
const hasBackupFlag = process.argv.includes("--i-have-backup");
const mode = apply ? "APPLY" : "DRY-RUN";

if (apply && !hasBackupFlag) {
  console.error("ERRO: --apply requer flag --i-have-backup. Faça backup antes:");
  console.error("  Supabase Dashboard > Database > Backups > Manual backup");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

async function loadEscolaId() {
  const { data, error } = await supabase
    .from("escolas")
    .select("id")
    .limit(1)
    .single();
  if (error || !data) throw new Error("escola não encontrada");
  return data.id;
}

async function loadPlanoId(escolaId) {
  const { data, error } = await supabase
    .from("planos")
    .select("id, nome")
    .eq("escola_id", escolaId)
    .eq("nome", PLANO_NOME)
    .single();
  if (error || !data) throw new Error(`plano '${PLANO_NOME}' não encontrado`);
  return data.id;
}

async function main() {
  console.log(`\n=== RESET MATRÍCULAS 2026 — modo ${mode} ===\n`);

  const escolaId = await loadEscolaId();
  const planoId = await loadPlanoId(escolaId);
  console.log(`escola_id: ${escolaId}`);
  console.log(`plano_id: ${planoId}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const itensRaw = parseMatriculadosXlsx(wb);
  console.log(`\nplanilha: ${itensRaw.length} linhas detectadas`);

  const itens = [];
  const semMapeamento = [];
  for (const it of itensRaw) {
    const mapped = mapHeaderToTarget(it.turma_label);
    if (!mapped) {
      semMapeamento.push(it);
      continue;
    }
    itens.push({ ...it, ...mapped });
  }
  if (semMapeamento.length > 0) {
    console.error(`\nERRO: ${semMapeamento.length} linhas com header não mapeado:`);
    for (const x of semMapeamento.slice(0, 10)) {
      console.error(`  - '${x.turma_label}' (sheet ${x.sheet}, aluno '${x.nome_raw}')`);
    }
    process.exit(1);
  }

  const comValor = itens.filter(i => typeof i.mensalidade === "number" && i.mensalidade > 0);
  const semValor = itens.filter(i => i.mensalidade == null || i.mensalidade <= 0);
  console.log(`com valor: ${comValor.length} | sem valor: ${semValor.length} (serão ignorados)`);

  const { data: alunosDb, error: errAlunos } = await supabase
    .from("alunos")
    .select("id, nome")
    .eq("escola_id", escolaId)
    .eq("ativo", true);
  if (errAlunos) throw errAlunos;

  const byName = new Map();
  const dupes = [];
  for (const a of alunosDb) {
    const key = normalizeName(a.nome);
    if (byName.has(key)) {
      dupes.push({ key, ids: [byName.get(key), a.id] });
    } else {
      byName.set(key, a.id);
    }
  }
  if (dupes.length > 0) {
    console.error(`\nERRO: ${dupes.length} nomes normalizados duplicados no DB:`);
    for (const d of dupes.slice(0, 10)) {
      console.error(`  - '${d.key}' -> ${d.ids.join(", ")}`);
    }
    process.exit(1);
  }

  const naoCasados = [];
  for (const it of comValor) {
    const key = normalizeName(it.nome_raw);
    const id = byName.get(key);
    if (!id) {
      naoCasados.push(it);
    } else {
      it.aluno_id = id;
    }
  }
  if (naoCasados.length > 0) {
    console.error(`\nERRO: ${naoCasados.length} alunos da planilha não encontrados no DB:`);
    for (const n of naoCasados) {
      console.error(`  - '${n.nome_raw}' (sheet ${n.sheet}, turma '${n.turma_label}')`);
    }
    process.exit(1);
  }

  console.log(`\nmatch: ${comValor.length} alunos casados com sucesso`);
  console.log(`\nPróximas etapas (delete/insert) serão implementadas nas Tasks 4-7.`);
}

main().catch(err => {
  console.error("FATAL:", err?.message ?? err);
  process.exit(1);
});
