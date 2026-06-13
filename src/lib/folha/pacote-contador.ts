import ExcelJS from "exceljs";

const MOEDA = '"R$ "#,##0.00';
const YELLOW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF3CD" },
};

type Lancamento = {
  rubrica_codigo: string;
  rubrica_nome: string;
  rubrica_tipo: string;
  referencia: string | null;
  valor: number;
  origem: string;
};

type ItemRow = {
  id: string;
  base_inss: number;
  base_fgts: number;
  total_proventos: number;
  total_descontos: number;
  liquido: number;
  employee_nome: string;
  employee_cpf: string;
  perfil_codigo: string;
  perfil_nome: string;
  empresa_nome: string;
  lancamentos: Lancamento[];
};

type ItemEspecial = {
  employee_nome: string;
  employee_cpf: string;
  tipo: string;
  base: number;
  memoria_media: string;
  avos: number | null;
  total_proventos: number;
  inss: number;
  irrf: number;
  liquido: number;
};

type Provisao = {
  contrato_id: string;
  funcionario_nome: string;
  tipo: string;
  saldo_acumulado: number;
};

export type PacoteInput = {
  competencia: string;
  empresa_nome: string;
  itens: ItemRow[];
  provisoes: Provisao[];
  itensEspeciais?: ItemEspecial[];
};

function estiloCabecalho(ws: ExcelJS.Worksheet, rowNum: number, numCols: number) {
  const row = ws.getRow(rowNum);
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B4FD8" },
  };
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  }
  row.commit();
}

function addResumo(wb: ExcelJS.Workbook, itens: ItemRow[]) {
  const ws = wb.addWorksheet("Resumo");

  ws.columns = [
    { header: "Empresa", key: "empresa", width: 30 },
    { header: "Total Proventos", key: "proventos", width: 18 },
    { header: "Total Descontos", key: "descontos", width: 18 },
    { header: "Líquido", key: "liquido", width: 16 },
    { header: "Base INSS", key: "base_inss", width: 16 },
    { header: "INSS Patronal (20%)", key: "inss_patronal", width: 22 },
    { header: "FGTS (8%)", key: "fgts", width: 16 },
  ];

  const byEmpresa = new Map<string, { proventos: number; descontos: number; liquido: number; base_inss: number; base_fgts: number }>();
  for (const item of itens) {
    const prev = byEmpresa.get(item.empresa_nome) ?? { proventos: 0, descontos: 0, liquido: 0, base_inss: 0, base_fgts: 0 };
    byEmpresa.set(item.empresa_nome, {
      proventos: prev.proventos + item.total_proventos,
      descontos: prev.descontos + item.total_descontos,
      liquido: prev.liquido + item.liquido,
      base_inss: prev.base_inss + item.base_inss,
      base_fgts: prev.base_fgts + item.base_fgts,
    });
  }

  for (const [empresa, v] of Array.from(byEmpresa)) {
    ws.addRow({
      empresa,
      proventos: v.proventos,
      descontos: v.descontos,
      liquido: v.liquido,
      base_inss: v.base_inss,
      inss_patronal: Math.round(v.base_inss * 0.2 * 100) / 100,
      fgts: Math.round(v.base_fgts * 0.08 * 100) / 100,
    });
  }

  estiloCabecalho(ws, 1, 7);
  ["proventos", "descontos", "liquido", "base_inss", "inss_patronal", "fgts"].forEach((k) => {
    ws.getColumn(k).numFmt = MOEDA;
  });
}

function addAnalitico(wb: ExcelJS.Workbook, itens: ItemRow[]) {
  const ws = wb.addWorksheet("Analítico");

  ws.columns = [
    { header: "Funcionário", key: "nome", width: 30 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Perfil", key: "perfil", width: 20 },
    { header: "Rubrica", key: "rubrica", width: 25 },
    { header: "Referência", key: "referencia", width: 16 },
    { header: "Valor", key: "valor", width: 14 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "Origem", key: "origem", width: 12 },
  ];

  for (const item of itens) {
    for (const lanc of item.lancamentos) {
      const row = ws.addRow({
        nome: item.employee_nome,
        cpf: item.employee_cpf,
        perfil: item.perfil_nome,
        rubrica: lanc.rubrica_nome,
        referencia: lanc.referencia ?? "",
        valor: lanc.valor,
        tipo: lanc.rubrica_tipo,
        origem: lanc.origem,
      });
      if (lanc.origem === "manual") {
        row.fill = YELLOW_FILL;
      }
    }
  }

  estiloCabecalho(ws, 1, 8);
  ws.getColumn("valor").numFmt = MOEDA;
}

function addRpaPj(wb: ExcelJS.Workbook, itens: ItemRow[]) {
  const ws = wb.addWorksheet("RPA-PJ");

  ws.columns = [
    { header: "Prestador", key: "nome", width: 30 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Perfil", key: "perfil", width: 16 },
    { header: "Bruto", key: "bruto", width: 14 },
    { header: "INSS Retido", key: "inss_retido", width: 16 },
    { header: "IRRF", key: "irrf", width: 14 },
    { header: "Líquido", key: "liquido", width: 14 },
  ];

  const rpaPj = itens.filter((i) =>
    i.perfil_codigo === "rpa" || i.perfil_codigo === "pj"
  );

  for (const item of rpaPj) {
    const bruto = item.lancamentos
      .filter((l) => l.rubrica_tipo === "provento")
      .reduce((s, l) => s + l.valor, 0);
    const inss_retido = item.lancamentos
      .filter((l) => l.rubrica_codigo === "inss_rpa")
      .reduce((s, l) => s + l.valor, 0);
    const irrf = item.lancamentos
      .filter((l) => l.rubrica_codigo === "irrf")
      .reduce((s, l) => s + l.valor, 0);

    ws.addRow({
      nome: item.employee_nome,
      cpf: item.employee_cpf,
      perfil: item.perfil_nome,
      bruto,
      inss_retido,
      irrf,
      liquido: item.liquido,
    });
  }

  if (rpaPj.length === 0) {
    ws.addRow({ nome: "Nenhum prestador RPA/PJ nesta competência." });
  }

  estiloCabecalho(ws, 1, 7);
  ["bruto", "inss_retido", "irrf", "liquido"].forEach((k) => {
    ws.getColumn(k).numFmt = MOEDA;
  });
}

function addProvisoes(wb: ExcelJS.Workbook, provisoes: Provisao[]) {
  const ws = wb.addWorksheet("Provisões");

  const TIPO_LABEL: Record<string, string> = {
    decimo_terceiro: "13º Salário",
    ferias: "Férias",
    fgts: "FGTS",
    inss_patronal: "INSS Patronal",
  };

  ws.columns = [
    { header: "Funcionário", key: "nome", width: 30 },
    { header: "Tipo", key: "tipo", width: 22 },
    { header: "Saldo Acumulado", key: "saldo", width: 18 },
  ];

  const byKey = new Map<string, { nome: string; tipo: string; saldo: number }>();
  for (const p of provisoes) {
    const key = `${p.contrato_id}|${p.tipo}`;
    const prev = byKey.get(key);
    if (!prev || p.saldo_acumulado > prev.saldo) {
      byKey.set(key, { nome: p.funcionario_nome, tipo: p.tipo, saldo: p.saldo_acumulado });
    }
  }

  const sorted = Array.from(byKey.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  for (const entry of sorted) {
    ws.addRow({
      nome: entry.nome,
      tipo: TIPO_LABEL[entry.tipo] ?? entry.tipo,
      saldo: entry.saldo,
    });
  }

  if (sorted.length === 0) {
    ws.addRow({ nome: "Nenhuma provisão registrada." });
  }

  estiloCabecalho(ws, 1, 3);
  ws.getColumn("saldo").numFmt = MOEDA;
}

const TIPO_ESPECIAL_LABEL: Record<string, string> = {
  ferias: "Férias",
  decimo_1a: "13º — 1ª parcela",
  decimo_2a: "13º — 2ª parcela",
};

function addFeriasDecimo(wb: ExcelJS.Workbook, itens: ItemEspecial[]) {
  const ws = wb.addWorksheet("Ferias-13o");

  ws.columns = [
    { header: "Funcionário", key: "nome", width: 30 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Tipo", key: "tipo", width: 20 },
    { header: "Base", key: "base", width: 16 },
    { header: "Memória da Média", key: "memoria", width: 40 },
    { header: "Avos", key: "avos", width: 8 },
    { header: "Proventos", key: "proventos", width: 16 },
    { header: "INSS", key: "inss", width: 14 },
    { header: "IRRF", key: "irrf", width: 14 },
    { header: "Líquido", key: "liquido", width: 16 },
  ];

  for (const item of itens) {
    ws.addRow({
      nome: item.employee_nome,
      cpf: item.employee_cpf,
      tipo: TIPO_ESPECIAL_LABEL[item.tipo] ?? item.tipo,
      base: item.base,
      memoria: item.memoria_media,
      avos: item.avos ?? "",
      proventos: item.total_proventos,
      inss: item.inss,
      irrf: item.irrf,
      liquido: item.liquido,
    });
  }

  if (itens.length === 0) {
    ws.addRow({ nome: "Nenhum lançamento especial nesta competência." });
  }

  estiloCabecalho(ws, 1, 10);
  ["base", "proventos", "inss", "irrf", "liquido"].forEach((k) => {
    ws.getColumn(k).numFmt = MOEDA;
  });
}

export async function gerarPacoteContador(input: PacoteInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "rrb-escola";
  wb.created = new Date();

  addResumo(wb, input.itens);
  addAnalitico(wb, input.itens);
  addRpaPj(wb, input.itens);
  addProvisoes(wb, input.provisoes);
  if (input.itensEspeciais && input.itensEspeciais.length > 0) {
    addFeriasDecimo(wb, input.itensEspeciais);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
