/**
 * Cruzadinha: o conteúdo é texto; a grade é calculada.
 *
 * Formato de cada linha (acentos são ignorados na grade):
 *   PALAVRA | Dica
 *   PALAVRA | Dica | linha,coluna,H   (opcional, trava a posição; 1 = primeira)
 *   PALAVRA - Dica
 *
 * Linhas com # definem título e observação. // é comentário.
 */

export type Direction = "across" | "down";

export type ParsedEntry = {
  answer: string;
  clue: string;
  line?: number;
  row?: number;
  col?: number;
  direction?: Direction;
};

export type ParseIssue = {
  line: number;
  answer: string;
  message: string;
};

export type PlacedWord = {
  id: string;
  number: number;
  answer: string;
  clue: string;
  row: number;
  col: number;
  direction: Direction;
};

export type PuzzleModel = {
  title: string;
  note: string;
  rows: number;
  cols: number;
  words: PlacedWord[];
  issues: ParseIssue[];
  omitted: { answer: string; clue: string }[];
};

export type MatrixCell = {
  letter: string;
  number: number | null;
  acrossId: string | null;
  downId: string | null;
};

const MAX_WORDS = 20;
const MAX_SPAN = 22;
const MIN_LEN = 3;
const MAX_LEN = 22;

const DIR_WORD: Record<string, Direction> = {
  h: "across",
  horizontal: "across",
  across: "across",
  a: "across",
  v: "down",
  vertical: "down",
  down: "down",
  d: "down",
};

export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .replace(/['’]/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

export function parseSource(source: string): {
  title: string;
  note: string;
  entries: ParsedEntry[];
  issues: ParseIssue[];
} {
  const entries: ParsedEntry[] = [];
  const issues: ParseIssue[] = [];
  let title = "";
  const notes: string[] = [];
  const seen = new Set<string>();

  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i]?.trim() ?? "";
    if (!line || line.startsWith("//")) continue;
    if (line.startsWith("#")) {
      const text = line.replace(/^#+\s*/, "").trim();
      if (!title) title = text || "Cruzadinha";
      else if (text) notes.push(text);
      continue;
    }

    let answerRaw = "";
    let clue = "";
    let slot = "";

    if (line.includes("|") || line.includes("\t")) {
      const parts = line.split(/\||\t/).map((part) => part.trim());
      answerRaw = parts[0] ?? "";
      clue = parts[1] ?? "";
      slot = parts[2] ?? "";
      if (parts.length > 3) {
        issues.push({
          line: lineNo,
          answer: answerRaw,
          message: "Linha com campos demais. Use PALAVRA | dica ou PALAVRA | dica | linha,coluna,H.",
        });
        continue;
      }
    } else {
      const match = /^(\S+)\s+[-–—]\s+(.+)$/.exec(line);
      if (!match) {
        issues.push({
          line: lineNo,
          answer: line.slice(0, 32),
          message: "Formato inválido. Use PALAVRA | dica.",
        });
        continue;
      }
      answerRaw = match[1] ?? "";
      clue = (match[2] ?? "").trim();
    }

    if (/[\s-]/.test(answerRaw.replace(/['’]/g, ""))) {
      issues.push({
        line: lineNo,
        answer: answerRaw,
        message: "Use uma palavra só, sem espaços nem hífen.",
      });
      continue;
    }

    const answer = normalizeAnswer(answerRaw);
    if (answer.length < MIN_LEN) {
      issues.push({
        line: lineNo,
        answer: answerRaw,
        message: `A resposta precisa ter pelo menos ${MIN_LEN} letras.`,
      });
      continue;
    }
    if (answer.length > MAX_LEN) {
      issues.push({
        line: lineNo,
        answer: answer,
        message: `Máximo de ${MAX_LEN} letras.`,
      });
      continue;
    }
    if (!clue) {
      issues.push({ line: lineNo, answer, message: "Falta a dica." });
      continue;
    }
    if (seen.has(answer)) {
      issues.push({ line: lineNo, answer, message: "Resposta repetida." });
      continue;
    }

    const entry: ParsedEntry = { answer, clue, line: lineNo };
    if (slot) {
      const slotMatch = /^(\d+)\s*,\s*(\d+)\s*,\s*([a-zA-Z]+)$/.exec(slot);
      const dir = slotMatch ? DIR_WORD[slotMatch[3]!.toLowerCase()] : undefined;
      if (!slotMatch || !dir) {
        issues.push({
          line: lineNo,
          answer,
          message: "Posição inválida. Exemplo: 1,3,H ou 4,1,V.",
        });
        continue;
      }
      const row = Number(slotMatch[1]) - 1;
      const col = Number(slotMatch[2]) - 1;
      if (row < 0 || col < 0 || row >= 40 || col >= 40) {
        issues.push({
          line: lineNo,
          answer,
          message: "Linha e coluna começam em 1 e vão até 40.",
        });
        continue;
      }
      entry.row = row;
      entry.col = col;
      entry.direction = dir;
    }

    if (entries.length >= MAX_WORDS) {
      issues.push({
        line: lineNo,
        answer,
        message: `Limite de ${MAX_WORDS} palavras por cruzadinha.`,
      });
      continue;
    }
    seen.add(answer);
    entries.push(entry);
  }

  return {
    title: title || "Cruzadinha",
    note: notes.join(" "),
    entries,
    issues,
  };
}

type GCell = { letter: string; h: boolean; v: boolean };

type Undo = { created: string[]; opened: string[]; axis: "h" | "v" };

type Snap = {
  answer: string;
  clue: string;
  r: number;
  c: number;
  dir: Direction;
};

type Candidate = {
  r: number;
  c: number;
  dir: Direction;
  cross: number;
  score: number;
};

class Board {
  cells = new Map<string, GCell>();
  byLetter = new Map<string, string[]>();

  has(r: number, c: number): boolean {
    return this.cells.has(`${r},${c}`);
  }

  bounds(): { rows: number; cols: number; area: number; span: number } {
    if (this.cells.size === 0) return { rows: 0, cols: 0, area: 0, span: 0 };
    let minR = Infinity;
    let minC = Infinity;
    let maxR = -Infinity;
    let maxC = -Infinity;
    for (const key of this.cells.keys()) {
      const [r, c] = key.split(",").map(Number);
      minR = Math.min(minR, r!);
      minC = Math.min(minC, c!);
      maxR = Math.max(maxR, r!);
      maxC = Math.max(maxC, c!);
    }
    const rows = maxR - minR + 1;
    const cols = maxC - minC + 1;
    return { rows, cols, area: rows * cols, span: Math.max(rows, cols) };
  }
}

function placeWord(board: Board, word: string, r: number, c: number, dir: Direction): Undo {
  const dr = dir === "down" ? 1 : 0;
  const dc = dir === "across" ? 1 : 0;
  const axis: "h" | "v" = dir === "across" ? "h" : "v";
  const created: string[] = [];
  const opened: string[] = [];
  for (let i = 0; i < word.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const key = `${rr},${cc}`;
    const letter = word[i]!;
    const existing = board.cells.get(key);
    if (!existing) {
      board.cells.set(key, { letter, h: axis === "h", v: axis === "v" });
      const bucket = board.byLetter.get(letter) ?? [];
      bucket.push(key);
      board.byLetter.set(letter, bucket);
      created.push(key);
    } else {
      existing[axis] = true;
      opened.push(key);
    }
  }
  return { created, opened, axis };
}

function undoWord(board: Board, undo: Undo) {
  for (const key of undo.opened) {
    const cell = board.cells.get(key);
    if (cell) cell[undo.axis] = false;
  }
  for (const key of undo.created) {
    const cell = board.cells.get(key);
    if (!cell) continue;
    const bucket = board.byLetter.get(cell.letter);
    if (bucket) {
      const idx = bucket.lastIndexOf(key);
      if (idx >= 0) bucket.splice(idx, 1);
    }
    board.cells.delete(key);
  }
}

function projectedSpan(board: Board, word: string, r: number, c: number, dir: Direction): number {
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -Infinity;
  let maxC = -Infinity;
  const eat = (rr: number, cc: number) => {
    minR = Math.min(minR, rr);
    minC = Math.min(minC, cc);
    maxR = Math.max(maxR, rr);
    maxC = Math.max(maxC, cc);
  };
  for (const key of board.cells.keys()) {
    const [rr, cc] = key.split(",").map(Number);
    eat(rr!, cc!);
  }
  const dr = dir === "down" ? 1 : 0;
  const dc = dir === "across" ? 1 : 0;
  for (let i = 0; i < word.length; i++) eat(r + dr * i, c + dc * i);
  return Math.max(maxR - minR + 1, maxC - minC + 1);
}

function canPlace(
  board: Board,
  word: string,
  r: number,
  c: number,
  dir: Direction,
  requireCross: boolean,
  maxSpan: number,
  floorZero: boolean,
): number {
  const dr = dir === "down" ? 1 : 0;
  const dc = dir === "across" ? 1 : 0;
  if (floorZero && (r < 0 || c < 0)) return -1;
  if (board.has(r - dr, c - dc)) return -1;
  if (board.has(r + dr * word.length, c + dc * word.length)) return -1;
  let cross = 0;
  for (let i = 0; i < word.length; i++) {
    const rr = r + dr * i;
    const cc = c + dc * i;
    const cell = board.cells.get(`${rr},${cc}`);
    if (cell) {
      if (cell.letter !== word[i]) return -1;
      if (dir === "across" && cell.h) return -1;
      if (dir === "down" && cell.v) return -1;
      cross++;
    } else if (dir === "across") {
      if (board.has(rr - 1, cc) || board.has(rr + 1, cc)) return -1;
    } else if (board.has(rr, cc - 1) || board.has(rr, cc + 1)) return -1;
  }
  if (requireCross && cross < 1) return -1;
  if (board.cells.size > 0 && projectedSpan(board, word, r, c, dir) > maxSpan) return -1;
  return cross;
}

function scoreOf(board: Board, word: string, r: number, c: number, dir: Direction, cross: number): number {
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -Infinity;
  let maxC = -Infinity;
  const eat = (rr: number, cc: number) => {
    minR = Math.min(minR, rr);
    minC = Math.min(minC, cc);
    maxR = Math.max(maxR, rr);
    maxC = Math.max(maxC, cc);
  };
  for (const key of board.cells.keys()) {
    const [rr, cc] = key.split(",").map(Number);
    eat(rr!, cc!);
  }
  const dr = dir === "down" ? 1 : 0;
  const dc = dir === "across" ? 1 : 0;
  for (let i = 0; i < word.length; i++) eat(r + dr * i, c + dc * i);
  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
  const span = Math.max(rows, cols);
  let score = cross * 70 - rows * cols * 1.15 - span * 4;
  if (cols > 11) score -= (cols - 11) * 28;
  if (rows > 12) score -= (rows - 12) * 18;
  if (span > 13) score -= (span - 13) * 36;
  return score;
}

function candidates(board: Board, word: string, maxSpan: number, floorZero = false): Candidate[] {
  if (board.cells.size === 0) {
    return [
      { r: 0, c: 0, dir: "across", cross: 0, score: 1 },
      { r: 0, c: 0, dir: "down", cross: 0, score: 0 },
    ];
  }
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (let i = 0; i < word.length; i++) {
    const keys = board.byLetter.get(word[i]!) ?? [];
    for (const key of keys) {
      const cell = board.cells.get(key);
      if (!cell) continue;
      const [cr, cc] = key.split(",").map(Number);
      const dirs: Direction[] = [];
      if (cell.h && !cell.v) dirs.push("down");
      else if (cell.v && !cell.h) dirs.push("across");
      for (const dir of dirs) {
        const r = dir === "down" ? cr! - i : cr!;
        const c = dir === "across" ? cc! - i : cc!;
        const id = `${r},${c},${dir}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const cross = canPlace(board, word, r, c, dir, true, maxSpan, floorZero);
        if (cross < 0) continue;
        out.push({ r, c, dir, cross, score: scoreOf(board, word, r, c, dir, cross) });
      }
    }
  }
  out.sort((a, b) => b.score - a.score || b.cross - a.cross || a.r - b.r || a.c - b.c || (a.dir === "across" ? -1 : 1));
  return out;
}

function cloneSnap(snap: Snap): Snap {
  return { answer: snap.answer, clue: snap.clue, r: snap.r, c: snap.c, dir: snap.dir };
}

function greedyFill(entries: ParsedEntry[], maxSpan: number): Snap[] {
  if (entries.length === 0) return [];
  const ranked = [...entries].sort(
    (a, b) => b.answer.length - a.answer.length || a.answer.localeCompare(b.answer),
  );
  let best: Snap[] = [];
  let bestArea = Infinity;
  let bestSpan = Infinity;

  for (const seed of ranked) {
    for (const dir of ["across", "down"] as const) {
      const board = new Board();
      const placed: Snap[] = [];
      placeWord(board, seed.answer, 0, 0, dir);
      placed.push({ answer: seed.answer, clue: seed.clue, r: 0, c: 0, dir });
      const pool = ranked.filter((entry) => entry.answer !== seed.answer);

      while (pool.length > 0) {
        let choice: { index: number; cand: Candidate } | null = null;
        for (let i = 0; i < pool.length; i++) {
          const cand = candidates(board, pool[i]!.answer, maxSpan)[0];
          if (!cand) continue;
          const answer = pool[i]!.answer;
          const better =
            !choice ||
            cand.score > choice.cand.score ||
            (cand.score === choice.cand.score && answer.length > pool[choice.index]!.answer.length) ||
            (cand.score === choice.cand.score &&
              answer.length === pool[choice.index]!.answer.length &&
              answer < pool[choice.index]!.answer);
          if (better) choice = { index: i, cand };
        }
        if (!choice) break;
        const word = pool[choice.index]!;
        placeWord(board, word.answer, choice.cand.r, choice.cand.c, choice.cand.dir);
        placed.push({
          answer: word.answer,
          clue: word.clue,
          r: choice.cand.r,
          c: choice.cand.c,
          dir: choice.cand.dir,
        });
        pool.splice(choice.index, 1);
      }

      const area = board.bounds().area;
      const span = board.bounds().span;
      const tighter =
        placed.length > best.length ||
        (placed.length === best.length && (area < bestArea || (area === bestArea && span < bestSpan)));
      if (tighter) {
        best = placed.map(cloneSnap);
        bestArea = area;
        bestSpan = span;
      }
    }
  }
  return best;
}

function searchFill(entries: ParsedEntry[], floor: number, maxSpan: number): Snap[] {
  if (entries.length === 0) return [];
  const total = entries.length;
  const board = new Board();
  const placed: Snap[] = [];
  let best: Snap[] = [];
  let bestArea = Infinity;
  const budget = { n: 0 };
  const limit = 12000;

  const remember = () => {
    const area = board.bounds().area || Infinity;
    if (placed.length > best.length || (placed.length === best.length && area < bestArea)) {
      best = placed.map(cloneSnap);
      bestArea = area;
    }
  };

  const visit = (remaining: ParsedEntry[]): boolean => {
    remember();
    if (best.length === total) return true;
    if (budget.n > limit) return false;
    if (remaining.length === 0) return false;
    if (placed.length + remaining.length < Math.max(floor, best.length)) return false;

    let pick = 0;
    let cands: Candidate[] = [];
    let fewest = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const next = candidates(board, remaining[i]!.answer, maxSpan).slice(0, 6);
      if (next.length < fewest) {
        fewest = next.length;
        pick = i;
        cands = next;
        if (fewest === 0) break;
      }
    }

    const word = remaining[pick]!;
    const rest = remaining.filter((_, index) => index !== pick);
    if (cands.length === 0) {
      budget.n++;
      return visit(rest);
    }

    for (const cand of cands) {
      budget.n++;
      const undo = placeWord(board, word.answer, cand.r, cand.c, cand.dir);
      placed.push({ answer: word.answer, clue: word.clue, r: cand.r, c: cand.c, dir: cand.dir });
      const done = visit(rest);
      placed.pop();
      undoWord(board, undo);
      if (done) return true;
    }
    return false;
  };

  const ordered = [...entries].sort(
    (a, b) => b.answer.length - a.answer.length || a.answer.localeCompare(b.answer),
  );
  visit(ordered);
  return best;
}

function placeFixed(entries: ParsedEntry[], issues: ParseIssue[]): { snaps: Snap[]; open: ParsedEntry[] } {
  const board = new Board();
  const snaps: Snap[] = [];
  const open: ParsedEntry[] = [];
  for (const entry of entries) {
    if (entry.row == null || entry.col == null || !entry.direction) {
      open.push(entry);
      continue;
    }
    const cross = canPlace(board, entry.answer, entry.row, entry.col, entry.direction, false, 32, true);
    if (cross < 0) {
      issues.push({
        line: entry.line ?? 0,
        answer: entry.answer,
        message: "Não encaixa nessa casa: conflito de letra, palavra colada ou encostada de lado.",
      });
      continue;
    }
    placeWord(board, entry.answer, entry.row, entry.col, entry.direction);
    snaps.push({
      answer: entry.answer,
      clue: entry.clue,
      r: entry.row,
      c: entry.col,
      dir: entry.direction,
    });
  }
  return { snaps, open };
}

function anchorFill(fixed: Snap[], open: ParsedEntry[], maxSpan: number): Snap[] {
  if (open.length === 0) return fixed.map(cloneSnap);
  const board = new Board();
  for (const snap of fixed) placeWord(board, snap.answer, snap.r, snap.c, snap.dir);
  const placed = fixed.map(cloneSnap);
  const pool = [...open];
  while (pool.length > 0) {
    let choice: { index: number; cand: Candidate } | null = null;
    for (let i = 0; i < pool.length; i++) {
      const cand = candidates(board, pool[i]!.answer, maxSpan, true)[0];
      if (!cand) continue;
      if (!choice || cand.score > choice.cand.score) choice = { index: i, cand };
    }
    if (!choice) break;
    const word = pool[choice.index]!;
    placeWord(board, word.answer, choice.cand.r, choice.cand.c, choice.cand.dir);
    placed.push({
      answer: word.answer,
      clue: word.clue,
      r: choice.cand.r,
      c: choice.cand.c,
      dir: choice.cand.dir,
    });
    pool.splice(choice.index, 1);
  }
  return placed;
}

function shiftToOrigin(snaps: Snap[]): Snap[] {
  if (snaps.length === 0) return snaps;
  const minR = Math.min(...snaps.map((snap) => snap.r));
  const minC = Math.min(...snaps.map((snap) => snap.c));
  if (minR === 0 && minC === 0) return snaps;
  return snaps.map((snap) => ({ ...snap, r: snap.r - minR, c: snap.c - minC }));
}

function finalize(snaps: Snap[], origin: boolean): { words: PlacedWord[]; rows: number; cols: number } {
  const shifted = origin ? shiftToOrigin(snaps) : snaps;
  if (shifted.length === 0) return { words: [], rows: 0, cols: 0 };
  const numbers = new Map<string, number>();
  const starts = [...shifted].sort((a, b) => a.r - b.r || a.c - b.c);
  let next = 1;
  for (const snap of starts) {
    const key = `${snap.r},${snap.c}`;
    if (!numbers.has(key)) numbers.set(key, next++);
  }
  let maxR = 0;
  let maxC = 0;
  const words: PlacedWord[] = shifted.map((snap) => {
    const endR = snap.dir === "down" ? snap.r + snap.answer.length - 1 : snap.r;
    const endC = snap.dir === "across" ? snap.c + snap.answer.length - 1 : snap.c;
    maxR = Math.max(maxR, endR);
    maxC = Math.max(maxC, endC);
    const number = numbers.get(`${snap.r},${snap.c}`)!;
    return {
      id: `${number}${snap.dir === "across" ? "A" : "D"}`,
      number,
      answer: snap.answer,
      clue: snap.clue,
      row: snap.r,
      col: snap.c,
      direction: snap.dir,
    };
  });
  words.sort((a, b) => a.number - b.number || (a.direction === "across" ? -1 : 1));
  return { words, rows: maxR + 1, cols: maxC + 1 };
}

function layout(entries: ParsedEntry[], issues: ParseIssue[]): { words: PlacedWord[]; rows: number; cols: number } {
  const fixedCount = entries.filter((entry) => entry.direction).length;
  if (fixedCount === 0) {
    const greedy = greedyFill(entries, MAX_SPAN);
    const searched = greedy.length === entries.length ? greedy : searchFill(entries, greedy.length, MAX_SPAN);
    const snaps = searched.length > greedy.length ? searched : greedy;
    return finalize(snaps, true);
  }
  const { snaps, open } = placeFixed(entries, issues);
  if (open.length === 0) return finalize(snaps, false);
  return finalize(anchorFill(snaps, open, MAX_SPAN), false);
}

export function buildPuzzle(source: string): PuzzleModel {
  const parsed = parseSource(source);
  const laid = layout(parsed.entries, parsed.issues);
  const placed = new Set(laid.words.map((word) => word.answer));
  const omitted = parsed.entries
    .filter((entry) => !placed.has(entry.answer))
    .map((entry) => ({ answer: entry.answer, clue: entry.clue }));
  return {
    title: parsed.title,
    note: parsed.note,
    rows: laid.rows,
    cols: laid.cols,
    words: laid.words,
    issues: parsed.issues,
    omitted,
  };
}

export function puzzleMatrix(model: PuzzleModel): (MatrixCell | null)[][] {
  const matrix: (MatrixCell | null)[][] = Array.from({ length: model.rows }, () =>
    Array.from({ length: model.cols }, () => null),
  );
  for (const word of model.words) {
    for (let i = 0; i < word.answer.length; i++) {
      const row = word.row + (word.direction === "down" ? i : 0);
      const col = word.col + (word.direction === "across" ? i : 0);
      const current = matrix[row]?.[col];
      const cell: MatrixCell = current ?? {
        letter: word.answer[i]!,
        number: null,
        acrossId: null,
        downId: null,
      };
      if (word.direction === "across") cell.acrossId = word.id;
      else cell.downId = word.id;
      if (i === 0) cell.number = word.number;
      matrix[row]![col] = cell;
    }
  }
  return matrix;
}

export function cellsOf(word: PlacedWord): { row: number; col: number }[] {
  return Array.from({ length: word.answer.length }, (_, index) => ({
    row: word.row + (word.direction === "down" ? index : 0),
    col: word.col + (word.direction === "across" ? index : 0),
  }));
}
