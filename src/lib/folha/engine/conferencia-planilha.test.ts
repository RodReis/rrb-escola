/**
 * Confere o motor de calculo da folha-v2 contra as planilhas que o RH fecha a mao.
 *
 * Roda o MOTOR PURO (calcularItem) — nao toca banco, nao toca producao.
 * Le a planilha, monta o contrato equivalente, calcula, e compara linha a linha.
 *
 * Uso:
 *   npx vitest run src/lib/folha/engine/conferencia-planilha.test.ts
 */

import ExcelJS from "exceljs";
import { calcularItem } from "./pipeline";
import type { InssBracket, IrBracket } from "./brackets-calc";
import type { RedutorIrrf } from "./irrf";
import type { PerfilRubrica, RubricaDef } from "./types";

// --- faixas 2026 (espelho de 202606120002_folha_v2_seed.sql) ---
const INSS_2026: InssBracket[] = [
  { ordem: 1, valor_de: 0, valor_ate: 1621.0, aliquota: 0.075, parcela_deduzir: 0 },
  { ordem: 2, valor_de: 1621.01, valor_ate: 2902.84, aliquota: 0.09, parcela_deduzir: 22.77 },
  { ordem: 3, valor_de: 2902.85, valor_ate: 4354.27, aliquota: 0.12, parcela_deduzir: 106.59 },
  { ordem: 4, valor_de: 4354.28, valor_ate: 8475.55, aliquota: 0.14, parcela_deduzir: 190.4 },
];

const IR_2026: IrBracket[] = [
  { ordem: 1, valor_de: 0, valor_ate: 2428.8, aliquota: 0, parcela_deduzir: 0, deducao_dependente: 189.59 },
  { ordem: 2, valor_de: 2428.81, valor_ate: 2826.65, aliquota: 0.075, parcela_deduzir: 182.16, deducao_dependente: 189.59 },
  { ordem: 3, valor_de: 2826.66, valor_ate: 3751.05, aliquota: 0.15, parcela_deduzir: 394.16, deducao_dependente: 189.59 },
  { ordem: 4, valor_de: 3751.06, valor_ate: 4664.68, aliquota: 0.225, parcela_deduzir: 675.49, deducao_dependente: 189.59 },
  { ordem: 5, valor_de: 4664.69, valor_ate: null, aliquota: 0.275, parcela_deduzir: 908.73, deducao_dependente: 189.59 },
];

// Redutor Lei 15.270/2025 (202606120005_folha_v2_adendos.sql)
const REDUTOR_2026: RedutorIrrf = {
  limite_isencao: 5000,
  limite_reducao: 7350,
  coef_fixo: 978.62,
  coef_mult: 0.133145,
};

// --- rubricas usadas na conferencia ---
function rub(
  codigo: string,
  nome: string,
  tipo: RubricaDef["tipo"],
  metodo: string,
  inc: Partial<Pick<RubricaDef, "incide_inss" | "incide_irrf" | "incide_fgts" | "incide_dsr">> = {},
): RubricaDef {
  return {
    id: codigo,
    codigo,
    nome,
    tipo,
    metodo_calculo: metodo,
    incide_inss: inc.incide_inss ?? false,
    incide_irrf: inc.incide_irrf ?? false,
    incide_fgts: inc.incide_fgts ?? false,
    incide_dsr: inc.incide_dsr ?? false,
    ordem_holerite: 0,
  };
}

const TODAS = {
  salario_base: rub("salario_base", "Salario base", "provento", "salario_base", {
    incide_inss: true, incide_irrf: true, incide_fgts: true,
  }),
  // professor: o salario-aulas e a base sobre a qual o DSR incide
  salario_base_dsr: rub("salario_base", "Salario base", "provento", "salario_base", {
    incide_inss: true, incide_irrf: true, incide_fgts: true, incide_dsr: true,
  }),
  dsr: rub("dsr", "DSR", "provento", "dsr", { incide_inss: true, incide_irrf: true, incide_fgts: true }),
  salario_dobra: rub("salario_dobra", "Salario dobra", "provento", "valor_contratual", {
    incide_inss: true, incide_irrf: true, incide_fgts: true,
  }),
  // DSR da dobra: a planilha traz numa 2a coluna "DSR", digitada a mao
  // (nao e dobra/6 nem dobra/5) — entra como verba, nao como calculo.
  dsr_dobra: rub("dsr_dobra", "DSR s/ dobra", "provento", "valor_contratual", {
    incide_inss: true, incide_irrf: true, incide_fgts: true,
  }),
  adicional: rub("adicional", "Adicional", "provento", "valor_contratual", {
    incide_inss: true, incide_irrf: true, incide_fgts: true,
  }),
  gratificacao: rub("gratificacao", "Gratificacao", "provento", "valor_contratual", {
    incide_inss: true, incide_irrf: true, incide_fgts: true,
  }),
  decenio: rub("decenio", "Decenio", "provento", "valor_contratual", {
    incide_inss: true, incide_irrf: true, incide_fgts: true,
  }),
  // "desconsiderar": provento pago FORA da base de INSS/IRRF (regra da casa)
  desconsiderar: rub("desconsiderar", "Desconsiderar (fora da base)", "provento", "valor_contratual", {}),
  um_terco_ferias: rub("um_terco_ferias", "1/3 ferias", "provento", "valor_contratual", {}),
  salario_familia: rub("salario_familia", "Salario familia", "provento", "valor_contratual", {}),
  // estagiario: bolsa nao sofre INSS/IRRF (Lei 11.788/2008)
  bolsa_estagio: rub("salario_base", "Bolsa estagio", "provento", "salario_base", {}),
  inss: rub("inss", "INSS", "desconto", "inss"),
  irrf: rub("irrf", "IRRF", "desconto", "irrf"),
  consignado: rub("consignado", "Consignado", "desconto", "valor_contratual"),
  adiantamento: rub("adiantamento", "Adiantamento", "desconto", "valor_contratual"),
} satisfies Record<string, RubricaDef>;

/** Ordem importa: proventos -> dsr -> inss -> irrf. */
function montarPerfil(codigos: string[], comDsr: boolean, estagiario = false): PerfilRubrica[] {
  const ordem = [
    "salario_base", "salario_dobra", "dsr_dobra", "adicional", "gratificacao", "decenio",
    "desconsiderar", "um_terco_ferias", "salario_familia",
    "dsr", "inss", "irrf", "consignado", "adiantamento",
  ];
  const ativos = new Set(codigos);
  if (!estagiario) {
    ativos.add("inss");
    ativos.add("irrf");
  }

  return ordem
    .filter((c) => ativos.has(c))
    .map((c, i) => {
      const base =
        c === "salario_base"
          ? estagiario
            ? TODAS.bolsa_estagio
            : comDsr
              ? TODAS.salario_base_dsr
              : TODAS.salario_base
          : TODAS[c as keyof typeof TODAS];
      return { rubrica: base, automatica: true, ordem_execucao: i + 1 };
    });
}

// --- leitura da planilha ---
type Coluna = { nome: string; idx: number };

type LinhaPlanilha = {
  linha: number;
  nome: string;
  valores: Map<string, number>;
  totalPlanilha: number | null;
  liquidoPlanilha: number | null;
  estagiario: boolean;
};

function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Mapeia o cabecalho da planilha para os codigos de rubrica do motor. */
const MAPA_COLUNAS: Record<string, string> = {
  "SALARIO BASE": "salario_base",
  "SALARIO": "salario_base",
  "SALARIO S/ DSR": "__salario_sem_dsr",
  "SAL/RIO S/ DSR": "__salario_sem_dsr",
  "DSR": "__dsr_planilha",
  "ADICIONAL": "adicional",
  "SALARIO DOBRA": "salario_dobra",
  "GRATIFICACAO": "gratificacao",
  "DECENIO": "decenio",
  "DESCONSIDERAR": "desconsiderar",
  "1/3 FERIAS": "um_terco_ferias",
  "TOTAL": "__total",
  "TOTAL SALARIO": "__total",
  "INSS": "__inss",
  "GPS": "__inss",
  "IRRF": "__irrf",
  "IR": "__irrf",
  "CONSIG": "consignado",
  "CONS": "consignado",
  "CONSEGUI": "consignado",
  "ADIANT": "adiantamento",
  "ADIANT.": "adiantamento",
  "FAMILIA": "salario_familia",
  "DEDUCOES": "__deducoes",
  "RECEBER": "__liquido",
};

function acharCabecalho(rows: unknown[][]): { linha: number; colunas: Coluna[] } | null {
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r] ?? [];
    const temNome = row.some((c) => /FUNCION/i.test(String(c ?? "")));
    if (!temNome) continue;
    const colunas: Coluna[] = [];
    row.forEach((c, i) => {
      const k = norm(c);
      if (k) colunas.push({ nome: k, idx: i });
    });
    return { linha: r, colunas };
  }
  return null;
}

function lerAba(rows: unknown[][], nomeAba: string): LinhaPlanilha[] {
  const cab = acharCabecalho(rows);
  if (!cab) {
    console.warn(`  [aviso] cabecalho nao encontrado em "${nomeAba}" — aba ignorada`);
    return [];
  }

  const colNome = cab.colunas.find((c) => /FUNCION|NOME|COLABORADOR/.test(c.nome));
  if (!colNome) return [];

  const out: LinhaPlanilha[] = [];
  for (let r = cab.linha + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const nome = String(row[colNome.idx] ?? "").trim();
    if (!nome || nome.length < 4) continue;
    if (/^TOTA|^SOMA|=\s*=/.test(norm(nome))) continue;

    const valores = new Map<string, number>();
    let dsrVistos = 0;
    let total: number | null = null;
    let liquido: number | null = null;

    for (const col of cab.colunas) {
      let alvo = MAPA_COLUNAS[col.nome];
      if (!alvo) continue;

      // A aba de professor tem DUAS colunas "DSR": a 1a e o DSR do salario
      // (derivado pelo motor), a 2a e o DSR da dobra (digitado a mao).
      if (alvo === "__dsr_planilha") {
        dsrVistos++;
        if (dsrVistos >= 2) alvo = "dsr_dobra";
      }

      const v = num(row[col.idx]);
      if (v == null || v === 0) continue;

      if (alvo === "__total") total = v;
      else if (alvo === "__liquido") liquido = v;
      else if (alvo.startsWith("__")) valores.set(alvo, v);
      else valores.set(alvo, v);
    }

    if (valores.size === 0 && total == null) continue;

    const estagiario = row.some((c) => /ESTAGI/.test(norm(c)));
    out.push({ linha: r + 1, nome, valores, totalPlanilha: total, liquidoPlanilha: liquido, estagiario });
  }
  return out;
}

// --- comparacao ---
type Divergencia = {
  aba: string;
  linha: number;
  nome: string;
  campo: string;
  planilha: number;
  motor: number;
  delta: number;
};

function conferirLinha(
  l: LinhaPlanilha,
  aba: string,
  temDsr: boolean,
  tolerancia: number,
): {
  divs: Divergencia[];
  ok: boolean;
  semBase: boolean;
  semInss?: { nome: string; aba: string; base: number; devido: number };
} {
  // A planilha decompoe o salario do professor: "Salario base" JA inclui o DSR.
  //   SALARIO S/ DSR = base_cheia * 5/6
  //   DSR            = base_cheia / 6        (= 20% da parte s/ DSR)
  // O motor calcula DSR = verba / divisor_dsr. Passando a parte s/ DSR, o divisor
  // equivalente e 5 — NAO 6. Os dois falam "6" sobre bases diferentes.
  const salarioBase = temDsr
    ? (l.valores.get("__salario_sem_dsr") ?? l.valores.get("salario_base"))
    : l.valores.get("salario_base");
  if (salarioBase == null) return { divs: [], ok: false, semBase: true };

  // Estagiario: bolsa de estagio nao sofre INSS nem IRRF (Lei 11.788/2008).
  // A planilha reflete isso — nenhum desconto nas linhas marcadas "Estagiaria".
  const ehEstagiario = l.estagiario;

  // Na aba de professor a planilha quebra o salario em "s/ DSR" + "DSR".
  // O motor recebe o salario cheio e deriva o DSR sozinho (divisor 6).
  const verbas = [
    "salario_dobra", "dsr_dobra", "adicional", "gratificacao", "decenio",
    "desconsiderar", "um_terco_ferias", "salario_familia",
    "consignado", "adiantamento",
  ]
    .map((c) => ({ rubrica_codigo: c, valor: l.valores.get(c) ?? null, percentual: null }))
    .filter((v) => v.valor != null);

  const codigos = ["salario_base", ...verbas.map((v) => v.rubrica_codigo)];
  if (temDsr) codigos.push("dsr");

  const res = calcularItem({
    contrato: {
      id: l.nome,
      salario_base: salarioBase,
      valor_hora_aula: null,
      aulas_semanais: null,
      dependentes_irrf: 0,
      verbas,
    },
    perfilRubricas: montarPerfil(codigos, temDsr, ehEstagiario),
    config: { divisor_dsr: temDsr ? 5 : 6, percentual_hora_atividade: 0, semanas_mes: 4.5 },
    manuais: [],
    faixas: { inss: INSS_2026, ir: IR_2026 },
    redutor: REDUTOR_2026,
  });

  const divs: Divergencia[] = [];
  const push = (campo: string, planilha: number | null, motor: number) => {
    if (planilha == null) return;
    const delta = Math.round((motor - planilha) * 100) / 100;
    if (Math.abs(delta) > tolerancia) {
      divs.push({ aba, linha: l.linha, nome: l.nome, campo, planilha, motor, delta });
    }
  };

  const inssMotor = res.lancamentos.find((x) => x.rubrica_codigo === "inss")?.valor ?? 0;
  const irrfMotor = res.lancamentos.find((x) => x.rubrica_codigo === "irrf")?.valor ?? 0;

  // A planilha nao lancou INSS numa linha com base tributavel: nao e divergencia
  // de calculo, e falta de lancamento (ou o contrato nao e CLT — PJ/RPA/estagio).
  // Sai numa secao propria em vez de poluir a comparacao do motor.
  const inssPlanilha = l.valores.get("__inss") ?? null;
  if (!ehEstagiario && inssPlanilha == null && inssMotor > 0) {
    return {
      divs: [],
      ok: false,
      semBase: false,
      semInss: { nome: l.nome, aba, base: res.base_inss, devido: inssMotor },
    };
  }

  push("total_proventos", l.totalPlanilha, res.total_proventos);
  push("inss", l.valores.get("__inss") ?? null, inssMotor);
  push("irrf", l.valores.get("__irrf") ?? null, irrfMotor);
  push("deducoes", l.valores.get("__deducoes") ?? null, res.total_descontos);
  push("liquido", l.liquidoPlanilha, res.liquido);

  return { divs, ok: divs.length === 0, semBase: false };
}

// --- main ---
const ARQUIVOS = [
  {
    file: "public/11714876000116.xlsx",
    empresa: "Escola Pinguinho de Gente (11714876000116)",
    abas: [
      { nome: "Professores", dsr: true },
      { nome: "Funcionários", dsr: false },
      { nome: "F. FUND. II", dsr: true },
    ],
  },
  {
    file: "public/35027047000123.xlsx",
    empresa: "Colegio Integrado EPG (35027047000123)",
    abas: [
      { nome: "PROFESSORES", dsr: false },
      { nome: "ADMINISTRATIVO", dsr: false },
      { nome: "ENSINO MÉDIO", dsr: false },
    ],
  },
];

async function main(): Promise<void> {
  const filtroAba = process.env.ABA;
  const tolerancia = Number(process.env.TOLERANCIA ?? 0.02);

  const todas: Divergencia[] = [];
  let totalLinhas = 0;
  let totalOk = 0;
  let totalSemBase = 0;
  const semInss: { nome: string; aba: string; base: number; devido: number }[] = [];

  for (const arq of ARQUIVOS) {
    console.log(`\n${"=".repeat(78)}\n${arq.empresa}\n${"=".repeat(78)}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(arq.file);

    for (const aba of arq.abas) {
      if (filtroAba && norm(aba.nome) !== norm(filtroAba)) continue;
      const ws = wb.getWorksheet(aba.nome);
      if (!ws) {
        console.log(`\n  [!] aba "${aba.nome}" nao encontrada`);
        continue;
      }

      const rows: unknown[][] = [];
      ws.eachRow({ includeEmpty: true }, (row, n) => {
        const vals: unknown[] = [];
        row.eachCell({ includeEmpty: true }, (cell, c) => {
          vals[c - 1] = cellVal(cell);
        });
        rows[n - 1] = vals;
      });

      const linhas = lerAba(rows, aba.nome);

      let ok = 0;
      let semBase = 0;
      let semInssAba = 0;
      const divsAba: Divergencia[] = [];
      for (const l of linhas) {
        const r = conferirLinha(l, aba.nome, aba.dsr, tolerancia);
        if (r.semBase) semBase++;
        else if (r.semInss) {
          semInss.push(r.semInss);
          semInssAba++;
        } else if (r.ok) ok++;
        divsAba.push(...r.divs);
      }

      totalLinhas += linhas.length;
      totalOk += ok;
      totalSemBase += semBase;
      todas.push(...divsAba);

      const conferidas = linhas.length - semBase;
      const pct = conferidas > 0 ? ((ok / conferidas) * 100).toFixed(0) : "--";
      console.log(
        `\n  ${aba.nome.padEnd(16)} ${String(conferidas).padStart(3)} pessoas  ` +
          `${String(ok).padStart(3)} batem (${pct}%)  ` +
          `${String(divsAba.length).padStart(3)} divergencias` +
          (semBase ? `  [${semBase} sem salario base]` : ""),
      );
    }
  }

  if (todas.length > 0) {
    console.log(`\n${"=".repeat(78)}\nDIVERGENCIAS (tolerancia R$ ${tolerancia.toFixed(2)})\n${"=".repeat(78)}`);
    const porCampo = new Map<string, Divergencia[]>();
    for (const d of todas) {
      const arr = porCampo.get(d.campo) ?? [];
      arr.push(d);
      porCampo.set(d.campo, arr);
    }

    const grupos = Array.from(porCampo.entries()).sort((a, b) => b[1].length - a[1].length);
    for (const [campo, ds] of grupos) {
      console.log(`\n### ${campo}  (${ds.length})`);
      console.log(
        `${"pessoa".padEnd(30)} ${"aba".padEnd(14)} ${"planilha".padStart(11)} ${"motor".padStart(11)} ${"delta".padStart(10)}`,
      );
      for (const d of ds.slice(0, 40)) {
        console.log(
          `${d.nome.slice(0, 30).padEnd(30)} ${d.aba.slice(0, 14).padEnd(14)} ` +
            `${d.planilha.toFixed(2).padStart(11)} ${d.motor.toFixed(2).padStart(11)} ` +
            `${(d.delta > 0 ? "+" : "") + d.delta.toFixed(2)}`.padStart(11),
        );
      }
      if (ds.length > 40) console.log(`  ... e mais ${ds.length - 40}`);
    }
  }

  if (semInss.length > 0) {
    const somaDevido = semInss.reduce((a, x) => a + x.devido, 0);
    console.log(`\n${"=".repeat(78)}`);
    console.log(`PLANILHA SEM LANCAMENTO DE INSS (${semInss.length} pessoas)`);
    console.log(
      "Nao e divergencia de calculo: a linha tem base tributavel e nenhum INSS.\n" +
        "Ou o contrato nao e CLT (PJ / RPA / estagio), ou faltou lancar.",
    );
    console.log("=".repeat(78));
    console.log(`${"pessoa".padEnd(32)} ${"aba".padEnd(16)} ${"base".padStart(10)} ${"INSS devido".padStart(12)}`);
    for (const x of semInss) {
      console.log(
        `${x.nome.slice(0, 32).padEnd(32)} ${x.aba.slice(0, 16).padEnd(16)} ` +
          `${x.base.toFixed(2).padStart(10)} ${x.devido.toFixed(2).padStart(12)}`,
      );
    }
    console.log(`${"".padEnd(49)} ${"TOTAL/mes".padStart(10)} ${somaDevido.toFixed(2).padStart(12)}`);
  }

  const conferidas = totalLinhas - totalSemBase - semInss.length;
  console.log(`\n${"=".repeat(78)}`);
  console.log(
    `RESUMO: ${totalOk}/${conferidas} pessoas batem ` +
      `(${conferidas > 0 ? ((totalOk / conferidas) * 100).toFixed(0) : "--"}%)  |  ` +
      `${todas.length} divergencias  |  ${semInss.length} sem INSS na planilha  |  ` +
      `${totalSemBase} linhas sem salario base`,
  );
  console.log(`${"=".repeat(78)}\n`);
}

function cellVal(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown };
    if (o.result != null) return o.result;
    if (o.text != null) return o.text;
    return null;
  }
  return v;
}

import { it } from "vitest";
it("confere folha-v2 contra as planilhas do RH", { timeout: 120_000 }, async () => {
  await main();
});
