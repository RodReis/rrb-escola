import { test } from "node:test";
import assert from "node:assert/strict";
import { parsearPagina, separarEstabelecimentoCidade } from "../lib/historico-pdf.mjs";

/** Pagina Fund2: "Média x5" e depois "Média C.H." x4 (6º ao 9º ANO). */
const PAGINA_FUND2 = `EPG TRINDADE
ANA REGINA RIBEIRO OLIVEIRA
Aluno(a):
714.910.811-39
CPF:
1575
Matrícula:
FABIANO e KELLY
Filiação:
27/12/2013
Data de Nascimento:
GOIÂNIA / GO
Naturalidade:
Disciplinas Média Média Média Média Média Méd
ia C.H
. Méd
ia C.H
. Méd
ia C.H
. Méd
ia C.H
. Média Média Média
C.H
.
Tot
al
CIÊNCIAS 75 100 94 83 86 - - - - - - - - - - - -
MATEMÁTICA 78 100 94 80 79 7,2 160 - 160 - - - - - - - 320
Resultado Final Aprovado Aprovado Aprovado Aprovado Aprovado Aprovado Cursando - - - - - -
Carga Horária Anual 800 800 800 800 800 1200 1200 - - - - - 6400
Dias Letivos - - - - - 205 203 - - - - - -
Série Ano Estabelecimento Cidade UF
1º ANO 2020 COLÉGIO EL SHADAY PALMEIRAS DE GOIÁS GO
6º ANO 2025 EPG TRINDADE TRINDADE GO
7º ANO - - - -
`;

test("separa estabelecimento de cidade multi-palavra", () => {
  assert.deepEqual(
    separarEstabelecimentoCidade("ESCOLA MARIA DE LOURDES ABADIA DE GOIÁS"),
    { instituicao: "ESCOLA MARIA DE LOURDES", cidade: "ABADIA DE GOIÁS" }
  );
  // cidade mais longa vence a curta que e prefixo dela
  assert.equal(
    separarEstabelecimentoCidade("ESCOLA X SANTA BÁRBARA DE GOIÁS").cidade,
    "SANTA BÁRBARA DE GOIÁS"
  );
});

test("cidade desconhecida nao e chutada", () => {
  const r = separarEstabelecimentoCidade("COLEGIO Y CIDADE INVENTADA");
  assert.equal(r.cidade, null);
});

test("le identificacao do aluno (rotulo vem depois do valor)", () => {
  const { aluno } = parsearPagina(PAGINA_FUND2);
  assert.equal(aluno.nome, "ANA REGINA RIBEIRO OLIVEIRA");
  assert.equal(aluno.cpf, "71491081139");
  assert.equal(aluno.matricula, "1575");
});

test("so importa anos presentes no rodape", () => {
  const { anos } = parsearPagina(PAGINA_FUND2);
  assert.deepEqual(anos.map((a) => a.ano), [2020, 2025]);
});

test("mantem a escala original de cada escola", () => {
  const { anos } = parsearPagina(PAGINA_FUND2);
  const externo = anos.find((a) => a.ano === 2020);
  const interno = anos.find((a) => a.ano === 2025);

  // escola anterior usa 0-100, EPG usa 0-10: nao convertemos
  assert.equal(externo.notas.find((n) => n.disciplinaNome === "MATEMÁTICA").nota, 78);
  assert.equal(interno.notas.find((n) => n.disciplinaNome === "MATEMÁTICA").nota, 7.2);
});

test("associa C.H. por disciplina so onde o cabecalho a declara", () => {
  const { anos } = parsearPagina(PAGINA_FUND2);
  const externo = anos.find((a) => a.ano === 2020); // coluna sem C.H.
  const interno = anos.find((a) => a.ano === 2025); // coluna com C.H.
  assert.equal(externo.notas.find((n) => n.disciplinaNome === "MATEMÁTICA").cargaHoraria, null);
  assert.equal(interno.notas.find((n) => n.disciplinaNome === "MATEMÁTICA").cargaHoraria, 160);
});

test("le resultado, carga horaria e dias letivos por ano", () => {
  const { anos } = parsearPagina(PAGINA_FUND2);
  const interno = anos.find((a) => a.ano === 2025);
  assert.equal(interno.resultado, "aprovado");
  assert.equal(interno.cargaHoraria, 1200);
  assert.equal(interno.diasLetivos, 205);
});

test("disciplina sem nota no ano fica de fora", () => {
  const { anos } = parsearPagina(PAGINA_FUND2);
  // CIENCIAS so tem nota ate o 5o ANO; nao entra em 2025
  const interno = anos.find((a) => a.ano === 2025);
  assert.equal(interno.notas.some((n) => n.disciplinaNome === "CIÊNCIAS"), false);
});

/** No Medio o cabecalho tem "Média x6" antes das colunas com C.H. */
test("layout do Medio nao desalinha nota com carga horaria", () => {
  const paginaMedio = `EPG
FULANO DE TAL
Aluno(a):
111.222.333-44
CPF:
9
Matrícula:
Disciplinas Média Média Média Média Média Média Méd
ia C.H
. Méd
ia C.H
. Méd
ia C.H
. Média Média Média
C.H
.
Tot
al
MATEMÁTICA 9,8 9,2 9,6 9,3 9,1 9,0 9,1 240 8,5 240 - - - - - 480
Resultado Final Aprovado - - - - - Aprovado - - - - -
Série Ano Estabelecimento Cidade UF
7º ANO 2022 EPG TRINDADE TRINDADE GO
`;
  const { anos } = parsearPagina(paginaMedio);
  const nota = anos[0].notas.find((n) => n.disciplinaNome === "MATEMÁTICA");
  assert.equal(nota.nota, 9.1, "nota nao pode receber o valor da carga horaria");
  assert.equal(nota.cargaHoraria, 240);
});

test("*** conta como celula vazia, nao como parte do nome", () => {
  const pagina = `EPG
CICRANO
Aluno(a):
111.222.333-44
CPF:
Disciplinas Méd
ia C.H
. Média Média
C.H
.
Tot
al
CIÊNCIAS *** - 98,2 9,5 360
Resultado Final Aprovado - -
Série Ano Estabelecimento Cidade UF
3º ANO 2018 COLÉGIO DINÂMICO TRINDADE GO
`;
  const { anos } = parsearPagina(pagina);
  const nomes = anos[0].notas.map((n) => n.disciplinaNome);
  assert.ok(nomes.includes("CIÊNCIAS"), `nome saiu como ${JSON.stringify(nomes)}`);
});

test("traduz CICLO II do PDF para a serie do sistema", () => {
  const pagina = `EPG
BELTRANO
Aluno(a):
111.222.333-44
CPF:
Disciplinas Média Média
C.H
.
Tot
al
MATEMÁTICA 8,5 -
Resultado Final Aprovado -
Série Ano Estabelecimento Cidade UF
CICLO II - D 2024 EPG TRINDADE TRINDADE GO
`;
  const { anos } = parsearPagina(pagina);
  assert.equal(anos[0].serieNome, "1ª SÉRIE");
  assert.equal(anos[0].coluna, "CICLO II - D", "a coluna do PDF continua sendo a chave de leitura");
});
