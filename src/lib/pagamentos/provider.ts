export type ProvedorPagamento = "asaas" | "sicoob";
export type TipoCobrancaProvider = "pix_imediato" | "boleto" | "fatura";
export type OrigemRecebimento = "cobranca" | "venda" | "contrato" | "evento" | "lancamento" | "avulso";

export type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export type CobrancaProviderInput = {
  cobranca: {
    id: string;
    descricao: string;
    valor_final: number | string;
    data_vencimento?: string | null;
  };
  conta?: {
    id: string;
    chave_pix: string | null;
  };
  origemTipo?: OrigemRecebimento;
  origemId?: string | null;
  responsavel: {
    nome: string;
    cpf?: string | null;
    email?: string | null;
    celular?: string | null;
    asaas_customer_id?: string | null;
  };
  tipo: TipoCobrancaProvider;
};

export type CobrancaProvedor = {
  provedor: ProvedorPagamento;
  tipo: TipoCobrancaProvider;
  id_externo: string;
  status_externo?: string | null;
  url_fatura?: string | null;
  pix_copia_cola?: string | null;
  pix_location?: string | null;
  expira_em?: string | null;
  payload: unknown;
};

export type StatusExterno = {
  id_externo: string;
  status: string;
  payload: unknown;
};

export type PaymentProvider = {
  id: ProvedorPagamento;
  suporta: TipoCobrancaProvider[];
  criarCobranca(input: CobrancaProviderInput): Promise<ProviderResult<CobrancaProvedor>>;
  consultarCobranca(idExterno: string): Promise<ProviderResult<StatusExterno>>;
  cancelarCobranca?(idExterno: string): Promise<ProviderResult<void>>;
};
