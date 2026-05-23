import { test } from "node:test";
import assert from "node:assert/strict";
import { mapHeaderToTarget } from "./reset-matriculas-mapper.mjs";

test("MATERNAL - MATUTINO", () => {
  assert.deepEqual(mapHeaderToTarget("MATERNAL - MATUTINO"), {
    serie_nome: "MATERNAL",
    turma_nome: "MATUTINO",
    turno: "matutino"
  });
});

test("INFANTIL 5 - VESPERTINO", () => {
  assert.deepEqual(mapHeaderToTarget("INFANTIL 5 - VESPERTINO"), {
    serie_nome: "INFANTIL5",
    turma_nome: "VESPERTINO",
    turno: "vespertino"
  });
});

test("1º ANO - A (FUND1 letra A vira MATUTINO)", () => {
  assert.deepEqual(mapHeaderToTarget("1º ANO - A"), {
    serie_nome: "1º ANO",
    turma_nome: "MATUTINO",
    turno: "matutino"
  });
});

test("5º ANO - B (FUND1 letra B vira VESPERTINO)", () => {
  assert.deepEqual(mapHeaderToTarget("5º ANO - B"), {
    serie_nome: "5º ANO",
    turma_nome: "VESPERTINO",
    turno: "vespertino"
  });
});

test("6º ANO - A (FUND2 só matutino)", () => {
  assert.deepEqual(mapHeaderToTarget("6º ANO - A"), {
    serie_nome: "6º ANO",
    turma_nome: "MATUTINO",
    turno: "matutino"
  });
});

test("1ª SÉRIE - EM - A (MÉDIO)", () => {
  assert.deepEqual(mapHeaderToTarget("1ª SÉRIE - EM - A"), {
    serie_nome: "1ª SÉRIE",
    turma_nome: "MATUTINO",
    turno: "matutino"
  });
});

test("header inválido retorna null", () => {
  assert.equal(mapHeaderToTarget("BLA"), null);
});
