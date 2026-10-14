import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUZZLES } from "../../data/puzzles.ts";
import { buildPuzzle, normalizeAnswer, parseSource, puzzleMatrix, type PuzzleModel } from "./engine.ts";

function runsOf(model: PuzzleModel) {
  const matrix = puzzleMatrix(model);
  const horizontal: string[] = [];
  const vertical: string[] = [];
  for (let row = 0; row < model.rows; row++) {
    let buffer = "";
    for (let col = 0; col <= model.cols; col++) {
      const letter = matrix[row]?.[col]?.letter;
      if (letter) buffer += letter;
      else {
        if (buffer) horizontal.push(buffer);
        buffer = "";
      }
    }
  }
  for (let col = 0; col < model.cols; col++) {
    let buffer = "";
    for (let row = 0; row <= model.rows; row++) {
      const letter = matrix[row]?.[col]?.letter;
      if (letter) buffer += letter;
      else {
        if (buffer) vertical.push(buffer);
        buffer = "";
      }
    }
  }
  return { horizontal, vertical };
}

function assertLegal(model: PuzzleModel) {
  const across = model.words.filter((word) => word.direction === "across").map((word) => word.answer);
  const down = model.words.filter((word) => word.direction === "down").map((word) => word.answer);
  const { horizontal, vertical } = runsOf(model);
  for (const run of horizontal) {
    if (run.length === 1) continue;
    assert.ok(across.includes(run), `trecho horizontal solto: ${run}`);
  }
  for (const run of vertical) {
    if (run.length === 1) continue;
    assert.ok(down.includes(run), `trecho vertical solto: ${run}`);
  }
  for (const word of across) assert.ok(horizontal.includes(word), word);
  for (const word of down) assert.ok(vertical.includes(word), word);
}

describe("normalizeAnswer", () => {
  it("remove acento, cedilha e caixa", () => {
    assert.equal(normalizeAnswer("Razão"), "RAZAO");
    assert.equal(normalizeAnswer("canção"), "CANCAO");
    assert.equal(normalizeAnswer("Ação"), "ACAO");
  });
});

describe("parseSource", () => {
  it("aceita 40 e rejeita 41 nas coordenadas manuais", () => {
    assert.equal(parseSource("CASA | lar | 40,40,H").entries.length, 1);
    for (const slot of ["41,1,H", "1,41,V", "0,1,H"]) {
      assert.equal(parseSource(`CASA | lar | ${slot}`).entries.length, 0);
    }
  });

  it("uma posição inválida não impede a correção da palavra em outra linha", () => {
    const parsed = parseSource("CASA | lar | inválido\nCASA | moradia");
    assert.equal(parsed.entries.length, 1);
    assert.equal(parsed.entries[0]?.clue, "moradia");
  });
  it("aceita pipe, travessão e recusa palavra solta", () => {
    const parsed = parseSource("CASA - lugar de morar\nSOL | estrela");
    assert.equal(parsed.entries.length, 2);
    assert.equal(parsed.issues.length, 0);
    const bad = parseSource("sem separador");
    assert.equal(bad.entries.length, 0);
    assert.equal(bad.issues.length, 1);
  });
});

describe("buildPuzzle", () => {
  it("respeita posição manual e aponta conflito", () => {
    const ok = buildPuzzle("# Casa\nCASA | lar | 1,1,H\nAMOR | afeto | 1,2,V\n");
    assert.equal(ok.omitted.length, 0);
    assert.equal(ok.words.length, 2);
    assertLegal(ok);
    const bad = buildPuzzle("CASA | lar | 1,1,H\nSOL | estrela | 1,1,V\n");
    assert.ok(bad.issues.some((issue) => issue.answer === "SOL"));
    assert.equal(bad.issues.find((issue) => issue.answer === "SOL")?.line, 2);
  });

  it("é determinística", () => {
    const source = PUZZLES[0]!.source;
    assert.deepEqual(buildPuzzle(source), buildPuzzle(source));
  });

  for (const puzzle of PUZZLES) {
    it(`encaixa todas as palavras de ${puzzle.id}`, () => {
      const started = Date.now();
      const model = buildPuzzle(puzzle.source);
      const elapsed = Date.now() - started;
      assert.equal(model.omitted.map((item) => item.answer).join(","), "", puzzle.id);
      assert.equal(model.issues.length, 0, puzzle.id);
      assert.ok(model.words.length >= 8);
      assertLegal(model);
      assert.ok(model.cols <= 16 && model.rows <= 16, `${puzzle.id} ${model.cols}x${model.rows}`);
      assert.ok(elapsed < 1500, `${puzzle.id} levou ${elapsed}ms`);
    });
  }
});
