import ExcelJS from "exceljs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const wb = new ExcelJS.Workbook();

function addBlock(ws, header, alunos) {
  ws.addRow([null, null, null, header]);
  ws.addRow([null, null, null, "ALUNO", "MATRICULA"]);
  alunos.forEach((a, i) => {
    ws.addRow([null, null, i + 1, a.nome, a.valor]);
  });
  ws.addRow([]);
}

const inf = wb.addWorksheet("INFANTIL");
inf.addRow([]);
inf.addRow([]);
addBlock(inf, "MATERNAL - MATUTINO", [
  { nome: "Antony Rodrigues Lino", valor: 600 },
  { nome: "Eurico Flores Amorim", valor: 690 }
]);
addBlock(inf, "INFANTIL 4 - VESPERTINO", [
  { nome: "Manuela Margarida Barros", valor: 800 }
]);

const f1 = wb.addWorksheet("FUND 1");
f1.addRow([]);
addBlock(f1, "3º ANO - B", [
  { nome: "Alice Teste", valor: 700 }
]);

mkdirSync(resolve(__dirname, "fixtures"), { recursive: true });
await wb.xlsx.writeFile(resolve(__dirname, "fixtures/mini-matriculados.xlsx"));
console.log("fixture gerada");
