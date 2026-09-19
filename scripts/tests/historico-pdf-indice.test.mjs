import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveIndice, normalizarSerie, construirIndice, construirIndiceComConflitos, extrairParesDePdfParsed, deduplicarPares } from "../lib/historico-pdf-indice.mjs";

test("normalizarSerie tira acento e padroniza espacos", () => {
  assert.equal(normalizarSerie("1ª Série"), "1A SERIE");
  assert.equal(normalizarSerie("  3º   ANO "), "3O ANO");
  assert.equal(normalizarSerie(null), "");
});

test("chaveIndice junta matricula e ano", () => {
  assert.equal(chaveIndice("1204", 2026), "1204|2026");
  assert.equal(chaveIndice(1204, 2026), "1204|2026");
});

test("construirIndice mapeia par para serie normalizada", () => {
  const idx = construirIndice([
    { mat: "1259", ano: 2025, serie: "1º ANO" },
    { mat: "1259", ano: 2026, serie: "2º ANO" }
  ]);
  assert.equal(idx.get("1259|2025"), "1O ANO");
  assert.equal(idx.get("1259|2026"), "2O ANO");
  assert.equal(idx.size, 2);
});

test("construirIndice ignora par sem ano ou sem serie", () => {
  const idx = construirIndice([
    { mat: "1", ano: null, serie: "1º ANO" },
    { mat: "2", ano: 2025, serie: null },
    { mat: "3", ano: 2025, serie: "1º ANO" }
  ]);
  assert.equal(idx.size, 1);
  assert.ok(idx.has("3|2025"));
});

test("construirIndiceComConflitos detecta series diferentes para mesma chave", () => {
  const { indice, conflitos } = construirIndiceComConflitos([
    { mat: "100", ano: 2025, serie: "1º ANO" },
    { mat: "100", ano: 2025, serie: "2º ANO" }
  ]);
  assert.equal(indice.size, 1);
  assert.equal(conflitos.length, 1);
  assert.equal(conflitos[0].chave, "100|2025");
  assert.deepEqual(conflitos[0].series.sort(), ["1O ANO", "2O ANO"]);
});

test("construirIndiceComConflitos nao reporta pares identicos", () => {
  const { indice, conflitos } = construirIndiceComConflitos([
    { mat: "101", ano: 2025, serie: "1º ANO" },
    { mat: "101", ano: 2025, serie: "1º ANO" }
  ]);
  assert.equal(indice.size, 1);
  assert.equal(conflitos.length, 0);
});

test("construirIndiceComConflitos reporta multiplos conflitos", () => {
  const { indice, conflitos } = construirIndiceComConflitos([
    { mat: "200", ano: 2025, serie: "1º ANO" },
    { mat: "200", ano: 2025, serie: "2º ANO" },
    { mat: "201", ano: 2025, serie: "3º ANO" },
    { mat: "201", ano: 2025, serie: "1º ANO" }
  ]);
  assert.equal(indice.size, 2);
  assert.equal(conflitos.length, 2);
});

test("extrairParesDePdfParsed transforma registros em pares", () => {
  const registros = [
    {
      aluno: { matricula: "1000" },
      anos: [
        { ano: 2025, serie: "1º ANO" },
        { ano: 2026, serie: "2º ANO" }
      ]
    },
    {
      aluno: { matricula: "1001" },
      anos: [
        { ano: 2025, coluna: "5º ANO" }
      ]
    }
  ];
  const pares = extrairParesDePdfParsed(registros);
  assert.equal(pares.length, 3);
  assert.deepEqual(pares[0], { mat: "1000", ano: 2025, serie: "1º ANO" });
  assert.deepEqual(pares[1], { mat: "1000", ano: 2026, serie: "2º ANO" });
  assert.deepEqual(pares[2], { mat: "1001", ano: 2025, serie: "5º ANO" });
});

test("extrairParesDePdfParsed ignora registros sem matricula", () => {
  const registros = [
    { aluno: {}, anos: [{ ano: 2025, serie: "1º ANO" }] },
    { aluno: { matricula: "2000" }, anos: [{ ano: 2025, serie: "1º ANO" }] }
  ];
  const pares = extrairParesDePdfParsed(registros);
  assert.equal(pares.length, 1);
  assert.equal(pares[0].mat, "2000");
});

test("extrairParesDePdfParsed prefere serie sobre coluna", () => {
  const registros = [
    {
      aluno: { matricula: "3000" },
      anos: [{ ano: 2025, serie: "1º ANO", coluna: "6º ANO" }]
    }
  ];
  const pares = extrairParesDePdfParsed(registros);
  assert.equal(pares[0].serie, "1º ANO");
});

test("deduplicarPares elimina duplicatas exatas", () => {
  const pares = [
    { mat: "5000", ano: 2025, serie: "1º ANO" },
    { mat: "5000", ano: 2025, serie: "1º ANO" },
    { mat: "5000", ano: 2025, serie: "1º ANO" }
  ];
  const dedupados = deduplicarPares(pares);
  assert.equal(dedupados.length, 1);
  assert.deepEqual(dedupados[0], { mat: "5000", ano: 2025, serie: "1º ANO" });
});

test("deduplicarPares NAO deduplica series diferentes (mesmo mat|ano)", () => {
  const pares = [
    { mat: "5001", ano: 2025, serie: "1º ANO" },
    { mat: "5001", ano: 2025, serie: "2º ANO" }
  ];
  const dedupados = deduplicarPares(pares);
  assert.equal(dedupados.length, 2);
  assert.deepEqual(dedupados[0].serie, "1º ANO");
  assert.deepEqual(dedupados[1].serie, "2º ANO");
});

test("deduplicarPares NAO deduplica anos diferentes", () => {
  const pares = [
    { mat: "5002", ano: 2025, serie: "1º ANO" },
    { mat: "5002", ano: 2026, serie: "1º ANO" }
  ];
  const dedupados = deduplicarPares(pares);
  assert.equal(dedupados.length, 2);
  assert.equal(dedupados[0].ano, 2025);
  assert.equal(dedupados[1].ano, 2026);
});

test("deduplicarPares normaliza serie antes de deduplica", () => {
  const pares = [
    { mat: "5003", ano: 2025, serie: "1ª SÉRIE" },
    { mat: "5003", ano: 2025, serie: "1a serie" },
    { mat: "5003", ano: 2025, serie: "1º ANO" }
  ];
  const dedupados = deduplicarPares(pares);
  // Primeira ocorrência é mantida (1ª SÉRIE)
  assert.equal(dedupados.length, 2);
  assert.equal(dedupados[0].serie, "1ª SÉRIE");
  assert.equal(dedupados[1].serie, "1º ANO");
});
