// Apenas para testes. Fake mínimo do client do Supabase: cada `await` de uma
// cadeia consome a próxima resposta da fila "<tabela>.<operação>" (vazia = ok/null).

type Resposta = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
export type Operacao = "select" | "insert" | "update" | "delete" | "upsert";
export type Chamada = { table: string; op: Operacao; payload?: unknown; filtros: unknown[][] };

export function fakeSupabase(filas: Record<string, Resposta[]> = {}) {
  const pendentes: Record<string, Resposta[]> = Object.fromEntries(
    Object.entries(filas).map(([chave, respostas]) => [chave, [...respostas]]),
  );
  const calls: Chamada[] = [];

  function from(table: string) {
    const chamada: Chamada = { table, op: "select", filtros: [] };
    calls.push(chamada);
    const builder: Record<string, unknown> = {};
    for (const op of ["insert", "update", "delete", "upsert"] as const) {
      builder[op] = (payload?: unknown) => {
        chamada.op = op;
        chamada.payload = payload;
        return builder;
      };
    }
    for (const nome of ["select", "eq", "neq", "in", "is", "order", "limit", "single", "maybeSingle"]) {
      builder[nome] = (...args: unknown[]) => {
        chamada.filtros.push([nome, ...args]);
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      const resposta = pendentes[`${table}.${chamada.op}`]?.shift() ?? {};
      return Promise.resolve({
        data: resposta.data ?? null,
        error: resposta.error ?? null,
        count: resposta.count ?? null,
      }).then(resolve, reject);
    };
    return builder;
  }

  return {
    client: { from },
    calls,
    chamadas: (table: string, op: Operacao) => calls.filter((c) => c.table === table && c.op === op),
  };
}

export function formData(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(campos)) {
    for (const v of Array.isArray(valor) ? valor : [valor]) fd.append(chave, v);
  }
  return fd;
}
