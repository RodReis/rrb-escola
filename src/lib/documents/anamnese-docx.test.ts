import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import {
  formatAnamneseParaDocx,
  boolToDocx,
  csvToDocx,
  nomeArquivoAnamnese,
  type DadosIdentificacao,
} from "./anamnese-docx";
import type { Anamnese } from "@/lib/actions/pipeline-anamnese";

// Anamnese mínima com defaults; sobrescreve só o que cada teste precisa.
function fakeAnamnese(over: Partial<Anamnese> = {}): Anamnese {
  return {
    id: "a1",
    card_id: "c1",
    aluno_id: null,
    status: "em_analise",
    necessidade_especial: false,
    necessidade_especial_descricao: null,
    alergias: null,
    medicamentos_continuos: null,
    restricoes_alimentares: null,
    acomp_psicologico: false,
    acomp_psicologico_descricao: null,
    acomp_fonoaudiologico: false,
    acomp_fonoaudiologico_descricao: null,
    acomp_psicopedagogico: false,
    acomp_psicopedagogico_descricao: null,
    historico_desenvolvimento: null,
    comportamento_social: null,
    rotina_familiar: null,
    observacoes_responsaveis: null,
    observacoes_coordenacao: null,
    como_soube_escola: null,
    turno: null,
    data_visita: null,
    crianca_compareceu: null,
    pais_estado_civil: null,
    crianca_vive_com: null,
    gestacao: null,
    saude_mae_gravidez: null,
    parto: null,
    amamentou: null,
    mamadeira: null,
    tem_irmaos: null,
    posicao_familiar: null,
    filho_adotivo: null,
    ciente_adocao: null,
    desenvolvimento_motor: null,
    atraso_fala: null,
    troca_fonemas: null,
    dificuldade_visao_locomocao: null,
    fatos_desenvolvimento: null,
    controle_esfincter: null,
    enurese_noturna: null,
    perturbacoes_sono_dev: null,
    habitos_especiais: null,
    atende_intervencoes: null,
    choro_facil: null,
    recusa_auxilio: null,
    resistencia_toque: null,
    escola_anterior: null,
    faz_amigos: null,
    adapta_meio: null,
    companheiros_brincadeira: null,
    distracoes_preferidas: null,
    atitudes_sociais: null,
    emocional: null,
    sono: null,
    problemas_neurologicos: null,
    acompanhamento_medico: null,
    reacao_contrariada: null,
    intolerancia_frustracao: null,
    uso_internet: null,
    orientacao_internet: null,
    outras_informacoes: null,
    consentimento_em: "2026-06-01T10:00:00Z",
    consentimento_por: "u1",
    termo_versao: "v1",
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    ...over,
  };
}

const ident: DadosIdentificacao = {
  nome: "João Silva",
  nascimento: "2020-03-15",
  serie: "Infantil 4",
  turma: "A",
  responsaveis: ["Maria Silva", "José Silva"],
};

describe("boolToDocx", () => {
  it("marca Sim quando true", () => {
    expect(boolToDocx(true)).toBe("( X ) Sim  (   ) Não");
  });
  it("marca Não quando false", () => {
    expect(boolToDocx(false)).toBe("(   ) Sim  ( X ) Não");
  });
  it("retorna vazio quando null/undefined", () => {
    expect(boolToDocx(null)).toBe("");
    expect(boolToDocx(undefined)).toBe("");
  });
});

describe("csvToDocx", () => {
  it("converte CSV em rótulos legíveis", () => {
    expect(csvToDocx("obediente,cooperador")).toBe("Obediente, Cooperador");
  });
  it("ignora itens vazios e espaços", () => {
    expect(csvToDocx(" insonia , , dorme-sozinho ")).toBe("Insônia, Dorme sozinho");
  });
  it("retorna vazio quando nulo ou vazio", () => {
    expect(csvToDocx(null)).toBe("");
    expect(csvToDocx("")).toBe("");
  });
});

describe("nomeArquivoAnamnese", () => {
  it("sanitiza acentos e espaços", () => {
    expect(nomeArquivoAnamnese("João da Conceição")).toBe("Anamnese-joao-da-conceicao.docx");
  });
  it("usa fallback quando nulo", () => {
    expect(nomeArquivoAnamnese(null)).toBe("Anamnese-aluno.docx");
  });
});

describe("formatAnamneseParaDocx", () => {
  it("preenche cabeçalho com nome, nascimento pt-BR, série/turma e responsáveis", () => {
    const out = formatAnamneseParaDocx(fakeAnamnese(), ident);
    expect(out.NOME).toBe("João Silva");
    expect(out.NASCIMENTO).toBe("15/03/2020");
    expect(out.SERIE_TURMA).toBe("Infantil 4 / A");
    expect(out.RESPONSAVEIS).toBe("Maria Silva, José Silva");
  });

  it("inclui o nome da escola no cabeçalho (ESCOLA), vazio quando ausente", () => {
    expect(formatAnamneseParaDocx(fakeAnamnese(), ident, "Colégio RRB").ESCOLA).toBe("Colégio RRB");
    expect(formatAnamneseParaDocx(fakeAnamnese(), ident).ESCOLA).toBe("");
  });

  it("converte boolean e CSV nos campos de resposta", () => {
    const out = formatAnamneseParaDocx(
      fakeAnamnese({ crianca_compareceu: true, atitudes_sociais: "obediente,agressivo" }),
      ident,
    );
    expect(out.crianca_compareceu).toBe("( X ) Sim  (   ) Não");
    expect(out.atitudes_sociais).toBe("Obediente, Agressivo");
  });

  it("campos text nulos viram string vazia", () => {
    const out = formatAnamneseParaDocx(fakeAnamnese(), ident);
    expect(out.alergias).toBe("");
    expect(out.outras_informacoes).toBe("");
  });

  it("acompanhamento com flag true inclui a descrição", () => {
    const out = formatAnamneseParaDocx(
      fakeAnamnese({ acomp_psicologico: true, acomp_psicologico_descricao: "1x semana" }),
      ident,
    );
    expect(out.acomp_psicologico).toContain("Sim");
    expect(out.acomp_psicologico).toContain("1x semana");
  });

  it("radio resolve rótulo amigável", () => {
    const out = formatAnamneseParaDocx(fakeAnamnese({ gestacao: "pre-matura", parto: "cesariano" }), ident);
    expect(out.gestacao).toBe("Pré-matura");
    expect(out.parto).toBe("Cesariano");
  });
});

describe("integração: render do template DOCX real", () => {
  const TEMPLATE = resolve(__dirname, "templates/anamnese-fund1.docx");

  it("substitui placeholders sem deixar chaves residuais", () => {
    const variables = formatAnamneseParaDocx(
      fakeAnamnese({ como_soube_escola: "Indicação", crianca_compareceu: true }),
      ident,
    );
    const buf = readFileSync(TEMPLATE);
    const zip = new PizZip(buf);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
    doc.render(variables);
    const out = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
    const xml = new PizZip(out).file("word/document.xml")!.asText();

    expect(out.length).toBeGreaterThan(1000);
    expect(xml).toContain("João Silva");
    expect(xml).toContain("Indicação");
    // Nenhum placeholder {campo} restante
    expect(/\{[a-zA-Z_]+\}/.test(xml)).toBe(false);
  });
});
