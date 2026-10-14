import assert from "node:assert/strict";
import { test } from "node:test";
import LZString from "lz-string";
import {
  activityUrl,
  embedCode,
  embedUrl,
  readActivityLocation,
  MAX_SHARED_SOURCE,
} from "./sharing.ts";
import { buildPuzzle } from "./engine.ts";

const base = "https://cruzadinha-escaninho.vercel.app/";
const source = "# Ação e razão\nCASA | Lugar de morar | 1,1,H\nAMOR | Afeto | 1,2,V";

test("o acesso público é aluno; a incorporação sempre desativa o modo professor", () => {
  assert.equal(readActivityLocation(base).teacher, false);
  assert.equal(readActivityLocation(base + "?modo=professor").teacher, true);
  assert.equal(readActivityLocation(base + "?modo=professor&incorporar=1").teacher, false);
});

test("o link de tema abre a atividade certa, removendo opções do professor", () => {
  const href = activityUrl(
    base + "?modo=professor&install=1#antigo",
    { puzzleId: "grecia", source: "" },
    false,
  );
  const location = readActivityLocation(href);
  assert.equal(location.puzzleId, "grecia");
  assert.equal(location.teacher, false);
  assert.equal(location.canCheck, false);
  assert.equal(new URL(href).searchParams.has("install"), false);
});

test("a atividade personalizada viaja no link, sem respostas preenchidas", () => {
  const href = activityUrl(base, { puzzleId: "custom", source });
  const location = readActivityLocation(href);
  assert.equal(location.source, source);
  assert.equal(location.teacher, false);
  assert.deepEqual(buildPuzzle(location.source!), buildPuzzle(source));
  assert.equal(href.includes("progress"), false);
});

test("links corrompidos, incompatíveis ou extensos retornam erro legível", () => {
  for (const token of [
    "",
    "quebrado",
    LZString.compressToEncodedURIComponent('{"v":2,"source":"x"}'),
    "A".repeat(10001),
  ]) {
    assert.ok(readActivityLocation(base + "#atividade=" + token).error);
  }
  assert.throws(() =>
    activityUrl(base, { puzzleId: "custom", source: "x".repeat(MAX_SHARED_SOURCE + 1) }),
  );
  assert.ok(readActivityLocation(base + "?tema=nao-existe").error);
});

test("incorporação preserva o conteúdo e escapa o título HTML", () => {
  const href = activityUrl(base, { puzzleId: "custom", source });
  const embedded = readActivityLocation(embedUrl(href));
  assert.equal(embedded.source, source);
  assert.equal(embedded.embedded, true);
  assert.equal(embedded.teacher, false);
  const code = embedCode(href, '\"><script>alert(1)</script>');
  assert.ok(code.includes("&quot;&gt;&lt;script&gt;"));
  assert.ok(code.includes("data-cruzadinha-embed"));
  assert.ok(code.includes("/embed.js"));
  assert.throws(() => embedCode("javascript:alert(1)", "Teste"));
});
