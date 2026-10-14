import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSave, writeSave } from "./storage.ts";

test("recupera o formato antigo e descarta células inválidas", () => {
  const saved = parseSave(JSON.stringify({ progress: { board: { "0,0": "A", "0,1": 5, "1,1": "ABC", bad: "B" }, broken: null } }));
  assert.deepEqual(saved.progress, { board: { "0,0": "A" } });
  assert.deepEqual(saved.helped, {});
});

test("preserva o histórico de ajuda", () => {
  const save = parseSave('{"helped":{"board":true,"other":"true"}}');
  assert.deepEqual(save.helped, { board: true });
});

test("rejeita arquivos corrompidos e estruturas inválidas", () => {
  for (const raw of ["broken", "null", "[]", "42"]) assert.throws(() => parseSave(raw));
});

test("falha no armazenamento não interrompe a tentativa", () => {
  const save = parseSave("{}");
  assert.equal(writeSave({ setItem() { throw new Error("quota"); } }, save), false);
  let raw = "";
  assert.equal(writeSave({ setItem(_key, value) { raw = value; } }, save), true);
  assert.deepEqual(parseSave(raw), save);
});
