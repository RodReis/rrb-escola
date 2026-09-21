/**
 * Aplica, via API, a migration 202609100001_corrige_ordem_series_infantil.sql.
 *
 * INFANTIL2 e INFANTIL3 estao cadastradas com a mesma ordem (2), embora sejam
 * etapas distintas. Este script reabre espaco (+1 nas series de ordem >= 3) e
 * assenta INFANTIL3 na ordem 3.
 *
 * A ordem das operacoes importa: desloca da maior para a menor, senao um update
 * colide com a ordem de outra serie no meio do caminho.
 *
 * Uso:
 *   node scripts/aplicar_ordem_series.mjs            # dry-run
 *   node scripts/aplicar_ordem_series.mjs --apply
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

  const { data: series, error } = await supabase.from("series").select("id,nome,ordem");
  if (error) throw new Error(error.message);

  const i3 = series.find((s) => s.nome === "INFANTIL3");
  if (!i3) throw new Error("INFANTIL3 nao encontrada");
  if (i3.ordem === 3) {
    console.log("INFANTIL3 ja esta na ordem 3. Nada a fazer.");
    return;
  }

  // Maior ordem primeiro, para nao colidir com a ordem ainda ocupada acima.
  const deslocar = series
    .filter((s) => s.ordem >= 3)
    .sort((a, b) => b.ordem - a.ordem);

  console.log("Plano:");
  for (const s of deslocar) console.log(`  ${s.nome.padEnd(11)} ${s.ordem} -> ${s.ordem + 1}`);
  console.log(`  ${i3.nome.padEnd(11)} ${i3.ordem} -> 3`);

  if (!apply) {
    console.log("\nNada foi gravado. Rode com --apply para aplicar.");
    return;
  }

  for (const s of deslocar) {
    const { error: e } = await supabase.from("series").update({ ordem: s.ordem + 1 }).eq("id", s.id);
    if (e) throw new Error(`${s.nome}: ${e.message}`);
  }
  const { error: e3 } = await supabase.from("series").update({ ordem: 3 }).eq("id", i3.id);
  if (e3) throw new Error(`INFANTIL3: ${e3.message}`);

  const { data: fim } = await supabase.from("series").select("nome,ordem").order("ordem");
  console.log("\nOrdem final:");
  for (const s of fim) console.log(`  ${String(s.ordem).padStart(2)}  ${s.nome}`);

  const ordens = fim.map((s) => s.ordem);
  const dup = ordens.length !== new Set(ordens).size;
  console.log(dup ? "\nATENCAO: ainda ha ordens duplicadas." : "\nSem ordens duplicadas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
