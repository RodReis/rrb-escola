export const TRANSICOES: Record<string, string[]> = {
  iniciada:    ["em_andamento"],
  em_andamento: ["revisao", "iniciada"],
  revisao:     ["aprovacao", "em_andamento"],
  aprovacao:   ["aprovado", "revisao"],
  aprovado:    [],
};

export function podeTransicionar(de: string, para: string): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
