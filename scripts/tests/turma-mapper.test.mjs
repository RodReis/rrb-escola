import { test } from "node:test";
import assert from "node:assert/strict";
import { mapTurmaHeader } from "../lib/turma-mapper.mjs";

test("maternal matutino", () => {
  assert.deepEqual(mapTurmaHeader("MATERNAL - MATUTINO"), {
    serie_nome: "Maternal",
    turma_nome: "A",
    turno: "matutino"
  });
});

test("maternal vespertino", () => {
  assert.deepEqual(mapTurmaHeader("MATERNAL - VESPERTINO"), {
    serie_nome: "Maternal",
    turma_nome: "B",
    turno: "vespertino"
  });
});

test("infantil com turno explicito", () => {
  assert.deepEqual(mapTurmaHeader("INFANTIL 4 - MATUTINO"), {
    serie_nome: "Infantil 4",
    turma_nome: "A",
    turno: "matutino"
  });
  assert.deepEqual(mapTurmaHeader("INFANTIL 3 - VESPERTINO"), {
    serie_nome: "Infantil 3",
    turma_nome: "B",
    turno: "vespertino"
  });
  assert.deepEqual(mapTurmaHeader("INFANTIL 5 - MATUTINO"), {
    serie_nome: "Infantil 5",
    turma_nome: "A",
    turno: "matutino"
  });
});

test("ano fundamental letra A = matutino", () => {
  assert.deepEqual(mapTurmaHeader("1º ANO - A"), {
    serie_nome: "1º Ano",
    turma_nome: "A",
    turno: "matutino"
  });
  assert.deepEqual(mapTurmaHeader("9º ANO - A"), {
    serie_nome: "9º Ano",
    turma_nome: "A",
    turno: "matutino"
  });
});

test("ano fundamental letra B = vespertino", () => {
  assert.deepEqual(mapTurmaHeader("3º ANO - B"), {
    serie_nome: "3º Ano",
    turma_nome: "B",
    turno: "vespertino"
  });
});

test("ensino medio", () => {
  assert.deepEqual(mapTurmaHeader("1ª SÉRIE - EM - A"), {
    serie_nome: "1ª Série EM",
    turma_nome: "A",
    turno: "matutino"
  });
  assert.deepEqual(mapTurmaHeader("3ª SÉRIE - EM - A"), {
    serie_nome: "3ª Série EM",
    turma_nome: "A",
    turno: "matutino"
  });
});

test("aceita variantes de digitacao", () => {
  assert.deepEqual(mapTurmaHeader("  3o ANO  -  A  "), {
    serie_nome: "3º Ano",
    turma_nome: "A",
    turno: "matutino"
  });
  assert.deepEqual(mapTurmaHeader("INFANTIL  4  -  MATUTINO"), {
    serie_nome: "Infantil 4",
    turma_nome: "A",
    turno: "matutino"
  });
});

test("retorna null para string nao reconhecida", () => {
  assert.equal(mapTurmaHeader("ALUNO"), null);
  assert.equal(mapTurmaHeader(""), null);
  assert.equal(mapTurmaHeader("MATRICULA"), null);
});
