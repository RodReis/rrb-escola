/**
 * Backup das tabelas afetadas pela correcao de ano letivo das matriculas.
 *
 * Salva matriculas e series em JSON, com um manifesto de contagens e a URL do
 * projeto, para que o restore consiga conferir que esta apontando para a mesma
 * base de onde o backup saiu.
 *
 * Uso:
 *   node scripts/backup_matriculas.mjs
 *   node scripts/backup_matriculas.mjs --out backups/meu_backup.json
 *
 * Restore:
 *   node scripts/restore_matriculas.mjs backups/<arquivo>.json          # dry-run
 *   node scripts/restore_matriculas.mjs backups/<arquivo>.json --apply
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

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

const outArg = process.argv.indexOf("--out");
const carimbo = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "_");
const outPath =
  outArg !== -1 ? process.argv[outArg + 1] : `backups/matriculas_pre_correcao_${carimbo}.json`;

async function fetchAll(supabase, table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
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

  const alvo = url.includes("127.0.0.1") || url.includes("localhost") ? "LOCAL" : "PRODUCAO";
  console.log(`Origem: ${url}  [${alvo}]\n`);

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const matriculas = await fetchAll(supabase, "matriculas");
  const series = await fetchAll(supabase, "series");

  const backup = {
    gerado_em: new Date().toISOString(),
    origem_url: url,
    ambiente: alvo,
    contagens: { matriculas: matriculas.length, series: series.length },
    tabelas: { matriculas, series },
  };

  mkdirSync(dirname(resolve(process.cwd(), outPath)), { recursive: true });
  writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf8");

  console.log(`matriculas: ${matriculas.length}`);
  console.log(`series:     ${series.length}`);
  console.log(`\nBackup gravado em ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
