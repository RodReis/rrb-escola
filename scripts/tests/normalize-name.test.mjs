import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName } from "../lib/normalize-name.mjs";

test("uppercases and trims", () => {
  assert.equal(normalizeName("  alice cabriny  "), "ALICE CABRINY");
});

test("strips accents", () => {
  assert.equal(normalizeName("João Pedro"), "JOAO PEDRO");
  assert.equal(normalizeName("Ana Lúcia"), "ANA LUCIA");
  assert.equal(normalizeName("MANUELA MARGARÍDA"), "MANUELA MARGARIDA");
});

test("collapses multiple spaces", () => {
  assert.equal(normalizeName("ana    paula  da   silva"), "ANA PAULA DA SILVA");
});

test("returns empty string for null/undefined", () => {
  assert.equal(normalizeName(null), "");
  assert.equal(normalizeName(undefined), "");
});
