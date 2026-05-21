export type DadosLembrete = {
  responsavel: string;
  aluno: string;
  descricao: string;
  valor: string;
  vencimento: string;
  diasAtraso: number;
};

// Substitui os placeholders {chave} do template pelos valores correspondentes.
// Placeholders sem valor conhecido são mantidos literais.
export function montarMensagem(template: string, dados: DadosLembrete): string {
  const mapa: Record<string, string> = {
    responsavel: dados.responsavel,
    aluno: dados.aluno,
    descricao: dados.descricao,
    valor: dados.valor,
    vencimento: dados.vencimento,
    dias_atraso: String(dados.diasAtraso),
  };
  return template.replace(/\{(\w+)\}/g, (literal, chave: string) => {
    return chave in mapa ? mapa[chave] : literal;
  });
}
