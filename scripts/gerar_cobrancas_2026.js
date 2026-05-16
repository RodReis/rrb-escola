#!/usr/bin/env node
// Gera 12 cobranças (Jan-Dez 2026) para cada aluno da planilha MATRICULADOS2026.xlsx.
// Vencimento: dia 5 de cada mês. Idempotente: skip se cobrança já existe.
// Requer: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env.local

const path = require("path");
const fs = require("fs");

// Load .env.local
const envPath = path.join(__dirname, "../.env.local");
const envLines = fs.readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const xlsx = require(path.join(__dirname, "../node_modules/xlsx"));
const { createClient } = require(path.join(__dirname, "../node_modules/@supabase/supabase-js"));

const ESCOLA_ID = "00000000-0000-0000-0000-000000000001";
const ANO_LETIVO = 2026;
const DIA_VENCIMENTO = 5;
const XLSX_PATH = path.join(__dirname, "../public/MATRICULADOS2026.xlsx");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function lastDayOfMonth(year, month1indexed) {
  return new Date(Date.UTC(year, month1indexed, 0)).getUTCDate();
}

function dueDate(year, month1indexed, day) {
  const safe = Math.min(day, lastDayOfMonth(year, month1indexed));
  return `${year}-${String(month1indexed).padStart(2, "0")}-${String(safe).padStart(2, "0")}`;
}

function parseXlsx() {
  const wb = xlsx.readFile(XLSX_PATH);
  const entries = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

    for (const row of rows) {
      // Data row: col0=sequential number, col1=nome, col2=valor
      if (
        typeof row[0] === "number" &&
        typeof row[1] === "string" &&
        typeof row[2] === "number" &&
        row[2] > 0
      ) {
        entries.push({ nome: row[1].trim(), valor: row[2] });
      }
    }
  }

  return entries;
}

async function main() {
  console.log("Lendo planilha...");
  const entries = parseXlsx();
  console.log(`${entries.length} alunos na planilha.`);

  // Busca alunos com matrícula ativa 2026
  console.log("Buscando alunos com matrícula ativa 2026...");
  const { data: matriculas, error: matError } = await supabase
    .from("matriculas")
    .select("id, aluno_id, alunos(id, nome)")
    .eq("escola_id", ESCOLA_ID)
    .eq("ano_letivo", ANO_LETIVO)
    .eq("status", "ativa");

  if (matError) throw new Error(`Erro buscando matrículas: ${matError.message}`);
  console.log(`${matriculas.length} matrículas ativas 2026 no banco.`);

  // Mapa nome normalizado → {aluno_id, matricula_id}
  const byName = new Map();
  for (const m of matriculas) {
    const aluno = Array.isArray(m.alunos) ? m.alunos[0] : m.alunos;
    if (!aluno) continue;
    byName.set(aluno.nome.trim().toLowerCase(), {
      aluno_id: aluno.id,
      matricula_id: m.id,
    });
  }

  // Busca cobranças existentes (idempotência)
  const { data: existing, error: existErr } = await supabase
    .from("cobrancas")
    .select("aluno_id, competencia")
    .eq("escola_id", ESCOLA_ID)
    .neq("status", "cancelada");

  if (existErr) throw new Error(`Erro buscando cobranças: ${existErr.message}`);

  const existSet = new Set(
    (existing ?? []).map((c) => `${c.aluno_id}#${c.competencia}`)
  );

  const noMatch = [];
  const rows = [];

  for (const entry of entries) {
    const key = entry.nome.toLowerCase();
    const match = byName.get(key);

    if (!match) {
      noMatch.push(entry.nome);
      continue;
    }

    for (let m = 1; m <= 12; m++) {
      const competencia = `${ANO_LETIVO}-${String(m).padStart(2, "0")}`;
      const existKey = `${match.aluno_id}#${competencia}`;

      if (existSet.has(existKey)) continue;

      rows.push({
        escola_id: ESCOLA_ID,
        aluno_id: match.aluno_id,
        matricula_id: match.matricula_id,
        descricao: `Mensalidade ${String(m).padStart(2, "0")}/${ANO_LETIVO}`,
        competencia,
        numero_parcela: m,
        valor_original: entry.valor,
        valor_desconto: 0,
        valor_acrescimo: 0,
        data_vencimento: dueDate(ANO_LETIVO, m, DIA_VENCIMENTO),
        status: "aberta",
      });
    }
  }

  console.log(`\nCobranças a inserir: ${rows.length}`);

  if (rows.length > 0) {
    // Insere em lotes de 500
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error: insErr } = await supabase.from("cobrancas").insert(batch);
      if (insErr) throw new Error(`Erro inserindo lote ${i}: ${insErr.message}`);
      inserted += batch.length;
      process.stdout.write(`\r  Inseridos: ${inserted}/${rows.length}`);
    }
    console.log("\nOK.");
  }

  if (noMatch.length > 0) {
    console.log(`\n⚠️  ${noMatch.length} alunos SEM MATCH (bolsa/permuta — tratar depois):`);
    for (const nome of noMatch) console.log(`  - ${nome}`);
  } else {
    console.log("\nTodos os alunos com match.");
  }

  console.log("\nConcluído.");
}

main().catch((err) => {
  console.error("ERRO:", err.message);
  process.exit(1);
});
