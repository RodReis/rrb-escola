import { describe, it, expect } from "vitest";
import { eventoConfirmaPagamento } from "./webhook";

describe("eventoConfirmaPagamento", () => {
  it("PAYMENT_RECEIVED confirma pagamento", () => {
    expect(eventoConfirmaPagamento("PAYMENT_RECEIVED")).toBe(true);
  });
  it("PAYMENT_CONFIRMED confirma pagamento", () => {
    expect(eventoConfirmaPagamento("PAYMENT_CONFIRMED")).toBe(true);
  });
  it("PAYMENT_OVERDUE não confirma", () => {
    expect(eventoConfirmaPagamento("PAYMENT_OVERDUE")).toBe(false);
  });
  it("PAYMENT_CREATED não confirma", () => {
    expect(eventoConfirmaPagamento("PAYMENT_CREATED")).toBe(false);
  });
  it("evento desconhecido não confirma", () => {
    expect(eventoConfirmaPagamento("ALGO_ESTRANHO")).toBe(false);
  });
  it("string vazia não confirma", () => {
    expect(eventoConfirmaPagamento("")).toBe(false);
  });
});
