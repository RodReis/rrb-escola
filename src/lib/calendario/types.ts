export type TipoExcecao = "feriado" | "recesso";

export type CalendarioExcecao = {
  id: string;
  calendarioId: string;
  escolaId: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  tipo: TipoExcecao;
  descricao: string;
};

export type Calendario = {
  id: string;
  escolaId: string;
  anoLetivo: number;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  diasSemanaLetivos: number[]; // 0=domingo … 6=sábado
};

export type CalendarioComExcecoes = {
  calendario: Calendario;
  excecoes: CalendarioExcecao[];
};
