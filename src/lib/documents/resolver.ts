import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_TABLES,
  isAllowedTable,
  isComputedFn,
  type Mapping,
  type ComputedFn,
} from "./schema-catalog";

const MESES = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro",
];

export type ResolverContext = {
  supabase: SupabaseClient;
  matriculaId: string;
  alunoId: string;
  escolaId: string;
};

type MatriculaRow = {
  id: string;
  ano_letivo: number | null;
  data_matricula: string | null;
  idade_na_matricula: number | null;
  observacoes: string | null;
  status: string | null;
  codigo: string | null;
  serie_id: string | null;
  turma_id: string | null;
  plano_id: string | null;
  escola_id: string;
};

function formatDataExtenso(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatCidadeDataExtenso(cidade: string | null, d: Date): string {
  const c = cidade && cidade.trim() ? cidade.trim() : "Trindade";
  return `${c}, ${formatDataExtenso(d)}`;
}

function formatEndereco(e: Record<string, unknown> | null): string {
  if (!e) return "";
  const parts = [
    e.logradouro,
    e.numero ? `nº ${e.numero}` : null,
    e.complemento,
    e.bairro,
    e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade,
    e.cep,
  ]
    .filter((v) => typeof v === "string" && v)
    .map((v) => String(v));
  return parts.join(", ");
}

function calcularIdade(dataNasc: string | null): string {
  if (!dataNasc) return "";
  const nasc = new Date(`${dataNasc}T00:00:00Z`);
  if (Number.isNaN(nasc.getTime())) return "";
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getUTCFullYear();
  const m = hoje.getMonth() - nasc.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getUTCDate())) idade--;
  return String(idade);
}

function applyFilter(rows: Record<string, unknown>[], filter: string | null): Record<string, unknown> | null {
  if (rows.length === 0) return null;
  if (!filter || filter === "first") return rows[0];
  switch (filter) {
    case "pai":
      return rows.find((r) => ["pai","padrasto"].includes(String(r.parentesco ?? "").toLowerCase())) ?? null;
    case "mae":
      return rows.find((r) => ["mae","mãe","madrasta"].includes(String(r.parentesco ?? "").toLowerCase())) ?? null;
    case "financeiro":
      return rows.find((r) => r.responsavel_financeiro === true) ?? null;
    case "principal":
      return rows.find((r) => r.principal === true) ?? rows[0];
    case "ativa":
      return rows.find((r) => r.status === "ativa") ?? null;
    case "ultima": {
      const sorted = [...rows].sort((a, b) => {
        const ta = String(a.created_at ?? "");
        const tb = String(b.created_at ?? "");
        return tb.localeCompare(ta);
      });
      return sorted[0] ?? null;
    }
    default:
      return rows[0];
  }
}

async function loadTableRows(
  supabase: SupabaseClient,
  table: string,
  ctx: ResolverContext,
  matricula: MatriculaRow | null,
  columns: Set<string>,
): Promise<Record<string, unknown>[]> {
  const colsForSelect = Array.from(columns);
  // Sempre incluir campos usados pelos filtros para evitar refetch
  const extraByTable: Record<string, string[]> = {
    responsaveis_aluno: ["parentesco", "responsavel_financeiro"],
    enderecos_aluno: ["principal"],
    matriculas: ["status", "created_at"],
  };
  for (const extra of (extraByTable[table] ?? [])) {
    if (!columns.has(extra)) colsForSelect.push(extra);
  }
  const select = colsForSelect.join(", ");

  switch (table) {
    case "alunos": {
      const { data } = await supabase.from("alunos").select(select).eq("id", ctx.alunoId);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "responsaveis_aluno":
    case "enderecos_aluno":
    case "contatos_aluno":
    case "informacoes_medicas": {
      const { data } = await supabase.from(table).select(select).eq("aluno_id", ctx.alunoId);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "matriculas": {
      const { data } = await supabase.from("matriculas").select(select).eq("id", ctx.matriculaId);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "series": {
      if (!matricula?.serie_id) return [];
      const { data } = await supabase.from("series").select(select).eq("id", matricula.serie_id);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "turmas": {
      if (!matricula?.turma_id) return [];
      const { data } = await supabase.from("turmas").select(select).eq("id", matricula.turma_id);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "planos": {
      if (!matricula?.plano_id) return [];
      const { data } = await supabase.from("planos").select(select).eq("id", matricula.plano_id);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    case "escolas": {
      const { data } = await supabase.from("escolas").select(select).eq("id", ctx.escolaId);
      return (data as Record<string, unknown>[] | null) ?? [];
    }
    default:
      return [];
  }
}

async function runComputed(
  fn: ComputedFn,
  ctx: ResolverContext,
  matricula: MatriculaRow | null,
): Promise<string> {
  const supabase = ctx.supabase;
  const now = new Date();
  switch (fn) {
    case "data_hoje_extenso":
      return formatDataExtenso(now);
    case "ano_letivo_atual":
      return String(now.getFullYear());
    case "cidade_data_extenso": {
      const { data } = await supabase.from("escolas").select("nome").eq("id", ctx.escolaId).maybeSingle();
      // No schema atual, escolas só tem `nome`. Usamos "Trindade" como padrão da cidade.
      void data;
      return formatCidadeDataExtenso(null, now);
    }
    case "idade_atual": {
      const { data } = await supabase.from("alunos").select("data_nascimento").eq("id", ctx.alunoId).maybeSingle();
      return calcularIdade((data?.data_nascimento as string | null) ?? null);
    }
    case "endereco_principal_formatado": {
      const { data } = await supabase
        .from("enderecos_aluno")
        .select("logradouro,numero,complemento,bairro,cidade,uf,cep,principal")
        .eq("aluno_id", ctx.alunoId);
      const rows = (data as Record<string, unknown>[] | null) ?? [];
      const principal = rows.find((r) => r.principal === true) ?? rows[0] ?? null;
      return formatEndereco(principal);
    }
    case "tipo_ensino_via_series_segmentos": {
      if (!matricula?.serie_id) return "";
      const { data } = await supabase
        .from("series")
        .select("segmentos(nome)")
        .eq("id", matricula.serie_id)
        .maybeSingle();
      const seg = data?.segmentos as { nome?: string } | { nome?: string }[] | null | undefined;
      const segObj = Array.isArray(seg) ? seg[0] ?? null : seg ?? null;
      return segObj?.nome ?? "";
    }
  }
}

export async function resolveMappings(
  mappings: Mapping[],
  ctx: ResolverContext,
): Promise<Record<string, string>> {
  // Busca a matrícula uma única vez (precisa de serie_id/turma_id/plano_id para outras queries).
  const { data: matricula } = await ctx.supabase
    .from("matriculas")
    .select("id, ano_letivo, data_matricula, idade_na_matricula, observacoes, status, codigo, serie_id, turma_id, plano_id, escola_id")
    .eq("id", ctx.matriculaId)
    .maybeSingle();
  const mat = (matricula as MatriculaRow | null) ?? null;

  // Agrupar mappings por tabela + acumular colunas necessárias.
  const tableCols = new Map<string, Set<string>>();
  for (const m of mappings) {
    if (m.type !== "tabela") continue;
    if (!isAllowedTable(m.table)) continue;
    if (!tableCols.has(m.table)) tableCols.set(m.table, new Set());
    tableCols.get(m.table)!.add(m.column);
  }

  // Carregar todas as tabelas em paralelo.
  const tableEntries = Array.from(tableCols.entries());
  const loaded: Map<string, Record<string, unknown>[]> = new Map();
  await Promise.all(
    tableEntries.map(async ([table, cols]) => {
      const rows = await loadTableRows(ctx.supabase, table, ctx, mat, cols);
      loaded.set(table, rows);
    }),
  );

  // Resolver cada mapping.
  const out: Record<string, string> = {};
  for (const m of mappings) {
    if (m.type === "computed") {
      if (!isComputedFn(m.fn)) {
        out[m.placeholder] = "";
        continue;
      }
      out[m.placeholder] = (await runComputed(m.fn, ctx, mat)) ?? "";
      continue;
    }
    if (m.type === "tabela") {
      if (!isAllowedTable(m.table)) {
        out[m.placeholder] = "";
        continue;
      }
      const rows = loaded.get(m.table) ?? [];
      const row = applyFilter(rows, m.filter);
      const v = row ? row[m.column] : null;
      out[m.placeholder] = v === null || v === undefined ? "" : String(v);
      continue;
    }
  }
  return out;
}
