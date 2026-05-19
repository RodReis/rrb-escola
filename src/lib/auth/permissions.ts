// src/lib/auth/permissions.ts

export type Acao = "read" | "create" | "update" | "delete";

export const GRUPOS = [
  "pedagogico",
  "secretaria",
  "financeiro",
  "rh",
  "academico",
  "operacional",
  "administracao",
] as const;
export type Grupo = (typeof GRUPOS)[number];

export const GRUPO_LABEL: Record<Grupo, string> = {
  pedagogico: "Pedagógico",
  secretaria: "Secretaria",
  financeiro: "Financeiro",
  rh: "RH",
  academico: "Acadêmico",
  operacional: "Operacional",
  administracao: "Administração",
};

export const MODULOS = {
  // pedagogico
  avaliacoes: { grupo: "pedagogico", nome: "Avaliações" },
  frequencias: { grupo: "pedagogico", nome: "Frequências" },
  disciplinas: { grupo: "pedagogico", nome: "Disciplinas" },
  mural: { grupo: "pedagogico", nome: "Mural" },
  // secretaria
  alunos: { grupo: "secretaria", nome: "Alunos" },
  matriculas: { grupo: "secretaria", nome: "Matrículas" },
  importacoes: { grupo: "secretaria", nome: "Importações" },
  "documentos.templates": { grupo: "secretaria", nome: "Templates Documentos" },
  // financeiro
  "financeiro.cobrancas": { grupo: "financeiro", nome: "Cobranças & Pagamentos" },
  despesas: { grupo: "financeiro", nome: "Despesas" },
  planos: { grupo: "financeiro", nome: "Planos" },
  "valores-praticados": { grupo: "financeiro", nome: "Valores Praticados" },
  bolsistas: { grupo: "financeiro", nome: "Bolsistas" },
  // rh
  "rh.funcionarios": { grupo: "rh", nome: "Funcionários" },
  "rh.empresas": { grupo: "rh", nome: "Empresas" },
  "rh.folha": { grupo: "rh", nome: "Folha" },
  "rh.templates": { grupo: "rh", nome: "Templates RH" },
  // academico
  series: { grupo: "academico", nome: "Séries" },
  turmas: { grupo: "academico", nome: "Turmas" },
  professores: { grupo: "academico", nome: "Professores" },
  organograma: { grupo: "academico", nome: "Organograma" },
  // operacional
  portaria: { grupo: "operacional", nome: "Portaria" },
  relatorios: { grupo: "operacional", nome: "Relatórios" },
  // administracao
  usuarios: { grupo: "administracao", nome: "Usuários" },
  "configuracoes.escola": { grupo: "administracao", nome: "Escola" },
  "configuracoes.webhook": { grupo: "administracao", nome: "Webhook" },
  "configuracoes.perfis": { grupo: "administracao", nome: "Perfis e Permissões" },
} as const satisfies Record<string, { grupo: Grupo; nome: string }>;

export type ModuloCodigo = keyof typeof MODULOS;

export const MODULO_CODIGOS = Object.keys(MODULOS) as ModuloCodigo[];

export type PermissionMap = Partial<Record<ModuloCodigo, {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}>>;

export function can(perms: PermissionMap, modulo: ModuloCodigo, acao: Acao): boolean {
  return perms[modulo]?.[acao] ?? false;
}

export function modulosDoGrupo(grupo: Grupo): ModuloCodigo[] {
  return MODULO_CODIGOS.filter((m) => MODULOS[m].grupo === grupo);
}

// Mapa rota → módulo (usado para route gating e filtro de menus)
export const ROTA_PARA_MODULO: Record<string, ModuloCodigo> = {
  "/alunos": "alunos",
  "/matriculas": "matriculas",
  "/importacoes": "importacoes",
  "/financeiro": "financeiro.cobrancas",
  "/despesas": "despesas",
  "/planos": "planos",
  "/valores-praticados": "valores-praticados",
  "/bolsistas": "bolsistas",
  "/rh/funcionarios": "rh.funcionarios",
  "/rh/empresas": "rh.empresas",
  "/rh/folha": "rh.folha",
  "/rh/documentos": "rh.templates",
  "/rh/brackets": "rh.folha",
  "/avaliacoes": "avaliacoes",
  "/frequencias": "frequencias",
  "/disciplinas": "disciplinas",
  "/mural/aniversariantes": "mural",
  "/series": "series",
  "/turmas": "turmas",
  "/professores/atribuicoes": "professores",
  "/organograma": "organograma",
  "/portaria": "portaria",
  "/relatorios/alunos": "relatorios",
  "/relatorios/frequencia": "relatorios",
  "/relatorios/inadimplencia": "relatorios",
  "/usuarios": "usuarios",
  "/configuracoes/escola": "configuracoes.escola",
  "/configuracoes/webhook": "configuracoes.webhook",
  "/configuracoes/perfis": "configuracoes.perfis",
  "/despesas/categorias": "despesas",
};
