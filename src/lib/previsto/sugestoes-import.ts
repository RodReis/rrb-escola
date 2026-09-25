import { normalizarTexto } from "@/lib/previsto/planilha";

export type EmpresaParaSugestao = { id: string; nome: string; cnpj: string | null };
export type CategoriaParaSugestao = { id: string; nome: string };

// Palavra da planilha -> trecho do nome da empresa (E4). A planilha da secretária
// usa ESCOLA / COLÉGIO no lugar do CNPJ.
const ALIAS_EMPRESA: Array<[RegExp, RegExp]> = [
  [/^escola$/, /pinguinho/],
  [/^colegio$/, /integrado/],
];

export function sugerirEmpresa(texto: string | null, empresas: EmpresaParaSugestao[]): string | null {
  if (!texto) return null;
  const t = normalizarTexto(texto);
  const digitos = texto.replace(/\D/g, "");

  if (digitos.length === 14) {
    const porCnpj = empresas.find((e) => (e.cnpj ?? "").replace(/\D/g, "") === digitos);
    if (porCnpj) return porCnpj.id;
  }

  const exata = empresas.find((e) => normalizarTexto(e.nome) === t);
  if (exata) return exata.id;

  for (const [palavra, trecho] of ALIAS_EMPRESA) {
    if (!palavra.test(t)) continue;
    const alvo = empresas.find((e) => trecho.test(normalizarTexto(e.nome)));
    if (alvo) return alvo.id;
  }
  return null;
}

/** 'Outros' é o valor inútil dos 13 avulsos de setembro: nunca sugere. */
export function sugerirCategoria(texto: string | null, categorias: CategoriaParaSugestao[]): string | null {
  if (!texto) return null;
  const t = normalizarTexto(texto);
  if (t === "outros") return null;
  return categorias.find((c) => normalizarTexto(c.nome) === t)?.id ?? null;
}
