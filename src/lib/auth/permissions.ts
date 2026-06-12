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
  eventos: { grupo: "secretaria", nome: "Eventos" },
  // financeiro
  "financeiro.cobrancas": { grupo: "financeiro", nome: "Cobranças & Pagamentos" },
  despesas: { grupo: "financeiro", nome: "Despesas" },
  planos: { grupo: "financeiro", nome: "Planos" },
  "valores-praticados": { grupo: "financeiro", nome: "Valores Praticados" },
  bolsistas: { grupo: "financeiro", nome: "Bolsistas" },
  "rh.folha": { grupo: "financeiro", nome: "Folha de Pagamento" },
  "rh.folha-v2": { grupo: "financeiro", nome: "Folha de Pagamento v2" },
  // rh
  "rh.funcionarios": { grupo: "rh", nome: "Funcionários" },
  "rh.empresas": { grupo: "rh", nome: "Empresas" },
  "rh.templates": { grupo: "rh", nome: "Templates RH" },
  comunicados: { grupo: "rh", nome: "Comunicados" },
  // academico
  series: { grupo: "academico", nome: "Séries" },
  turmas: { grupo: "academico", nome: "Turmas" },
  professores: { grupo: "academico", nome: "Professores" },
  organograma: { grupo: "academico", nome: "Organograma" },
  calendario: { grupo: "academico", nome: "Calendário Letivo" },
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

// IMPORTANT: Every key in MODULOS MUST have a matching row in the DB seed
// (supabase/migrations/202605300001_rbac_permissoes.sql, section 6).
// When adding a module: update MODULOS + DB seed (modulos + role_permissoes) + ROTA_PARA_MODULO.
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

// Mapa rota → módulo (usado para route gating e filtro de menus).
// Matching strategy: longest-prefix match against pathname.
// Sub-routes (e.g. /alunos/[id]/editar) inherit from their parent entry.
export const ROTA_PARA_MODULO: Record<string, ModuloCodigo> = {
  "/alunos": "alunos",
  "/eventos": "eventos",
  "/matriculas": "matriculas",
  "/importacoes": "importacoes",
  "/financeiro/folha": "rh.folha",
  "/rh/folha-v2": "rh.folha-v2",
  "/financeiro/alunos-sem-valor": "relatorios",
  "/financeiro": "financeiro.cobrancas",
  "/despesas": "despesas",
  "/planos": "planos",
  "/valores-praticados": "valores-praticados",
  "/bolsistas": "bolsistas",
  "/rh/funcionarios": "rh.funcionarios",
  "/rh/empresas": "rh.empresas",
  "/rh/documentos": "rh.templates",
  "/comunicados": "comunicados",
  "/rh/brackets": "rh.folha",
  "/avaliacoes": "avaliacoes",
  "/frequencias": "frequencias",
  "/disciplinas": "disciplinas",
  "/mural/aniversariantes": "mural",
  "/series": "series",
  "/turmas": "turmas",
  "/professores/atribuicoes": "professores",
  "/organograma": "organograma",
  "/calendario": "calendario",
  "/portaria": "portaria",
  "/relatorios/alunos": "relatorios",
  "/relatorios/frequencia": "relatorios",
  "/relatorios/inadimplencia": "relatorios",
  "/usuarios": "usuarios",
  "/configuracoes/escola": "configuracoes.escola",
  "/configuracoes/webhook": "configuracoes.webhook",
  "/configuracoes/perfis": "configuracoes.perfis",
  "/configuracoes/lembretes": "financeiro.cobrancas",
  "/despesas/categorias": "despesas",
};
