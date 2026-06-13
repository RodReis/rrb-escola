// Cria contratos folha-v2 a partir das planilhas de folha (uma por empresa, nome=CNPJ).
// Salario base + admissao vem da PLANILHA (nao do banco). Verba fixa: Gratificacao.
// Perfil: aba "Admin" -> clt; demais (Professores/Fund.II) -> clt_professor.
//
// Uso (bash):
//   PGPASSWORD=<senha> PROD_URL=<conn> node scripts/criar_contratos_da_planilha.mjs --dry-run
//   PGPASSWORD=<senha> PROD_URL=<conn> node scripts/criar_contratos_da_planilha.mjs --apply
//
// So cria contrato para funcionario que casa por nome (normalizado) na empresa certa
// e que ainda NAO tem contrato ativo. Nao-casados / datas invalidas vao pro relatorio.

import ExcelJS from "exceljs";
import { execSync } from "node:child_process";

const PROD_URL = process.env.PROD_URL;
if (!PROD_URL) { console.error("ERRO: defina PROD_URL (e PGPASSWORD)."); process.exit(1); }
const APPLY = process.argv.includes("--apply");

const PLANILHAS = [
  { file: "public/11714876000116.xlsx", cnpj: "11714876000116" },
  { file: "public/35027047000123.xlsx", cnpj: "35027047000123" },
];
const ABAS_ADMIN = ["admin"];
const ABAS_PESSOAS = ["professores", "admin", "fund. ii", "fund ii", "medio", "médio"];

function psql(sql) {
  return execSync(`psql "${PROD_URL}" -tA -c "${sql.replace(/"/g, '\\"')}"`, {
    encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: { ...process.env, PGCLIENTENCODING: "UTF8" },
  });
}

// quebra linhas removendo CR (CRLF do psql no Windows)
function lines(out) {
  return out.split(/\r?\n/).map((l) => l.replace(/\r$/, "")).filter(Boolean);
}

function norm(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim();
}

function cellVal(cell) {
  const v = cell.value;
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (v.result != null) return v.result;
    if (v.text) return v.text;
    return null;
  }
  return v;
}

function isValidDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

function findHeaderRow(ws) {
  for (let r = 1; r <= Math.min(ws.rowCount, 12); r++) {
    for (let c = 1; c <= ws.columnCount; c++) {
      if (/funcion/i.test(String(cellVal(ws.getRow(r).getCell(c)) ?? ""))) return r;
    }
  }
  return null;
}

function canon(h) {
  const n = norm(h);
  if (/FUNCION/.test(n)) return "nome";
  if (/SALARIO BASE/.test(n) || n === "SALARIO") return "salario_base";
  if (/ENTRADA/.test(n)) return "entrada";
  if (/^ADICIONAL/.test(n)) return "adicional";
  if (/GRATIFIC/.test(n)) return "gratificacao";
  return null;
}

async function lerPlanilha(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const linhas = [];
  wb.eachSheet((ws) => {
    if (!ABAS_PESSOAS.includes(ws.name.toLowerCase())) return;
    const isAdmin = ABAS_ADMIN.includes(ws.name.toLowerCase());
    const hr = findHeaderRow(ws);
    if (!hr) return;
    const colMap = {};
    for (let c = 1; c <= ws.columnCount; c++) {
      const k = canon(cellVal(ws.getRow(hr).getCell(c)));
      if (k && colMap[k] == null) colMap[k] = c;
    }
    if (colMap.nome == null) return;
    for (let r = hr + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const nome = cellVal(row.getCell(colMap.nome));
      if (!nome || /^TOTA/i.test(String(nome).trim()) || /= = >/.test(String(nome))) continue;
      const get = (k) => (colMap[k] != null ? cellVal(row.getCell(colMap[k])) : null);
      linhas.push({
        nome: String(nome).trim(),
        norm: norm(nome),
        aba: ws.name,
        perfil: isAdmin ? "clt" : "clt_professor",
        salario_base: Number(get("salario_base")) || null,
        entrada: get("entrada"),
        adicional: Number(get("adicional")) || null,
        gratificacao: Number(get("gratificacao")) || null,
      });
    }
  });
  return linhas;
}

async function main() {
  const empRaw = psql(
    `select e.id||'~'||e.company_id||'~'||coalesce(e.school_category,'')||'~'||e.name from employees e where e.ativo=true`
  );
  const employees = lines(empRaw).map((l) => {
    const [id, company_id, cat, name] = l.split("~");
    return { id, company_id, cat, name, norm: norm(name) };
  });

  const compRaw = psql(`select id||'~'||replace(replace(replace(coalesce(cnpj,''),'.',''),'/',''),'-','') from companies`);
  const cnpjToComp = {};
  for (const l of lines(compRaw)) { const [id, cnpj] = l.split("~"); if (cnpj) cnpjToComp[cnpj] = id; }

  const perfilRaw = psql(`select codigo||'~'||id from folha_perfis_calculo`);
  const perfilMap = {};
  for (const l of lines(perfilRaw)) { const [c, id] = l.split("~"); perfilMap[c] = id; }

  const rubRaw = psql(`select codigo||'~'||id from folha_rubricas where codigo='gratificacao'`);
  const gratifId = lines(rubRaw)[0]?.split("~")[1] ?? null;

  const comContratoRaw = psql(`select employee_id from folha_contratos where ativo=true`);
  const comContrato = new Set(lines(comContratoRaw));

  const ESCOLA = "00000000-0000-0000-0000-000000000001";
  const HOJE = "2026-06-13";

  const toCreate = [];
  const semMatch = [];
  const semSalario = [];
  const jaTem = [];
  const dataSuspeita = [];

  for (const { file, cnpj } of PLANILHAS) {
    const companyId = cnpjToComp[cnpj];
    const linhas = await lerPlanilha(file);
    for (const lin of linhas) {
      const cand = employees.filter((e) => e.company_id === companyId && e.norm === lin.norm);
      if (cand.length === 0) { semMatch.push({ ...lin, cnpj }); continue; }
      if (cand.length > 1) { semMatch.push({ ...lin, cnpj, ambiguo: true }); continue; }
      const emp = cand[0];
      if (comContrato.has(emp.id)) { jaTem.push({ nome: emp.name, aba: lin.aba }); continue; }
      if (!lin.salario_base || lin.salario_base <= 0) { semSalario.push({ nome: emp.name }); continue; }
      // dedup: mesmo funcionario em 2 abas -> so o 1º (constraint folha_contratos_um_ativo)
      if (toCreate.some((t) => t.emp.id === emp.id)) { jaTem.push({ nome: emp.name, aba: lin.aba + " (2a aba)" }); continue; }
      let admissao = lin.entrada;
      if (!isValidDate(admissao)) { dataSuspeita.push({ nome: emp.name, entrada: admissao }); admissao = null; }
      toCreate.push({ emp, companyId, lin, admissao });
    }
  }

  console.log(`\n=== RESUMO ===`);
  console.log(`A criar: ${toCreate.length} | sem match: ${semMatch.length} | sem salario: ${semSalario.length} | ja tem: ${jaTem.length} | data suspeita: ${dataSuspeita.length}`);

  console.log(`\n=== CONTRATOS A CRIAR ===`);
  for (const t of toCreate) {
    const verbas = [];
    if (t.lin.gratificacao && gratifId) verbas.push(`gratificacao=${t.lin.gratificacao}`);
    console.log(`  ${t.emp.name} | ${t.lin.perfil} | base=${t.lin.salario_base} | adm=${t.admissao ?? "(s/data)"} | ${verbas.join(",") || "sem verba"}`);
  }
  if (semMatch.length) { console.log(`\n=== SEM MATCH (planilha -> banco) ===`); for (const s of semMatch) console.log(`  [${s.cnpj}] ${s.nome}${s.ambiguo ? " (AMBIGUO)" : ""}`); }
  if (semSalario.length) { console.log(`\n=== SEM SALARIO ===`); for (const s of semSalario) console.log(`  ${s.nome}`); }
  if (jaTem.length) { console.log(`\n=== JA TEM CONTRATO ===`); for (const s of jaTem) console.log(`  ${s.nome}`); }
  if (dataSuspeita.length) { console.log(`\n=== DATA ADMISSAO INVALIDA (criado sem data->hoje) ===`); for (const s of dataSuspeita) console.log(`  ${s.nome} -> "${s.entrada}"`); }

  if (!APPLY) { console.log(`\n[DRY-RUN] Nada gravado. Use --apply.`); return; }

  console.log(`\n=== APPLY ===`);
  let ok = 0, falhou = 0;
  for (const t of toCreate) {
    const adm = t.admissao ?? HOJE;
    try {
      const ins = psql(
        `insert into folha_contratos (escola_id, employee_id, company_id, perfil_calculo_id, salario_base, dependentes_irrf, data_admissao, ativo) values ('${ESCOLA}','${t.emp.id}','${t.companyId}','${perfilMap[t.lin.perfil]}',${t.lin.salario_base},0,'${adm}',true) returning id`
      ).trim();
      const contratoId = lines(ins)[0];
      if (t.lin.gratificacao && gratifId) {
        psql(`insert into folha_contratos_rubricas (contrato_id, rubrica_id, valor, ativa) values ('${contratoId}','${gratifId}',${t.lin.gratificacao},true)`);
      }
      ok++;
      console.log(`  OK ${t.emp.name} -> ${contratoId}`);
    } catch (e) {
      falhou++;
      const msg = String(e.stderr || e.message).split("\n")[0];
      console.log(`  FALHA ${t.emp.name}: ${msg}`);
    }
  }
  console.log(`\n[APPLY] ${ok} criados, ${falhou} falharam.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
