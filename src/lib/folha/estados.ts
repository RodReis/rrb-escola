export const TRANSICOES: Record<string, string[]> = {
  rascunho: ["em_revisao", "aprovada"],
  em_revisao: ["rascunho", "aprovada"],
  aprovada: ["paga"],
  paga: ["fechada"],
  fechada: [],
};

export function podeTransicionar(de: string, para: string): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
