/**
 * Remove as matriculas duplicadas que o historico escolar oficial identifica.
 *
 * PROBLEMA
 * O importador do sistema antigo derivou ano_letivo de year(data_matricula).
 * Como a escola matricula de set-dez PARA o ano seguinte, parte do historico
 * ficou um ano atrasado. Producao ja passou pela correcao de 10/09 (commit
 * 14008cf3), que reconstruiu o ano pela progressao de series, mas sobraram 132
 * divergencias em 27 alunos.
 *
 * ESCOPO DESTE SCRIPT
 * Trata SO o caso inequivoco: a serie aparece DUAS vezes para o mesmo aluno —
 * uma no ano que o PDF confirma e outra num ano deslocado. A deslocada e
 * residuo da importacao e e removida; a correta fica.
 *
 * Nao move matricula de ano. Os outros dois casos ficam de fora por decisao do
 * usuario (2026-09-19):
 *  - trajetoria inteira deslocada sem duplicata (11 alunos): mover empurraria a
 *    ultima matricula para 2027, criando ano letivo futuro para ex-aluno;
 *  - historico com buraco ou repetencia (5 alunos): corrigir seria adivinhar.
 * Ambos saem no relatorio para a secretaria tratar pela tela.
 *
 * SEGURANCA
 * Dry-run por padrao. So remove linha SEM cobranca, pagamento, nota ou
 * frequencia vinculada, reconferido no momento da remocao. Deleta uma a uma,
 * por id — nunca em massa, porque matriculas cascateia para cinco tabelas.
 *
 * Uso:
 *   node scripts/corrigir_ano_letivo_pelo_pdf.mjs "C:/.../histo"
 *   node scripts/corrigir_ano_letivo_pelo_pdf.mjs "C:/.../histo" --apply
 *   node scripts/corrigir_ano_letivo_pelo_pdf.mjs "C:/.../histo" --apply --producao
 */

import { createClient } from "@supabase/supabase-js";
import { extrairParesDePasta, construirIndice, normalizarSerie } from "./lib/historico-pdf-indice.mjs";
import { lerEnv, lerTudo } from "./conferir_ano_letivo.mjs";

const ESCOLA_ID = "00000000-0000-0000-0000-000000000001";

/** Map<matricula_codigo, Map<serieNormalizada, ano>> a partir do indice dos PDFs. */
export function trajetoriasDoPdf(indice) {
  const porAluno = new Map();
  for (const [chave, serie] of indice) {
    const [codigo, ano] = chave.split("|");
    if (!porAluno.has(codigo)) porAluno.set(codigo, new Map());
    porAluno.get(codigo).set(serie, Number(ano));
  }
  return porAluno;
}

/**
 * Seleciona as linhas a remover: serie repetida para o mesmo aluno, com uma das
 * ocorrencias no ano que o PDF confirma. Remove as demais ocorrencias.
 *
 * Serie repetida SEM nenhuma ocorrencia no ano do PDF nao e tocada: pode ser
 * repetencia real, e o documento nao autoriza escolher qual linha e a boa.
 */
export function planejarRemocoes(matriculasPorAluno, pdfPorAluno) {
  const remover = [];
  const revisar = [];

  for (const [codigo, linhas] of matriculasPorAluno) {
    const doPdf = pdfPorAluno.get(codigo);
    if (!doPdf) continue;

    const porSerie = new Map();
    for (const linha of linhas) {
      if (!porSerie.has(linha.serie)) porSerie.set(linha.serie, []);
      porSerie.get(linha.serie).push(linha);
    }

    for (const [serie, ocorrencias] of porSerie) {
      if (ocorrencias.length < 2) continue;
      const anoPdf = doPdf.get(serie);
      if (anoPdf === undefined) {
        revisar.push({ codigo, serie, motivo: "serie repetida que o PDF nao cobre" });
        continue;
      }
      const corretas = ocorrencias.filter((o) => o.ano === anoPdf);
      if (corretas.length === 0) {
        revisar.push({ codigo, serie, motivo: `serie repetida, nenhuma no ano ${anoPdf} do PDF` });
        continue;
      }
      for (const o of ocorrencias.filter((x) => x.ano !== anoPdf)) {
        remover.push({ ...o, codigo, anoCorreto: anoPdf });
      }
    }
  }
  return { remover, revisar };
}

/** Ids que alguma tabela dependente referencia. */
async function idsComVinculo(db, ids) {
  const comVinculo = new Set();
  for (const tabela of ["cobrancas", "pagamentos", "notas", "frequencias"]) {
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100);
      const { data, error } = await db.from(tabela).select("matricula_id").in("matricula_id", lote);
      if (error) throw new Error(`${tabela}: ${error.message}`);
      for (const r of data) comVinculo.add(r.matricula_id);
    }
  }
  return comVinculo;
}

async function main() {
  const pastaPdfs = process.argv[2];
  if (!pastaPdfs) throw new Error("Informe a pasta dos PDFs");
  const apply = process.argv.includes("--apply");
  const producao = process.argv.includes("--producao");

  const env = lerEnv(producao);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  console.log(`Base: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(producao ? "*** PRODUCAO ***" : "Local");
  console.log(apply ? "Modo: APLICANDO\n" : "Modo: DRY-RUN (nada sera gravado)\n");

  const indice = construirIndice(await extrairParesDePasta(pastaPdfs));
  if (indice.size === 0) {
    throw new Error(
      `Nenhum par lido dos PDFs. A pasta "${pastaPdfs}" nao contem subpastas ` +
      `no formato <ano> com arquivos .pdf dentro. Verifique o caminho.`
    );
  }
  const pdfPorAluno = trajetoriasDoPdf(indice);

  const brutas = await lerTudo(() =>
    db.from("matriculas")
      .select("id, ano_letivo, status, alunos(matricula_codigo), series(nome)")
      .eq("escola_id", ESCOLA_ID)
  );
  const porAluno = new Map();
  for (const b of brutas) {
    const codigo = String(b.alunos?.matricula_codigo ?? "");
    if (!porAluno.has(codigo)) porAluno.set(codigo, []);
    porAluno.get(codigo).push({
      id: b.id,
      ano: b.ano_letivo,
      status: b.status,
      serie: normalizarSerie(b.series?.nome)
    });
  }

  const { remover, revisar } = planejarRemocoes(porAluno, pdfPorAluno);

  const comVinculo = remover.length > 0
    ? await idsComVinculo(db, remover.map((r) => r.id))
    : new Set();
  const seguras = remover.filter((r) => !comVinculo.has(r.id));
  const retidas = remover.filter((r) => comVinculo.has(r.id));

  console.log("-- duplicatas a remover --");
  for (const r of seguras) {
    console.log(`  mat ${String(r.codigo).padEnd(6)} ${r.serie.padEnd(10)} ano ${r.ano} (correto: ${r.anoCorreto}) status=${r.status}`);
  }

  if (retidas.length > 0) {
    console.log("\n-- RETIDAS (tem cobranca/nota/frequencia vinculada) --");
    for (const r of retidas) {
      console.log(`  mat ${String(r.codigo).padEnd(6)} ${r.serie.padEnd(10)} ano ${r.ano}`);
    }
  }

  if (revisar.length > 0) {
    console.log("\n-- para a secretaria revisar (nao tocadas) --");
    for (const r of revisar.slice(0, 20)) {
      console.log(`  mat ${String(r.codigo).padEnd(6)} ${r.serie.padEnd(10)} ${r.motivo}`);
    }
    if (revisar.length > 20) console.log(`  ... mais ${revisar.length - 20}`);
  }

  console.log(`\nremover: ${seguras.length} | retidas: ${retidas.length} | revisar: ${revisar.length}`);

  if (!apply) {
    console.log("\nDry-run. Rode com --apply para gravar.");
    return;
  }
  if (seguras.length === 0) {
    console.log("\nNada a remover.");
    return;
  }

  let feitas = 0;
  for (const r of seguras) {
    const { error } = await db.from("matriculas").delete().eq("id", r.id);
    if (error) throw new Error(`matricula ${r.codigo} (${r.id}): ${error.message}`);
    feitas += 1;
  }
  console.log(`\n${feitas} duplicatas removidas (uma a uma, por id).`);
}

if (process.argv[1]?.endsWith("corrigir_ano_letivo_pelo_pdf.mjs")) {
  main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });
}
