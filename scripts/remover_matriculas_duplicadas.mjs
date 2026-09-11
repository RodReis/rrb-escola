/**
 * Remove as matriculas redundantes que sobraram apos a correcao de ano letivo.
 *
 * Depois de scripts/corrigir_ano_letivo_matriculas.mjs, as linhas duplicadas
 * passaram a apontar para o mesmo (aluno, ano letivo, serie). Elas descrevem a
 * mesma etapa escolar registrada duas vezes: uma veio do PDF do sistema antigo,
 * outra da planilha do ano corrente. Apagar evita que toda consulta futura
 * precise agrupar para nao mostrar a etapa em dobro.
 *
 * QUAL LINHA FICA
 *   1. A matricula ativa do grupo (a do ano corrente, vinda da planilha).
 *   2. Sem nenhuma ativa, a de data_matricula mais recente.
 *
 * SALVAGUARDAS
 *   - Nunca apaga uma linha com status ativa.
 *   - Nunca apaga uma linha com cobranca, frequencia ou nota vinculada;
 *     o grupo inteiro e pulado e reportado para revisao manual.
 *   - Grava um backup so das linhas removidas antes de apagar.
 *
 * Uso:
 *   node scripts/remover_matriculas_duplicadas.mjs            # dry-run
 *   node scripts/remover_matriculas_duplicadas.mjs --apply
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

const apply = process.argv.includes("--apply");
const carimbo = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "_");

/**
 * Escolhe a linha que fica em cada grupo duplicado.
 * Recebe as matriculas de um mesmo (aluno, ano, serie).
 */
export function escolherSobrevivente(grupo) {
  const porDataDesc = (a, b) =>
    String(b.data_matricula ?? "").localeCompare(String(a.data_matricula ?? ""));
  const ativas = grupo.filter((m) => m.status === "ativa");
  if (ativas.length > 0) return ativas.slice().sort(porDataDesc)[0];
  return grupo.slice().sort(porDataDesc)[0];
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

/** Ids de matricula referenciados por uma tabela filha, em lotes. */
async function idsReferenciados(supabase, tabela, ids) {
  const usados = new Set();
  for (let i = 0; i < ids.length; i += 150) {
    const lote = ids.slice(i, i + 150);
    const { data, error } = await supabase.from(tabela).select("matricula_id").in("matricula_id", lote);
    if (error) {
      if (/does not exist|Could not find the table/i.test(error.message)) return usados;
      throw new Error(`${tabela}: ${error.message}`);
    }
    for (const r of data ?? []) usados.add(r.matricula_id);
  }
  return usados;
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

  const alvo = url.includes("127.0.0.1") || url.includes("localhost") ? "LOCAL" : "PRODUCAO";
  console.log(`Base: ${url}  [${alvo}]`);
  console.log(`Modo: ${apply ? "APPLY" : "DRY-RUN"}\n`);

  const series = await fetchAll(supabase, "series", "id,nome");
  const nomeDaSerie = new Map(series.map((s) => [s.id, s.nome]));
  const alunos = await fetchAll(supabase, "alunos", "id,nome");
  const nomeDoAluno = new Map(alunos.map((a) => [a.id, a.nome]));
  const matriculas = await fetchAll(supabase, "matriculas", "*");

  const grupos = new Map();
  for (const m of matriculas) {
    const chave = `${m.aluno_id}|${m.ano_letivo}|${m.serie_id}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(m);
  }
  const duplicados = [...grupos.values()].filter((g) => g.length > 1);

  let candidatas = [];
  for (const grupo of duplicados) {
    const fica = escolherSobrevivente(grupo);
    for (const m of grupo) if (m.id !== fica.id) candidatas.push(m);
  }

  // Salvaguarda: nunca remover uma matricula ativa.
  const ativasNaLista = candidatas.filter((m) => m.status === "ativa");
  if (ativasNaLista.length > 0) {
    console.error(`ABORTADO: ${ativasNaLista.length} matriculas ativas entraram na lista.`);
    process.exit(1);
  }

  // Salvaguarda: nunca remover uma matricula com dado vinculado.
  const ids = candidatas.map((m) => m.id);
  const vinculadas = new Set();
  for (const tabela of ["cobrancas", "frequencias", "notas"]) {
    for (const id of await idsReferenciados(supabase, tabela, ids)) vinculadas.add(id);
  }
  const protegidas = candidatas.filter((m) => vinculadas.has(m.id));
  candidatas = candidatas.filter((m) => !vinculadas.has(m.id));

  console.log(`Grupos duplicados:   ${duplicados.length}`);
  console.log(`Linhas a remover:    ${candidatas.length}`);
  console.log(`Preservadas (em uso): ${protegidas.length}`);

  if (protegidas.length > 0) {
    console.log("\nPreservadas por terem dados vinculados (revisar manualmente):");
    for (const m of protegidas.slice(0, 10)) {
      console.log(`  ${(nomeDoAluno.get(m.aluno_id) ?? "?").slice(0, 30)} ${m.ano_letivo} ${nomeDaSerie.get(m.serie_id)}`);
    }
  }

  console.log("\nAmostra do que sai:");
  for (const m of candidatas.slice(0, 10)) {
    console.log(
      `  ${(nomeDoAluno.get(m.aluno_id) ?? "?").slice(0, 30).padEnd(30)} ` +
        `${m.ano_letivo}  ${(nomeDaSerie.get(m.serie_id) ?? "?").padEnd(10)} ` +
        `dt=${m.data_matricula}  ${m.status}`,
    );
  }
  if (candidatas.length > 10) console.log(`  ... e mais ${candidatas.length - 10} linhas`);

  if (!apply) {
    console.log("\nNada foi removido. Rode com --apply para apagar.");
    return;
  }

  const backupPath = `backups/matriculas_removidas_${carimbo}.json`;
  mkdirSync(dirname(resolve(process.cwd(), backupPath)), { recursive: true });
  writeFileSync(
    backupPath,
    JSON.stringify(
      { gerado_em: new Date().toISOString(), origem_url: url, removidas: candidatas },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nBackup das linhas removidas: ${backupPath}`);

  let ok = 0;
  const falhas = [];
  for (const m of candidatas) {
    const { error } = await supabase.from("matriculas").delete().eq("id", m.id);
    if (error) falhas.push(`${nomeDoAluno.get(m.aluno_id)}: ${error.message}`);
    else ok++;
  }

  console.log(`Removidas: ${ok}`);
  if (falhas.length) {
    console.log(`Falhas: ${falhas.length}`);
    for (const f of falhas.slice(0, 10)) console.log(`  ${f}`);
  }
}

if (process.argv[1]?.endsWith("remover_matriculas_duplicadas.mjs")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
