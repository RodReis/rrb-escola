import type { DadosRelatorio, Ordenacao, TipoColuna } from "./tipos";

const COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** null = valor vazio (sempre vai para o fim, em asc e desc). */
export function chaveOrdenacao(valor: string, tipo: TipoColuna): string | number | null {
  const v = valor.trim();
  if (!v) return null;
  if (tipo === "data") {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    return m ? `${m[3]}${m[2]}${m[1]}` : v;
  }
  if (tipo === "numero") {
    const n = Number(v.replace(/[^\d,-]/g, "").replace(",", "."));
    return Number.isNaN(n) ? null : n;
  }
  return v;
}

function comparar(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return COLLATOR.compare(String(a), String(b));
}

export function ordenarLinhas(dados: DadosRelatorio, ordenacao: Ordenacao[]): DadosRelatorio {
  const regras = ordenacao
    .map((o) => ({ ...o, idx: dados.colunas.findIndex((c) => c.key === o.key) }))
    .filter((o) => o.idx >= 0);
  if (regras.length === 0) return dados;

  const linhas = [...dados.linhas].sort((la, lb) => {
    for (const r of regras) {
      const tipo = dados.colunas[r.idx].tipo;
      const ka = chaveOrdenacao(la[r.idx] ?? "", tipo);
      const kb = chaveOrdenacao(lb[r.idx] ?? "", tipo);
      if (ka === null || kb === null) {
        const c = comparar(ka, kb); // vazio no fim independente da direção
        if (c !== 0) return c;
        continue;
      }
      const c = comparar(ka, kb);
      if (c !== 0) return r.dir === "asc" ? c : -c;
    }
    return 0;
  });
  return { ...dados, linhas };
}

export function repetirCopias(linhas: string[][], copias: number): string[][] {
  return linhas.flatMap((l) => Array.from({ length: copias }, () => l));
}
