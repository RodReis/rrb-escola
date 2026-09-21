export type AlunoElegivel = {
  id: string;
  nome: string;
  temHistorico: boolean;
};

export function separarElegiveis(alunos: AlunoElegivel[]) {
  return {
    prontos: alunos.filter((a) => a.temHistorico),
    pendentes: alunos.filter((a) => !a.temHistorico)
  };
}
