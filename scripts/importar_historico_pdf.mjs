/**
 * Importa historicos escolares dos PDFs (modelo EPG) para historico_escolar /
 * historico_anos / historico_notas.
 *
 * O PDF traz o historico ACUMULADO de cada aluno: todos os anos cursados, com
 * as notas como o documento original registrou (escola anterior costuma usar
 * escala 0-100, a EPG usa 0-10 — nao convertemos nada).
 *
 * Aluno e casado por CPF. Quem nao existir na base e pulado e listado no fim.
 * Ano ja congelado no sistema nunca e sobrescrito.
 *
 * Uso:
 *   node scripts/importar_historico_pdf.mjs <pasta-ou-pdf>             # dry-run
 *   node scripts/importar_historico_pdf.mjs <pasta-ou-pdf> --apply     # grava
 */

import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsearPdf } from "./lib/historico-pdf.mjs";
// Regra unica de congelamento do projeto — nao duplicar aqui.
import { deveCongelar } from "../src/lib/historico/congelamento.ts";

const ESCOLA_ID = "00000000-0000-0000-0000-000000000001";

/** Prefixo da serie -> nivel de ensino da tabela historico_escolar. */
function nivelDaSerie(serieNome) {
  if (/^[1-5]º ANO$/.test(serieNome)) return "fund1";
  if (/^[6-9]º ANO$/.test(serieNome)) return "fund2";
  if (/^[1-3]ª SÉRIE$/.test(serieNome)) return "medio";
  return null;
}

/** Nome comparavel: sem acento, maiusculo, sem espaco duplicado. */
function chaveDisciplina(nome) {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Uma importacao faz milhares de requisicoes; uma queda de conexao no meio
 * derrubava o lote inteiro. Reexecuta o que for transitorio.
 */
async function comRetry(rotulo, fn, tentativas = 4) {
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tentativas) throw new Error(`${rotulo}: ${e.message}`);
      const espera = 500 * 2 ** (i - 1);
      console.log(`   … ${rotulo} falhou (${e.message}); retry ${i}/${tentativas - 1} em ${espera}ms`);
      await new Promise((r) => setTimeout(r, espera));
    }
  }
}

function loadEnvFile(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function listarPdfs(alvo) {
  const path = resolve(alvo);
  if (!existsSync(path)) throw new Error(`Caminho nao encontrado: ${path}`);
  if (statSync(path).isFile()) return [path];
  return readdirSync(path)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort()
    .map((f) => join(path, f));
}

async function lerPdf(arquivo) {
  const parser = new PDFParse({ data: readFileSync(arquivo) });
  const { pages } = await parser.getText();
  return parsearPdf(pages);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const alvo = args.find((a) => !a.startsWith("--"));
  if (!alvo) {
    console.error("Uso: node scripts/importar_historico_pdf.mjs <pasta-ou-pdf> [--apply]");
    process.exit(1);
  }

  loadEnvFile(".env.local");
  loadEnvFile(".env");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Base: ${url}`);
  console.log(apply ? "Modo: APLICANDO\n" : "Modo: DRY-RUN (nada sera gravado)\n");

  // Indices: CPF -> aluno, e nome de disciplina -> id (para ligar quando existir).
  const { data: alunosBase, error: erroAlunos } = await db
    .from("alunos")
    .select("id, nome, cpf, matricula_codigo")
    .eq("escola_id", ESCOLA_ID);
  if (erroAlunos) throw erroAlunos;
  const porCpf = new Map();
  for (const a of alunosBase ?? []) {
    const cpf = String(a.cpf ?? "").replace(/\D/g, "");
    if (cpf) porCpf.set(cpf, a);
  }

  const { data: disciplinasBase, error: erroDisc } = await db
    .from("disciplinas")
    .select("id, nome")
    .eq("escola_id", ESCOLA_ID);
  if (erroDisc) throw erroDisc;
  // O cadastro guarda os nomes sem acento ("MATEMATICA") e o PDF traz com
  // ("MATEMÁTICA"); comparamos normalizado. Ha varias linhas por disciplina
  // (uma por serie/turma) — qualquer id serve, e so para o vinculo opcional.
  const porDisciplina = new Map();
  for (const d of disciplinasBase ?? []) {
    const chave = chaveDisciplina(d.nome);
    if (chave && !porDisciplina.has(chave)) porDisciplina.set(chave, d.id);
  }

  const naoEncontrados = [];
  const congeladosPreservados = [];
  let totAlunos = 0;
  let totAnos = 0;
  let totNotas = 0;

  for (const arquivo of listarPdfs(alvo)) {
    const registros = await lerPdf(arquivo);
    console.log(`\n── ${arquivo.split(/[\\/]/).pop()} (${registros.length} alunos)`);

    for (const { aluno, anos } of registros) {
      const base = aluno.cpf ? porCpf.get(aluno.cpf) : null;
      if (!base) {
        naoEncontrados.push({ ...aluno, arquivo });
        continue;
      }

      // Um historico por nivel: os anos do PDF se distribuem entre fund1/fund2/medio.
      const porNivel = new Map();
      for (const ano of anos) {
        const nivel = nivelDaSerie(ano.serieNome);
        if (!nivel) continue;
        if (!porNivel.has(nivel)) porNivel.set(nivel, []);
        porNivel.get(nivel).push(ano);
      }

      for (const [nivel, anosDoNivel] of porNivel) {
        let historicoId = null;

        if (apply) {
          const existente = await comRetry(`busca historico ${base.nome}`, async () => {
            const { data, error } = await db
              .from("historico_escolar")
              .select("id")
              .eq("escola_id", ESCOLA_ID)
              .eq("aluno_id", base.id)
              .eq("nivel", nivel)
              .maybeSingle();
            if (error) throw error;
            return data;
          });

          if (existente) {
            historicoId = existente.id;
          } else {
            const criado = await comRetry(`cria historico ${base.nome}`, async () => {
              const { data, error } = await db
                .from("historico_escolar")
                .insert({ escola_id: ESCOLA_ID, aluno_id: base.id, nivel })
                .select("id")
                .single();
              if (error) throw error;
              return data;
            });
            historicoId = criado.id;
          }
        }

        // Em lote por aluno: uma ida ao banco por operacao, nao por ano. Com
        // ~1500 anos, o modo ano-a-ano fazia milhares de requisicoes e a
        // conexao caia no meio do lote.
        let congelados = new Set();
        if (apply) {
          const existentes = await comRetry(`checa anos ${base.nome}`, async () => {
            const { data, error } = await db
              .from("historico_anos")
              .select("ano, congelado")
              .eq("historico_id", historicoId);
            if (error) throw error;
            return data ?? [];
          });
          congelados = new Set(existentes.filter((a) => a.congelado).map((a) => a.ano));
        }

        const aGravar = anosDoNivel.filter((ano) => {
          // Ano congelado = nota ja fechada pela secretaria; o PDF nao vence isso.
          if (congelados.has(ano.ano)) {
            congeladosPreservados.push({ aluno: base.nome, ano: ano.ano });
            return false;
          }
          return true;
        });

        totAnos += aGravar.length;
        totNotas += aGravar.reduce((s, a) => s + a.notas.length, 0);
        if (!apply || aGravar.length === 0) continue;

        const linhasAno = aGravar.map((ano) => {
          const origem = /EPG/i.test(ano.instituicao ?? "") ? "interna" : "externa";
          return {
            historico_id: historicoId,
            ano: ano.ano,
            serie_nome: ano.serieNome,
            origem,
            instituicao: ano.instituicao,
            cidade: ano.cidade,
            uf: ano.uf,
            resultado: ano.resultado,
            carga_horaria: ano.cargaHoraria,
            dias_letivos: ano.diasLetivos,
            // Ano ja encerrado precisa nascer congelado: sem isso a emissao
            // ignora a nota importada e vai buscar em notas_consolidadas, que
            // so tem o ano corrente — as colunas saiam vazias no PDF.
            congelado: deveCongelar(ano.resultado, origem)
          };
        });

        const anosGravados = await comRetry(`grava anos ${base.nome}`, async () => {
          const { data, error } = await db
            .from("historico_anos")
            .upsert(linhasAno, { onConflict: "historico_id,ano" })
            .select("id, ano");
          if (error) throw error;
          return data ?? [];
        });

        const idPorAno = new Map(anosGravados.map((r) => [r.ano, r.id]));

        // Regrava as notas (o PDF e a fonte para anos nao congelados).
        await comRetry(`limpa notas ${base.nome}`, async () => {
          const { error } = await db
            .from("historico_notas")
            .delete()
            .in("historico_ano_id", [...idPorAno.values()]);
          if (error) throw error;
        });

        const linhasNota = aGravar.flatMap((ano) =>
          ano.notas.map((n) => ({
            historico_ano_id: idPorAno.get(ano.ano),
            disciplina_id: porDisciplina.get(chaveDisciplina(n.disciplinaNome)) ?? null,
            disciplina_nome: n.disciplinaNome,
            nota: n.nota,
            carga_horaria: n.cargaHoraria,
            ordem: n.ordem
          }))
        );
        if (linhasNota.length > 0) {
          await comRetry(`grava notas ${base.nome}`, async () => {
            const { error } = await db.from("historico_notas").insert(linhasNota);
            if (error) throw error;
          });
        }
      }

      totAlunos += 1;
    }
  }

  console.log("\n════ RESUMO ════");
  console.log(`Alunos casados por CPF : ${totAlunos}`);
  console.log(`Anos de historico      : ${totAnos}`);
  console.log(`Notas                  : ${totNotas}`);
  console.log(`CPF nao encontrado     : ${naoEncontrados.length}`);
  console.log(`Anos congelados mantidos: ${congeladosPreservados.length}`);

  if (naoEncontrados.length > 0) {
    console.log("\n── Alunos do PDF sem cadastro na base (nao importados) ──");
    for (const a of naoEncontrados) {
      console.log(`  ${a.cpf}  ${a.nome}  (matricula ${a.matricula ?? "-"})`);
    }
  }

  if (congeladosPreservados.length > 0) {
    console.log("\n── Anos congelados preservados (PDF ignorado) ──");
    for (const c of congeladosPreservados) console.log(`  ${c.aluno} — ${c.ano}`);
  }

  if (!apply) console.log("\nDry-run. Rode com --apply para gravar.");
}

main().catch((e) => {
  console.error("\nFALHOU:", e.message);
  process.exit(1);
});
