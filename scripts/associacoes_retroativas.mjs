/**
 * Cria as associacoes serie <-> empresa dos anos anteriores ao corrente.
 *
 * A tela de Associacoes so tem o ano corrente, mas o historico importado vai
 * de 2015 em diante. Sem associacao para o ano, a emissao nao acha a empresa
 * credenciada e o PDF sai sem cabecalho, sem cidade e sem as assinaturas.
 *
 * Cria UMA faixa por serie cobrindo todo o periodo historico, apontando para a
 * empresa que os proprios anos internos nomeiam. Nao toca em associacao que ja
 * exista (inclusive a do ano corrente).
 *
 * Uso:
 *   node scripts/associacoes_retroativas.mjs            # dry-run
 *   node scripts/associacoes_retroativas.mjs --apply    # grava
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ESCOLA_ID = "00000000-0000-0000-0000-000000000001";

/** Serie -> nivel de ensino, mesma regra da importacao. */
function nivelDaSerie(nome) {
  if (/^[1-5]º ANO$/.test(nome)) return "fund1";
  if (/^[6-9]º ANO$/.test(nome)) return "fund2";
  if (/^[1-3]ª SÉRIE$/.test(nome)) return "medio";
  return null;
}

function loadEnvFile(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function chaveNome(nome) {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const apply = process.argv.includes("--apply");
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Base: ${url}`);
  console.log(apply ? "Modo: APLICANDO\n" : "Modo: DRY-RUN (nada sera gravado)\n");

  // Periodo real coberto pelo historico interno de cada serie.
  const { data: anos, error: erroAnos } = await db
    .from("historico_anos")
    .select("ano, serie_id, instituicao, origem, historico_escolar!inner(escola_id)")
    .eq("origem", "interna")
    .eq("historico_escolar.escola_id", ESCOLA_ID);
  if (erroAnos) throw erroAnos;

  const porSerie = new Map();
  for (const a of anos ?? []) {
    if (!a.serie_id) continue;
    const atual = porSerie.get(a.serie_id) ?? { min: Infinity, max: -Infinity, instituicoes: new Set() };
    atual.min = Math.min(atual.min, a.ano);
    atual.max = Math.max(atual.max, a.ano);
    if (a.instituicao) atual.instituicoes.add(a.instituicao);
    porSerie.set(a.serie_id, atual);
  }

  if (porSerie.size === 0) {
    console.log("Nenhum ano interno com serie_id — nada a fazer.");
    return;
  }

  const [{ data: series, error: erroSeries }, { data: empresas, error: erroEmpresas }, { data: existentes, error: erroExistentes }] =
    await Promise.all([
      db.from("series").select("id, nome").eq("escola_id", ESCOLA_ID),
      db.from("companies").select("id, name").eq("ativo", true),
      db.from("historico_niveis_ensino").select("serie_id, company_id, ano_inicio, ano_fim").eq("escola_id", ESCOLA_ID)
    ]);
  if (erroSeries) throw erroSeries;
  if (erroEmpresas) throw erroEmpresas;
  if (erroExistentes) throw erroExistentes;

  const nomeSerie = new Map((series ?? []).map((s) => [s.id, s.nome]));
  const faixasPorSerie = new Map();
  for (const e of existentes ?? []) {
    if (!faixasPorSerie.has(e.serie_id)) faixasPorSerie.set(e.serie_id, []);
    faixasPorSerie.get(e.serie_id).push(e);
  }

  // Qual empresa usar. O historico nomeia a instituicao pelo nome fantasia
  // ("EPG TRINDADE") e o cadastro guarda a razao social ("Escola Pinguinho de
  // Gente LTDA") — casar por texto erraria, e com mais de uma empresa ativa um
  // palpite vincularia o historico a escola errada. Entao:
  //   1) --empresa <id|nome> quando informado;
  //   2) a empresa que as associacoes existentes ja usam (a escolha que a
  //      secretaria fez na tela de Associacoes);
  //   3) a unica empresa ativa, se so houver uma.
  // Fora isso, paramos e pedimos para escolher.
  const empresasAtivas = empresas ?? [];
  const argEmpresa = process.argv.find((a) => a.startsWith("--empresa="))?.split("=")[1];

  function resolverEmpresa() {
    if (argEmpresa) {
      const alvo = chaveNome(argEmpresa);
      const achada = empresasAtivas.find((c) => c.id === argEmpresa || chaveNome(c.name) === alvo);
      if (!achada) throw new Error(`--empresa="${argEmpresa}" nao casa com nenhuma empresa ativa`);
      return { empresa: achada, motivo: "informada em --empresa" };
    }

    const usadas = new Set((existentes ?? []).map((e) => e.company_id).filter(Boolean));
    if (usadas.size === 1) {
      const id = [...usadas][0];
      const achada = empresasAtivas.find((c) => c.id === id);
      if (achada) return { empresa: achada, motivo: "ja usada nas associacoes existentes" };
    }

    if (empresasAtivas.length === 1) {
      return { empresa: empresasAtivas[0], motivo: "unica empresa ativa" };
    }

    throw new Error(
      "Nao da para decidir a empresa sozinho. Empresas ativas:\n" +
        empresasAtivas.map((c) => `  ${c.id}  ${c.name}`).join("\n") +
        '\nRode de novo com --empresa="<nome ou id>".'
    );
  }

  const { empresa, motivo } = resolverEmpresa();
  console.log(`Empresa: ${empresa.name} (${motivo})\n`);

  const novas = [];
  const pulados = [];

  for (const [serieId, info] of porSerie) {
    const nome = nomeSerie.get(serieId);
    const nivel = nome ? nivelDaSerie(nome) : null;
    if (!nivel) {
      pulados.push(`${nome ?? serieId}: serie fora dos niveis conhecidos`);
      continue;
    }

    // Anos ja cobertos por alguma faixa existente nao precisam de nova.
    const faixas = faixasPorSerie.get(serieId) ?? [];
    const descobertos = [];
    for (let ano = info.min; ano <= info.max; ano += 1) {
      if (!faixas.some((f) => f.ano_inicio <= ano && ano <= f.ano_fim)) descobertos.push(ano);
    }
    if (descobertos.length === 0) {
      pulados.push(`${nome}: ${info.min}-${info.max} ja coberto`);
      continue;
    }

    const inicio = Math.min(...descobertos);
    const fim = Math.max(...descobertos);
    novas.push({
      escola_id: ESCOLA_ID,
      serie_id: serieId,
      company_id: empresa.id,
      nivel,
      ano_inicio: inicio,
      ano_fim: fim,
      _nome: nome,
      _empresa: empresa.name
    });
  }

  novas.sort((a, b) => a._nome.localeCompare(b._nome, "pt-BR"));

  console.log("── Associacoes a criar ──");
  for (const n of novas) {
    console.log(`  ${n._nome.padEnd(10)} ${n.ano_inicio}-${n.ano_fim}  ${n.nivel.padEnd(6)} -> ${n._empresa}`);
  }
  if (pulados.length > 0) {
    console.log("\n── Nao criadas ──");
    for (const p of pulados) console.log(`  ${p}`);
  }

  if (!apply) {
    console.log(`\nDry-run: ${novas.length} associacoes seriam criadas. Rode com --apply para gravar.`);
    return;
  }
  if (novas.length === 0) {
    console.log("\nNada a criar.");
    return;
  }

  const linhas = novas.map(({ _nome, _empresa, ...linha }) => linha);
  const { error } = await db.from("historico_niveis_ensino").insert(linhas);
  if (error) throw error;
  console.log(`\n${linhas.length} associacoes criadas.`);
}

main().catch((e) => {
  console.error("\nFALHOU:", e.message);
  process.exit(1);
});
