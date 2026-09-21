// Curva ABC: classifica variações por giro (volume de saída no período).
// A = top 80% do volume acumulado, B = próximos 15%, C = últimos 5%.
// Lógica pura.

export interface GiroVariacao {
  variacao_id: string;
  rotulo: string;       // produto + sku/atributos
  quantidadeSaida: number;
}

export interface LinhaABC extends GiroVariacao {
  percentual: number;       // % do volume total
  acumulado: number;        // % acumulado
  classe: "A" | "B" | "C";
}

const CORTE_A = 80;
const CORTE_B = 95;

export function curvaABC(giros: GiroVariacao[]): LinhaABC[] {
  const total = giros.reduce((a, g) => a + g.quantidadeSaida, 0);
  if (total === 0) {
    return giros.map((g) => ({ ...g, percentual: 0, acumulado: 0, classe: "C" as const }));
  }

  const ordenado = [...giros].sort((a, b) => b.quantidadeSaida - a.quantidadeSaida);
  let acumulado = 0;
  return ordenado.map((g) => {
    const percentual = (g.quantidadeSaida / total) * 100;
    acumulado += percentual;
    const classe: "A" | "B" | "C" = acumulado <= CORTE_A ? "A" : acumulado <= CORTE_B ? "B" : "C";
    return { ...g, percentual, acumulado, classe };
  });
}
