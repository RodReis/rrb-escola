// Allowlist de tabelas/colunas/filtros disponíveis para mapping de templates.
// Backend valida contra esta lista. Frontend só oferece o que está aqui.

export type AllowedFilter =
  | "pai" | "mae" | "financeiro" | "first"
  | "principal" | "ativa" | "ultima";

export type AllowedTableConfig = {
  columns: readonly string[];
  filters: readonly AllowedFilter[];
};

export const ALLOWED_TABLES: Record<string, AllowedTableConfig> = {
  alunos: {
    columns: [
      "nome", "cpf", "rg", "data_nascimento", "sexo", "naturalidade",
      "email", "celular", "etnia", "codigo_inep",
      "informacoes_adicionais", "matricula_codigo",
    ],
    filters: [],
  },
  responsaveis_aluno: {
    columns: [
      "nome", "cpf", "rg", "celular", "telefone", "email",
      "parentesco", "profissao", "endereco_trabalho",
    ],
    filters: ["pai", "mae", "financeiro", "first"],
  },
  enderecos_aluno: {
    columns: ["logradouro", "numero", "complemento", "bairro", "cidade", "uf", "cep"],
    filters: ["principal", "first"],
  },
  contatos_aluno: {
    columns: ["nome", "telefone", "email", "parentesco"],
    filters: ["first"],
  },
  informacoes_medicas: {
    columns: [
      "alergia", "necessidade_especial", "medico",
      "telefone_medico", "plano_saude", "telefone_plano", "observacoes",
    ],
    filters: [],
  },
  matriculas: {
    columns: ["codigo", "ano_letivo", "data_matricula", "idade_na_matricula", "observacoes", "status"],
    filters: ["ativa", "ultima"],
  },
  series:  { columns: ["nome"],          filters: [] },
  turmas:  { columns: ["nome", "turno"], filters: [] },
  planos:  { columns: ["nome", "valor"], filters: [] },
  escolas: { columns: ["nome", "cnpj", "telefone", "email", "endereco", "cidade", "uf", "cep"], filters: [] },
};

export const COMPUTED_FNS = [
  "data_hoje_extenso",
  "cidade_data_extenso",
  "idade_atual",
  "ano_letivo_atual",
  "endereco_principal_formatado",
  "tipo_ensino_via_series_segmentos",
] as const;

export type ComputedFn = (typeof COMPUTED_FNS)[number];

export function isAllowedTable(t: string): t is keyof typeof ALLOWED_TABLES {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TABLES, t);
}

export function isAllowedColumn(table: string, column: string): boolean {
  if (!isAllowedTable(table)) return false;
  return (ALLOWED_TABLES[table].columns as readonly string[]).includes(column);
}

export function isAllowedFilter(table: string, filter: string): boolean {
  if (!isAllowedTable(table)) return false;
  return (ALLOWED_TABLES[table].filters as readonly string[]).includes(filter);
}

export function isComputedFn(fn: string): fn is ComputedFn {
  return (COMPUTED_FNS as readonly string[]).includes(fn);
}

export type Mapping =
  | { placeholder: string; type: "tabela"; table: string; column: string; filter: string | null }
  | { placeholder: string; type: "computed"; fn: ComputedFn };

export function validateMapping(m: unknown): m is Mapping {
  if (!m || typeof m !== "object") return false;
  const obj = m as Record<string, unknown>;
  if (typeof obj.placeholder !== "string" || !obj.placeholder.trim()) return false;
  if (obj.type === "tabela") {
    if (typeof obj.table !== "string" || !isAllowedTable(obj.table)) return false;
    if (typeof obj.column !== "string" || !isAllowedColumn(obj.table, obj.column)) return false;
    if (obj.filter !== null && obj.filter !== undefined) {
      if (typeof obj.filter !== "string" || !isAllowedFilter(obj.table, obj.filter)) return false;
    }
    return true;
  }
  if (obj.type === "computed") {
    return typeof obj.fn === "string" && isComputedFn(obj.fn);
  }
  return false;
}
