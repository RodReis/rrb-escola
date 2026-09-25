import { normalizarTexto } from "../formatar";

export function nomeArquivo(base: string, ext: "pdf" | "csv", agora: Date = new Date()): string {
  const slug = normalizarTexto(base).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "relatorio";
  const p = (n: number) => String(n).padStart(2, "0");
  const carimbo = `${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}`;
  return `${slug}-${carimbo}.${ext}`;
}

export function baixarBlob(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
