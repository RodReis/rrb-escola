export type NivelEnsino = "infantil" | "fund1" | "fund2" | "medio";
export type OrigemHistorico = "interna" | "externa";
export type ResultadoHistorico = "aprovado" | "reprovado" | "cursando" | "transferido";

export const NIVEL_LABEL: Record<NivelEnsino, string> = {
  infantil: "Educação Infantil",
  fund1: "Ensino Fundamental",
  fund2: "Ensino Fundamental",
  medio: "Ensino Médio"
};

/** Colunas da grade por nível, na ordem impressa. */
export const SERIES_POR_NIVEL: Record<NivelEnsino, string[]> = {
  infantil: ["MATERNAL", "JARDIM I", "JARDIM II"],
  fund1: ["1º ANO", "2º ANO", "3º ANO", "4º ANO", "5º ANO"],
  fund2: ["6º ANO", "7º ANO", "8º ANO", "9º ANO"],
  medio: ["1ª SÉRIE", "2ª SÉRIE", "3ª SÉRIE"]
};

/** C.H. por disciplina só é impressa de Fund2 em diante (ver spec, seção "O PDF"). */
export const NIVEL_EXIBE_CH: Record<NivelEnsino, boolean> = {
  infantil: false,
  fund1: false,
  fund2: true,
  medio: true
};

export type HistoricoNota = {
  disciplinaId: string | null;
  disciplinaNome: string;
  nota: number | null;
  cargaHoraria: number | null;
  faltas: number | null;
  ordem: number;
};

export type HistoricoAno = {
  id: string;
  ano: number;
  serieId: string | null;
  serieNome: string;
  origem: OrigemHistorico;
  instituicao: string | null;
  cidade: string | null;
  uf: string | null;
  resultado: ResultadoHistorico;
  mediaAprovacao: number | null;
  cargaHoraria: number | null;
  diasLetivos: number | null;
  faltas: number | null;
  percentualFrequencia: number | null;
  congelado: boolean;
  notas: HistoricoNota[];
};

export type HistoricoCredenciamento = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string | null;
  resolucao: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  telefones: string | null;
  email: string | null;
  logoPath: string | null;
  secretarioNome: string | null;
  secretarioCargo: string;
  diretorNome: string | null;
  diretorCargo: string;
};

export type HistoricoAluno = {
  id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  filiacao: string | null;
  dataNascimento: string | null;
  naturalidade: string | null;
  nacionalidade: string | null;
  rg: string | null;
  orgaoExpedidor: string | null;
  dataExpedicao: string | null;
};

export type HistoricoData = {
  aluno: HistoricoAluno;
  nivel: NivelEnsino;
  credenciamento: HistoricoCredenciamento;
  anos: HistoricoAno[];
  observacoes: string | null;
};
