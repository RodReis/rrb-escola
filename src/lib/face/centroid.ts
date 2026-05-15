export function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) throw new Error("no embeddings");
  const dim = embeddings[0].length;
  const sum = new Array(dim).fill(0);
  for (const e of embeddings) {
    for (let i = 0; i < dim; i++) sum[i] += e[i];
  }
  return sum.map((v) => v / embeddings.length);
}

export function vectorToPgString(vec: number[]): string {
  return `[${vec.map((v) => v.toFixed(6)).join(",")}]`;
}
