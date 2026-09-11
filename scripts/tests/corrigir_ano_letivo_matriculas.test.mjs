import test from "node:test";
import assert from "node:assert/strict";
import { reconstruirAnos } from "../corrigir_ano_letivo_matriculas.mjs";

// Espelha a ordem real das series no banco.
const ORDEM = new Map([
  ["maternal", 1],
  ["inf2", 2],
  ["inf3", 2],
  ["ano1", 5],
  ["ano2", 6],
  ["ano3", 7],
  ["ano4", 8],
]);

const mat = (id, serie_id, ano_letivo, status = "concluida", data_matricula = null) => ({
  id,
  serie_id,
  ano_letivo,
  status,
  data_matricula,
});

const anoDe = (res, id) => res.find((r) => r.matricula.id === id).anoCorrigido;

test("caso Amanda: 3o ANO duplicado em 2025 e 2026 vira uma etapa so", () => {
  const res = reconstruirAnos(
    [
      mat("a", "maternal", 2021),
      mat("b", "inf3", 2022),
      mat("c", "ano1", 2023),
      mat("d", "ano2", 2024),
      mat("e", "ano3", 2025),
      mat("f", "ano3", 2026, "ativa"),
    ],
    ORDEM,
  );

  // As duas linhas de 3o ANO passam a ser o mesmo ano letivo: 2026.
  assert.equal(anoDe(res, "e"), 2026);
  assert.equal(anoDe(res, "f"), 2026);
  assert.equal(res.find((r) => r.matricula.id === "e").motivo, "duplicata mesclada");

  // O historico recua um ano cada, sem buracos.
  assert.equal(anoDe(res, "d"), 2025);
  assert.equal(anoDe(res, "c"), 2024);
  assert.equal(anoDe(res, "b"), 2023);
  assert.equal(anoDe(res, "a"), 2022);
});

test("cada serie ocupa um ano letivo distinto", () => {
  const res = reconstruirAnos(
    [
      mat("a", "ano1", 2023),
      mat("b", "ano2", 2024),
      mat("c", "ano3", 2025),
      mat("d", "ano4", 2026, "ativa"),
    ],
    ORDEM,
  );
  const anos = res.map((r) => r.anoCorrigido);
  assert.equal(new Set(anos).size, anos.length);
  assert.deepEqual(anos.slice().sort(), [2023, 2024, 2025, 2026]);
});

test("aluno sem matricula ativa de 2026 ancora na serie de maior ano", () => {
  const res = reconstruirAnos(
    [mat("a", "ano1", 2022), mat("b", "ano2", 2023), mat("c", "ano3", 2024)],
    ORDEM,
  );
  assert.equal(anoDe(res, "c"), 2024);
  assert.equal(anoDe(res, "b"), 2023);
  assert.equal(anoDe(res, "a"), 2022);
});

test("series de mesma ordem (INFANTIL2 e INFANTIL3) contam como uma etapa", () => {
  const res = reconstruirAnos(
    [
      mat("a", "inf2", 2021),
      mat("b", "inf3", 2021),
      mat("c", "ano1", 2022),
      mat("d", "ano2", 2023, "ativa"),
    ],
    ORDEM,
  );
  // Ambas ficam no mesmo ano, sem empurrar a sequencia.
  assert.equal(anoDe(res, "a"), anoDe(res, "b"));
  assert.equal(anoDe(res, "c"), anoDe(res, "a") + 1);
});

test("matricula sem serie conhecida e ignorada em vez de quebrar", () => {
  const res = reconstruirAnos(
    [mat("a", "serie-fantasma", 2024), mat("b", "ano3", 2026, "ativa")],
    ORDEM,
  );
  assert.equal(res.length, 1);
  assert.equal(res[0].matricula.id, "b");
});
