// scripts/continue_reset_2026.mjs
//
// Continuação do reset: turmas/séries já criadas. Falta inserir matrículas e cobranças.
// Usa estado atual do DB para mapear série/turma -> id, lê planilha, insere.

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseMatriculadosXlsx } from "./lib/parse-matriculados-xlsx.mjs";
import { normalizeName } from "./lib/normalize-name.mjs";
import { mapHeaderToTarget } from "./lib/reset-matriculas-mapper.mjs";

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
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(120000) }) }
});

function lastDayOfMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}
function dueDate(year, monthIndex, day) {
  const safe = Math.min(Math.max(day, 1), lastDayOfMonth(year, monthIndex));
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(safe).padStart(2, "0")}`;
}

async function main() {
  console.log("\n=== CONTINUAR RESET 2026 (matriculas + cobrancas) ===\n");

  const { data: escola } = await supabase.from("escolas").select("id").limit(1).single();
  const escolaId = escola.id;
  const { data: plano } = await supabase
    .from("planos")
    .select("id, nome, valor_matricula, quantidade_parcelas, dia_vencimento")
    .eq("escola_id", escolaId)
    .eq("nome", PLANO_NOME)
    .single();
  console.log(`escola_id: ${escolaId} plano: ${plano.id}`);

  // Carrega séries existentes
  const { data: series } = await supabase.from("series").select("id, nome").eq("escola_id", escolaId);
  const serieIdByNome = new Map(series.map(s => [s.nome, s.id]));

  // Carrega turmas 2026
  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, nome, serie_id")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", ANO_LETIVO);
  // construir map turma por (serie_nome|turma_nome)
  const serieNomeById = new Map(series.map(s => [s.id, s.nome]));
  const turmaIdByKey = new Map();
  for (const t of turmas) {
    const serieNome = serieNomeById.get(t.serie_id);
    turmaIdByKey.set(`${serieNome}|${t.nome}`, t.id);
  }
  console.log(`séries em uso: ${serieIdByNome.size}, turmas 2026: ${turmas.length}`);

  // Parse planilha
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const itensRaw = parseMatriculadosXlsx(wb);
  const itens = [];
  for (const it of itensRaw) {
    const mapped = mapHeaderToTarget(it.turma_label);
    if (mapped) itens.push({ ...it, ...mapped });
  }
  const comValor = itens.filter(i => typeof i.mensalidade === "number" && i.mensalidade > 0);

  // Match alunos
  const { data: alunos } = await supabase
    .from("alunos")
    .select("id, nome, matricula_codigo")
    .eq("escola_id", escolaId)
    .eq("ativo", true);
  const byName = new Map(alunos.map(a => [normalizeName(a.nome), a.id]));
  const codigoById = new Map(alunos.map(a => [a.id, a.matricula_codigo]));
  for (const it of comValor) {
    it.aluno_id = byName.get(normalizeName(it.nome_raw));
    if (!it.aluno_id) throw new Error(`não casou: ${it.nome_raw}`);
  }
  console.log(`alunos casados: ${comValor.length}`);

  // Verificar quais matrículas já existem (idempotência)
  const { data: existentes } = await supabase
    .from("matriculas")
    .select("aluno_id")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", ANO_LETIVO);
  const jaInseridas = new Set(existentes.map(m => m.aluno_id));
  const pendentes = comValor.filter(it => !jaInseridas.has(it.aluno_id));
  console.log(`matrículas já existentes: ${jaInseridas.size}, pendentes: ${pendentes.length}`);

  // Insert matrículas em batches MENORES (50) com retry
  const rows = pendentes.map(it => ({
    escola_id: escolaId,
    aluno_id: it.aluno_id,
    serie_id: serieIdByNome.get(it.serie_nome),
    turma_id: turmaIdByKey.get(`${it.serie_nome}|${it.turma_nome}`),
    plano_id: plano.id,
    codigo: `${codigoById.get(it.aluno_id) ?? it.aluno_id}-${ANO_LETIVO}`,
    data_matricula: `${ANO_LETIVO}-01-01`,
    ano_letivo: ANO_LETIVO,
    status: "ativa",
    tipo_vaga: "paga",
    percentual_bolsa: 0,
    valor_mensalidade_praticado: it.mensalidade
  }));

  const BATCH = 50;
  const inseridas = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    let attempts = 0;
    while (attempts < 3) {
      try {
        const { data, error } = await supabase
          .from("matriculas")
          .insert(slice)
          .select("id, aluno_id, valor_mensalidade_praticado, data_matricula");
        if (error) throw error;
        inseridas.push(...data);
        console.log(`  matrículas inseridas ${inseridas.length}/${rows.length}`);
        break;
      } catch (err) {
        attempts++;
        console.log(`  batch ${i / BATCH} falhou (tentativa ${attempts}): ${err.message}`);
        if (attempts >= 3) throw err;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  // Buscar todas matrículas 2026 pra gerar cobranças (idempotente)
  const { data: todasMatriculas } = await supabase
    .from("matriculas")
    .select("id, aluno_id, valor_mensalidade_praticado, data_matricula")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", ANO_LETIVO);

  // Verificar quais matrículas já têm cobranças
  const { data: comCob } = await supabase
    .from("cobrancas")
    .select("matricula_id")
    .eq("escola_id", escolaId);
  const matricComCob = new Set(comCob.map(c => c.matricula_id));
  const matriculasSemCob = todasMatriculas.filter(m => !matricComCob.has(m.id));
  console.log(`matrículas sem cobrança: ${matriculasSemCob.length}`);

  const valorMatricula = Number(plano.valor_matricula ?? 0);
  const installments = Number(plano.quantidade_parcelas ?? 12);
  const dueDay = Number(plano.dia_vencimento ?? 10);

  const cobrancasRows = [];
  for (const m of matriculasSemCob) {
    const valorMensal = Number(m.valor_mensalidade_praticado ?? 0);
    if (valorMatricula > 0) {
      cobrancasRows.push({
        escola_id: escolaId,
        aluno_id: m.aluno_id,
        matricula_id: m.id,
        plano_id: plano.id,
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
      cobrancasRows.push({
        escola_id: escolaId,
        aluno_id: m.aluno_id,
        matricula_id: m.id,
        plano_id: plano.id,
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

  const CBATCH = 200;
  let totalCob = 0;
  for (let i = 0; i < cobrancasRows.length; i += CBATCH) {
    const slice = cobrancasRows.slice(i, i + CBATCH);
    let attempts = 0;
    while (attempts < 3) {
      try {
        const { error } = await supabase.from("cobrancas").insert(slice);
        if (error) throw error;
        totalCob += slice.length;
        console.log(`  cobranças inseridas ${totalCob}/${cobrancasRows.length}`);
        break;
      } catch (err) {
        attempts++;
        console.log(`  cob batch ${i / CBATCH} falhou (${attempts}): ${err.message}`);
        if (attempts >= 3) throw err;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  console.log("\n=== CONCLUÍDO ===");
  console.log(`matrículas totais 2026: ${todasMatriculas.length}`);
  console.log(`cobranças inseridas nesta rodada: ${totalCob}`);
}

main().catch(err => {
  console.error("FATAL:", err?.message ?? err);
  process.exit(1);
});
