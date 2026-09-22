/**
 * Importa repasses isaac pela mesma lógica da tela, sem passar pelo navegador.
 *
 * Existe porque o reprocessamento de 2026 são ~16 pares de arquivos por
 * unidade, e fazer isso pela tela um a um é lento e sujeito a erro de seleção.
 * Usa os MESMOS parsers e as MESMAS regras de decisão da action
 * (`analisarRepasseIsaacAction`), então o resultado é idêntico ao da tela.
 *
 * Uso:
 *   node scripts/importar_repasse_isaac.mjs --dir <pasta> [--aplicar]
 *
 * Sem `--aplicar` é ENSAIO: mostra a prévia de cada par e não grava nada.
 * Com `--aplicar`, grava via RPC `importar_repasse_isaac` (transacional).
 *
 * Um repasse bloqueado (divergência de fechamento, ou mensalidade cobrada de
 * bolsista) NUNCA é gravado, nem com `--aplicar` — o bloqueio é o mesmo da
 * tela. O script segue para o próximo par e relata no fim.
 *
 * Os arquivos NÃO são enviados ao Storage por este caminho: quem faz isso é a
 * tela. Para repasse importado por aqui, `arquivo_*_path` fica nulo.
 */
import { readFile, readdir, readFile as lerArquivo } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { PDFParse } from "pdf-parse";

import { parseAnaliticoIsaac, ABA_PARCELAS, ABA_MUDANCAS, validarAnalitico } from "../src/lib/isaac/parse-analitico.ts";
import { parseResumoIsaac, validarResumo } from "../src/lib/isaac/parse-resumo.ts";
import { prepararImportacao } from "../src/lib/isaac/preparar-importacao.ts";
import { normalizarNomeIsaac } from "../src/lib/isaac/normalizar-nome.ts";

const args = process.argv.slice(2);
const dir = args[args.indexOf("--dir") + 1];
const aplicar = args.includes("--aplicar");

if (!dir || args.indexOf("--dir") === -1) {
  console.error("uso: node scripts/importar_repasse_isaac.mjs --dir <pasta> [--aplicar]");
  process.exit(1);
}

async function lerEnv() {
  const env = await lerArquivo(".env.local", "utf8");
  const pega = (nome) => {
    const m = new RegExp(`^${nome}=(\\S+)$`, "m").exec(env);
    return m ? m[1].trim() : null;
  };
  const url = pega("NEXT_PUBLIC_SUPABASE_URL");
  const key = pega("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local");
  return { url, key };
}

async function lerAnalitico(caminho) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const linhas = (nome) => {
    const ws = wb.getWorksheet(nome);
    if (!ws) return [];
    const out = [];
    ws.eachRow((row) => out.push(row.values.slice(1)));
    return out;
  };
  return parseAnaliticoIsaac(linhas(ABA_PARCELAS), linhas(ABA_MUDANCAS));
}

async function lerResumo(caminho) {
  const parser = new PDFParse({ data: await readFile(caminho) });
  try {
    const { text } = await parser.getText();
    return parseResumoIsaac(text);
  } finally {
    await parser.destroy();
  }
}

/** Casa cada .xlsx com o .pdf da mesma unidade e competência. */
async function acharPares(pasta) {
  const arquivos = await readdir(pasta);
  const xlsx = arquivos.filter((f) => f.toLowerCase().endsWith(".xlsx") && f.toLowerCase().includes("analitico"));
  const pdfs = arquivos.filter((f) => f.toLowerCase().endsWith(".pdf") && f.toLowerCase().includes("resumo"));

  const pares = [];
  for (const x of xlsx) {
    // analitico-01-08-2026-epg-trindade[-educacao-infantil].xlsx
    const m = /analitico-\d{2}-(\d{2})-(\d{4})-(.+)\.xlsx$/i.exec(x);
    if (!m) continue;
    const [, mes, ano, unidadeSlug] = m;
    const competencia = `${ano}-${mes}`;

    // O resumo não traz mês no nome de forma confiável ("resumo-x 8.pdf"), e a
    // competência de verdade está DENTRO do PDF — então lê todos e casa pelo
    // conteúdo, que é o único critério que não mente.
    let pdfCasado = null;
    for (const p of pdfs) {
      const slugPdf = p.toLowerCase().replace(/^resumo-/, "").replace(/\s*\d*\.pdf$/, "");
      if (slugPdf !== unidadeSlug.toLowerCase()) continue;
      const resumo = await lerResumo(path.join(pasta, p));
      if (resumo.competencia === competencia) { pdfCasado = { arquivo: p, resumo }; break; }
    }
    pares.push({ xlsx: x, competencia, unidadeSlug, pdf: pdfCasado });
  }
  pares.sort((a, b) => a.competencia.localeCompare(b.competencia) || a.unidadeSlug.localeCompare(b.unidadeSlug));
  return pares;
}

const money = (v) => `R$ ${Number(v).toFixed(2)}`;

(async () => {
  const { url, key } = await lerEnv();
  const sb = createClient(url, key);
  console.log(`Banco: ${url}`);
  console.log(aplicar ? "Modo: APLICAR (vai gravar)\n" : "Modo: ENSAIO (nada é gravado)\n");

  const { data: unidades } = await sb.from("isaac_unidade").select("id, nome_isaac, company_id");
  if (!unidades?.length) throw new Error("Nenhuma unidade isaac configurada.");

  const { data: alunosRaw } = await sb
    .from("alunos")
    .select("id, nome_normalizado, matriculas(tipo_vaga, valor_mensalidade_praticado, ano_letivo, status)");
  const alunos = (alunosRaw ?? []).map((a) => {
    const ativa = (a.matriculas ?? [])
      .filter((m) => m.status === "ativa")
      .sort((x, y) => Number(y.ano_letivo ?? 0) - Number(x.ano_letivo ?? 0))[0];
    return {
      id: a.id,
      nomeNormalizado: String(a.nome_normalizado ?? "").replace(/\s+/g, " ").trim(),
      tipoVaga: ativa?.tipo_vaga ?? null,
      valorMensalidadePraticado: ativa?.valor_mensalidade_praticado ?? null,
    };
  });

  const { data: aliasRaw } = await sb.from("aluno_alias").select("aluno_id, nome_normalizado").eq("fonte", "isaac");
  const aliases = new Map((aliasRaw ?? []).map((r) => [r.nome_normalizado, r.aluno_id]));

  const pares = await acharPares(dir);
  console.log(`${pares.length} analítico(s) encontrado(s) em ${dir}\n`);

  const relatorio = [];
  for (const par of pares) {
    const rotulo = `${par.unidadeSlug} ${par.competencia}`;
    if (!par.pdf) {
      console.log(`SEM RESUMO  ${rotulo} — o .pdf daquela competência não está na pasta; pulando.`);
      relatorio.push({ rotulo, situacao: "sem resumo" });
      continue;
    }

    const analitico = await lerAnalitico(path.join(dir, par.xlsx));
    const resumo = par.pdf.resumo;

    const problemas = [
      ...validarAnalitico(analitico).map((d) => `analítico: ${d.o_que}`),
      ...validarResumo(resumo).map((d) => `resumo: ${d.o_que}`),
    ];
    if (problemas.length) {
      console.log(`ARQUIVO RUIM ${rotulo}: ${problemas.join(" | ")}`);
      relatorio.push({ rotulo, situacao: "arquivo não fecha" });
      continue;
    }

    // A unidade vem do nome que o isaac escreve DENTRO do resumo, não do nome
    // do arquivo: o arquivo pode ser renomeado, o conteúdo não.
    const unidade = unidades.find((u) => u.nome_isaac === resumo.unidade);
    if (!unidade) {
      console.log(`UNIDADE DESCONHECIDA ${rotulo}: "${resumo.unidade}" não está em isaac_unidade.`);
      relatorio.push({ rotulo, situacao: "unidade não configurada" });
      continue;
    }

    const preparo = prepararImportacao(analitico, resumo, alunos, aliases);
    const c = preparo.resumoContagens;
    console.log(`${resumo.unidade} · ${resumo.competencia}`);
    console.log(`  total ${money(resumo.total)} | ${c.total} parcelas | ${c.viramCobranca} viram cobrança | ${c.estornos} estorno(s)`);
    if (c.semAluno) console.log(`  ${c.semAluno} sem aluno`);
    if (c.permutaManual) console.log(`  ${c.permutaManual} permuta para revisão`);

    if (preparo.bloqueios.length) {
      for (const b of preparo.bloqueios) console.log(`  BLOQUEIO: ${b.o_que}`);
      relatorio.push({ rotulo: `${resumo.unidade} ${resumo.competencia}`, situacao: "BLOQUEADO" });
      console.log("");
      continue;
    }

    if (!aplicar) {
      console.log("  (ensaio — não gravado)\n");
      relatorio.push({ rotulo: `${resumo.unidade} ${resumo.competencia}`, situacao: "pronto para importar" });
      continue;
    }

    const payload = {
      unidade_id: unidade.id,
      competencia_repasse: resumo.competencia,
      data_repasse: resumo.transferencias[0]?.data ?? `${resumo.competencia}-05`,
      bruto: analitico.totais.mensalidades,
      ajustes: analitico.totais.mudancas,
      base: analitico.totais.base,
      taxa: analitico.totais.taxa,
      liquido: resumo.total,
      alunos_informados: resumo.alunosInformados,
      cobrancas_informadas: resumo.cobrancasInformadas,
      linhas: resumo.linhas,
      transferencias: resumo.transferencias,
      mudancas: analitico.mudancas,
      parcelas: preparo.parcelas,
    };

    const { data, error } = await sb.rpc("importar_repasse_isaac", { p_payload: payload });
    if (error) throw new Error(`${rotulo}: ${error.message}`);
    if (!data?.ok) throw new Error(`${rotulo}: ${data?.error ?? "falha ao importar"}`);
    console.log(`  IMPORTADO: ${data.cobrancas} cobrança(s), ${data.pendencias} pendência(s)\n`);
    relatorio.push({ rotulo: `${resumo.unidade} ${resumo.competencia}`, situacao: `importado (${data.cobrancas} cobranças)` });
  }

  console.log("\n=== RESUMO ===");
  for (const r of relatorio) console.log(`  ${r.situacao.padEnd(28)} ${r.rotulo}`);
  void normalizarNomeIsaac;
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
