export type PipelineColuna = {
  id: string;
  nome: string;
  cor: string | null;
  ordem: number;
  etapa_final: boolean;
};

export type EtiquetaCor = 'verde' | 'azul' | 'amarelo' | 'vermelho' | 'roxo' | 'laranja' | 'cinza';

export const ETIQUETA_CORES: { valor: EtiquetaCor; label: string; bg: string; fundo: string; borda: string }[] = [
  { valor: 'verde',    label: 'Verde',    bg: '#22c55e', fundo: 'rgba(34,197,94,0.09)',   borda: 'rgba(34,197,94,0.3)'   },
  { valor: 'azul',     label: 'Azul',     bg: '#3b82f6', fundo: 'rgba(59,130,246,0.09)',  borda: 'rgba(59,130,246,0.3)'  },
  { valor: 'amarelo',  label: 'Amarelo',  bg: '#eab308', fundo: 'rgba(234,179,8,0.09)',   borda: 'rgba(234,179,8,0.3)'   },
  { valor: 'vermelho', label: 'Vermelho', bg: '#ef4444', fundo: 'rgba(239,68,68,0.09)',   borda: 'rgba(239,68,68,0.3)'   },
  { valor: 'roxo',     label: 'Roxo',     bg: '#a855f7', fundo: 'rgba(168,85,247,0.09)',  borda: 'rgba(168,85,247,0.3)'  },
  { valor: 'laranja',  label: 'Laranja',  bg: '#f97316', fundo: 'rgba(249,115,22,0.09)',  borda: 'rgba(249,115,22,0.3)'  },
  { valor: 'cinza',    label: 'Cinza',    bg: '#6b7280', fundo: 'rgba(107,114,128,0.09)', borda: 'rgba(107,114,128,0.3)' },
];

export type PipelineCardResumo = {
  id: string;
  coluna_id: string;
  ordem: number;
  titulo: string;
  origem: string | null;
  status_lead: string;
  assigned_to: string | null;
  ultimo_contato_at: string | null;
  created_at: string;
  sem_resposta: boolean;
  etiqueta_cor: EtiquetaCor | null;
  etiqueta_label: string | null;
  pipeline_lead: { nome: string; data_nascimento: string | null } | null;
};

export type PipelineBoardData = {
  quadro: { id: string; nome: string; tipo: string | null };
  colunas: PipelineColuna[];
  cards: PipelineCardResumo[];
};

// Mapa cor-token → classe Tailwind do tema DS
export const COR_TOKEN_CLASSES: Record<string, string> = {
  "color-pipeline-novo":       "bg-[rgb(var(--color-brand)/0.12)] text-[rgb(var(--color-brand))]",
  "color-pipeline-contato":    "bg-[rgb(var(--color-primary)/0.12)] text-[rgb(var(--color-primary))]",
  "color-pipeline-aguardando": "bg-[rgb(var(--color-warning)/0.12)] text-[rgb(var(--color-warning))]",
  "color-pipeline-entrevista": "bg-[rgb(var(--color-warning)/0.15)] text-[rgb(var(--color-warning))]",
  "color-pipeline-reserva":    "bg-[rgb(var(--color-success)/0.12)] text-[rgb(var(--color-success))]",
  "color-pipeline-analise":    "bg-[rgb(var(--color-success)/0.18)] text-[rgb(var(--color-success))]",
  "color-pipeline-convertido": "bg-[rgb(var(--color-success)/0.22)] text-[rgb(var(--color-success))]",
  "color-pipeline-perdido":    "bg-[rgb(var(--color-danger)/0.12)] text-[rgb(var(--color-danger))]",
};

export const STATUS_LEAD_LABEL: Record<string, string> = {
  novo: "Novo",
  em_analise: "Em Análise",
  reserva: "Reserva",
  convertido: "Convertido",
  perdido: "Perdido",
};

export const ORIGEM_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  indicacao: "Indicação",
  site: "Site",
  ligacao: "Ligação",
  evento: "Evento",
  campanha: "Campanha",
  presencial: "Presencial",
};
