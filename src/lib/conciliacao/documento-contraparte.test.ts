import { describe, expect, it } from "vitest";
import { extrairDocumentoContraparte, chaveDeDocumento } from "@/lib/conciliacao/documento-contraparte";

describe("extrairDocumentoContraparte", () => {
  it("lê CNPJ completo, que o Sicoob manda com espaço no lugar da barra", () => {
    expect(
      extrairDocumentoContraparte({ descInfComplementar: "Pagamento Pix|@01.816.875 0001-29|@" }),
    ).toBe("01816875000129");
  });

  it("lê CPF mascarado pelo banco, devolvendo os 6 dígitos visíveis", () => {
    expect(
      extrairDocumentoContraparte({ descInfComplementar: "Pagamento Pix|@***.246.701-**|@" }),
    ).toBe("246701");
  });

  it("devolve null quando o campo existe mas vem vazio (DÉB.TIT.COMPE)", () => {
    expect(extrairDocumentoContraparte({ descInfComplementar: "" })).toBeNull();
  });

  it("devolve null quando não há delimitador |@", () => {
    expect(extrairDocumentoContraparte({ descInfComplementar: "Pagamento Pix" })).toBeNull();
  });

  it("devolve null quando entre os delimitadores não sobra dígito nenhum", () => {
    expect(extrairDocumentoContraparte({ descInfComplementar: "Pagamento Pix|@***.***.***-**|@" })).toBeNull();
  });

  it("cai no cpfCnpj quando ele existe — 2 dos 1.294 itens medidos o trazem", () => {
    expect(extrairDocumentoContraparte({ cpfCnpj: "01.816.875/0001-29" })).toBe("01816875000129");
  });

  it("prefere descInfComplementar ao cpfCnpj quando os dois existem", () => {
    expect(
      extrairDocumentoContraparte({
        descInfComplementar: "Pagamento Pix|@***.246.701-**|@",
        cpfCnpj: "99.999.999/0001-99",
      }),
    ).toBe("246701");
  });

  it("devolve null para item sem nenhum dos dois campos", () => {
    expect(extrairDocumentoContraparte({})).toBeNull();
  });
});

describe("chaveDeDocumento", () => {
  it("reduz CPF completo aos 6 dígitos que o banco deixa visíveis", () => {
    expect(chaveDeDocumento("857.906.721-91")).toBe("906721");
    expect(chaveDeDocumento("47853620144")).toBe("536201");
  });

  it("mantém CNPJ inteiro", () => {
    expect(chaveDeDocumento("01.816.875/0001-29")).toBe("01816875000129");
  });
});
