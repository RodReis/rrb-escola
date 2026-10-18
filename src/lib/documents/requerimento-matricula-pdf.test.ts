import { describe, expect, it } from "vitest";
import { renderRequerimentos, type RequerimentoPdfDados } from "./requerimento-matricula-pdf";
import type { DadosRequerimento } from "@/lib/data/requerimento-matricula";

function dadosFake(): DadosRequerimento {
  return {
    aluno: {
      matricula: "1754",
      nome: "Isabela Nunes Fidelis do Nascimento",
      sexo: "Feminino",
      dataNascimento: "2017-01-31",
      naturalidade: "GOIÂNIA-GO",
      telefones: null,
      endereco: "RUA 114, nº 8, SETOR ANA ROSA, TRINDADE/GO, 75389-066",
      cpf: null,
      rg: null,
      etnia: null,
      religiao: null,
      fotoUrl: null
    },
    pai: {
      nome: "Amauri Fidelis do Nascimento",
      rg: "4912539",
      cpfOuCnpj: "736.971.681-34",
      telefones: "(62)9931-8574",
      email: null,
      dataNascimento: "1988-06-02",
      estadoCivil: "Casado(a)",
      escolaridade: null,
      localTrabalho: null,
      profissao: null,
      telefoneTrabalho: null
    },
    mae: {
      nome: "Ana Paula Nunes da Silva",
      rg: "5550060",
      cpfOuCnpj: "043.638.081-10",
      telefones: "(62)99318-5874",
      email: "ana@example.com",
      dataNascimento: "1992-06-11",
      estadoCivil: "Casado(a)",
      escolaridade: null,
      localTrabalho: null,
      profissao: null,
      telefoneTrabalho: null
    },
    matricula: {
      anoLetivo: 2027,
      serieId: "serie-1",
      serie: "5º ANO",
      turma: "A",
      turno: "Matutino",
      tipoEnsino: "Ensino Fundamental",
      dataMatricula: "2026-10-16"
    },
    responsavelFinanceiro: {
      nome: "Ana Paula Nunes da Silva",
      cpfOuCnpj: "043.638.081-10",
      parentesco: "Mãe"
    }
  };
}

function paginaFake(): RequerimentoPdfDados {
  return {
    dados: dadosFake(),
    anoLetivo: 2027,
    observacoes: null,
    escola: {
      nome: "ESCOLA PINGUINHO DE GENTE LTDA",
      cnpj: "11.714.876/0001-16",
      endereco: "RUA EUGÊNIO JARDIM Nº 473",
      cidade: "TRINDADE",
      uf: "GO",
      cep: "75388-686",
      telefones: "(62)3505-1531",
      email: "secretariaepgtrindade@gmail.com",
      logoPath: null
    },
    secretario: {
      nome: "Rossania Brígida Rodrigues Ribeiro Barbosa",
      cargo: "Secretário(a)"
    }
  };
}

describe("renderRequerimentos", () => {
  it("gera uma página por item de entrada", () => {
    const doc = renderRequerimentos([paginaFake(), paginaFake()], new Map());
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it("omite o bloco de um responsável ausente sem lançar", () => {
    const pagina = paginaFake();
    pagina.dados.pai = null;
    expect(() => renderRequerimentos([pagina], new Map())).not.toThrow();
  });

  it("omite o bloco de responsável financeiro ausente sem lançar (preview individual)", () => {
    const pagina = paginaFake();
    pagina.dados.responsavelFinanceiro = null;
    expect(() => renderRequerimentos([pagina], new Map())).not.toThrow();
  });

  it("renderiza observações quando preenchidas, sem lançar", () => {
    const pagina = paginaFake();
    pagina.observacoes = "Documento conferido na secretaria.";
    expect(() => renderRequerimentos([pagina], new Map())).not.toThrow();
  });

  it("com aluno + pai + mãe + matrícula + responsável financeiro, tudo cabe em 1 página A4", () => {
    const doc = renderRequerimentos([paginaFake()], new Map());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("dados longos e observações enormes nunca geram 2ª página (altura de linha é fixa)", () => {
    const pagina = paginaFake();
    const longo = "TEXTO MUITO LONGO ".repeat(40);
    pagina.observacoes = Array.from({ length: 80 }, (_, i) => `Linha de observação número ${i + 1}.`).join(" ");
    pagina.dados.aluno.endereco = longo;
    pagina.dados.aluno.nome = longo;
    pagina.dados.mae = { ...pagina.dados.mae!, localTrabalho: longo, email: longo, profissao: longo };
    pagina.escola.endereco = longo;
    pagina.secretario.nome = longo;
    const doc = renderRequerimentos([pagina], new Map());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("a data do rodapé leva o nome da cidade da escola (Trindade, ...)", () => {
    const pagina = paginaFake();
    pagina.escola.cidade = "TRINDADE";
    const pdf = renderRequerimentos([pagina], new Map()).output();
    expect(pdf).toMatch(/Trindade, \d{1,2} de \w+ de \d{4}\./);
  });

  it("embute a foto do aluno quando ela está no cache, e segue sem ela quando não está", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const pagina = paginaFake();
    pagina.dados.aluno.fotoUrl = "https://signed.example/foto.png";
    const comFoto = renderRequerimentos([pagina], new Map([[pagina.dados.aluno.fotoUrl, { data: png, w: 30, h: 40 }]]));
    const semFoto = renderRequerimentos([pagina], new Map());
    expect(comFoto.getNumberOfPages()).toBe(1);
    expect(comFoto.output().length).toBeGreaterThan(semFoto.output().length);
  });

  it("não lança com foto ilegível no cache (cai no espaço 'Foto')", () => {
    const pagina = paginaFake();
    pagina.dados.aluno.fotoUrl = "https://signed.example/quebrada.png";
    const imagens = new Map([[pagina.dados.aluno.fotoUrl, { data: "data:image/png;base64,@@@", w: 10, h: 10 }]]);
    expect(() => renderRequerimentos([pagina], imagens)).not.toThrow();
  });
});
