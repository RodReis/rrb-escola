import test from "node:test";
import assert from "node:assert/strict";
import { escolherSobrevivente } from "../remover_matriculas_duplicadas.mjs";

const mat = (id, status, data_matricula) => ({ id, status, data_matricula });

test("caso Amanda: mantem a ativa, nao a concluida", () => {
  const grupo = [
    mat("antiga", "concluida", "2025-11-26"),
    mat("planilha", "ativa", "2026-01-01"),
  ];
  assert.equal(escolherSobrevivente(grupo).id, "planilha");
});

test("a ativa vence mesmo tendo data mais antiga", () => {
  const grupo = [
    mat("concluida", "concluida", "2026-12-01"),
    mat("ativa", "ativa", "2026-01-01"),
  ];
  assert.equal(escolherSobrevivente(grupo).id, "ativa");
});

test("sem nenhuma ativa, mantem a de data mais recente", () => {
  const grupo = [
    mat("velha", "concluida", "2024-07-25"),
    mat("nova", "concluida", "2024-11-18"),
  ];
  assert.equal(escolherSobrevivente(grupo).id, "nova");
});

test("grupo de tres com uma ativa mantem a ativa", () => {
  const grupo = [
    mat("a", "concluida", "2025-08-04"),
    mat("b", "ativa", "2026-01-01"),
    mat("c", "concluida", "2025-10-28"),
  ];
  assert.equal(escolherSobrevivente(grupo).id, "b");
});

test("data ausente nao quebra a escolha", () => {
  const grupo = [mat("sem_data", "concluida", null), mat("com_data", "concluida", "2023-11-10")];
  assert.equal(escolherSobrevivente(grupo).id, "com_data");
});

test("sempre devolve uma linha do proprio grupo", () => {
  const grupo = [mat("x", "concluida", "2022-01-01"), mat("y", "concluida", "2022-01-01")];
  assert.ok(grupo.includes(escolherSobrevivente(grupo)));
});
