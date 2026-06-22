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

// Default fallback. Quando heurística não casar nada.
const FALLBACK_DEFAULT: Mapping = {
  placeholder: "",
  type: "tabela",
  table: "alunos",
  column: "nome",
  filter: null,
};

function tabela(placeholder: string, table: string, column: string, filter: AllowedFilter | null = null): Mapping {
  return { placeholder, type: "tabela", table, column, filter };
}
function computed(placeholder: string, fn: ComputedFn): Mapping {
  return { placeholder, type: "computed", fn };
}

/**
 * Infere mapping default a partir do nome do placeholder.
 * Casa-insensitive. Retorna `alunos.nome` como fallback se nada casar.
 */
export function inferDefaultMapping(placeholder: string): Mapping {
  const name = placeholder.toUpperCase();

  // Computed primeiro — nomes exatos
  if (name === "DATA_HOJE_EXTENSO") return computed(placeholder, "data_hoje_extenso");
  if (name === "CIDADE_DATA_EXTENSO") return computed(placeholder, "cidade_data_extenso");
  if (name === "ANO_LETIVO_ATUAL") return computed(placeholder, "ano_letivo_atual");
  if (name.startsWith("IDADE")) return computed(placeholder, "idade_atual");
  if (name.startsWith("TIPOENSINO") || name.startsWith("TIPO_ENSINO")) return computed(placeholder, "tipo_ensino_via_series_segmentos");
  if (name.startsWith("ENDERECO")) {
    // Endereço de aluno/responsável formatado por padrão.
    if (!name.endsWith("_EMPRESA")) return computed(placeholder, "endereco_principal_formatado");
  }

  // Empresa/escola
  if (name.endsWith("_EMPRESA") || name.endsWith("_ESCOLA")) {
    if (name.startsWith("CNPJ")) return tabela(placeholder, "escolas", "cnpj");
    if (name.startsWith("RAZAO_SOCIAL") || name.startsWith("FANTASIA") || name.startsWith("NOME")) return tabela(placeholder, "escolas", "nome");
    if (name.startsWith("TELEFONE")) return tabela(placeholder, "escolas", "telefone");
    if (name.startsWith("EMAIL")) return tabela(placeholder, "escolas", "email");
    if (name.startsWith("CEP")) return tabela(placeholder, "escolas", "cep");
    if (name.startsWith("CIDADE")) return tabela(placeholder, "escolas", "cidade");
    if (name.startsWith("UF") || name.startsWith("ESTADO")) return tabela(placeholder, "escolas", "uf");
    if (name.startsWith("LOGRADOURO") || name.startsWith("ENDERECO")) return tabela(placeholder, "escolas", "endereco");
    return tabela(placeholder, "escolas", "nome");
  }

  // Filtro por sufixo
  let filter: AllowedFilter | null = null;
  if (name.endsWith("_RESP") || name.includes("_RESPONSAVEL")) filter = "financeiro";
  else if (name.endsWith("_PAI") || name.startsWith("PAI_")) filter = "pai";
  else if (name.endsWith("_MAE") || name.startsWith("MAE_")) filter = "mae";

  // Responsável (pai/mãe/financeiro)
  if (filter) {
    if (name.startsWith("NOME") || name.includes("_NOME")) return tabela(placeholder, "responsaveis_aluno", "nome", filter);
    if (name.startsWith("CPF") || name.includes("_CPF")) return tabela(placeholder, "responsaveis_aluno", "cpf", filter);
    if (name.startsWith("RG") || name.includes("_RG")) return tabela(placeholder, "responsaveis_aluno", "rg", filter);
    if (name.startsWith("TELEFONE") || name.includes("_TELEFONE")) return tabela(placeholder, "responsaveis_aluno", "telefone", filter);
    if (name.startsWith("CELULAR") || name.includes("_CELULAR")) return tabela(placeholder, "responsaveis_aluno", "celular", filter);
    if (name.startsWith("EMAIL") || name.includes("_EMAIL")) return tabela(placeholder, "responsaveis_aluno", "email", filter);
    if (name.startsWith("PROFISSAO")) return tabela(placeholder, "responsaveis_aluno", "profissao", filter);
    // Default pra responsável: nome
    return tabela(placeholder, "responsaveis_aluno", "nome", filter);
  }

  // Sufixo _ALUNO ou sem sufixo → campos do aluno / acadêmicos
  if (name.startsWith("SERIE")) return tabela(placeholder, "series", "nome");
  if (name.startsWith("TURMA")) return tabela(placeholder, "turmas", "nome");
  if (name.startsWith("TURNO")) return tabela(placeholder, "turmas", "turno");
  if (name.startsWith("PLANO")) return tabela(placeholder, "planos", "nome");
  if (name.startsWith("ANO_LETIVO") || name.startsWith("ANOLETIVO")) return tabela(placeholder, "matriculas", "ano_letivo", "ativa");
  if (name.startsWith("MATRICULA_CODIGO") || name.startsWith("CODIGO_MATRICULA")) return tabela(placeholder, "alunos", "matricula_codigo");
  if (name.startsWith("DT") || name.startsWith("DATA_NASC") || name.startsWith("DATANASC") || name.startsWith("NASCIMENTO")) return tabela(placeholder, "alunos", "data_nascimento");
  if (name.startsWith("NATURALIDADE")) return tabela(placeholder, "alunos", "naturalidade");
  if (name.startsWith("CPF")) return tabela(placeholder, "alunos", "cpf");
  if (name.startsWith("RG")) return tabela(placeholder, "alunos", "rg");
  if (name.startsWith("SEXO") || name.startsWith("GENERO")) return tabela(placeholder, "alunos", "sexo");
  if (name.startsWith("ETNIA")) return tabela(placeholder, "alunos", "etnia");
  if (name.startsWith("EMAIL")) return tabela(placeholder, "alunos", "email");
  if (name.startsWith("CELULAR") || name.startsWith("TELEFONE")) return tabela(placeholder, "alunos", "celular");
  if (name.startsWith("CODIGO_INEP") || name.startsWith("INEP")) return tabela(placeholder, "alunos", "codigo_inep");

  // PAI_ALUNO / MAE_ALUNO sem campo específico: nome do pai/mãe
  if (name.startsWith("PAI") || name === "FILIACAO_PAI") return tabela(placeholder, "responsaveis_aluno", "nome", "pai");
  if (name.startsWith("MAE") || name === "FILIACAO_MAE") return tabela(placeholder, "responsaveis_aluno", "nome", "mae");

  // NOME_ALUNO ou NOME
  if (name === "NOME" || name === "NOME_ALUNO" || name.startsWith("NOME")) return tabela(placeholder, "alunos", "nome");

  // Fallback total: nome do aluno
  return { ...FALLBACK_DEFAULT, placeholder };
}

// ---------------------------------------------------------------------------
// Phase 2 additions — TemplateCatalog, TEMPLATE_META, types for Phase 3 usage
// ---------------------------------------------------------------------------

/**
 * Catalog of the 6 hardcoded template categories this system supports.
 * Used by Phase 3 server actions and UI to reference known template kinds.
 */
export enum TemplateCatalog {
  DeclaracaoFrequencia = "declaracao_frequencia",
  DeclaracaoMatricula  = "declaracao_matricula",
  TermoResponsabilidade = "termo_responsabilidade",
  TermoAutorizacao = "termo_autorizacao",
  ContratoServicos = "contrato_servicos",
  FichaCadastral = "ficha_cadastral",
}

export type TemplateCategoria = "declaracao" | "termo" | "contrato" | "outro";

export type TemplateMetadata = {
  id: TemplateCatalog;
  nome: string;
  categoria: TemplateCategoria;
  description: string;
};

/**
 * Metadata map for the 6 catalog entries.
 * Keyed by TemplateCatalog value.
 */
export const TEMPLATE_META: Record<TemplateCatalog, TemplateMetadata> = {
  [TemplateCatalog.DeclaracaoFrequencia]: {
    id: TemplateCatalog.DeclaracaoFrequencia,
    nome: "Declaração de Frequência",
    categoria: "declaracao",
    description: "Certifica a frequência do aluno no período letivo.",
  },
  [TemplateCatalog.DeclaracaoMatricula]: {
    id: TemplateCatalog.DeclaracaoMatricula,
    nome: "Declaração de Matrícula",
    categoria: "declaracao",
    description: "Confirma o vínculo ativo do aluno com a instituição.",
  },
  [TemplateCatalog.TermoResponsabilidade]: {
    id: TemplateCatalog.TermoResponsabilidade,
    nome: "Termo de Responsabilidade",
    categoria: "termo",
    description: "Formaliza a responsabilidade do responsável pelo aluno.",
  },
  [TemplateCatalog.TermoAutorizacao]: {
    id: TemplateCatalog.TermoAutorizacao,
    nome: "Termo de Autorização",
    categoria: "termo",
    description: "Autorização para atividades fora do ambiente escolar.",
  },
  [TemplateCatalog.ContratoServicos]: {
    id: TemplateCatalog.ContratoServicos,
    nome: "Contrato de Serviços",
    categoria: "contrato",
    description: "Contrato de prestação de serviços educacionais.",
  },
  [TemplateCatalog.FichaCadastral]: {
    id: TemplateCatalog.FichaCadastral,
    nome: "Ficha Cadastral",
    categoria: "outro",
    description: "Registro completo de dados do aluno e responsáveis.",
  },
};

/**
 * Type alias for AllowedFilter, exported under the spec name for Phase 3.
 */
export type FilterRule = AllowedFilter;

/**
 * Typed representation of the ALLOWED_TABLES structure.
 */
export type AllowlistSchema = {
  tables: typeof ALLOWED_TABLES;
  computedFns: typeof COMPUTED_FNS;
};

/**
 * Validates whether a table/column combination is allowed,
 * and optionally whether a filter is valid for that table.
 *
 * @returns true if the combination is permitted by the allowlist.
 */
export function validateTableAccess(
  table: string,
  column: string,
  filter?: string | null,
): boolean {
  if (!isAllowedTable(table)) return false;
  if (!isAllowedColumn(table, column)) return false;
  if (filter != null && filter !== "") {
    if (!isAllowedFilter(table, filter)) return false;
  }
  return true;
}
