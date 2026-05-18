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

function normSerie(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+EM$/u, "")
    .replace(/\s+/g, "")
    .trim();
}

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

async function ensureSeriesETurmas({
  escola_id,
  series,
  turmas,
  pass1Resolved,
  seriesFaltando,
  dryRun
}) {
  const serieByNorm = new Map(series.map((s) => [normSerie(s.nome), s]));
  const turmaBySerieTurno = new Map(
    turmas.map((t) => [`${t.serie_id}|${t.turno}`, t])
  );
  const seriesCriadas = [];
  const turmasCriadas = [];

  // Create missing series
  for (const nome of seriesFaltando) {
    if (dryRun) {
      const fakeId = `dry-serie-${normSerie(nome)}`;
      seriesCriadas.push({ id: fakeId, nome, dry: true });
      serieByNorm.set(normSerie(nome), { id: fakeId, nome });
      continue;
    }
    const { data, error } = await supabase
      .from("series")
      .insert({ escola_id, nome, ordem: 0, ativo: true })
      .select("id, nome")
      .single();
    if (error) throw new Error(`Erro criando serie ${nome}: ${error.message}`);
    serieByNorm.set(normSerie(data.nome), data);
    seriesCriadas.push(data);
  }

  // Collect needed turmas from pass1 items that had turma_faltando
  const turmasNecessarias = new Map();
  for (const r of pass1Resolved) {
    if (r.status !== "turma_faltando") continue;
    const key = `${r.serie_nome_alvo}|${r.turno_alvo}`;
    if (turmasNecessarias.has(key)) continue;
    const serie = serieByNorm.get(normSerie(r.serie_nome_alvo));
    if (!serie) continue;
    turmasNecessarias.set(key, {
      serie_id: serie.id,
      serie_nome: r.serie_nome_alvo,
      nome: r.turma_nome_alvo,
      turno: r.turno_alvo
    });
  }

  for (const t of turmasNecessarias.values()) {
    const tKey = `${t.serie_id}|${t.turno}`;
    if (turmaBySerieTurno.has(tKey)) continue;
    if (dryRun) {
      const fakeId = `dry-turma-${tKey}`;
      turmasCriadas.push({ id: fakeId, serie_id: t.serie_id, serie_nome: t.serie_nome, nome: t.nome, turno: t.turno, dry: true });
      turmaBySerieTurno.set(tKey, { id: fakeId, serie_id: t.serie_id, nome: t.nome, turno: t.turno });
      continue;
    }
    const { data, error } = await supabase
      .from("turmas")
      .insert({
        escola_id,
        serie_id: t.serie_id,
        nome: t.nome,
        ano_letivo: ANO_LETIVO,
        turno: t.turno,
        capacidade: 30,
        ativo: true
      })
      .select("id, serie_id, nome, ano_letivo, turno")
      .single();
    if (error)
      throw new Error(
        `Erro criando turma ${t.serie_nome}/${t.nome}/${t.turno}: ${error.message}`
      );
    turmaBySerieTurno.set(`${data.serie_id}|${data.turno}`, data);
    turmasCriadas.push(data);
  }

  return { serieByNorm, turmaBySerieTurno, seriesCriadas, turmasCriadas };
}

async function applyMatriculas({ escola_id, resolved, dryRun }) {
  let updated = 0;
  let inserted = 0;
  for (const r of resolved) {
    if (r.status === "update_matricula") {
      if (dryRun) {
        updated++;
        continue;
      }
      const { error } = await supabase
        .from("matriculas")
        .update({
          serie_id: r.serie_id_alvo,
          turma_id: r.turma_id_alvo,
          updated_at: new Date().toISOString()
        })
        .eq("id", r.matricula_id_atual);
      if (error)
        throw new Error(
          `UPDATE matricula ${r.matricula_id_atual} falhou: ${error.message}`
        );
      updated++;
    } else if (r.status === "insert_matricula") {
      if (dryRun) {
        inserted++;
        continue;
      }
      const { error } = await supabase.from("matriculas").insert({
        escola_id,
        aluno_id: r.aluno_id,
        serie_id: r.serie_id_alvo,
        turma_id: r.turma_id_alvo,
        ano_letivo: ANO_LETIVO,
        status: "ativa"
      });
      if (error)
        throw new Error(
          `INSERT matricula aluno ${r.aluno_id} falhou: ${error.message}`
        );
      inserted++;
    }
  }
  return { updated, inserted };
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

  // Índices base
  const alunoByNorm = new Map();
  for (const a of alunos) {
    alunoByNorm.set(normalizeName(a.nome), a);
  }
  const matriculaByAluno = new Map(matriculas.map((m) => [m.aluno_id, m]));
  const dupeAlunoIds = matriculas
    .map((m) => m.aluno_id)
    .filter((id, _, arr) => arr.indexOf(id) !== arr.lastIndexOf(id));
  if (dupeAlunoIds.length) {
    console.warn(
      `AVISO: ${[...new Set(dupeAlunoIds)].length} aluno(s) com múltiplas matrículas 2026 — apenas a última será considerada:`,
      [...new Set(dupeAlunoIds)]
    );
  }

  // First pass with current DB state
  function resolveAll({ serieByNorm, turmaBySerieTurno }) {
    const resolved = [];
    const orfaos = [];
    const turmasFaltando = new Set();
    const seriesFaltando = new Set();
    for (const item of planilha) {
      const mapped = mapTurmaHeader(item.turma_label);
      if (!mapped) {
        orfaos.push({ ...item, motivo: "turma_label nao mapeada" });
        continue;
      }
      const aluno = alunoByNorm.get(normalizeName(item.nome_raw));
      if (!aluno) {
        orfaos.push({ ...item, motivo: "aluno nao encontrado por nome" });
        continue;
      }
      const serie = serieByNorm.get(normSerie(mapped.serie_nome));
      if (!serie) seriesFaltando.add(mapped.serie_nome);
      const turma = serie ? turmaBySerieTurno.get(`${serie.id}|${mapped.turno}`) : null;
      if (serie && !turma) turmasFaltando.add(`${mapped.serie_nome} | ${mapped.turno}`);
      const matricula = matriculaByAluno.get(aluno.id);
      let status;
      if (!serie || !turma) status = "turma_faltando";
      else if (!matricula) status = "insert_matricula";
      else if (matricula.turma_id === turma.id) status = "inalterado";
      else status = "update_matricula";
      resolved.push({
        aluno_id: aluno.id,
        aluno_nome: aluno.nome,
        sheet: item.sheet,
        turma_label: item.turma_label,
        serie_nome_alvo: mapped.serie_nome,
        turma_nome_alvo: mapped.turma_nome,
        turno_alvo: mapped.turno,
        matricula_id_atual: matricula?.id ?? null,
        serie_id_alvo: serie?.id ?? null,
        turma_id_alvo: turma?.id ?? null,
        status
      });
    }
    return { resolved, orfaos, seriesFaltando, turmasFaltando };
  }

  const pass1 = resolveAll({
    serieByNorm: new Map(series.map((s) => [normSerie(s.nome), s])),
    turmaBySerieTurno: new Map(turmas.map((t) => [`${t.serie_id}|${t.turno}`, t]))
  });

  const ensured = await ensureSeriesETurmas({
    escola_id: escola.id,
    series,
    turmas,
    pass1Resolved: pass1.resolved,
    seriesFaltando: pass1.seriesFaltando,
    dryRun: !apply
  });

  // Second pass with updated maps (real or simulated)
  const pass2 = resolveAll({
    serieByNorm: ensured.serieByNorm,
    turmaBySerieTurno: ensured.turmaBySerieTurno
  });

  const resolved = pass2.resolved;
  const orfaos = pass2.orfaos;
  const seriesFaltando = pass2.seriesFaltando;
  const turmasFaltando = pass2.turmasFaltando;

  // Extras: matrículas no DB cujos alunos não estão na planilha (por nome)
  const planilhaAlunoIds = new Set(
    resolved.map((r) => r.aluno_id).filter(Boolean)
  );
  const extras = matriculas
    .filter((m) => !planilhaAlunoIds.has(m.aluno_id))
    .map((m) => ({
      matricula_id: m.id,
      aluno_id: m.aluno_id,
      aluno_nome: alunos.find((a) => a.id === m.aluno_id)?.nome ?? "?"
    }));

  const counts = resolved.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  counts.orfaos_planilha = orfaos.length;
  counts.extras_sistema = extras.length;

  console.log("\n=== Resumo ===");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  if (seriesFaltando.size) {
    console.log("\nSéries faltando no DB:");
    for (const s of seriesFaltando) console.log(`  - ${s}`);
  }
  if (turmasFaltando.size) {
    console.log("\nTurmas faltando no DB:");
    for (const t of turmasFaltando) console.log(`  - ${t}`);
  }

  // --- JSON report ---
  const turmaById = new Map(turmas.map((t) => [t.id, t]));
  for (const t of ensured.turmasCriadas) {
    if (!t.dry && t.id) turmaById.set(t.id, t);
  }
  const serieById = new Map(series.map((s) => [s.id, s]));

  const report = {
    mode,
    ano_letivo: ANO_LETIVO,
    escola: { id: escola.id, nome: escola.nome },
    counts,
    series_faltando: [...seriesFaltando],
    turmas_faltando: [...turmasFaltando],
    inalterados_count: counts.inalterado ?? 0,
    corrigidos: resolved
      .filter((r) => r.status === "update_matricula")
      .map((r) => ({
        aluno_id: r.aluno_id,
        nome: r.aluno_nome,
        matricula_id: r.matricula_id_atual,
        de_serie: serieById.get(
          matriculas.find((m) => m.id === r.matricula_id_atual)?.serie_id
        )?.nome ?? null,
        de_turma: turmaById.get(
          matriculas.find((m) => m.id === r.matricula_id_atual)?.turma_id
        )?.nome ?? null,
        de_turno: turmaById.get(
          matriculas.find((m) => m.id === r.matricula_id_atual)?.turma_id
        )?.turno ?? null,
        para_serie: r.serie_nome_alvo,
        para_turma: r.turma_nome_alvo,
        para_turno: r.turno_alvo
      })),
    criados: resolved
      .filter((r) => r.status === "insert_matricula")
      .map((r) => ({
        aluno_id: r.aluno_id,
        nome: r.aluno_nome,
        serie_id_alvo: r.serie_id_alvo,
        turma_id_alvo: r.turma_id_alvo,
        para_serie: r.serie_nome_alvo,
        para_turma: r.turma_nome_alvo,
        para_turno: r.turno_alvo
      })),
    orfaos_planilha: orfaos.map((o) => ({
      nome_raw: o.nome_raw,
      sheet: o.sheet,
      turma_label: o.turma_label,
      motivo: o.motivo
    })),
    extras_sistema: extras
  };

  const applied = await applyMatriculas({
    escola_id: escola.id,
    resolved,
    dryRun: !apply
  });
  console.log(`\nAplicado: updates=${applied.updated} inserts=${applied.inserted}`);
  report.applied = applied;

  report.series_criadas = ensured.seriesCriadas;
  report.turmas_criadas = ensured.turmasCriadas;

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = `${REPORT_DIR}/reconcile-2026-${mode.toLowerCase()}-${ts}.json`;
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nRelatório gravado em ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
