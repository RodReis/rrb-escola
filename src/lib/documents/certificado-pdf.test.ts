import { describe, expect, it } from "vitest";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { renderCertificados } from "./certificado-pdf";
import { dataLocalDeIso } from "./certificado-texto";
import { renderHistoricos } from "./historico-pdf";
import { CERTIFICADO_DEFAULTS } from "./certificado-tipos";
import type { CertificadoData, CertificadoOptions } from "./certificado-tipos";
import type { HistoricoAno, HistoricoData } from "@/lib/historico/tipos";

const escola: CertificadoData["escola"] = {
  razaoSocial: "ESCOLA PINGUINHO DE GENTE LTDA",
  nomeFantasia: "EPG TRINDADE",
  cnpj: "11.714.876/0001-16",
  resolucao: "RESOLUÇÃO CEE/CEB Nº 518/2024",
  endereco: "RUA EUGÊNIO JARDIM Nº 473, CENTRO",
  cidade: "TRINDADE",
  uf: "GO",
  cep: "75388-686",
  logoPath: null,
  secretarioNome: "ROSSANIA BRÍGIDA RODRIGUES RIBEIRO BARBOSA",
  secretarioCargo: "Secretário(a)",
  diretorNome: "RAFAELA MARGARIDA BARROS",
  diretorCargo: "Diretor(a)"
};

function alunoFake(n: number): CertificadoData["aluno"] {
  return {
    id: `a${n}`,
    matriculaId: `m${n}`,
    nome: `ALUNO TESTE ${n}`,
    cpf: "116.726.301-42",
    matricula: `10${n}`,
    filiacao: "PAI TESTE e MAE TESTE",
    dataNascimento: "2006-11-22",
    naturalidade: "GOIÂNIA-GO",
    nacionalidade: "BRASILEIRA",
    rg: "6063621",
    orgaoExpedidor: "PC/GO",
    dataExpedicao: "2024-03-15",
    serie: "3ª SÉRIE - EM",
    turma: "A",
    anoLetivo: 2024
  };
}

const opts: CertificadoOptions = {
  tituloCertificado: "Certificado",
  textoInicio: "A Diretora da",
  descricaoCurso: "ENSINO MÉDIO",
  baseLegal:
    "sob a Resolução CEE/CEB N.01, de 14 de janeiro de 2022 de acordo com a Lei Nº 9394 de 20 de dezembro de 1996.",
  anoConclusao: 2024,
  dataEmissao: "2026-09-19",
  textoCustomizado: null,
  mostrarHistorico: false,
  leiaute: CERTIFICADO_DEFAULTS.leiaute,
  assinaturas: [
    { nome: "ALUNO TESTE 1", cargo: "Aluno(a)" },
    { nome: "ROSSANIA BRÍGIDA RODRIGUES RIBEIRO BARBOSA", cargo: "Secretária" },
    { nome: "RAFAELA MACHADO MARGARIDA BARROS", cargo: "Diretora" }
  ]
};

const dados = (n: number): CertificadoData => ({ escola, aluno: alunoFake(n) });

function anoHistorico(serieNome: string, ano: number): HistoricoAno {
  return {
    id: `${ano}`,
    ano,
    serieId: null,
    serieNome,
    origem: "interna",
    instituicao: "EPG TRINDADE",
    cidade: "TRINDADE",
    uf: "GO",
    resultado: "aprovado",
    mediaAprovacao: 6,
    cargaHoraria: 1000,
    diasLetivos: 213,
    faltas: null,
    percentualFrequencia: null,
    congelado: true,
    notas: [
      { disciplinaId: null, disciplinaNome: "MATEMÁTICA", nota: 9.4, cargaHoraria: 280, faltas: null, ordem: 0 },
      { disciplinaId: null, disciplinaNome: "LÍNGUA PORTUGUESA", nota: 9.2, cargaHoraria: 240, faltas: null, ordem: 1 }
    ]
  };
}

function historicoDe(n: number): HistoricoData {
  const aluno = alunoFake(n);
  return {
    aluno: {
      id: aluno.id,
      nome: aluno.nome,
      cpf: aluno.cpf,
      matricula: aluno.matricula,
      filiacao: aluno.filiacao,
      dataNascimento: aluno.dataNascimento,
      naturalidade: aluno.naturalidade,
      nacionalidade: aluno.nacionalidade,
      rg: aluno.rg,
      orgaoExpedidor: aluno.orgaoExpedidor,
      dataExpedicao: aluno.dataExpedicao
    },
    nivel: "medio",
    credenciamento: {
      ...escola,
      telefones: "(62)3505-1531",
      email: "secretariaepgtrindade@gmail.com",
      secretarioNome: "ROSSANIA BRÍGIDA",
      secretarioCargo: "Secretário(a)",
      diretorNome: "RAFAELA MARGARIDA",
      diretorCargo: "Diretor(a)"
    },
    anos: [anoHistorico("1ª SÉRIE", 2022), anoHistorico("2ª SÉRIE", 2023), anoHistorico("3ª SÉRIE", 2024)],
    observacoes: null
  };
}

/** Largura x altura da página `n`, em pontos. */
function medida(doc: ReturnType<typeof renderCertificados>, n: number) {
  const mb = (
    doc.getPageInfo(n) as unknown as {
      pageContext: {
        mediaBox: { bottomLeftX: number; bottomLeftY: number; topRightX: number; topRightY: number };
      };
    }
  ).pageContext.mediaBox;
  return {
    largura: Math.round(mb.topRightX - mb.bottomLeftX),
    altura: Math.round(mb.topRightY - mb.bottomLeftY)
  };
}

/** Itens de texto da página `n` com posição e largura, em pontos. */
async function itensDaPagina(doc: ReturnType<typeof renderCertificados>, n: number) {
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const conteudo = await (await pdf.getPage(n)).getTextContent();
  return conteudo.items
    .filter((i): i is TextItem => "str" in i)
    .filter((i) => i.str.trim() !== "")
    .map((i) => ({
      texto: i.str.trim(),
      x: i.transform[4] as number,
      y: i.transform[5] as number,
      largura: i.width as number
    }));
}

async function textosDaPagina(doc: ReturnType<typeof renderCertificados>, n: number): Promise<string[]> {
  return (await itensDaPagina(doc, n)).map((i) => i.texto);
}

describe("renderCertificados sem histórico", () => {
  it("gera uma página por aluno", () => {
    expect(renderCertificados([dados(1), dados(2)], opts).getNumberOfPages()).toBe(2);
  });

  it("usa paisagem A4 por padrão", () => {
    const { largura, altura } = medida(renderCertificados([dados(1)], opts), 1);
    expect(largura).toBe(842);
    expect(altura).toBe(595);
    expect(largura).toBeGreaterThan(altura);
  });

  it("respeita orientação retrato quando configurada", () => {
    const doc = renderCertificados([dados(1)], {
      ...opts,
      leiaute: { ...opts.leiaute, orientacao: "portrait" }
    });
    const { largura, altura } = medida(doc, 1);
    expect(largura).toBeLessThan(altura);
  });

  it("gera documento de uma página em branco para lista vazia", () => {
    expect(renderCertificados([], opts).getNumberOfPages()).toBe(1);
  });

  it("não quebra sem RG, filiação nem naturalidade", () => {
    const magro: CertificadoData = {
      escola,
      aluno: { ...alunoFake(9), rg: null, filiacao: null, naturalidade: null }
    };
    expect(() => renderCertificados([magro], opts)).not.toThrow();
  });

  it("não quebra com escola sem CNPJ nem endereço", () => {
    const semDados: CertificadoData = {
      escola: { ...escola, cnpj: null, endereco: null, resolucao: null, cep: null },
      aluno: alunoFake(1)
    };
    expect(() => renderCertificados([semDados], opts)).not.toThrow();
  });

  it("imprime nome do aluno, escola, curso e data por extenso", async () => {
    const itens = await textosDaPagina(renderCertificados([dados(1)], opts), 1);
    const texto = itens.join(" ");
    expect(texto).toContain("ALUNO TESTE 1");
    expect(texto).toContain("EPG TRINDADE");
    expect(texto).toContain("ENSINO MÉDIO");
    expect(texto).toContain("19 de setembro de 2026");
  });

  it("imprime a data de nascimento formatada, não ISO", async () => {
    const texto = (await textosDaPagina(renderCertificados([dados(1)], opts), 1)).join(" ");
    expect(texto).toContain("22/11/2006");
    expect(texto).not.toContain("2006-11-22");
  });

  it("imprime os cargos das assinaturas", async () => {
    const itens = await textosDaPagina(renderCertificados([dados(1)], opts), 1);
    expect(itens).toContain("Aluno(a)");
    expect(itens).toContain("Secretária");
    expect(itens).toContain("Diretora");
  });

  it("mantém todo o texto dentro das margens", async () => {
    const doc = renderCertificados([dados(1)], opts);
    const larguraPagina = medida(doc, 1).largura;
    const margemPt = (opts.leiaute.margemMm * 72) / 25.4;
    const itens = await itensDaPagina(doc, 1);

    expect(itens.length).toBeGreaterThan(0);
    // Meio ponto de folga absorve arredondamento do extrator.
    const estouram = itens.filter(
      (i) => i.x < margemPt - 0.5 || i.x + i.largura > larguraPagina - margemPt + 0.5
    );
    expect(estouram.map((i) => `${i.texto} @${i.x.toFixed(1)}+${i.largura.toFixed(1)}`)).toEqual([]);
  });

  it("quebra o corpo em várias linhas em vez de uma só", async () => {
    const itens = await itensDaPagina(renderCertificados([dados(1)], opts), 1);
    const ys = new Set(itens.map((i) => Math.round(i.y)));
    // Cabeçalho, título, corpo (várias linhas), data e assinaturas.
    expect(ys.size).toBeGreaterThan(6);
  });

  it("não sobrepõe o corpo às assinaturas com base legal longa", async () => {
    const baseLonga = `${opts.baseLegal} ${opts.baseLegal} ${opts.baseLegal}`;
    const doc = renderCertificados([dados(1)], { ...opts, baseLegal: baseLonga });
    const itens = await itensDaPagina(doc, 1);
    const margemPt = (opts.leiaute.margemMm * 72) / 25.4;

    const cargo = itens.find((i) => i.texto === "Secretária");
    expect(cargo).toBeDefined();
    // y cresce para cima no extrator: o cargo fica abaixo de tudo menos da margem.
    expect(cargo!.y).toBeGreaterThan(margemPt - 0.5);
  });
});

describe("renderCertificados com histórico no verso", () => {
  const optsHist: CertificadoOptions = { ...opts, mostrarHistorico: true };

  it("gera duas páginas por aluno", () => {
    const historicos = new Map([
      ["a1", historicoDe(1)],
      ["a2", historicoDe(2)]
    ]);
    expect(renderCertificados([dados(1), dados(2)], optsHist, historicos).getNumberOfPages()).toBe(4);
  });

  it("mantém a mesma paisagem no certificado e no histórico do verso", () => {
    const doc = renderCertificados([dados(1)], optsHist, new Map([["a1", historicoDe(1)]]));
    const certificado = medida(doc, 1);
    const historico = medida(doc, 2);

    expect(certificado.largura).toBeGreaterThan(certificado.altura);
    expect(historico.largura).toBeGreaterThan(historico.altura);
    expect(historico.largura).toBe(842);
    expect(historico.altura).toBe(595);
  });

  it("gera só o certificado quando o aluno não tem histórico no mapa", () => {
    expect(renderCertificados([dados(1)], optsHist, new Map()).getNumberOfPages()).toBe(1);
  });

  it("gera só o certificado quando o histórico está desligado", () => {
    const historicos = new Map([["a1", historicoDe(1)]]);
    expect(renderCertificados([dados(1)], opts, historicos).getNumberOfPages()).toBe(1);
  });

  it("dá a cada aluno o próprio histórico, na ordem", async () => {
    const historicos = new Map([
      ["a1", historicoDe(1)],
      ["a2", historicoDe(2)]
    ]);
    const doc = renderCertificados([dados(1), dados(2)], optsHist, historicos);

    expect((await textosDaPagina(doc, 2)).join(" ")).toContain("ALUNO TESTE 1");
    expect((await textosDaPagina(doc, 4)).join(" ")).toContain("ALUNO TESTE 2");
  });

  it("imprime a grade do histórico no verso", async () => {
    const doc = renderCertificados([dados(1)], optsHist, new Map([["a1", historicoDe(1)]]));
    const texto = (await textosDaPagina(doc, 2)).join(" ");
    expect(texto).toContain("HISTÓRICO ESCOLAR");
    expect(texto).toContain("MATEMÁTICA");
  });

  it("não quebra com histórico sem nenhum ano", () => {
    const vazio = { ...historicoDe(1), anos: [] };
    expect(() => renderCertificados([dados(1)], optsHist, new Map([["a1", vazio]]))).not.toThrow();
  });

  it("usa a mesma data no certificado e no verso", async () => {
    // `new Date("2026-09-19")` é meia-noite UTC: em GMT-3 o verso sairia com
    // 18 de setembro enquanto o certificado dizia 19.
    const doc = renderCertificados([dados(1)], optsHist, new Map([["a1", historicoDe(1)]]));

    expect((await textosDaPagina(doc, 1)).join(" ")).toContain("19 de setembro de 2026");
    expect((await textosDaPagina(doc, 2)).join(" ")).toContain("19 de setembro de 2026");
  });

  it("mantém o verso idêntico ao histórico emitido sozinho", async () => {
    // O verso do certificado não é um layout novo: é o mesmo documento que sai
    // por /historico/emissao, na mesma posição.
    const referencia = renderHistoricos([historicoDe(1)], {
      dataEmissao: dataLocalDeIso(optsHist.dataEmissao)
    });
    const comVerso = renderCertificados([dados(1)], optsHist, new Map([["a1", historicoDe(1)]]));

    const sozinho = await posicoes(referencia, 1);
    const verso = await posicoes(comVerso, 2);

    expect(verso).toEqual(sozinho);
  });
});

/** Itens como `texto@x,y`, para comparar posição entre documentos. */
async function posicoes(doc: ReturnType<typeof renderCertificados>, n: number): Promise<string[]> {
  return (await itensDaPagina(doc, n)).map((i) => `${i.texto}@${i.x.toFixed(1)},${i.y.toFixed(1)}`);
}
