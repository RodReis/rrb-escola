// Atualiza CPF dos funcionarios casando por NOME (normalizado).
// Fonte: PDF "CADASTRO CPF FUNCIONARIOS" (pares embutidos abaixo).
//
// Uso (bash):
//   PGPASSWORD=<senha> PROD_URL=<conn> node scripts/atualizar_cpf_funcionarios.mjs --dry-run
//   PGPASSWORD=<senha> PROD_URL=<conn> node scripts/atualizar_cpf_funcionarios.mjs --apply
//
// --dry-run (default): so mostra matches + nao-casados, NAO grava.
// --apply: backup CSV dos CPFs atuais e aplica os UPDATEs (so dos casados exatos).
// Nomes que nao casam EXATO (apos normalizacao) ficam no relatorio para mapeamento manual.

import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const PROD_URL = process.env.PROD_URL;
if (!PROD_URL) {
  console.error("ERRO: defina PROD_URL (e PGPASSWORD) no ambiente.");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");

// --- Pares nome -> CPF do PDF (69 linhas; duplicata JANAINA/JANAÍNA = mesmo CPF) ---
const PDF = [
  ["ADRIANE CRISTINA SIQUEIRA", "905.082.031-04"],
  ["ANA FLÁVIA DE JESUS LUCIANO", "038.958.291-37"],
  ["ANA LIVIA LOURENÇO FERREIRA", "042.684.561-71"],
  ["ÂNGELA MARIA DOS SANTOS GONÇALVES", "622.904.951-15"],
  ["ANY KAROLLINY RODRIGUES SIQUEIRA", "702.448.611-29"],
  ["AURIO VELOZO DOS SANTOS GODOY", "936.057.651-49"],
  ["BENEDITO RODRIGUES BORGES", "253.408.081-49"],
  ["BRUNA ROCHA FERREIRA", "605.620.743-92"],
  ["CAIO DE MEDEIROS REZENDE", "702.537.191-27"],
  ["CARLENE RODRIGUES DA CUNHA MANRIQUE", "449.628.001-91"],
  ["CARLOS HENRIQUE CAMILO DE MATOS", "704.182.021-17"],
  ["CARLOS LEONARDO ALVES SOARES", "050.747.791-03"],
  ["CAROLINA CARDOSO MIRANDA", "007.038.901-23"],
  ["DANIELA ABRÃO BARONI", "928.103.496-49"],
  ["EDUARDA LAÍS SILVA CÂNDIDO", "047.301.361-44"],
  ["ELAINE BATISTA OLIVEIRA", "008.556.871-69"],
  ["ELLIZAINNE JANINE SILVA", "004.516.881-47"],
  ["EVELYN EMYLLY MOREIRA DOS REIS", "709.088.191-10"],
  ["FERNANDO SILVA OLÍMPIO", "737.904.941-00"],
  ["GABRIEL FERREIRA E SILVA", "054.615.171-02"],
  ["HANNIERY MARQUES FERNANDES", "035.266.471-19"],
  ["HELLEN ALVES LEMES", "995.647.691-91"],
  ["INÊS VIEIRA DE SOUZA BARBOSA", "822.585.971-53"],
  ["JANAINA MARIA DA SILVA NUNES", "007.707.621-40"],
  ["JANAÍNA MARIA DA SILVA NUNES", "007.707.621-40"],
  ["JANETE DE FREITAS RODRIGUES", "910.008.741-68"],
  ["JEAN DIVINO DE JESUS", "846.628.321-87"],
  ["JORDANA CRISTINA SILVA GAIOSO", "756.910.271-15"],
  ["JOSEANE SILVA LEITE", "102.222.136-12"],
  ["JULIANA VIEIRA JORGE", "008.362.451-13"],
  ["KEILA REGINA DE OLIVEIRA", "006.201.931-74"],
  ["LAÍS RAMOS FERNANDES", "701.530.871-10"],
  ["LÁYSLLA ROBERTA DOS SANTOS GONÇALVES", "704.353.601-40"],
  ["LEIA DAMASCENO DE ANDRADE APOLINÁRIO", "025.311.841-71"],
  ["LETÍCIA DIAS DE CASTRO", "706.328.731-16"],
  ["LUCIANY MAIRA DA SILVA", "796.858.541-49"],
  ["LUCILENE MARIA MONTELO", "565.953.951-34"],
  ["LUCIMAR DE SOUZA SILVA", "712.191.701-78"],
  ["MARIA ANGÉLICA DE ARAÚJO", "002.991.711-59"],
  ["MARIA CONCEIÇÃO BEZERRA DA SILVA", "888.975.401-04"],
  ["MARIA DE FATIMA SILVA", "740.960.441-72"],
  ["MARIA MÁRCIA BORGES SOUZA", "014.304.031-60"],
  ["MARIANA ALVES DE DEUS", "061.750.521-70"],
  ["MIRAMAR BARBOSA SILVA", "871.301.731-49"],
  ["PEDRO JUNIO DIAS ROSA", "700.963.161-10"],
  ["PEDRO LEANDRO OLIVEIRA SOUZA", "009.236.701-14"],
  ["POLLYANNA APARECIDA DE SOUZA", "999.463.941-20"],
  ["RAFAELA MACHADO MARGARIDA BARROS", "018.559.591-00"],
  ["REGINALDA CANUTO MACHADO SILVA", "016.020.651-01"],
  ["RENATO DIAS DE OLIVEIRA", "703.979.141-21"],
  ["RENATO REIS BARROS", "478.536.201-44"],
  ["RICARDO ALVES MARTINS", "913.664.101-49"],
  ["RODRIGO REIS BARROS", "857.906.721-91"],
  ["ROSÂNGELA MARIA DIAS", "829.576.571-04"],
  ["ROSSANIA BRIGIDA RODRIGUES RIBEIRO BARBOSA", "776.246.701-78"],
  ["SAILLEN CHRISTINNA PEREIRA DO COUTO", "704.528.031-95"],
  ["SAMANTHA SILVA AMORIM", "756.906.321-04"],
  ["SELMA DE PAULA LUIZ OLIVEIRA", "647.229.291-49"],
  ["SELMA DOS REIS TEIXEIRA GONÇALVES", "074.785.796-20"],
  ["SOLANGE JESUS KOGA LIMA", "899.324.041-87"],
  ["STÉFANNY GUIMARÃES", "702.749.971-18"],
  ["SUZANE DOS SANTOS MARTINS", "703.902.391-19"],
  ["TATIANA VIEIRA DA SILVA", "012.897.391-96"],
  ["THAÍS PRISCILLA SOUZA", "709.522.221-59"],
  ["VALDIRENE DA SILVA CUNHA", "896.577.051-34"],
  ["VANESSA ALVES SOARES", "700.885.391-21"],
  ["VICTÓRIA KAROLINE DE OLIVEIRA MENEZES", "705.358.181-06"],
  ["VINICIUS FERREIRA BARBOSA", "013.874.921-36"],
  ["WÂNIA MARQUES DA SILVA", "603.504.661-49"],
];

function norm(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")        // pontuacao (S., R.) vira espaco
    .replace(/\s+/g, " ")
    .trim();
}

function psql(sql) {
  // -tA unaligned, separador padrao "|" (nomes nao contem pipe)
  return execSync(`psql "${PROD_URL}" -tA -c "${sql.replace(/"/g, '\\"')}"`, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

// 1. Carrega employees do banco
const raw = psql("select id, name, coalesce(cpf,'') from employees order by name");
const employees = raw
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => {
    const [id, name, cpf] = l.split("|");
    return { id, name, cpf: cpf ?? "", norm: norm(name) };
  });

// indice por nome normalizado (detecta colisao)
const empByNorm = new Map();
for (const e of employees) {
  if (!empByNorm.has(e.norm)) empByNorm.set(e.norm, []);
  empByNorm.get(e.norm).push(e);
}

// 2. Casa PDF -> employee (dedup por CPF: JANAINA/JANAÍNA)
const seenCpf = new Set();
const matches = [];
const pdfSemMatch = [];
const ambiguos = [];

for (const [nomePdf, cpf] of PDF) {
  if (seenCpf.has(cpf)) continue; // duplicata mesmo CPF
  const n = norm(nomePdf);
  const cand = empByNorm.get(n);
  if (!cand || cand.length === 0) {
    pdfSemMatch.push({ nomePdf, cpf, norm: n });
  } else if (cand.length > 1) {
    ambiguos.push({ nomePdf, cpf, candidatos: cand.map((c) => c.name) });
  } else {
    matches.push({ nomePdf, cpf, emp: cand[0] });
    seenCpf.add(cpf);
  }
}

// employees sem nenhum CPF do PDF
const matchedEmpIds = new Set(matches.map((m) => m.emp.id));
const empSemMatch = employees.filter((e) => !matchedEmpIds.has(e.id));

// 3. Relatorio
console.log(`\n=== RESUMO ===`);
console.log(`PDF: ${PDF.length} linhas (${seenCpf.size} CPFs unicos casados)`);
console.log(`Employees no banco: ${employees.length}`);
console.log(`Casados exato: ${matches.length}`);
console.log(`PDF sem match no banco: ${pdfSemMatch.length}`);
console.log(`Ambiguos (>1 candidato): ${ambiguos.length}`);
console.log(`Employees sem CPF do PDF: ${empSemMatch.length}`);

if (matches.length) {
  console.log(`\n=== CASADOS (nome | cpf_atual -> cpf_novo) ===`);
  for (const m of matches) {
    const muda = m.emp.cpf !== m.cpf ? "" : "  (igual)";
    console.log(`  ${m.emp.name} | ${m.emp.cpf || "<vazio>"} -> ${m.cpf}${muda}`);
  }
}
if (pdfSemMatch.length) {
  console.log(`\n=== PDF SEM MATCH (mapear manual) ===`);
  for (const p of pdfSemMatch) console.log(`  ${p.nomePdf}  [${p.cpf}]`);
}
if (ambiguos.length) {
  console.log(`\n=== AMBIGUOS ===`);
  for (const a of ambiguos) console.log(`  ${a.nomePdf} -> ${a.candidatos.join(" | ")}`);
}
if (empSemMatch.length) {
  console.log(`\n=== EMPLOYEES SEM CPF DO PDF (revisar) ===`);
  for (const e of empSemMatch) console.log(`  ${e.name} | ${e.cpf || "<vazio>"}`);
}

if (!APPLY) {
  console.log(`\n[DRY-RUN] Nada gravado. Rode com --apply para atualizar.`);
  process.exit(0);
}

// 4. APPLY: backup + updates
mkdirSync("backup", { recursive: true });
const stamp = process.env.STAMP || "apply";
const backupFile = `backup/employees_cpf_pre_${stamp}.csv`;
psql(`\\copy (select id, name, cpf from employees order by name) to '${backupFile}' csv header`);
console.log(`\nBackup CPFs atuais: ${backupFile}`);

let ok = 0;
for (const m of matches) {
  if (m.emp.cpf === m.cpf) continue;
  const sql = `update employees set cpf='${m.cpf}' where id='${m.emp.id}'`;
  psql(sql);
  ok++;
}
console.log(`\n[APPLY] ${ok} CPFs atualizados (${matches.length - ok} ja estavam corretos).`);
console.log(`Nao casados (${pdfSemMatch.length + ambiguos.length}) NAO foram tocados.`);
