// scripts/reset_matriculas_2026.mjs
//
// Reset completo das matrículas 2026: apaga matriculas + cobrancas + pagamentos
// + turmas 2026 + series não-alvo, e recria a partir de dados-alunos/MATRICULADOS2026.xlsx.
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
const XLSX_PATH = "dados-alunos/MATRICULADOS2026.xlsx";
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

async function executeReset(escolaId, itens, planoId) {
  // 1. Apagar pagamentos vinculados a matriculas 2026
  const { data: matriculasAntigas, error: errM } = await supabase
    .from("matriculas")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", ANO_LETIVO);
  if (errM) throw errM;
  const matriculaIds = matriculasAntigas.map(m => m.id);
  console.log(`\ndelete: ${matriculaIds.length} matriculas 2026 alvo`);

  if (matriculaIds.length > 0) {
    const { error, count } = await supabase
      .from("pagamentos")
      .delete({ count: "exact" })
      .in("matricula_id", matriculaIds);
    if (error) throw error;
    console.log(`  pagamentos deletados: ${count}`);

    const { error: errC, count: countC } = await supabase
      .from("cobrancas")
      .delete({ count: "exact" })
      .in("matricula_id", matriculaIds);
    if (errC) throw errC;
    console.log(`  cobrancas deletadas: ${countC}`);

    const { error: errMD, count: countMD } = await supabase
      .from("matriculas")
      .delete({ count: "exact" })
      .in("id", matriculaIds);
    if (errMD) throw errMD;
    console.log(`  matriculas deletadas: ${countMD}`);
  }

  // 2. Apagar turmas 2026
  const { error: errT, count: countT } = await supabase
    .from("turmas")
    .delete({ count: "exact" })
    .eq("escola_id", escolaId)
    .eq("ano_letivo", ANO_LETIVO);
  if (errT) throw errT;
  console.log(`  turmas 2026 deletadas: ${countT}`);

  // 3. Apagar séries fora da lista alvo (sem dependências)
  const nomesAlvo = SERIES_ALVO.map(s => s.nome);
  const { data: seriesForaAlvo, error: errSF } = await supabase
    .from("series")
    .select("id, nome")
    .eq("escola_id", escolaId)
    .not("nome", "in", `(${nomesAlvo.map(n => `"${n}"`).join(",")})`);
  if (errSF) throw errSF;
  for (const s of seriesForaAlvo) {
    const { error } = await supabase.from("series").delete().eq("id", s.id);
    if (error) {
      console.log(`  série '${s.nome}' não pôde ser deletada (deps): ${error.message}`);
    } else {
      console.log(`  série '${s.nome}' deletada`);
    }
  }
}

async function recreateSeriesTurmas(escolaId) {
  const { data: existentes, error: errE } = await supabase
    .from("series")
    .select("id, nome")
    .eq("escola_id", escolaId);
  if (errE) throw errE;

  const byNome = new Map(existentes.map(s => [s.nome, s.id]));
  const serieIdByNome = new Map();

  for (const s of SERIES_ALVO) {
    if (byNome.has(s.nome)) {
      const id = byNome.get(s.nome);
      const { error } = await supabase
        .from("series")
        .update({ ordem: s.ordem, ativo: true, segmento: s.segmento })
        .eq("id", id);
      if (error) throw error;
      serieIdByNome.set(s.nome, id);
    } else {
      const { data, error } = await supabase
        .from("series")
        .insert({ escola_id: escolaId, nome: s.nome, ordem: s.ordem, ativo: true, segmento: s.segmento })
        .select("id")
        .single();
      if (error) throw error;
      serieIdByNome.set(s.nome, data.id);
      console.log(`  série criada: ${s.nome}`);
    }
  }

  const turmaIdByKey = new Map();
  for (const t of TURMAS_ALVO) {
    const serieId = serieIdByNome.get(t.serie);
    if (!serieId) throw new Error(`série '${t.serie}' não encontrada`);
    const { data, error } = await supabase
      .from("turmas")
      .insert({
        escola_id: escolaId,
        serie_id: serieId,
        nome: t.turma,
        ano_letivo: ANO_LETIVO,
        turno: t.turno,
        capacidade: 30,
        ativo: true
      })
      .select("id")
      .single();
    if (error) throw error;
    turmaIdByKey.set(`${t.serie}|${t.turma}`, data.id);
  }
  console.log(`  séries: ${SERIES_ALVO.length} alvo | turmas criadas: ${TURMAS_ALVO.length}`);

  return { serieIdByNome, turmaIdByKey };
}

async function insertMatriculas(escolaId, planoId, itens, serieIdByNome, turmaIdByKey) {
  const alunoIds = [...new Set(itens.map(i => i.aluno_id))];
  const { data: alunos, error } = await supabase
    .from("alunos")
    .select("id, matricula_codigo")
    .in("id", alunoIds);
  if (error) throw error;
  const codigoById = new Map(alunos.map(a => [a.id, a.matricula_codigo]));

  const rows = [];
  for (const it of itens) {
    const serieId = serieIdByNome.get(it.serie_nome);
    const turmaId = turmaIdByKey.get(`${it.serie_nome}|${it.turma_nome}`);
    if (!serieId || !turmaId) {
      throw new Error(`mapeamento ausente: ${it.serie_nome}/${it.turma_nome}`);
    }
    rows.push({
      escola_id: escolaId,
      aluno_id: it.aluno_id,
      serie_id: serieId,
      turma_id: turmaId,
      plano_id: planoId,
      codigo: `${codigoById.get(it.aluno_id) ?? it.aluno_id}-${ANO_LETIVO}`,
      data_matricula: `${ANO_LETIVO}-01-01`,
      ano_letivo: ANO_LETIVO,
      status: "ativa",
      tipo_vaga: "paga",
      percentual_bolsa: 0,
      valor_mensalidade_praticado: it.mensalidade
    });
  }

  const BATCH = 100;
  const inseridas = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { data, error: errIns } = await supabase
      .from("matriculas")
      .insert(slice)
      .select("id, aluno_id, valor_mensalidade_praticado, data_matricula");
    if (errIns) throw errIns;
    inseridas.push(...data);
  }
  console.log(`  matriculas inseridas: ${inseridas.length}`);
  return inseridas;
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function dueDate(year, monthIndex, day) {
  const safe = Math.min(Math.max(day, 1), lastDayOfMonth(year, monthIndex));
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(safe).padStart(2, "0")}`;
}

async function generateCobrancas(escolaId, planoId, matriculasNovas) {
  const { data: plano, error: errP } = await supabase
    .from("planos")
    .select("nome, valor_matricula, quantidade_parcelas, dia_vencimento")
    .eq("id", planoId)
    .single();
  if (errP) throw errP;

  const valorMatricula = Number(plano.valor_matricula ?? 0);
  const installments = Number(plano.quantidade_parcelas ?? 12);
  const dueDay = Number(plano.dia_vencimento ?? 10);

  const rows = [];
  for (const m of matriculasNovas) {
    const valorMensal = Number(m.valor_mensalidade_praticado ?? 0);
    if (valorMatricula > 0) {
      rows.push({
        escola_id: escolaId,
        aluno_id: m.aluno_id,
        matricula_id: m.id,
        plano_id: planoId,
        descricao: `Matricula ${ANO_LETIVO}`,
        competencia: `${ANO_LETIVO}-00`,
        numero_parcela: 0,
        valor_original: valorMatricula,
        valor_desconto: 0,
        valor_acrescimo: 0,
        data_vencimento: m.data_matricula,
        status: "aberta"
      });
    }
    for (let idx = 0; idx < installments; idx += 1) {
      const monthIndex = idx % 12;
      const year = ANO_LETIVO + Math.floor(idx / 12);
      rows.push({
        escola_id: escolaId,
        aluno_id: m.aluno_id,
        matricula_id: m.id,
        plano_id: planoId,
        descricao: `Mensalidade ${String(monthIndex + 1).padStart(2, "0")}/${year} - ${plano.nome}`,
        competencia: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        numero_parcela: idx + 1,
        valor_original: valorMensal,
        valor_desconto: 0,
        valor_acrescimo: 0,
        data_vencimento: dueDate(year, monthIndex, dueDay),
        status: "aberta"
      });
    }
  }

  const BATCH = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("cobrancas").insert(slice);
    if (error) throw error;
    total += slice.length;
  }
  console.log(`  cobranças inseridas: ${total}`);
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

  if (!apply) {
    console.log(`\n[DRY-RUN] Para aplicar: node scripts/reset_matriculas_2026.mjs --apply --i-have-backup`);
    return;
  }

  console.log(`\n--- INICIANDO RESET ---`);
  await executeReset(escolaId, itens, planoId);
  const { serieIdByNome, turmaIdByKey } = await recreateSeriesTurmas(escolaId);
  const matriculasNovas = await insertMatriculas(escolaId, planoId, comValor, serieIdByNome, turmaIdByKey);
  await generateCobrancas(escolaId, planoId, matriculasNovas);

  console.log(`\n=== RESET CONCLUÍDO ===`);
  console.log(`séries: ${SERIES_ALVO.length}`);
  console.log(`turmas: ${TURMAS_ALVO.length}`);
  console.log(`matrículas: ${matriculasNovas.length}`);
}

main().catch(err => {
  console.error("FATAL:", err?.message ?? err);
  process.exit(1);
});
