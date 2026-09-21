export type ExtratoLinha = {
  id: string;
  tipo: "credito" | "debito";
  valor: number;
  data: string;
  end_to_end_id?: string | null;
};

export type PagamentoCandidato = {
  id: string;
  valor_pago: number;
  data_pagamento: string;
  end_to_end_id?: string | null;
};

export function casarPorE2E(
  linha: ExtratoLinha,
  pagamentos: PagamentoCandidato[],
): PagamentoCandidato | null {
  if (!linha.end_to_end_id) return null;
  return pagamentos.find((p) => p.end_to_end_id === linha.end_to_end_id) ?? null;
}

export function sugerirPorValorData(
  linha: ExtratoLinha,
  candidatos: Array<{ id: string; valor: number; data: string }>,
  janelaDias: number,
) {
  const base = new Date(`${linha.data}T12:00:00Z`).getTime();
  return candidatos.filter((c) => {
    const diff = Math.abs(new Date(`${c.data}T12:00:00Z`).getTime() - base) / 86400000;
    return Math.abs(c.valor - linha.valor) < 0.01 && diff <= janelaDias;
  });
}
