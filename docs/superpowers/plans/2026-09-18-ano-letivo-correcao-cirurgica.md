# Correção Cirúrgica do Ano Letivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir as 132 matrículas cujo `ano_letivo` diverge do histórico escolar oficial, e impedir que o defeito volte pela tela de nova matrícula.

**Architecture:** Os PDFs de histórico da escola (136 arquivos, 2009–2025) são a fonte de verdade. Um módulo extrai deles 3.139 pares `(matrícula, ano, série)`; um script compara a base com esses pares e corrige apenas onde há conflito. Nada de deslocamento em massa — produção já passou por isso em 10/09 e um segundo deslocamento a quebraria.

**Tech Stack:** Node.js ESM, `@supabase/supabase-js`, `pdf-parse` v2, `node --test`, Vitest (para o componente React).

**Spec:** `docs/superpowers/specs/2026-09-18-ano-letivo-corte-matricula-design.md`

## Global Constraints

- **Nunca** rodar `supabase db reset --local` — quebra na ordem das migrations. Usar `db push`.
- **Avisar o usuário antes** de rodar `npm run build` ou `npm run dev` — corrompe o `.next` do dev server em execução.
- O PDF é fonte de verdade sobre a matrícula quando os dois divergem.
- Todo script de escrita roda **dry-run por padrão**; grava só com `--apply`.
- `escola_id` fixo: `00000000-0000-0000-0000-000000000001`.
- Scripts carregam env com a regra "primeira ocorrência vence" (`if (!process.env[k])`), que faz `.env.local` apontar para o banco local. Produção exige `--producao` explícito.
- Comentários e mensagens em português, sem acento em nome de arquivo ou identificador.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `scripts/lib/historico-pdf-indice.mjs` | Extrai e indexa `(matrícula, ano, série)` dos PDFs. Sem I/O de banco. |
| `scripts/tests/historico-pdf-indice.test.mjs` | Testes do indexador. |
| `scripts/conferir_ano_letivo.mjs` | Relatório read-only: compara base × PDFs, classifica divergências. |
| `scripts/alinhar_local_com_producao.mjs` | Traz o local ao estado de produção por UPDATE/INSERT, sem apagar vínculo. |
| `scripts/corrigir_ano_letivo_pelo_pdf.mjs` | Correção cirúrgica, dry-run por padrão. |
| `src/lib/matriculas/ano-letivo.ts` | Regra do corte 01/09. Pura, testável. |
| `src/lib/matriculas/ano-letivo.test.ts` | Testes da regra. |
| `src/components/matriculas/nova-matricula-fields.tsx` | Passa a usar a regra; campo editável. |

---

## Task 1: Indexador de PDFs

**Files:**
- Create: `scripts/lib/historico-pdf-indice.mjs`
- Test: `scripts/tests/historico-pdf-indice.test.mjs`

**Interfaces:**
- Consumes: `parsearPdf(paginas)` de `scripts/lib/historico-pdf.mjs` (já existe; recebe o array `pages` de `new PDFParse({data}).getText()`, devolve `[{aluno:{nome,matricula,...}, anos:[{ano,serie,coluna,...}]}]`).
- Produces:
  - `chaveIndice(matricula, ano)` → `string`
  - `normalizarSerie(nome)` → `string` (maiúscula, sem acento, espaços colapsados)
  - `construirIndice(pares)` → `Map<string, string>` de `"mat|ano"` para série normalizada
  - `extrairParesDeArquivo(caminho)` → `Promise<Array<{mat, ano, serie}>>`
  - `extrairParesDePasta(raiz)` → `Promise<Array<{mat, ano, serie}>>` (varre subpastas `/^\d{4}$/`, deduplica)

- [ ] **Step 1: Escrever o teste que falha**

```javascript
// scripts/tests/historico-pdf-indice.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveIndice, normalizarSerie, construirIndice } from "../lib/historico-pdf-indice.mjs";

test("normalizarSerie tira acento e padroniza espacos", () => {
  assert.equal(normalizarSerie("1ª Série"), "1A SERIE");
  assert.equal(normalizarSerie("  3º   ANO "), "3O ANO");
  assert.equal(normalizarSerie(null), "");
});

test("chaveIndice junta matricula e ano", () => {
  assert.equal(chaveIndice("1204", 2026), "1204|2026");
  assert.equal(chaveIndice(1204, 2026), "1204|2026");
});

test("construirIndice mapeia par para serie normalizada", () => {
  const idx = construirIndice([
    { mat: "1259", ano: 2025, serie: "1º ANO" },
    { mat: "1259", ano: 2026, serie: "2º ANO" }
  ]);
  assert.equal(idx.get("1259|2025"), "1O ANO");
  assert.equal(idx.get("1259|2026"), "2O ANO");
  assert.equal(idx.size, 2);
});

test("construirIndice ignora par sem ano ou sem serie", () => {
  const idx = construirIndice([
    { mat: "1", ano: null, serie: "1º ANO" },
    { mat: "2", ano: 2025, serie: null },
    { mat: "3", ano: 2025, serie: "1º ANO" }
  ]);
  assert.equal(idx.size, 1);
  assert.ok(idx.has("3|2025"));
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test scripts/tests/historico-pdf-indice.test.mjs`
Expected: FAIL — `Cannot find module '../lib/historico-pdf-indice.mjs'`

- [ ] **Step 3: Implementar o módulo**

```javascript
// scripts/lib/historico-pdf-indice.mjs
/**
 * Indexa os PDFs de historico escolar como fonte de verdade do ano letivo.
 *
 * O sistema antigo nao guarda ano letivo; o PDF de historico guarda, porque
 * lista a trajetoria do aluno ano a ano. Esse indice e o criterio objetivo
 * para decidir em que ano o aluno cursou cada serie.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PDFParse } from "pdf-parse";
import { parsearPdf } from "./historico-pdf.mjs";

/** Maiuscula sem acento, espacos colapsados: casa "1ª Série" com "1A SERIE". */
export function normalizarSerie(nome) {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function chaveIndice(matricula, ano) {
  return `${String(matricula)}|${ano}`;
}

/** Map "mat|ano" -> serie normalizada. Pares incompletos sao descartados. */
export function construirIndice(pares) {
  const indice = new Map();
  for (const p of pares) {
    if (!p.mat || !p.ano || !p.serie) continue;
    indice.set(chaveIndice(p.mat, p.ano), normalizarSerie(p.serie));
  }
  return indice;
}

export async function extrairParesDeArquivo(caminho) {
  const { pages } = await new PDFParse({ data: readFileSync(caminho) }).getText();
  const pares = [];
  for (const registro of parsearPdf(pages)) {
    const mat = registro.aluno?.matricula;
    if (!mat) continue;
    for (const ano of registro.anos ?? []) {
      const serie = ano.serie ?? ano.coluna;
      if (ano.ano && serie) pares.push({ mat: String(mat), ano: Number(ano.ano), serie });
    }
  }
  return pares;
}

/** Varre <raiz>/<ano>/*.pdf. Deduplica: o mesmo aluno aparece em varios PDFs. */
export async function extrairParesDePasta(raiz) {
  const vistos = new Set();
  const pares = [];
  for (const pasta of readdirSync(raiz).filter((d) => /^\d{4}$/.test(d))) {
    for (const arquivo of readdirSync(join(raiz, pasta)).filter((f) => f.endsWith(".pdf"))) {
      for (const p of await extrairParesDeArquivo(join(raiz, pasta, arquivo))) {
        const chave = `${p.mat}|${p.ano}|${normalizarSerie(p.serie)}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        pares.push(p);
      }
    }
  }
  return pares;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test scripts/tests/historico-pdf-indice.test.mjs`
Expected: PASS — 4 testes.

- [ ] **Step 5: Verificar contra os PDFs reais**

Run:
```bash
node -e "import('./scripts/lib/historico-pdf-indice.mjs').then(async m => {
  const p = await m.extrairParesDePasta('C:/Users/rodri/OneDrive/Desktop/histo');
  console.log('pares:', p.length, '| alunos:', new Set(p.map(x=>x.mat)).size);
})"
```
Expected: `pares: 3139 | alunos: 554`

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/historico-pdf-indice.mjs scripts/tests/historico-pdf-indice.test.mjs
git commit -m "feat(scripts): indexa PDFs de historico como fonte de verdade do ano letivo"
```

---

## Task 2: Relatório de conferência (read-only)

**Files:**
- Create: `scripts/conferir_ano_letivo.mjs`

**Interfaces:**
- Consumes: `extrairParesDePasta`, `construirIndice`, `chaveIndice`, `normalizarSerie` da Task 1.
- Produces: CLI `node scripts/conferir_ano_letivo.mjs <pasta-pdfs> [--producao] [--csv arquivo.csv]`. Não escreve no banco.

Classifica cada matrícula em: `confere`, `conflito` (PDF diz outra série), `ausente-infantil` (PDF não cobre o nível), `ausente-outro`, `aluno-fora-do-pdf`.

- [ ] **Step 1: Implementar o script**

```javascript
// scripts/conferir_ano_letivo.mjs
/**
 * Compara o ano_letivo das matriculas com o historico escolar oficial.
 *
 * Read-only: nao grava nada. Serve para medir a divergencia antes e depois
 * da correcao, e para gerar a planilha que a secretaria confere.
 *
 * Uso:
 *   node scripts/conferir_ano_letivo.mjs "C:/.../histo"
 *   node scripts/conferir_ano_letivo.mjs "C:/.../histo" --producao
 *   node scripts/conferir_ano_letivo.mjs "C:/.../histo" --csv relatorio.csv
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  extrairParesDePasta, construirIndice, chaveIndice, normalizarSerie
} from "./lib/historico-pdf-indice.mjs";

const ESCOLA_ID = "00000000-0000-0000-0000-000000000001";
const INFANTIL = /INFANTIL|MATERNAL|BERC|CRECHE|PRE/;

/**
 * Le .env.local. Com --producao fica com a ULTIMA ocorrencia de cada chave
 * (o bloco cloud), senao com a PRIMEIRA (o bloco local) — mesma regra dos
 * outros scripts do projeto, que protege contra apontar para producao sem querer.
 */
export function lerEnv(producao) {
  const caminho = resolve(process.cwd(), ".env.local");
  if (!existsSync(caminho)) throw new Error("Falta .env.local");
  const env = {};
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (producao || env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** PostgREST devolve no maximo 1000 linhas por requisicao. */
export async function lerTudo(query) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await query().range(de, de + 999);
    if (error) throw error;
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  return linhas;
}

export function classificar(matricula, indice, matriculasNoPdf) {
  const mat = String(matricula.codigo ?? "");
  if (!matriculasNoPdf.has(mat)) return { classe: "aluno-fora-do-pdf" };
  const serieBase = normalizarSerie(matricula.serie);
  const seriePdf = indice.get(chaveIndice(mat, matricula.ano_letivo));
  if (!seriePdf) {
    return { classe: INFANTIL.test(serieBase) ? "ausente-infantil" : "ausente-outro" };
  }
  if (seriePdf === serieBase) return { classe: "confere" };
  return { classe: "conflito", seriePdf };
}

/** Em que ano o PDF diz que o aluno cursou esta serie? */
export function anoCorretoSegundoPdf(mat, serieNormalizada, indice) {
  const anos = [];
  for (const [chave, serie] of indice) {
    const [m, ano] = chave.split("|");
    if (m === mat && serie === serieNormalizada) anos.push(Number(ano));
  }
  return anos.length === 1 ? anos[0] : null;
}

async function main() {
  const pastaPdfs = process.argv[2];
  if (!pastaPdfs) throw new Error("Informe a pasta dos PDFs");
  const producao = process.argv.includes("--producao");
  const csv = process.argv.find((a) => a.startsWith("--csv"))
    ? process.argv[process.argv.indexOf("--csv") + 1]
    : null;

  const env = lerEnv(producao);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  console.log(`Base: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(producao ? "*** PRODUCAO (somente leitura) ***\n" : "Local\n");

  const indice = construirIndice(await extrairParesDePasta(pastaPdfs));
  const matriculasNoPdf = new Set([...indice.keys()].map((k) => k.split("|")[0]));
  console.log(`PDFs: ${indice.size} pares, ${matriculasNoPdf.size} alunos\n`);

  const matriculas = await lerTudo(() =>
    db.from("matriculas")
      .select("id, ano_letivo, data_matricula, alunos(matricula_codigo), series(nome)")
      .eq("escola_id", ESCOLA_ID)
  );

  const contagem = {};
  const conflitos = [];
  for (const m of matriculas) {
    const registro = {
      id: m.id,
      codigo: m.alunos?.matricula_codigo,
      serie: m.series?.nome,
      ano_letivo: m.ano_letivo,
      data_matricula: m.data_matricula
    };
    const r = classificar(registro, indice, matriculasNoPdf);
    contagem[r.classe] = (contagem[r.classe] ?? 0) + 1;
    if (r.classe === "conflito") {
      conflitos.push({
        ...registro,
        serie_pdf: r.seriePdf,
        ano_correto: anoCorretoSegundoPdf(
          String(registro.codigo), normalizarSerie(registro.serie), indice
        )
      });
    }
  }

  const comparaveis = matriculas.length - (contagem["aluno-fora-do-pdf"] ?? 0);
  const confere = contagem["confere"] ?? 0;
  console.log(`total de matriculas      : ${matriculas.length}`);
  console.log(`comparaveis com o PDF    : ${comparaveis}`);
  console.log(`  conferem               : ${confere} (${(100 * confere / comparaveis).toFixed(1)}%)`);
  console.log(`  conflito de serie      : ${contagem["conflito"] ?? 0}`);
  console.log(`  ausente (infantil)     : ${contagem["ausente-infantil"] ?? 0}  [PDF nao cobre o nivel]`);
  console.log(`  ausente (outro nivel)  : ${contagem["ausente-outro"] ?? 0}`);

  const corrigiveis = conflitos.filter((c) => c.ano_correto !== null);
  console.log(`\nconflitos com ano determinavel pelo PDF: ${corrigiveis.length} de ${conflitos.length}`);

  const pares = {};
  for (const c of corrigiveis) {
    const k = `${normalizarSerie(c.serie)} (${c.ano_letivo}) -> PDF diz ${c.ano_correto}`;
    pares[k] = (pares[k] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(pares).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(n).padStart(4)}  ${k}`);
  }

  if (csv) {
    const cabecalho = "matricula,serie_base,ano_base,data_matricula,serie_pdf,ano_correto\n";
    const linhas = conflitos
      .map((c) => [c.codigo, c.serie, c.ano_letivo, c.data_matricula, c.serie_pdf, c.ano_correto ?? ""].join(","))
      .join("\n");
    writeFileSync(csv, cabecalho + linhas);
    console.log(`\nCSV: ${csv} (${conflitos.length} linhas)`);
  }
}

// Guarda o main() porque corrigir_ano_letivo_pelo_pdf.mjs importa lerEnv,
// lerTudo e anoCorretoSegundoPdf daqui — sem isto o relatorio inteiro rodaria
// no import. Mesmo padrao de scripts/remover_matriculas_duplicadas.mjs:185.
if (process.argv[1]?.endsWith("conferir_ano_letivo.mjs")) {
  main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });
}
```

- [ ] **Step 2: Rodar contra o local**

Run: `node scripts/conferir_ano_letivo.mjs "C:/Users/rodri/OneDrive/Desktop/histo"`
Expected: imprime a contagem; no local atual a taxa de acerto fica em torno de 22%.

- [ ] **Step 3: Rodar contra produção (somente leitura)**

Run: `node scripts/conferir_ano_letivo.mjs "C:/Users/rodri/OneDrive/Desktop/histo" --producao --csv conflitos-prod.csv`
Expected: ~64% conferem, ~132 conflitos, e o padrão "base uma série à frente".

- [ ] **Step 4: Commit**

```bash
git add scripts/conferir_ano_letivo.mjs
git commit -m "feat(scripts): relatorio de conferencia do ano letivo contra os PDFs"
```

---

## Task 3: Alinhar o banco local com produção

**Files:** nenhum arquivo versionado — operação de dados.

**Interfaces:**
- Consumes: `scripts/conferir_ano_letivo.mjs` da Task 2.
- Produces: banco local equivalente a produção, com o histórico de 18/09 reaplicado.

O local tem 2.657 matrículas e 329 colisões; produção tem 2.284 e zero. Testar a correção contra o local atual mediria um estado que não existe em lugar nenhum.

**ATENÇÃO — não apagar `matriculas`.** Cinco tabelas cascateiam a partir dela:
`cobrancas`, `pagamentos`, `notas`, `frequencias` e `historico_matriculas`, todas
`ON DELETE CASCADE`. Um `DELETE FROM matriculas` levaria junto as 6.032 cobranças que a
correção de 10/09 preservou. O alinhamento é feito por **UPDATE e INSERT seletivos**,
nunca por truncar e restaurar.

- [ ] **Step 1: Backup do local**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c \
  "CREATE TABLE matriculas_local_20260918 AS SELECT * FROM matriculas;"
```

Expected: `SELECT 2657`.

- [ ] **Step 2: Exportar produção para JSON (somente leitura)**

```bash
node -e "
import('./scripts/conferir_ano_letivo.mjs').then(async (m) => {
  const { createClient } = await import('@supabase/supabase-js');
  const env = m.lerEnv(true);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
  const linhas = await m.lerTudo(() => db.from('matriculas').select('*')
    .eq('escola_id','00000000-0000-0000-0000-000000000001'));
  require('fs').writeFileSync('scratch-prod-matriculas.json', JSON.stringify(linhas));
  console.log('producao:', linhas.length);
});"
```

Expected: `producao: 2284`.

- [ ] **Step 3: Alinhar por diferença, preservando os vínculos**

Aplica em três movimentos, dentro de uma transação:
1. **UPDATE** nas matrículas que existem nos dois lados e divergem em `ano_letivo`,
   `serie_id` ou `turma_id` — mantém o `id`, então cobranças e notas seguem ligadas.
2. **INSERT** das que só existem em produção.
3. **DELETE** apenas das que só existem no local **e** não têm cobrança, nota, frequência
   ou pagamento. As que tiverem são listadas e mantidas, para decisão do usuário.

```javascript
// scripts/alinhar_local_com_producao.mjs
/**
 * Traz o banco local ao estado de producao SEM apagar matricula que tenha
 * vinculo.
 *
 * matriculas e referenciada com ON DELETE CASCADE por cobrancas, pagamentos,
 * notas, frequencias e historico_matriculas. Truncar e restaurar levaria junto
 * as 6032 cobrancas. Entao: UPDATE no que diverge, INSERT no que falta, e
 * DELETE so no que sobra e nao tem vinculo.
 *
 * Uso:
 *   node scripts/alinhar_local_com_producao.mjs           # dry-run
 *   node scripts/alinhar_local_com_producao.mjs --apply
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { lerEnv, lerTudo } from "./conferir_ano_letivo.mjs";

const ESCOLA_ID = "00000000-0000-0000-0000-000000000001";
const CAMPOS = ["ano_letivo", "serie_id", "turma_id", "data_matricula", "status"];

/** Quais linhas atualizar, inserir e remover para o local virar producao. */
export function planejarAlinhamento(local, producao) {
  const porIdLocal = new Map(local.map((m) => [m.id, m]));
  const porIdProd = new Map(producao.map((m) => [m.id, m]));

  const atualizar = [];
  const inserir = [];
  for (const p of producao) {
    const l = porIdLocal.get(p.id);
    if (!l) { inserir.push(p); continue; }
    const mudou = CAMPOS.filter((c) => String(l[c] ?? "") !== String(p[c] ?? ""));
    if (mudou.length > 0) atualizar.push({ id: p.id, campos: mudou, alvo: p });
  }
  const remover = local.filter((l) => !porIdProd.has(l.id));
  return { atualizar, inserir, remover };
}

async function idsComVinculo(db, ids) {
  const comVinculo = new Set();
  for (const tabela of ["cobrancas", "pagamentos", "notas", "frequencias"]) {
    for (let i = 0; i < ids.length; i += 200) {
      const lote = ids.slice(i, i + 200);
      const { data, error } = await db.from(tabela).select("matricula_id").in("matricula_id", lote);
      if (error) throw new Error(`${tabela}: ${error.message}`);
      for (const r of data) comVinculo.add(r.matricula_id);
    }
  }
  return comVinculo;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const env = lerEnv(false);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
  console.log(`Base local: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(apply ? "Modo: APLICANDO\n" : "Modo: DRY-RUN\n");

  const producao = JSON.parse(readFileSync("scratch-prod-matriculas.json", "utf8"));
  const local = await lerTudo(() =>
    db.from("matriculas").select("*").eq("escola_id", ESCOLA_ID)
  );
  console.log(`local: ${local.length} | producao: ${producao.length}`);

  const { atualizar, inserir, remover } = planejarAlinhamento(local, producao);
  const comVinculo = remover.length > 0
    ? await idsComVinculo(db, remover.map((m) => m.id))
    : new Set();
  const removerSeguro = remover.filter((m) => !comVinculo.has(m.id));
  const removerRetido = remover.filter((m) => comVinculo.has(m.id));

  console.log(`\natualizar        : ${atualizar.length}`);
  console.log(`inserir          : ${inserir.length}`);
  console.log(`remover (seguro) : ${removerSeguro.length}`);
  console.log(`remover (retido) : ${removerRetido.length}  [tem cobranca/nota/frequencia]`);

  if (removerRetido.length > 0) {
    console.log("\nRetidas — decisao do usuario, nao sao apagadas:");
    for (const m of removerRetido.slice(0, 10)) {
      console.log(`  ${m.id} ano=${m.ano_letivo}`);
    }
    if (removerRetido.length > 10) console.log(`  ... mais ${removerRetido.length - 10}`);
  }

  if (!apply) { console.log("\nDry-run. Rode com --apply para gravar."); return; }

  for (const a of atualizar) {
    const alvo = Object.fromEntries(CAMPOS.map((c) => [c, a.alvo[c]]));
    const { error } = await db.from("matriculas").update(alvo).eq("id", a.id);
    if (error) throw new Error(`update ${a.id}: ${error.message}`);
  }
  for (let i = 0; i < inserir.length; i += 200) {
    const { error } = await db.from("matriculas").insert(inserir.slice(i, i + 200));
    if (error) throw new Error(`insert: ${error.message}`);
  }
  for (const m of removerSeguro) {
    const { error } = await db.from("matriculas").delete().eq("id", m.id);
    if (error) throw new Error(`delete ${m.id}: ${error.message}`);
  }
  console.log(`\nalinhado: ${atualizar.length} atualizadas, ${inserir.length} inseridas, ${removerSeguro.length} removidas.`);
}

if (process.argv[1]?.endsWith("alinhar_local_com_producao.mjs")) {
  main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });
}
```

Run: `node scripts/alinhar_local_com_producao.mjs`
Expected (dry-run): contagens de UPDATE, INSERT, DELETE seguro e DELETE retido.

- [ ] **Step 4: Aplicar o alinhamento**

Run: `node scripts/alinhar_local_com_producao.mjs --apply`
Expected: grava e imprime o resumo. Se alguma remoção ficar retida por vínculo, parar e
reportar ao usuário antes de seguir.

- [ ] **Step 5: Conferir que o local igualou produção**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c \
  "SELECT count(*) AS total,
          count(*) FILTER (WHERE (aluno_id, ano_letivo) IN (
            SELECT aluno_id, ano_letivo FROM matriculas
            GROUP BY 1,2 HAVING count(*)>1)) AS em_colisao
   FROM matriculas WHERE escola_id='00000000-0000-0000-0000-000000000001';"
```

Expected: `total = 2284`, `em_colisao = 0`.

- [ ] **Step 6: Conferir que as cobranças sobreviveram**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c \
  "SELECT count(*) AS cobrancas, count(*) FILTER (WHERE matricula_id IS NULL) AS orfas
   FROM cobrancas;"
```

Expected: contagem igual à de antes do alinhamento, `orfas = 0`. Se caiu, restaurar de
`matriculas_local_20260918` e investigar.

- [ ] **Step 7: Conferir a paridade com produção**

Run: `node scripts/conferir_ano_letivo.mjs "C:/Users/rodri/OneDrive/Desktop/histo"`
Expected: taxa de acerto ~64% e ~132 conflitos — os mesmos números de produção.

- [ ] **Step 8: Commit**

```bash
git add scripts/alinhar_local_com_producao.mjs \
        docs/superpowers/specs/2026-09-18-ano-letivo-corte-matricula-design.md
git commit -m "feat(scripts): alinha o local com producao sem apagar vinculo"
```

---

## Task 4: Correção cirúrgica pelo PDF

**Files:**
- Create: `scripts/corrigir_ano_letivo_pelo_pdf.mjs`

**Interfaces:**
- Consumes: `lerEnv`, `lerTudo`, `classificar`, `anoCorretoSegundoPdf` da Task 2; indexador da Task 1.
- Produces: CLI `node scripts/corrigir_ano_letivo_pelo_pdf.mjs <pasta-pdfs> [--apply] [--producao]`.

Corrige **apenas** matrículas em conflito cujo ano correto o PDF determina sem ambiguidade. Pula o resto e lista.

- [ ] **Step 1: Implementar**

```javascript
// scripts/corrigir_ano_letivo_pelo_pdf.mjs
/**
 * Corrige o ano_letivo das matriculas que divergem do historico oficial.
 *
 * Producao ja passou pela correcao de 10/09 (commit 14008cf3), que reconstruiu
 * o ano pela progressao de series. Sobraram ~132 matriculas onde a progressao
 * nao tinha ancora (aluno com buraco na sequencia): todas com a serie
 * exatamente um ano a frente do que o PDF registra.
 *
 * Este script NAO desloca em massa. Compara com o PDF e corrige so o conflito,
 * quando o PDF determina o ano sem ambiguidade.
 *
 * Uso:
 *   node scripts/corrigir_ano_letivo_pelo_pdf.mjs "C:/.../histo"
 *   node scripts/corrigir_ano_letivo_pelo_pdf.mjs "C:/.../histo" --apply
 *   node scripts/corrigir_ano_letivo_pelo_pdf.mjs "C:/.../histo" --apply --producao
 */

import { createClient } from "@supabase/supabase-js";
import {
  extrairParesDePasta, construirIndice, chaveIndice, normalizarSerie
} from "./lib/historico-pdf-indice.mjs";
import { lerEnv, lerTudo, anoCorretoSegundoPdf } from "./conferir_ano_letivo.mjs";

const ESCOLA_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Decide o destino de cada matricula.
 * Corrige so quando: ha conflito, o PDF determina UM ano, e o ano destino
 * esta livre para aquele aluno (senao viraria duas linhas no mesmo ano).
 */
export function planejarCorrecoes(matriculas, indice, matriculasNoPdf) {
  const anosOcupados = new Map();
  for (const m of matriculas) {
    const cod = String(m.codigo ?? "");
    if (!anosOcupados.has(cod)) anosOcupados.set(cod, new Set());
    anosOcupados.get(cod).add(m.ano_letivo);
  }

  const corrigir = [];
  const pular = [];
  for (const m of matriculas) {
    const cod = String(m.codigo ?? "");
    if (!matriculasNoPdf.has(cod)) continue;

    const serieBase = normalizarSerie(m.serie);
    const seriePdf = indice.get(chaveIndice(cod, m.ano_letivo));
    if (!seriePdf || seriePdf === serieBase) continue;

    const anoCorreto = anoCorretoSegundoPdf(cod, serieBase, indice);
    if (anoCorreto === null) {
      pular.push({ ...m, motivo: `PDF nao determina um ano unico para ${serieBase}` });
      continue;
    }
    if (anoCorreto === m.ano_letivo) continue;
    if (anosOcupados.get(cod).has(anoCorreto)) {
      pular.push({ ...m, motivo: `aluno ja tem matricula em ${anoCorreto}` });
      continue;
    }
    corrigir.push({ ...m, ano_correto: anoCorreto });
    anosOcupados.get(cod).delete(m.ano_letivo);
    anosOcupados.get(cod).add(anoCorreto);
  }
  return { corrigir, pular };
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
  const matriculasNoPdf = new Set([...indice.keys()].map((k) => k.split("|")[0]));

  const brutas = await lerTudo(() =>
    db.from("matriculas")
      .select("id, ano_letivo, data_matricula, alunos(matricula_codigo), series(nome)")
      .eq("escola_id", ESCOLA_ID)
  );
  const matriculas = brutas.map((m) => ({
    id: m.id,
    codigo: m.alunos?.matricula_codigo,
    serie: m.series?.nome,
    ano_letivo: m.ano_letivo,
    data_matricula: m.data_matricula
  }));

  const { corrigir, pular } = planejarCorrecoes(matriculas, indice, matriculasNoPdf);

  console.log("-- a corrigir --");
  for (const c of corrigir.slice(0, 30)) {
    console.log(`  mat ${String(c.codigo).padEnd(6)} ${normalizarSerie(c.serie).padEnd(10)} ${c.ano_letivo} -> ${c.ano_correto}`);
  }
  if (corrigir.length > 30) console.log(`  ... mais ${corrigir.length - 30}`);

  if (pular.length > 0) {
    console.log("\n-- pulados --");
    for (const p of pular.slice(0, 15)) {
      console.log(`  mat ${String(p.codigo).padEnd(6)} ${normalizarSerie(p.serie).padEnd(10)} ${p.ano_letivo}: ${p.motivo}`);
    }
    if (pular.length > 15) console.log(`  ... mais ${pular.length - 15}`);
  }

  console.log(`\ncorrigir: ${corrigir.length} | pular: ${pular.length}`);

  if (!apply) {
    console.log("\nDry-run. Rode com --apply para gravar.");
    return;
  }
  if (corrigir.length === 0) {
    console.log("\nNada a corrigir.");
    return;
  }

  let feitas = 0;
  for (const c of corrigir) {
    const { error } = await db.from("matriculas")
      .update({ ano_letivo: c.ano_correto })
      .eq("id", c.id);
    if (error) throw new Error(`matricula ${c.codigo}: ${error.message}`);
    feitas += 1;
  }
  console.log(`\n${feitas} matriculas corrigidas.`);
}

main().catch((e) => { console.error("\nFALHOU:", e.message); process.exit(1); });
```

- [ ] **Step 2: Dry-run no local**

Run: `node scripts/corrigir_ano_letivo_pelo_pdf.mjs "C:/Users/rodri/OneDrive/Desktop/histo"`
Expected: lista ~132 correções no formato `3º ANO 2023 -> 2022`, nenhuma gravação.

- [ ] **Step 3: Aplicar no local**

Run: `node scripts/corrigir_ano_letivo_pelo_pdf.mjs "C:/Users/rodri/OneDrive/Desktop/histo" --apply`
Expected: `N matriculas corrigidas`.

- [ ] **Step 4: Conferir o ganho**

Run: `node scripts/conferir_ano_letivo.mjs "C:/Users/rodri/OneDrive/Desktop/histo"`
Expected: taxa de acerto sobe de ~64% para ~72%; `conflito de serie` cai para perto de zero.

- [ ] **Step 5: Conferir que não criou colisão**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c \
  "SELECT count(*) FROM (SELECT aluno_id, ano_letivo FROM matriculas
    WHERE escola_id='00000000-0000-0000-0000-000000000001'
    GROUP BY 1,2 HAVING count(*)>1) x;"
```

Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add scripts/corrigir_ano_letivo_pelo_pdf.mjs
git commit -m "feat(scripts): corrige ano letivo divergente usando o PDF como fonte"
```

---

## Task 5: Regra do corte 01/09

**Files:**
- Create: `src/lib/matriculas/ano-letivo.ts`
- Test: `src/lib/matriculas/ano-letivo.test.ts`

**Interfaces:**
- Produces:
  - `MES_CORTE_ANO_LETIVO = 9`
  - `anoLetivoDaData(data: Date): number`
  - `anoLetivoSugerido(data: Date, anosOcupados: Iterable<number>): number`

- [ ] **Step 1: Escrever o teste que falha**

```typescript
// src/lib/matriculas/ano-letivo.test.ts
import { describe, expect, it } from "vitest";
import { anoLetivoDaData, anoLetivoSugerido } from "./ano-letivo";

describe("anoLetivoDaData", () => {
  it("matricula de setembro em diante vale para o ano seguinte", () => {
    expect(anoLetivoDaData(new Date(2025, 8, 1))).toBe(2026);   // 01/09
    expect(anoLetivoDaData(new Date(2025, 10, 4))).toBe(2026);  // 04/11
    expect(anoLetivoDaData(new Date(2025, 11, 20))).toBe(2026); // 20/12
  });

  it("matricula antes de setembro vale para o ano corrente", () => {
    expect(anoLetivoDaData(new Date(2025, 0, 10))).toBe(2025);  // 10/01
    expect(anoLetivoDaData(new Date(2025, 7, 31))).toBe(2025);  // 31/08
  });
});

describe("anoLetivoSugerido", () => {
  it("sugere o ano do corte quando esta livre", () => {
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [])).toBe(2026);
  });

  it("avanca enquanto o ano estiver ocupado", () => {
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [2026])).toBe(2027);
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [2026, 2027])).toBe(2028);
  });

  it("ignora anos ocupados anteriores ao do corte", () => {
    expect(anoLetivoSugerido(new Date(2025, 10, 4), [2023, 2024, 2025])).toBe(2026);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lib/matriculas/ano-letivo.test.ts`
Expected: FAIL — não resolve `./ano-letivo`.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/matriculas/ano-letivo.ts
/**
 * Ano letivo a partir da data da matrícula.
 *
 * A escola matricula de setembro a dezembro PARA o ano seguinte. Derivar o ano
 * letivo de `getFullYear()` jogava toda a matrícula de fim de ano um ano para
 * trás — foi o que corrompeu o histórico importado do sistema antigo.
 */

/** Setembro: a partir dele a rematrícula é para o ano seguinte. */
export const MES_CORTE_ANO_LETIVO = 9;

export function anoLetivoDaData(data: Date): number {
  const mes = data.getMonth() + 1;
  return mes >= MES_CORTE_ANO_LETIVO ? data.getFullYear() + 1 : data.getFullYear();
}

/** O ano do corte, avançando enquanto o aluno já tiver matrícula naquele ano. */
export function anoLetivoSugerido(data: Date, anosOcupados: Iterable<number>): number {
  const ocupados = new Set(anosOcupados);
  let ano = anoLetivoDaData(data);
  while (ocupados.has(ano)) ano += 1;
  return ano;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/matriculas/ano-letivo.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matriculas/ano-letivo.ts src/lib/matriculas/ano-letivo.test.ts
git commit -m "feat(matriculas): regra do corte de 01/09 para o ano letivo"
```

---

## Task 6: Tela de nova matrícula usa a regra, campo editável

**Files:**
- Modify: `src/components/matriculas/nova-matricula-fields.tsx`

**Interfaces:**
- Consumes: `anoLetivoSugerido` da Task 5.

Hoje o componente calcula `proximoAnoDisponivel(aluno, new Date().getFullYear())` — parte do ano do relógio e desconhece o corte. Uma matrícula feita em novembro cai no ano corrente, que é o defeito original. O campo é `readOnly`, então a secretaria não tem como corrigir.

- [ ] **Step 1: Substituir `proximoAnoDisponivel` pela regra compartilhada**

Remover a função local (linhas 52-60) e importar a regra:

```typescript
import { anoLetivoSugerido } from "@/lib/matriculas/ano-letivo";
```

- [ ] **Step 2: Calcular o ano com a data de hoje e permitir edição**

Trocar o `useMemo` do ano e o estado:

```typescript
const hoje = useMemo(() => new Date(), []);
const anoAtual = hoje.getFullYear();

const anoSugerido = useMemo(() => {
  const ocupados = (aluno?.matriculas ?? [])
    .filter((m) => m.status === "ativa" || m.status === "concluida")
    .map((m) => m.ano_letivo);
  return anoLetivoSugerido(hoje, ocupados);
}, [aluno, hoje]);

const [anoLetivo, setAnoLetivo] = useState(anoSugerido);
const [anoTocado, setAnoTocado] = useState(false);

// Enquanto a secretaria não editar o campo, ele acompanha a troca de aluno.
useEffect(() => {
  if (!anoTocado) setAnoLetivo(anoSugerido);
}, [anoSugerido, anoTocado]);
```

Acrescentar `useEffect` ao import de `react`.

- [ ] **Step 3: Tornar o input editável**

```tsx
<label className="self-start">Ano letivo
  <input
    name="ano_letivo"
    type="number"
    value={anoLetivo}
    onChange={(e) => { setAnoTocado(true); setAnoLetivo(Number(e.target.value)); }}
  />
  {anoLetivo !== anoAtual ? (
    <FieldNote>
      Matrícula a partir de setembro vale para {anoLetivo}.
    </FieldNote>
  ) : null}
</label>
```

- [ ] **Step 4: Verificar que `turmasDisponiveis` acompanha o ano editado**

A lista de turmas filtra por `t.ano_letivo === anoLetivo`. Como `anoLetivo` virou estado, a troca manual do ano deve refiltrar sozinha — confirmar lendo o trecho, sem mudança adicional.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sem erro.

- [ ] **Step 6: Suite completa**

Run: `npm run test`
Expected: verde, incluindo os testes da Task 5.

- [ ] **Step 7: Commit**

```bash
git add src/components/matriculas/nova-matricula-fields.tsx
git commit -m "fix(matriculas): tela de nova matricula aplica o corte de 01/09"
```

---

## Task 7: Constraint de unicidade

**Files:**
- Create: `supabase/migrations/202609180005_matriculas_aluno_ano_unico.sql`

**Interfaces:**
- Consumes: base sem colisões (Task 4, passo 5).

Sem essa constraint nada impede a duplicata de voltar — foi ela que permitiu 329 colisões no local.

- [ ] **Step 1: Confirmar que a base está limpa**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c \
  "SELECT count(*) FROM (SELECT aluno_id, ano_letivo FROM matriculas
    GROUP BY 1,2 HAVING count(*)>1) x;"
```

Expected: `0`. Se não for, a migration falha — voltar à Task 4.

- [ ] **Step 2: Escrever a migration**

```sql
-- supabase/migrations/202609180005_matriculas_aluno_ano_unico.sql
--
-- Um aluno tem no maximo uma matricula por ano letivo.
--
-- A ausencia dessa trava deixou 329 pares (aluno, ano) duplicados quando o
-- importador derivou ano_letivo de year(data_matricula): a linha deslocada
-- convivia com a do ano correto.

ALTER TABLE matriculas
  ADD CONSTRAINT matriculas_aluno_ano_unico
  UNIQUE (escola_id, aluno_id, ano_letivo);
```

- [ ] **Step 3: Aplicar no local**

Run: `npx supabase db push --local`
Expected: aplica sem erro. (**Nunca** `supabase db reset --local`.)

- [ ] **Step 4: Verificar que a constraint pega**

```bash
docker exec supabase_db_rrb-escola psql -U postgres -d postgres -c \
  "INSERT INTO matriculas (escola_id, aluno_id, serie_id, turma_id, ano_letivo, data_matricula, status)
   SELECT escola_id, aluno_id, serie_id, turma_id, ano_letivo, data_matricula, status
   FROM matriculas LIMIT 1;"
```

Expected: `ERROR: duplicate key value violates unique constraint "matriculas_aluno_ano_unico"`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202609180005_matriculas_aluno_ano_unico.sql
git commit -m "feat(db): um aluno tem no maximo uma matricula por ano letivo"
```

---

## Task 8: Aplicar em produção

**Files:** nenhum — operação de dados.

**Interfaces:**
- Consumes: Tasks 2, 4 e 7 validadas no local.

- [ ] **Step 1: Backup de produção**

```bash
pg_dump "$(grep -m1 SUPABASE_CLOUD_DB_URL .env.local | cut -d= -f2-)" \
  --data-only --table=public.matriculas \
  --file=backup-prod-matriculas-20260918.sql
```

Expected: arquivo com as 2.284 linhas. **Não seguir sem ele.**

- [ ] **Step 2: Dry-run em produção**

Run: `node scripts/corrigir_ano_letivo_pelo_pdf.mjs "C:/Users/rodri/OneDrive/Desktop/histo" --producao`
Expected: mesma contagem vista no local (~132). Divergência grande = parar e investigar.

- [ ] **Step 3: Conferir a lista com o usuário**

Mostrar as correções e confirmar antes de gravar. Produção alimenta financeiro e relatórios; a decisão de aplicar é do usuário.

- [ ] **Step 4: Aplicar**

Run: `node scripts/corrigir_ano_letivo_pelo_pdf.mjs "C:/Users/rodri/OneDrive/Desktop/histo" --producao --apply`
Expected: `N matriculas corrigidas`.

- [ ] **Step 5: Conferir o resultado**

Run: `node scripts/conferir_ano_letivo.mjs "C:/Users/rodri/OneDrive/Desktop/histo" --producao`
Expected: acerto sobe de ~64% para ~72%; conflitos perto de zero.

- [ ] **Step 6: Aplicar a migration em produção**

Run: `npx supabase db push`
Expected: `202609180005` aplicada.

- [ ] **Step 7: Conferir na tela**

Abrir a ficha do aluno 1259 e confirmar a progressão sem série repetida. Abrir Histórico → Emissão com ano 2025 e confirmar que lista alunos.

---

## Self-Review

**Cobertura do spec:**

| Requisito | Task |
|---|---|
| Diagnóstico do corte 01/09 | Task 5 (regra) |
| Validação contra os 136 PDFs | Tasks 1, 2 |
| Produção já corrigida em 10/09 | Task 3 (alinha o local) |
| Correção cirúrgica dos 132 | Task 4 |
| `UNIQUE (escola_id, aluno_id, ano_letivo)` | Task 7 |
| Tela com corte, editável | Task 6 |
| Dry-run antes de aplicar | Tasks 4, 8 |
| Backup antes de escrever | Tasks 3, 8 |

**Fora de escopo, herdado do spec:** o deslocamento em massa (passos 2–5 do spec original) não vira task — produção já passou por correção equivalente e reaplicá-lo deslocaria um segundo ano.

**Pendência conhecida:** `.env.local` define `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` duas vezes (linhas 18/20 local, 34/37 produção). Os scripts do projeto ficam com a primeira e apontam para o local, mas o Next.js fica com a última — `npm run dev` provavelmente conecta em produção. Não é parte desta correção; reportado ao usuário à parte.
