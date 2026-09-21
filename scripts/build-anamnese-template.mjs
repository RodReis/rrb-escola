// scripts/build-anamnese-template.mjs
// Gera o template DOCX da Ficha de Anamnese (FICHA FUND 1) — layout institucional.
// Executar: `node scripts/build-anamnese-template.mjs`
// Saída: src/lib/documents/templates/anamnese-fund1.docx (binário commitado).
//
// Layout: cabeçalho centralizado (escola + título), tabela de identificação do aluno,
// e cada bloco como título de seção + tabela de 2 colunas (pergunta | resposta).
// Placeholders {campo} resolvidos em runtime por docxtemplater.

import PizZip from "pizzip";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/lib/documents/templates/anamnese-fund1.docx");

const BRAND = "234CC9"; // azul do design system (aprox. --color-brand)
const ZEBRA = "F2F4FA"; // fundo claro de linhas alternadas

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Run de texto com propriedades opcionais.
function run(text, { bold, color, size, italic } = {}) {
  const rpr = [];
  if (bold) rpr.push("<w:b/>");
  if (italic) rpr.push("<w:i/>");
  if (color) rpr.push(`<w:color w:val="${color}"/>`);
  if (size) rpr.push(`<w:sz w:val="${size}"/>`);
  const rprXml = rpr.length ? `<w:rPr>${rpr.join("")}</w:rPr>` : "";
  return `<w:r>${rprXml}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

// Parágrafo simples.
function p(runsXml, { align, spacingBefore = 0, spacingAfter = 60, shd } = {}) {
  const ppr = [];
  if (align) ppr.push(`<w:jc w:val="${align}"/>`);
  ppr.push(`<w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}"/>`);
  if (shd) ppr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${shd}"/>`);
  return `<w:p><w:pPr>${ppr.join("")}</w:pPr>${runsXml}</w:p>`;
}

// Título de seção (barra colorida com texto branco).
function secao(titulo) {
  return `<w:p><w:pPr><w:spacing w:before="200" w:after="60"/><w:shd w:val="clear" w:color="auto" w:fill="${BRAND}"/><w:ind w:left="60" w:right="60"/></w:pPr>${run(esc(titulo), { bold: true, color: "FFFFFF", size: 22 })}</w:p>`;
}

// Célula de tabela.
function cell(runsXml, { width, fill, align } = {}) {
  const tcpr = [];
  if (width) tcpr.push(`<w:tcW w:w="${width}" w:type="dxa"/>`);
  if (fill) tcpr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`);
  tcpr.push('<w:vAlign w:val="center"/>');
  const ppr = align ? `<w:pPr><w:jc w:val="${align}"/><w:spacing w:after="20"/></w:pPr>` : '<w:pPr><w:spacing w:after="20"/></w:pPr>';
  return `<w:tc><w:tcPr>${tcpr.join("")}</w:tcPr><w:p>${ppr}${runsXml}</w:p></w:tc>`;
}

// Tabela de 2 colunas (pergunta | resposta) com bordas leves e zebra.
function tabela2col(linhas) {
  const borders = `<w:tblBorders>
    <w:top w:val="single" w:sz="4" w:space="0" w:color="DDE1EC"/>
    <w:left w:val="single" w:sz="4" w:space="0" w:color="DDE1EC"/>
    <w:bottom w:val="single" w:sz="4" w:space="0" w:color="DDE1EC"/>
    <w:right w:val="single" w:sz="4" w:space="0" w:color="DDE1EC"/>
    <w:insideH w:val="single" w:sz="4" w:space="0" w:color="DDE1EC"/>
    <w:insideV w:val="single" w:sz="4" w:space="0" w:color="DDE1EC"/>
  </w:tblBorders>`;
  const tblPr = `<w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borders}<w:tblLayout w:type="fixed"/></w:tblPr>`;
  const grid = `<w:tblGrid><w:gridCol w:w="4400"/><w:gridCol w:w="5400"/></w:tblGrid>`;
  const rows = linhas
    .map(([rotulo, ph], i) => {
      const fill = i % 2 === 1 ? ZEBRA : undefined;
      const c1 = cell(run(esc(rotulo), { bold: true, size: 18 }), { width: 4400, fill });
      const c2 = cell(run(`{${ph}}`, { size: 18 }), { width: 5400, fill });
      return `<w:tr>${c1}${c2}</w:tr>`;
    })
    .join("");
  return `<w:tbl>${tblPr}${grid}${rows}</w:tbl>`;
}

// Tabela de identificação do aluno (cabeçalho de dados, layout 2 col com rótulos fortes).
function tabelaIdent() {
  const linhas = [
    ["Aluno(a)", "NOME"],
    ["Data de nascimento", "NASCIMENTO"],
    ["Série / Turma", "SERIE_TURMA"],
    ["Responsáveis", "RESPONSAVEIS"],
  ];
  return tabela2col(linhas);
}

const corpo = [
  // Cabeçalho institucional
  p(run("{ESCOLA}", { bold: true, size: 24, color: BRAND }), { align: "center", spacingAfter: 20 }),
  p(run("FICHA DE ANAMNESE", { bold: true, size: 32 }), { align: "center", spacingAfter: 40 }),
  p(run("Entrevista de ingresso — Educação Infantil e Fundamental I", { italic: true, size: 18, color: "777777" }), { align: "center", spacingAfter: 160 }),

  // Identificação
  secao("Identificação do aluno"),
  tabelaIdent(),

  secao("Entrevista"),
  tabela2col([
    ["Como soube da escola?", "como_soube_escola"],
    ["Turno", "turno"],
    ["Data da visita", "data_visita"],
    ["A criança compareceu?", "crianca_compareceu"],
  ]),

  secao("Família"),
  tabela2col([
    ["Pais", "pais_estado_civil"],
    ["Em caso de separação, vive com quem?", "crianca_vive_com"],
  ]),

  secao("Gestação e parto"),
  tabela2col([
    ["Gestação", "gestacao"],
    ["Saúde da mãe durante a gravidez", "saude_mae_gravidez"],
    ["Parto", "parto"],
    ["Amamentou? Quanto tempo?", "amamentou"],
    ["Mamadeira? Quanto tempo?", "mamadeira"],
  ]),

  secao("Estrutura familiar"),
  tabela2col([
    ["Tem irmãos?", "tem_irmaos"],
    ["Posição no bloco familiar", "posicao_familiar"],
    ["Filho adotivo?", "filho_adotivo"],
    ["A criança é ciente da adoção?", "ciente_adocao"],
  ]),

  secao("Desenvolvimento"),
  tabela2col([
    ["Desenvolvimento motor no tempo esperado?", "desenvolvimento_motor"],
    ["Atraso ou problema na fala?", "atraso_fala"],
    ["Troca letras, fonemas? Quais?", "troca_fonemas"],
    ["Dificuldades na visão ou locomoção?", "dificuldade_visao_locomocao"],
    ["Fatos que afetaram o desenvolvimento", "fatos_desenvolvimento"],
    ["Dificuldades ou atraso no esfíncter?", "controle_esfincter"],
    ["Enurese noturna?", "enurese_noturna"],
    ["Perturbações (pesadelos, sonambulismo)?", "perturbacoes_sono_dev"],
    ["Possui hábitos especiais?", "habitos_especiais"],
    ["Atende às intervenções quando desobedece?", "atende_intervencoes"],
  ]),

  secao("Comportamento e emocional"),
  tabela2col([
    ["Apresenta choro fácil?", "choro_facil"],
    ["Recusa auxílio?", "recusa_auxilio"],
    ["Resistência ao toque (carinho, afago)?", "resistencia_toque"],
    ["Já estudou em outra escola? Motivo?", "escola_anterior"],
    ["Faz amigos com facilidade?", "faz_amigos"],
    ["Adapta-se facilmente ao meio?", "adapta_meio"],
    ["Companheiros nas brincadeiras", "companheiros_brincadeira"],
    ["Distrações preferidas", "distracoes_preferidas"],
    ["Atitudes sociais predominantes", "atitudes_sociais"],
    ["Emocional", "emocional"],
    ["Sono", "sono"],
  ]),

  secao("Saúde"),
  tabela2col([
    ["Alergias", "alergias"],
    ["Medicamentos contínuos", "medicamentos_continuos"],
    ["Restrições alimentares", "restricoes_alimentares"],
    ["Problemas neurológicos? Qual?", "problemas_neurologicos"],
    ["Acompanhamentos (médico/psi/fono)", "acompanhamento_medico"],
    ["Necessidade especial / aluno atípico", "necessidade_especial"],
    ["Acompanhamento psicológico", "acomp_psicologico"],
    ["Acompanhamento fonoaudiológico", "acomp_fonoaudiologico"],
    ["Acompanhamento psicopedagógico", "acomp_psicopedagogico"],
  ]),

  secao("Reação e internet"),
  tabela2col([
    ["Como reage quando contrariada / atitude dos pais", "reacao_contrariada"],
    ["Apresenta intolerância à frustração?", "intolerancia_frustracao"],
    ["Faz uso da internet e redes sociais?", "uso_internet"],
    ["Os pais orientam quanto ao uso da internet?", "orientacao_internet"],
  ]),

  secao("Resumo e rotina"),
  tabela2col([
    ["Histórico de desenvolvimento", "historico_desenvolvimento"],
    ["Comportamento social", "comportamento_social"],
    ["Rotina familiar", "rotina_familiar"],
  ]),

  secao("Observações"),
  tabela2col([
    ["Outras informações importantes", "outras_informacoes"],
    ["Obs. dos responsáveis", "observacoes_responsaveis"],
    ["Obs. da coordenação", "observacoes_coordenacao"],
  ]),

  // Assinatura
  p(run(""), { spacingBefore: 280 }),
  p(run("____________________________________________", {}), { align: "center", spacingAfter: 0 }),
  p(run("Assinatura do responsável", { size: 18, color: "777777" }), { align: "center" }),
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
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

// Fonte padrão Calibri 11pt, sem espaçamento extra entre parágrafos.
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;

const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", rels);
zip.file("word/_rels/document.xml.rels", docRels);
zip.file("word/document.xml", documentXml);
zip.file("word/styles.xml", styles);

const out = zip.generate({ type: "nodebuffer" });
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`Template gravado: ${OUT} (${out.length} bytes)`);
