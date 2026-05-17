import { mapTurmaHeader } from "./turma-mapper.mjs";

function cellText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null) {
    if ("text" in v) return cellText(v.text);
    if ("result" in v) return cellText(v.result);
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map(r => r.text).join("");
    }
  }
  return "";
}

function cellNumber(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    return cellNumber(v.result);
  }
  return null;
}

function findTurmaHeader(rowValues) {
  for (const v of rowValues) {
    const t = cellText(v).trim();
    if (!t) continue;
    const mapped = mapTurmaHeader(t);
    if (mapped) return t; // retorna label original
  }
  return null;
}

function isAlunoHeaderRow(rowValues) {
  return rowValues.some(v => cellText(v).trim().toUpperCase() === "ALUNO");
}

function extractNameAndValue(rowValues) {
  let nome = null;
  let valor = null;
  for (const v of rowValues) {
    const t = cellText(v).trim();
    if (!nome && t.length > 5) {
      const up = t.toUpperCase();
      if (up === "ALUNO" || up.startsWith("MATRICULA")) continue;
      if (mapTurmaHeader(t)) continue;
      nome = t;
      continue;
    }
    if (nome && valor == null) {
      const n = cellNumber(v);
      if (n != null && n > 0) {
        valor = n;
        break;
      }
    }
  }
  return { nome, valor };
}

export function parseMatriculadosXlsx(workbook) {
  const items = [];
  for (const ws of workbook.worksheets) {
    let currentTurma = null;
    let seenAlunoHeader = false;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];

      const header = findTurmaHeader(values);
      if (header) {
        currentTurma = header;
        seenAlunoHeader = false;
        return;
      }

      if (currentTurma && !seenAlunoHeader) {
        if (isAlunoHeaderRow(values)) {
          seenAlunoHeader = true;
          return;
        }
      }

      if (currentTurma && seenAlunoHeader) {
        const { nome, valor } = extractNameAndValue(values);
        if (nome) {
          items.push({
            nome_raw: nome,
            sheet: ws.name,
            turma_label: currentTurma,
            mensalidade: valor
          });
        }
      }
    });
  }
  return items;
}
