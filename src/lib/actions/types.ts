/**
 * Contrato único de retorno das Server Actions.
 *
 * `redirectTo` substitui a chamada de `redirect()` dentro da action:
 * a action devolve o destino e o cliente navega, para que o toast
 * apareça e a navegação aconteça — as duas coisas.
 *
 * `message` sobrescreve a mensagem de sucesso padrão quando o
 * resultado é dinâmico (ex: "12 rematriculados, 3 ignorados").
 */
export type ActionResult<T = void> =
  | { ok: true; data: T; redirectTo?: string; message?: string }
  | { ok: false; error: string };
