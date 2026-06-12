export type RubricaDef = {
  id: string;
  codigo: string;
  nome: string;
  tipo: "provento" | "desconto" | "base" | "informativa";
  metodo_calculo: string;
  incide_inss: boolean;
  incide_irrf: boolean;
  incide_fgts: boolean;
  incide_dsr: boolean;
  ordem_holerite: number;
};

export type PerfilRubrica = { rubrica: RubricaDef; automatica: boolean; ordem_execucao: number };

export type VerbaContratual = { rubrica_codigo: string; valor: number | null; percentual: number | null };

export type ContratoCalculo = {
  id: string;
  salario_base: number | null;
  valor_hora_aula: number | null;
  aulas_semanais: number | null;
  dependentes_irrf: number;
  verbas: VerbaContratual[];
};

export type ConfigCalculo = {
  divisor_dsr: number;
  percentual_hora_atividade: number;
  semanas_mes: number;
};

export type LancamentoManual = {
  rubrica_codigo: string;
  valor: number;
  referencia?: string;
  origem: "manual" | "recorrente";
  recorrente_parcelas?: number;
  recorrente_parcela_atual?: number;
};

export type LancamentoCalculado = {
  rubrica_codigo: string;
  referencia: string | null;
  valor: number;
  origem: "auto" | "manual" | "recorrente";
};

export type ValidacaoItem = { nivel: "erro" | "aviso"; mensagem: string };

export type ResultadoItem = {
  lancamentos: LancamentoCalculado[];
  total_proventos: number;
  total_descontos: number;
  liquido: number;
  base_inss: number;
  base_irrf: number;
  base_fgts: number;
  encargos: { fgts: number; inss_patronal: number; provisao_13: number; provisao_ferias: number };
  validacoes: ValidacaoItem[];
};
