import { describe, expect, it } from "vitest";
import { formatarDataCurta, formatarDataExtenso, montarCorpo } from "./certificado-texto";
import { CERTIFICADO_DEFAULTS } from "./certificado-tipos";
import type { CertificadoData, CertificadoOptions } from "./certificado-tipos";

const escola: CertificadoData["escola"] = {
  razaoSocial: "ESCOLA PINGUINHO DE GENTE LTDA",
  nomeFantasia: "EPG TRINDADE",
  cnpj: "11.714.876/0001-16",
  resolucao: "RESOLUÇÃO CEE/CEB Nº 518/2024",
  endereco: "RUA EUGÊNIO JARDIM Nº 473, CENTRO",
  cidade: "TRINDADE",
  uf: "GO",
  cep: "75388-686",
  logoPath: null
};

const aluno: CertificadoData["aluno"] = {
  id: "a1",
  matriculaId: "m1",
  nome: "VITÓRIA VIEIRA VÍTOR",
  cpf: "116.726.301-42",
  matricula: "1041",
  filiacao: "JANIRO VIEIRA DA COSTA e MARIA JOSÉ DA SILVA VITOR",
  // Colunas `date` chegam em ISO.
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

const opts: CertificadoOptions = {
  tituloCertificado: "Certificado",
  textoInicio: "A Diretora da",
  descricaoCurso: "ENSINO MÉDIO",
  baseLegal: "sob a Resolução CEE/CEB N.01, de 14 de janeiro de 2022.",
  anoConclusao: 2024,
  dataEmissao: "2026-09-19",
  textoCustomizado: null,
  mostrarHistorico: false,
  leiaute: CERTIFICADO_DEFAULTS.leiaute,
  assinaturas: CERTIFICADO_DEFAULTS.assinaturas
};

const data: CertificadoData = { escola, aluno };
const juntar = (segs: Array<{ texto: string }>) => segs.map((s) => s.texto).join("");

describe("montarCorpo", () => {
  it("põe nome, nacionalidade, filiação, naturalidade, nascimento, ano e curso em negrito", () => {
    const negrito = montarCorpo(data, opts)
      .filter((s) => s.negrito)
      .map((s) => s.texto);

    expect(negrito).toContain("VITÓRIA VIEIRA VÍTOR");
    expect(negrito).toContain("BRASILEIRA");
    expect(negrito).toContain("JANIRO VIEIRA DA COSTA e MARIA JOSÉ DA SILVA VITOR");
    expect(negrito).toContain("GOIÂNIA-GO");
    expect(negrito).toContain("22/11/2006");
    expect(negrito).toContain("2024");
    expect(negrito).toContain("ENSINO MÉDIO");
  });

  it("monta um parágrafo legível com a base legal ao final", () => {
    const texto = juntar(montarCorpo(data, opts));

    expect(texto).toContain("A Diretora da EPG TRINDADE, certifica que VITÓRIA VIEIRA VÍTOR");
    expect(texto).toContain("concluiu no ano letivo de 2024 o ENSINO MÉDIO");
    expect(texto).toContain("sob a Resolução CEE/CEB N.01");
    expect(texto).not.toContain("  ");
  });

  it("usa o nome fantasia da escola, não a razão social", () => {
    expect(juntar(montarCorpo(data, opts))).not.toContain("PINGUINHO DE GENTE LTDA");
  });

  it("omite trechos de campos ausentes sem deixar buraco", () => {
    const texto = juntar(
      montarCorpo(
        { escola, aluno: { ...aluno, rg: null, filiacao: null, naturalidade: null, nacionalidade: null } },
        opts
      )
    );

    expect(texto).not.toContain("null");
    expect(texto).not.toContain("undefined");
    expect(texto).not.toContain("filho(a) de ,");
    expect(texto).not.toContain("  ");
    expect(texto).toContain("concluiu no ano letivo de 2024");
  });

  it("não deixa espaço antes da pontuação quando um campo cai", () => {
    const texto = juntar(montarCorpo({ escola, aluno: { ...aluno, rg: null } }, opts));
    expect(texto).not.toContain(" ,");
  });

  it("sobrevive a um aluno sem nenhum dado além do nome", () => {
    const texto = juntar(
      montarCorpo(
        {
          escola,
          aluno: {
            ...aluno,
            filiacao: null,
            dataNascimento: null,
            naturalidade: null,
            nacionalidade: null,
            rg: null
          }
        },
        opts
      )
    );

    expect(texto).toContain("VITÓRIA VIEIRA VÍTOR");
    expect(texto).toContain("ENSINO MÉDIO");
    expect(texto).not.toContain("  ");
  });

  it("usa o texto customizado com placeholders quando fornecido", () => {
    const segs = montarCorpo(data, {
      ...opts,
      textoCustomizado: "O aluno {{aluno}} concluiu {{curso}} em {{ano}}."
    });

    expect(juntar(segs)).toBe("O aluno VITÓRIA VIEIRA VÍTOR concluiu ENSINO MÉDIO em 2024.");
    expect(segs.filter((s) => s.negrito).map((s) => s.texto)).toContain("VITÓRIA VIEIRA VÍTOR");
  });

  it("deixa placeholder desconhecido literal, para a secretária ver o erro", () => {
    const texto = juntar(
      montarCorpo(data, { ...opts, textoCustomizado: "Aluno {{aluno}} e {{inexistente}}." })
    );
    expect(texto).toContain("{{inexistente}}");
  });

  it("ignora texto customizado só com espaços", () => {
    const texto = juntar(montarCorpo(data, { ...opts, textoCustomizado: "   " }));
    expect(texto).toContain("certifica que");
  });

  it("substitui todas as ocorrências do mesmo placeholder", () => {
    const texto = juntar(
      montarCorpo(data, { ...opts, textoCustomizado: "{{ano}} e de novo {{ano}}." })
    );
    expect(texto).toBe("2024 e de novo 2024.");
  });
});

describe("formatarDataExtenso", () => {
  it("formata em português por extenso", () => {
    expect(formatarDataExtenso("2026-09-19")).toBe("19 de setembro de 2026");
  });

  it("não desloca o dia por fuso horário", () => {
    expect(formatarDataExtenso("2026-01-01")).toBe("1 de janeiro de 2026");
  });

  it("devolve string vazia para entrada inválida", () => {
    expect(formatarDataExtenso("")).toBe("");
  });
});

describe("formatarDataCurta", () => {
  it("formata ISO como dd/mm/aaaa", () => {
    expect(formatarDataCurta("2006-11-22")).toBe("22/11/2006");
  });

  it("não desloca o dia na virada do ano", () => {
    expect(formatarDataCurta("2017-01-01")).toBe("01/01/2017");
  });

  it("devolve string vazia para data ausente", () => {
    expect(formatarDataCurta(null)).toBe("");
  });

  it("deixa passar valor já formatado da base importada", () => {
    expect(formatarDataCurta("28/08/2017")).toBe("28/08/2017");
  });
});
