// scripts/build-anamnese-template.mjs
// Gera o template DOCX da Ficha de Anamnese (FICHA FUND 1) com placeholders {campo}.
// Executar uma vez: `node scripts/build-anamnese-template.mjs`
// Saída: src/lib/documents/templates/anamnese-fund1.docx (binário commitado).
//
// Reproduz a ordem dos blocos do PDF original. Os placeholders são resolvidos
// em runtime por docxtemplater (delimitadores {}), via generateDocxFromBuffer.

import PizZip from "pizzip";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/lib/documents/templates/anamnese-fund1.docx");

// Escape XML para o texto fixo (rótulos). Placeholders {x} não levam caracteres especiais.
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Parágrafo de título (negrito, maior).
function titulo(txt) {
  return `<w:p><w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve">${esc(txt)}</w:t></w:r></w:p>`;
}

// Cabeçalho de bloco (negrito).
function bloco(txt) {
  return `<w:p><w:pPr><w:spacing w:before="160" w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${esc(txt)}</w:t></w:r></w:p>`;
}

// Linha "Rótulo: {placeholder}". O rótulo em negrito, o valor em texto normal.
function linha(rotulo, ph) {
  return `<w:p><w:pPr><w:spacing w:after="20"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(rotulo)}: </w:t></w:r><w:r><w:t xml:space="preserve">{${ph}}</w:t></w:r></w:p>`;
}

const corpo = [
  titulo("FICHA DE ANAMNESE"),

  linha("Nome do(a) aluno(a)", "NOME"),
  linha("Data de nascimento", "NASCIMENTO"),
  linha("Série/Turma", "SERIE_TURMA"),
  linha("Responsáveis", "RESPONSAVEIS"),

  bloco("Identificação / entrevista"),
  linha("Como soube da escola?", "como_soube_escola"),
  linha("Turno", "turno"),
  linha("Data da visita", "data_visita"),
  linha("A criança compareceu?", "crianca_compareceu"),

  bloco("Família"),
  linha("Pais", "pais_estado_civil"),
  linha("Em caso de separação, a criança vive com quem?", "crianca_vive_com"),

  bloco("Gestação / parto"),
  linha("Gestação", "gestacao"),
  linha("Saúde da mãe durante a gravidez", "saude_mae_gravidez"),
  linha("Parto", "parto"),
  linha("Amamentou? Quanto tempo?", "amamentou"),
  linha("Mamadeira? Quanto tempo?", "mamadeira"),

  bloco("Estrutura familiar"),
  linha("Tem irmãos?", "tem_irmaos"),
  linha("Posição no bloco familiar", "posicao_familiar"),
  linha("Filho adotivo?", "filho_adotivo"),
  linha("A criança é ciente da adoção?", "ciente_adocao"),

  bloco("Desenvolvimento"),
  linha("Desenvolvimento motor no tempo esperado?", "desenvolvimento_motor"),
  linha("Atraso ou problema na fala?", "atraso_fala"),
  linha("Troca letras, fonemas? Quais?", "troca_fonemas"),
  linha("Dificuldades na visão ou locomoção?", "dificuldade_visao_locomocao"),
  linha("Fatos que afetaram o desenvolvimento", "fatos_desenvolvimento"),
  linha("Dificuldades ou atraso no esfíncter?", "controle_esfincter"),
  linha("Enurese noturna?", "enurese_noturna"),
  linha("Perturbações (pesadelos, sonambulismo, agitação)?", "perturbacoes_sono_dev"),
  linha("Possui hábitos especiais?", "habitos_especiais"),
  linha("Atende às intervenções quando desobedece?", "atende_intervencoes"),

  bloco("Comportamento / emocional"),
  linha("Apresenta choro fácil?", "choro_facil"),
  linha("Recusa auxílio?", "recusa_auxilio"),
  linha("Resistência ao toque (carinho, afago)?", "resistencia_toque"),
  linha("Já estudou em outra escola? Motivo da transferência?", "escola_anterior"),
  linha("Faz amigos com facilidade?", "faz_amigos"),
  linha("Adapta-se facilmente ao meio?", "adapta_meio"),
  linha("Companheiros nas brincadeiras", "companheiros_brincadeira"),
  linha("Distrações preferidas", "distracoes_preferidas"),
  linha("Atitudes sociais predominantes", "atitudes_sociais"),
  linha("Emocional", "emocional"),
  linha("Sono", "sono"),

  bloco("Saúde"),
  linha("Alergias", "alergias"),
  linha("Medicamentos contínuos", "medicamentos_continuos"),
  linha("Restrições alimentares", "restricoes_alimentares"),
  linha("Problemas neurológicos? Qual?", "problemas_neurologicos"),
  linha("Acompanhamento (médico, psicológico, fonoaudiológico)", "acompanhamento_medico"),
  linha("Necessidade especial / aluno atípico", "necessidade_especial"),
  linha("Acompanhamento psicológico", "acomp_psicologico"),
  linha("Acompanhamento fonoaudiológico", "acomp_fonoaudiologico"),
  linha("Acompanhamento psicopedagógico", "acomp_psicopedagogico"),

  bloco("Reação / internet"),
  linha("Como reage quando contrariada e atitude dos pais", "reacao_contrariada"),
  linha("Apresenta intolerância à frustração?", "intolerancia_frustracao"),
  linha("Faz uso da internet e redes sociais? Especificar", "uso_internet"),
  linha("Os pais orientam quanto ao uso da internet?", "orientacao_internet"),

  bloco("Desenvolvimento (resumo) / rotina"),
  linha("Histórico de desenvolvimento", "historico_desenvolvimento"),
  linha("Comportamento social", "comportamento_social"),
  linha("Rotina familiar", "rotina_familiar"),

  bloco("Observações"),
  linha("Outras informações importantes", "outras_informacoes"),
  linha("Obs. dos responsáveis", "observacoes_responsaveis"),
  linha("Obs. da coordenação (preenchido pela coordenadora)", "observacoes_coordenacao"),
].join("");

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${corpo}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", rels);
zip.file("word/document.xml", documentXml);

const out = zip.generate({ type: "nodebuffer" });
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`Template gravado: ${OUT} (${out.length} bytes)`);
