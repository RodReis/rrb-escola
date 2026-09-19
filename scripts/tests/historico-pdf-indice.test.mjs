import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveIndice, normalizarSerie, construirIndice } from "../lib/historico-pdf-indice.mjs";

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
