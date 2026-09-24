// src/lib/auth/permissions.ts

export type Acao = "read" | "create" | "update" | "delete";

export const GRUPOS = [
  "dashboard",
  "pedagogico",
  "secretaria",
  "financeiro",
  "rh",
  "academico",
  "operacional",
  "administracao",
  "comunicacao",
] as const;
export type Grupo = (typeof GRUPOS)[number];

export const GRUPO_LABEL: Record<Grupo, string> = {
  dashboard: "Dashboard",
  pedagogico: "Pedagógico",
  secretaria: "Secretaria",
  financeiro: "Financeiro",
  rh: "RH",
  academico: "Acadêmico",
  operacional: "Operacional",
  administracao: "Administração",
  comunicacao: "Comunicação",
};

export const MODULOS = {
  // dashboard — uma aba do painel inicial por módulo. Gate ADICIONAL: a aba só
  // aparece se o perfil tiver esta permissão E algum módulo de dado por trás
  // dela (ex.: a aba Financeiro ainda precisa de financeiro.cobrancas ou
  // despesas). Serve para esconder o painel de quem tem o dado mas não deve
  // ver o resumo consolidado.
  "dashboard.financeiro": { grupo: "dashboard", nome: "Painel Financeiro" },
  "dashboard.comercial": { grupo: "dashboard", nome: "Painel Comercial" },
  "dashboard.secretaria": { grupo: "dashboard", nome: "Painel Secretaria" },
  "dashboard.pedagogico": { grupo: "dashboard", nome: "Painel Pedagógico" },
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
  "comercial.produtos": { grupo: "secretaria", nome: "Produtos" },
  "comercial.vendas": { grupo: "secretaria", nome: "Vendas" },
  "comercial.estoque": { grupo: "secretaria", nome: "Estoque" },
  pipeline: { grupo: "secretaria", nome: "Pipeline / Captação" },
  pipeline_admin: { grupo: "secretaria", nome: "Pipeline / Admin" },
  pipeline_sensivel: { grupo: "secretaria", nome: "Pipeline / Dados Sensíveis" },
  historico: { grupo: "secretaria", nome: "Histórico Escolar" },
  // financeiro
  "financeiro.cobrancas": { grupo: "financeiro", nome: "Cobranças & Pagamentos" },
  "financeiro.tesouraria": { grupo: "financeiro", nome: "Tesouraria" },
  "financeiro.conciliacao": { grupo: "financeiro", nome: "Conciliação Bancária" },
  "financeiro.lancamentos": { grupo: "financeiro", nome: "Livro-Razão" },
  "financeiro.contratos": { grupo: "financeiro", nome: "Contratos de Receita" },
  "financeiro.isaac": { grupo: "financeiro", nome: "Repasse isaac" },
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
  // comunicacao
  whatsapp_inbox: { grupo: "comunicacao", nome: "WhatsApp Inbox" },
  // operacional
  portaria: { grupo: "operacional", nome: "Portaria" },
  relatorios: { grupo: "operacional", nome: "Relatórios" },
  "relatorios.comercial": { grupo: "operacional", nome: "Relatórios Comerciais" },
  "relatorios.dre": { grupo: "financeiro", nome: "DRE / Resultado" },
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
  "/historico": "historico",
  // Redundantes com o prefixo acima, mas explícitos: as telas do histórico
  // (incluindo o certificado de conclusão) reusam o módulo `historico`, sem
  // módulo RBAC próprio. Entrada explícita evita que uma rota nova escape pelo
  // fallback "sem mapa = liberada" dos filtros de menu.
  "/historico/associacoes": "historico",
  "/historico/notas": "historico",
  "/historico/emissao": "historico",
  "/historico/certificado": "historico",
  // Declarações pedagógicas reaproveitam o módulo `historico` (mesma
  // categoria de documento pedagógico da escola), sem módulo RBAC novo.
  "/declaracoes": "historico",
  "/declaracoes/modelos": "historico",
  "/declaracoes/emitir": "historico",
  "/eventos": "eventos",
  "/comercial/produtos": "comercial.produtos",
  "/comercial/vendas": "comercial.vendas",
  "/comercial/estoque": "comercial.estoque",
  "/matriculas": "matriculas",
  "/importacoes": "importacoes",
  "/rh/folha-v2": "rh.folha-v2",
  "/financeiro/alunos-sem-valor": "relatorios",
  "/financeiro/tesouraria": "financeiro.tesouraria",
  "/financeiro/tesouraria/conciliacao": "financeiro.conciliacao",
  "/financeiro/tesouraria/cobrancas-pix": "financeiro.tesouraria",
  "/financeiro/conciliacao": "financeiro.conciliacao",
  "/financeiro/isaac/pendencias": "financeiro.isaac",
  "/financeiro/isaac": "financeiro.isaac",
  "/financeiro/lancamentos/categorias": "financeiro.lancamentos",
  "/financeiro/lancamentos": "financeiro.lancamentos",
  "/financeiro/contratos": "financeiro.contratos",
  "/relatorios/dre": "relatorios.dre",
  "/relatorios/comercial": "relatorios.comercial",
  "/financeiro": "financeiro.cobrancas",
  "/despesas": "despesas",
  "/planos": "planos",
  "/valores-praticados": "valores-praticados",
  "/bolsistas": "bolsistas",
  "/rh/funcionarios": "rh.funcionarios",
  "/rh/empresas": "rh.empresas",
  "/rh/documentos": "rh.templates",
  "/comunicados": "comunicados",
  "/rh/brackets": "rh.folha-v2",
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
  "/pipeline": "pipeline",
  "/pipeline/config": "pipeline_admin",
  "/whatsapp": "whatsapp_inbox",
};
