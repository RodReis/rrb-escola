import type { ColunaDef, DadosRelatorio } from "./tipos";

export function montarDados<C>(catalogo: ColunaDef<C>[], ctxs: C[], keys: string[]): DadosRelatorio {
  const porKey = new Map(catalogo.map((c) => [c.key, c]));
  const cols = keys.map((k) => {
    const c = porKey.get(k);
    if (!c) throw new Error(`Coluna desconhecida: ${k}`);
    return c;
  });
  return {
    colunas: cols.map((c) => ({ key: c.key, label: c.label, grupo: c.grupo, tipo: c.tipo ?? "texto" })),
    linhas: ctxs.map((ctx) => cols.map((c) => c.resolve(ctx))),
  };
}
