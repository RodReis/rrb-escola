// src/lib/documents/anamnese-docx.ts
// Converte uma Anamnese (FICHA FUND 1) em Record<placeholder, string> para o
// template DOCX. Função pura — alvo de testes unitários. Sem "use server".

import type { Anamnese } from "@/lib/actions/pipeline-anamnese";

export type DadosIdentificacao = {
  nome: string | null;
  nascimento: string | null; // ISO date (yyyy-mm-dd) ou null
  serie: string | null;
  turma: string | null;
  responsaveis: string[]; // nomes
};

// Rótulos amigáveis para valores canônicos (espelha anamnese-fields.tsx).
const ROTULOS: Record<string, string> = {
  matutino: "Matutino", vespertino: "Vespertino",
  casados: "Casados", separados: "Separados",
  completa: "Completa", "pre-matura": "Pré-matura", "pos-matura": "Pós-matura",
  normal: "Normal", cesariano: "Cesariano", induzido: "Induzido",
  primogenito: "Primogênito", "do-meio": "Do meio", cacula: "Caçula", unico: "Único",
  obediente: "Obediente", independente: "Independente", comunicativo: "Comunicativo",
  agressivo: "Agressivo", cooperador: "Cooperador",
  tranquilo: "Tranquilo", seguro: "Seguro", ansioso: "Ansioso",
  alegre: "Alegre", emotivo: "Emotivo", queixoso: "Queixoso",
  insonia: "Insônia", pesadelo: "Pesadelo", hipersonia: "Hipersonia (excesso de sono)",
  "dorme-sozinho": "Dorme sozinho", "dorme-com-pais": "Dorme com os pais",
  "divide-quarto": "Divide o quarto com alguém",
  televisao: "Televisão", musica: "Música", leitura: "Leitura", computador: "Computador",
};

function rotulo(v: string): string {
  return ROTULOS[v] ?? v;
}

function txt(v: string | null | undefined): string {
  return v?.trim() ? v : "";
}

// boolean → "( X ) Sim / (  ) Não". null → vazio (nenhuma marca).
export function boolToDocx(v: boolean | null | undefined): string {
  if (v === true) return "( X ) Sim  (   ) Não";
  if (v === false) return "(   ) Sim  ( X ) Não";
  return "";
}

// CSV → marca cada opção do grupo. Ex: "obediente,cooperador" sobre as opções.
export function csvToDocx(csv: string | null | undefined): string {
  const sel = (csv ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!sel.length) return "";
  return sel.map(rotulo).join(", ");
}

function radioToDocx(v: string | null | undefined): string {
  return v?.trim() ? rotulo(v) : "";
}

function dataBR(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

export function formatAnamneseParaDocx(
  a: Anamnese,
  ident: DadosIdentificacao,
  escolaNome: string | null = null,
): Record<string, string> {
  const serieTurma = [ident.serie, ident.turma].filter((x) => x?.trim()).join(" / ");

  return {
    // Cabeçalho
    ESCOLA: txt(escolaNome),
    NOME: txt(ident.nome),
    NASCIMENTO: dataBR(ident.nascimento),
    SERIE_TURMA: serieTurma,
    RESPONSAVEIS: ident.responsaveis.filter(Boolean).join(", "),

    // Identificação / entrevista
    como_soube_escola: txt(a.como_soube_escola),
    turno: radioToDocx(a.turno),
    data_visita: dataBR(a.data_visita),
    crianca_compareceu: boolToDocx(a.crianca_compareceu),

    // Família
    pais_estado_civil: radioToDocx(a.pais_estado_civil),
    crianca_vive_com: txt(a.crianca_vive_com),

    // Gestação / parto
    gestacao: radioToDocx(a.gestacao),
    saude_mae_gravidez: txt(a.saude_mae_gravidez),
    parto: radioToDocx(a.parto),
    amamentou: txt(a.amamentou),
    mamadeira: txt(a.mamadeira),

    // Estrutura familiar
    tem_irmaos: boolToDocx(a.tem_irmaos),
    posicao_familiar: radioToDocx(a.posicao_familiar),
    filho_adotivo: boolToDocx(a.filho_adotivo),
    ciente_adocao: boolToDocx(a.ciente_adocao),

    // Desenvolvimento
    desenvolvimento_motor: txt(a.desenvolvimento_motor),
    atraso_fala: txt(a.atraso_fala),
    troca_fonemas: txt(a.troca_fonemas),
    dificuldade_visao_locomocao: txt(a.dificuldade_visao_locomocao),
    fatos_desenvolvimento: txt(a.fatos_desenvolvimento),
    controle_esfincter: txt(a.controle_esfincter),
    enurese_noturna: txt(a.enurese_noturna),
    perturbacoes_sono_dev: txt(a.perturbacoes_sono_dev),
    habitos_especiais: txt(a.habitos_especiais),
    atende_intervencoes: txt(a.atende_intervencoes),

    // Comportamento / emocional
    choro_facil: txt(a.choro_facil),
    recusa_auxilio: txt(a.recusa_auxilio),
    resistencia_toque: txt(a.resistencia_toque),
    escola_anterior: txt(a.escola_anterior),
    faz_amigos: txt(a.faz_amigos),
    adapta_meio: boolToDocx(a.adapta_meio),
    companheiros_brincadeira: txt(a.companheiros_brincadeira),
    distracoes_preferidas: csvToDocx(a.distracoes_preferidas),
    atitudes_sociais: csvToDocx(a.atitudes_sociais),
    emocional: csvToDocx(a.emocional),
    sono: csvToDocx(a.sono),

    // Saúde
    alergias: txt(a.alergias),
    medicamentos_continuos: txt(a.medicamentos_continuos),
    restricoes_alimentares: txt(a.restricoes_alimentares),
    problemas_neurologicos: txt(a.problemas_neurologicos),
    acompanhamento_medico: txt(a.acompanhamento_medico),
    necessidade_especial: a.necessidade_especial
      ? `Sim — ${txt(a.necessidade_especial_descricao) || "sem descrição"}`
      : boolToDocx(false),
    acomp_psicologico: a.acomp_psicologico
      ? `Sim — ${txt(a.acomp_psicologico_descricao) || "sem detalhes"}`
      : boolToDocx(false),
    acomp_fonoaudiologico: a.acomp_fonoaudiologico
      ? `Sim — ${txt(a.acomp_fonoaudiologico_descricao) || "sem detalhes"}`
      : boolToDocx(false),
    acomp_psicopedagogico: a.acomp_psicopedagogico
      ? `Sim — ${txt(a.acomp_psicopedagogico_descricao) || "sem detalhes"}`
      : boolToDocx(false),

    // Reação / internet
    reacao_contrariada: txt(a.reacao_contrariada),
    intolerancia_frustracao: boolToDocx(a.intolerancia_frustracao),
    uso_internet: txt(a.uso_internet),
    orientacao_internet: txt(a.orientacao_internet),

    // Resumo / rotina
    historico_desenvolvimento: txt(a.historico_desenvolvimento),
    comportamento_social: txt(a.comportamento_social),
    rotina_familiar: txt(a.rotina_familiar),

    // Observações
    outras_informacoes: txt(a.outras_informacoes),
    observacoes_responsaveis: txt(a.observacoes_responsaveis),
    observacoes_coordenacao: txt(a.observacoes_coordenacao),
  };
}

// Sanitiza o nome do aluno para uso em nome de arquivo.
export function nomeArquivoAnamnese(nome: string | null): string {
  const base = (nome ?? "aluno")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `Anamnese-${base || "aluno"}.docx`;
}
