import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePermissionMock, listarMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  listarMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/lib/data/cancelamento", () => ({ listarCobrancasAbertasParaCancelamento: listarMock }));

import { GET } from "./route";

beforeEach(() => {
  requirePermissionMock.mockReset().mockResolvedValue({});
  listarMock.mockReset().mockResolvedValue([{ id: "c1", descricao: "Mensalidade", competencia: "2026-09", valorFinal: 500, dataVencimento: "2026-10-05", origem: "manual", preSelecionada: true }]);
});

describe("GET /api/cancelamento/cobrancas", () => {
  it("retorna as cobrancas do aluno", async () => {
    const req = new Request("http://localhost/api/cancelamento/cobrancas?aluno_id=aluno-1&data=2026-09-24");
    const res = await GET(req);
    const body = await res.json();

    expect(listarMock).toHaveBeenCalledWith("aluno-1", "2026-09-24");
    expect(body).toHaveLength(1);
  });

  it("retorna 400 sem aluno_id", async () => {
    const req = new Request("http://localhost/api/cancelamento/cobrancas?data=2026-09-24");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
