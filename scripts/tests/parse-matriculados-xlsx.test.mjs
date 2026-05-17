import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMatriculadosXlsx } from "../lib/parse-matriculados-xlsx.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadFixture() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolve(__dirname, "fixtures/mini-matriculados.xlsx"));
  return wb;
}

test("extrai todos alunos com turma e mensalidade", async () => {
  const wb = await loadFixture();
  const items = parseMatriculadosXlsx(wb);
  assert.equal(items.length, 6);

  const maternal = items.filter(i => i.turma_label.includes("MATERNAL"));
  assert.equal(maternal.length, 2);
  assert.equal(maternal[0].nome_raw, "Antony Rodrigues Lino");
  assert.equal(maternal[0].mensalidade, 600);

  const inf4 = items.find(i => i.nome_raw === "Manuela Margarida Barros");
  assert.ok(inf4);
  assert.match(inf4.turma_label, /INFANTIL 4 - VESPERTINO/);

  const a3b = items.find(i => i.nome_raw === "Alice Teste");
  assert.ok(a3b);
  assert.match(a3b.turma_label, /3.\s*ANO\s*-\s*B/);
  assert.equal(a3b.sheet, "FUND 1");
});

test("ignora linhas sem nome", async () => {
  const wb = await loadFixture();
  const items = parseMatriculadosXlsx(wb);
  assert.ok(items.every(i => i.nome_raw && i.nome_raw.length > 2));
});

test("ignora linha de totalizador numerico", async () => {
  const wb = await loadFixture();
  const items = parseMatriculadosXlsx(wb);
  // Nenhum item deve ter nome_raw que seja apenas numero
  assert.ok(items.every(i => !/^-?\d+([.,]\d+)?$/.test(i.nome_raw)));
  // INFANTIL 5 - MATUTINO deve ter exatamente 2 alunos (linha 1420 ignorada)
  const inf5 = items.filter(i => i.turma_label.includes("INFANTIL 5"));
  assert.equal(inf5.length, 2);
});
