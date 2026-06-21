import { z } from "zod";

export const ORIGENS_LEAD = [
  "whatsapp",
  "instagram",
  "indicacao",
  "site",
  "ligacao",
  "evento",
  "campanha",
  "presencial",
] as const;

export const STATUS_LEAD = [
  "novo",
  "em_analise",
  "reserva",
  "convertido",
  "perdido",
] as const;

export const TIPOS_ATIVIDADE = [
  "nota",
  "ligacao",
  "email",
  "whatsapp",
  "sistema",
] as const;

export type OrigemLead = (typeof ORIGENS_LEAD)[number];
export type StatusLead = (typeof STATUS_LEAD)[number];
export type TipoAtividade = (typeof TIPOS_ATIVIDADE)[number];

// --- Lead (dados pessoais) ---
export const leadSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(200),
  data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sexo: z.string().max(20).optional().nullable(),
  cpf: z.string().max(14).optional().nullable(),
  rg: z.string().max(20).optional().nullable(),
  foto_url: z.string().url().optional().nullable(),
  serie_interesse: z.string().max(60).optional().nullable(),
  turno: z.string().max(30).optional().nullable(),
  ano_letivo: z.number().int().min(2000).max(2100).optional().nullable(),
});
export type LeadInput = z.infer<typeof leadSchema>;

// --- Responsável ---
export const responsavelSchema = z.object({
  nome: z.string().min(1, "Nome do responsável obrigatório").max(200),
  parentesco: z.string().max(40).optional().nullable(),
  cpf: z.string().max(14).optional().nullable(),
  rg: z.string().max(20).optional().nullable(),
  telefone: z.string().max(20).optional().nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  email: z.string().email("E-mail inválido").optional().nullable(),
  financeiro: z.boolean().default(false),
  pedagogico: z.boolean().default(false),
  autorizado_retirar: z.boolean().default(false),
  observacoes: z.string().max(500).optional().nullable(),
});
export type ResponsavelInput = z.infer<typeof responsavelSchema>;

// --- Card (criar) ---
export const criarCardSchema = z
  .object({
    quadro_id: z.string().uuid("Quadro inválido"),
    coluna_id: z.string().uuid("Coluna inválida"),
    titulo: z.string().min(1, "Nome do interessado obrigatório").max(200),
    origem: z.enum(ORIGENS_LEAD).optional().nullable(),
    status_lead: z.enum(STATUS_LEAD).default("novo"),
    assigned_to: z.string().uuid().optional().nullable(),
    lead: leadSchema,
    responsaveis: z
      .array(responsavelSchema)
      .min(1, "Ao menos um responsável é obrigatório"),
  });
export type CriarCardInput = z.infer<typeof criarCardSchema>;

// --- Card (editar campos do card) ---
export const editarCardSchema = z.object({
  titulo: z.string().min(1).max(200).optional(),
  origem: z.enum(ORIGENS_LEAD).optional().nullable(),
  status_lead: z.enum(STATUS_LEAD).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  motivo_perda: z.string().max(500).optional().nullable(),
});
export type EditarCardInput = z.infer<typeof editarCardSchema>;

// --- Mover card ---
export const moverCardSchema = z.object({
  card_id: z.string().uuid(),
  para_coluna_id: z.string().uuid(),
  nova_ordem: z.number(),
  observacao: z.string().max(500).optional().nullable(),
});
export type MoverCardInput = z.infer<typeof moverCardSchema>;

// --- Nota (atividade) ---
export const notaSchema = z.object({
  card_id: z.string().uuid(),
  descricao: z.string().min(1, "Nota não pode ser vazia").max(2000),
  tipo: z.enum(TIPOS_ATIVIDADE).default("nota"),
  anexo_url: z.string().url().optional().nullable(),
});
export type NotaInput = z.infer<typeof notaSchema>;

// ─── MVP2 ─────────────────────────────────────────────────────────────────────

export const STATUS_VAGA = [
  "aguardando",
  "disponivel",
  "responsavel_contactado",
  "aguardando_resposta",
  "convertido",
  "desistiu",
  "sem_retorno",
] as const;
export type StatusVaga = (typeof STATUS_VAGA)[number];

export const SITUACAO_ESCOLAR = [
  "regular",
  "transferencia",
  "abandono",
  "conclusao",
] as const;
export type SituacaoEscolar = (typeof SITUACAO_ESCOLAR)[number];

export const TIPOS_QUADRO = ["captacao", "rematricula", "reserva"] as const;
export type TipoQuadro = (typeof TIPOS_QUADRO)[number];

export const COR_COLUNAS = [
  "color-pipeline-novo",
  "color-pipeline-contato",
  "color-pipeline-aguardando",
  "color-pipeline-entrevista",
  "color-pipeline-reserva",
  "color-pipeline-analise",
  "color-pipeline-convertido",
  "color-pipeline-perdido",
] as const;
export type CorColuna = (typeof COR_COLUNAS)[number];

// --- Reserva ---
export const reservaSchema = z.object({
  serie_id: z.string().uuid().optional().nullable(),
  turma_id: z.string().uuid().optional().nullable(),
  prioridade: z.number().int().min(0).default(0),
  status_vaga: z.enum(STATUS_VAGA).default("aguardando"),
  data_entrada_reserva: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  previsao_disponibilidade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  interesse_confirmado: z.boolean().default(false),
  observacoes_secretaria: z.string().max(1000).optional().nullable(),
});
export type ReservaInput = z.infer<typeof reservaSchema>;

// --- Dados educacionais (extensão do lead) ---
export const dadosEducacionaisSchema = z.object({
  escola_anterior: z.string().max(200).optional().nullable(),
  motivo_transferencia: z.string().max(500).optional().nullable(),
  situacao_escolar: z.enum(SITUACAO_ESCOLAR).optional().nullable(),
  observacoes_pedagogicas: z.string().max(1000).optional().nullable(),
  documentos_pendentes: z.array(z.string()).optional().nullable(),
});
export type DadosEducacionaisInput = z.infer<typeof dadosEducacionaisSchema>;

// --- Quadro (CRUD admin) ---
export const quadroSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(100),
  descricao: z.string().max(500).optional().nullable(),
  tipo: z.enum(TIPOS_QUADRO).default("captacao"),
  ordem: z.number().int().min(0).default(0),
  ativo: z.boolean().default(true),
});
export type QuadroInput = z.infer<typeof quadroSchema>;

// --- Coluna admin (CRUD) ---
export const colunaAdminSchema = z.object({
  nome: z.string().min(1, "Nome obrigatório").max(100),
  cor: z.enum(COR_COLUNAS).optional().nullable(),
  ordem: z.number().int().min(0).default(0),
  prazo_max_dias: z.number().int().min(1).optional().nullable(),
  etapa_final: z.boolean().default(false),
});
export type ColunaAdminInput = z.infer<typeof colunaAdminSchema>;

// ─── MVP3 ─────────────────────────────────────────────────────────────────────

export const FONTES_WPP = [
  "lead.nome",
  "lead.responsavel.nome",
  "lead.responsavel.whatsapp",
  "escola.nome",
  "hoje",
  "campo_livre",
] as const;
export type FonteWpp = (typeof FONTES_WPP)[number];

export const FONTES_WPP_LABEL: Record<FonteWpp, string> = {
  "lead.nome": "Nome do lead",
  "lead.responsavel.nome": "Nome do responsável",
  "lead.responsavel.whatsapp": "WhatsApp do responsável",
  "escola.nome": "Nome da escola",
  "hoje": "Data de hoje",
  "campo_livre": "Campo livre (usuário preenche)",
};

// --- Template WhatsApp ---
export const templateWppSchema = z.object({
  nome_template: z.string().min(1, "Nome do template obrigatório").max(100),
  descricao: z.string().min(1, "Descrição obrigatória").max(200),
  variaveis_count: z.number().int().min(0).max(10).default(0),
  variaveis_fontes: z.array(z.enum(FONTES_WPP)).default([]),
  ativo: z.boolean().default(true),
});
export type TemplateWppInput = z.infer<typeof templateWppSchema>;

// --- Tarefa ---
export const tarefaSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(200),
  descricao: z.string().max(1000).optional().nullable(),
  due_at: z.string().datetime({ offset: true }).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
});
export type TarefaInput = z.infer<typeof tarefaSchema>;

// ─── MVP4 ─────────────────────────────────────────────────────────────────────

export const TIPOS_AUTOMACAO = [
  "card_parado_cria_tarefa",
  "coluna_entrada_envia_template",
  "coluna_entrada_cria_tarefa",
  "coluna_entrada_solicita_dado",
  "coluna_entrada_muda_status",
  "entrada_etapa_final_boas_vindas",
  "mover_card_condicional",
] as const;
export type TipoAutomacao = (typeof TIPOS_AUTOMACAO)[number];

export const AUTOMACAO_GATILHO: Record<TipoAutomacao, "evento" | "tempo"> = {
  card_parado_cria_tarefa:         "tempo",
  coluna_entrada_envia_template:   "evento",
  coluna_entrada_cria_tarefa:      "evento",
  coluna_entrada_solicita_dado:    "evento",
  coluna_entrada_muda_status:      "evento",
  entrada_etapa_final_boas_vindas: "evento",
  mover_card_condicional:          "evento",
};

export const AUTOMACAO_DEDUPE: Record<TipoAutomacao, "card" | "entrada" | "nenhum"> = {
  card_parado_cria_tarefa:         "card",
  coluna_entrada_envia_template:   "entrada",
  coluna_entrada_cria_tarefa:      "entrada",
  coluna_entrada_solicita_dado:    "nenhum",
  coluna_entrada_muda_status:      "nenhum",
  entrada_etapa_final_boas_vindas: "card",
  mover_card_condicional:          "entrada",
};

export const AUTOMACAO_LABEL: Record<TipoAutomacao, string> = {
  card_parado_cria_tarefa:         "Card parado → Criar tarefa",
  coluna_entrada_envia_template:   "Ao entrar na coluna → Enviar template WhatsApp",
  coluna_entrada_cria_tarefa:      "Ao entrar na coluna → Criar tarefa",
  coluna_entrada_solicita_dado:    "Ao entrar na coluna → Solicitar campo",
  coluna_entrada_muda_status:      "Ao entrar na coluna → Mudar status do lead",
  entrada_etapa_final_boas_vindas: "Ao entrar na etapa final → Enviar boas-vindas",
  mover_card_condicional:          "Mover card condicional",
};

const paramsCardParado = z.object({
  dias: z.number().int().min(2).optional(),
  titulo: z.string().min(1).max(200),
  assigned_to: z.string().uuid().optional(),
});

const paramsColunaEnviaTemplate = z.object({
  coluna_id: z.string().uuid(),
  template_id: z.string().uuid(),
  variaveis_fontes: z.array(z.enum(FONTES_WPP)).optional(),
});

const paramsColunaGeraTarefa = z.object({
  coluna_id: z.string().uuid(),
  titulo: z.string().min(1).max(200),
  due_em_dias: z.number().int().min(1).optional(),
  assigned_to: z.string().uuid().optional(),
});

const paramsColunaStatusLead = z.object({
  coluna_id: z.string().uuid(),
  status_destino: z.enum(STATUS_LEAD),
});

const paramsBoasVindas = z.object({
  template_id: z.string().uuid(),
});

const paramsMoverCondicional = z.object({
  de_coluna_id: z.string().uuid(),
  para_coluna_id: z.string().uuid(),
});

const paramsColunasolicitaDado = z.object({
  coluna_id: z.string().uuid(),
  campo: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  obrigatorio: z.boolean().default(true),
});

export const automacaoParamsSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("card_parado_cria_tarefa"), ...paramsCardParado.shape }),
  z.object({ tipo: z.literal("coluna_entrada_envia_template"), ...paramsColunaEnviaTemplate.shape }),
  z.object({ tipo: z.literal("coluna_entrada_cria_tarefa"), ...paramsColunaGeraTarefa.shape }),
  z.object({ tipo: z.literal("coluna_entrada_solicita_dado"), ...paramsColunasolicitaDado.shape }),
  z.object({ tipo: z.literal("coluna_entrada_muda_status"), ...paramsColunaStatusLead.shape }),
  z.object({ tipo: z.literal("entrada_etapa_final_boas_vindas"), ...paramsBoasVindas.shape }),
  z.object({ tipo: z.literal("mover_card_condicional"), ...paramsMoverCondicional.shape }),
]);

export const automacaoSchema = z.object({
  quadro_id: z.string().uuid().optional().nullable(),
  tipo: z.enum(TIPOS_AUTOMACAO),
  ativo: z.boolean().default(true),
  params: z.record(z.unknown()),
});
export type AutomacaoInput = z.infer<typeof automacaoSchema>;

// --- Mover card (MVP4: campo_valor para coluna com campo_obrigatorio) ---
export const moverCardComCampoSchema = z.object({
  card_id: z.string().uuid(),
  para_coluna_id: z.string().uuid(),
  nova_ordem: z.number(),
  observacao: z.string().max(500).optional().nullable(),
  campo_valor: z.string().max(500).optional().nullable(),
});

// ─── MVP5 ─────────────────────────────────────────────────────────────────────

export const STATUS_ANAMNESE = [
  "nao_iniciada",
  "enviada",
  "pendente",
  "em_analise",
  "concluida",
  "requer_atencao",
] as const;
export type StatusAnamnese = (typeof STATUS_ANAMNESE)[number];

// Transições válidas de status no MVP5 (auto-preenchimento fora do escopo)
export const TRANSICOES_STATUS_ANAMNESE: Partial<Record<StatusAnamnese, StatusAnamnese[]>> = {
  em_analise:      ["concluida", "requer_atencao"],
  concluida:       ["requer_atencao"],
  requer_atencao:  ["em_analise"],
};

export const salvarAnamneseSchema = z.object({
  card_id: z.string().uuid(),
  consentimento_em: z.string().datetime({ offset: true }),
  consentimento_por: z.string().uuid(),
  termo_versao: z.string().default("v1"),
  necessidade_especial: z.boolean().optional(),
  necessidade_especial_descricao: z.string().max(2000).optional().nullable(),
  alergias: z.string().max(2000).optional().nullable(),
  medicamentos_continuos: z.string().max(2000).optional().nullable(),
  restricoes_alimentares: z.string().max(2000).optional().nullable(),
  acomp_psicologico: z.boolean().optional(),
  acomp_psicologico_descricao: z.string().max(1000).optional().nullable(),
  acomp_fonoaudiologico: z.boolean().optional(),
  acomp_fonoaudiologico_descricao: z.string().max(1000).optional().nullable(),
  acomp_psicopedagogico: z.boolean().optional(),
  acomp_psicopedagogico_descricao: z.string().max(1000).optional().nullable(),
  historico_desenvolvimento: z.string().max(3000).optional().nullable(),
  comportamento_social: z.string().max(3000).optional().nullable(),
  rotina_familiar: z.string().max(3000).optional().nullable(),
  observacoes_responsaveis: z.string().max(3000).optional().nullable(),
  observacoes_coordenacao: z.string().max(3000).optional().nullable(),
});
export type SalvarAnamneseInput = z.infer<typeof salvarAnamneseSchema>;

export const mudarStatusAnamneseSchema = z.object({
  card_id: z.string().uuid(),
  novo_status: z.enum(["em_analise", "concluida", "requer_atencao"]),
});
