/**
 * Restaura ano_letivo das matriculas e ordem das series a partir de um backup
 * gerado por scripts/backup_matriculas.mjs.
 *
 * Reverte exatamente os campos que a correcao altera. Nao recria linhas
 * apagadas nem toca em nenhuma outra coluna, entao e seguro rodar mais de uma
 * vez: o resultado e sempre o estado do backup.
 *
 * Uso:
 *   node scripts/restore_matriculas.mjs backups/<arquivo>.json           # dry-run
 *   node scripts/restore_matriculas.mjs backups/<arquivo>.json --apply
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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
const backupPath = process.argv[2];

if (!backupPath || backupPath.startsWith("--")) {
  console.error("Uso: node scripts/restore_matriculas.mjs <backup.json> [--apply]");
  process.exit(1);
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

  const backup = JSON.parse(readFileSync(backupPath, "utf8"));
  console.log(`Backup:  ${backupPath}`);
  console.log(`Gerado:  ${backup.gerado_em}`);
  console.log(`Origem:  ${backup.origem_url}`);
  console.log(`Destino: ${url}`);
  console.log(`Modo:    ${apply ? "APPLY" : "DRY-RUN"}\n`);

  if (backup.origem_url !== url) {
    console.error("ABORTADO: o backup veio de outra base. Restaurar aqui misturaria dados.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const matAtual = await fetchAll(supabase, "matriculas", "id,ano_letivo");
  const serAtual = await fetchAll(supabase, "series", "id,ordem");
  const anoAtual = new Map(matAtual.map((m) => [m.id, m.ano_letivo]));
  const ordemAtual = new Map(serAtual.map((s) => [s.id, s.ordem]));

  const matDif = backup.tabelas.matriculas.filter(
    (m) => anoAtual.has(m.id) && anoAtual.get(m.id) !== m.ano_letivo,
  );
  const serDif = backup.tabelas.series.filter(
    (s) => ordemAtual.has(s.id) && ordemAtual.get(s.id) !== s.ordem,
  );
  const sumidas = backup.tabelas.matriculas.filter((m) => !anoAtual.has(m.id));

  console.log(`matriculas a reverter: ${matDif.length}`);
  console.log(`series a reverter:     ${serDif.length}`);
  if (sumidas.length) {
    console.log(`\nAVISO: ${sumidas.length} matriculas do backup nao existem mais na base.`);
    console.log("Este script nao recria linhas apagadas.");
  }

  if (!apply) {
    console.log("\nNada foi gravado. Rode com --apply para reverter.");
    return;
  }

  let ok = 0;
  const falhas = [];
  for (const s of serDif) {
    const { error } = await supabase.from("series").update({ ordem: s.ordem }).eq("id", s.id);
    if (error) falhas.push(`serie ${s.id}: ${error.message}`);
    else ok++;
  }
  for (const m of matDif) {
    const { error } = await supabase
      .from("matriculas")
      .update({ ano_letivo: m.ano_letivo })
      .eq("id", m.id);
    if (error) falhas.push(`matricula ${m.id}: ${error.message}`);
    else ok++;
  }

  console.log(`\nRevertidas: ${ok}`);
  if (falhas.length) {
    console.log(`Falhas: ${falhas.length}`);
    for (const f of falhas.slice(0, 10)) console.log(`  ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
