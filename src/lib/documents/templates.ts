export const TIPO_TEMPLATE = {
  CONTRATO_COLEGIO: "contrato_colegio",
  CONTRATO_PINGUINHO: "contrato_pinguinho",
  DECLARACAO_FREQUENCIA: "declaracao_frequencia",
  DECLARACAO_TRANSFERENCIA: "declaracao_transferencia",
  TERMO_RESPONSABILIDADE: "termo_responsabilidade",
} as const;

export type TipoTemplate = (typeof TIPO_TEMPLATE)[keyof typeof TIPO_TEMPLATE];

export const TEMPLATE_META: Record<
  TipoTemplate,
  { label: string; arquivo: string; tipoDocumento: string }
> = {
  contrato_colegio: {
    label: "Contrato — Colégio Integrado",
    arquivo: "contrato-colegio-integrado.docx",
    tipoDocumento: "contrato",
  },
  contrato_pinguinho: {
    label: "Contrato — Pinguinho de Gente",
    arquivo: "contrato-pinguinho.docx",
    tipoDocumento: "contrato",
  },
  declaracao_frequencia: {
    label: "Declaração de Frequência",
    arquivo: "declaracao-frequencia.docx",
    tipoDocumento: "declaracao",
  },
  declaracao_transferencia: {
    label: "Declaração de Transferência",
    arquivo: "declaracao-transferencia.docx",
    tipoDocumento: "declaracao",
  },
  termo_responsabilidade: {
    label: "Termo de Responsabilidade",
    arquivo: "termo-responsabilidade.docx",
    tipoDocumento: "termo",
  },
};

export function isTipoTemplate(value: unknown): value is TipoTemplate {
  return Object.values(TIPO_TEMPLATE).includes(value as TipoTemplate);
}
