import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { BookOpen, Check, Eraser, Eye, PenLine, Printer } from "lucide-react";
import { CUSTOM_ID, PUZZLES } from "@/data/puzzles";
import {
  buildPuzzle,
  cellsOf,
  normalizeAnswer,
  puzzleMatrix,
  type Direction,
  type MatrixCell,
  type PlacedWord,
  type PuzzleModel,
} from "@/lib/crossword/engine";

import { parseSave, writeSave, STORAGE_KEY, type Save } from "@/lib/crossword/storage";
import { readActivityLocation, type ActivityLocation } from "@/lib/crossword/sharing";
import { EmbedBridge } from "./embed-bridge";
const ShareDialog = lazy(() =>
  import("./share-dialog").then((module) => ({ default: module.ShareDialog })),
);
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type Active = { row: number; col: number; dir: Direction };
const builtIns = PUZZLES.map((puzzle) => ({
  ...puzzle,
  model: buildPuzzle(puzzle.source),
}));

function cellKey(row: number, col: number) {
  return `${row},${col}`;
}

function signature(model: PuzzleModel) {
  return model.words
    .map((word) => `${word.direction}:${word.row},${word.col}:${word.answer}`)
    .join("|");
}

function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseSave(raw);
  } catch {
    return null;
  }
}

function wordCellsMatch(
  word: PlacedWord,
  fills: Record<string, string>,
  expect: "full" | "correct",
) {
  return cellsOf(word).every((cell, index) => {
    const value = fills[cellKey(cell.row, cell.col)] ?? "";
    if (expect === "full") return value.length === 1;
    return value === word.answer[index];
  });
}

export function CrosswordPlay() {
  const [puzzleId, setPuzzleId] = useState(builtIns[0]!.id);
  const [customSource, setCustomSource] = useState("");
  const [progress, setProgress] = useState<Record<string, Record<string, string>>>({});
  const [hydrated, setHydrated] = useState(false);
  const [location, setLocation] = useState<ActivityLocation | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [sharedSource, setSharedSource] = useState("");
  const [activityError, setActivityError] = useState("");
  const appRoot = useRef<HTMLDivElement | null>(null);
  const teacher = location?.teacher === true;
  const canCheck = teacher || location?.canCheck !== false;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(builtIns[0]!.source);
  const [checked, setChecked] = useState(false);
  const [revealAll, setRevealAll] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [helpHistory, setHelpHistory] = useState<Record<string, boolean>>({});
  const [storageWarning, setStorageWarning] = useState("");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [active, setActive] = useState<Active | null>(() => {
    const first =
      builtIns[0]!.model.words.find((word) => word.direction === "across") ??
      builtIns[0]!.model.words[0];
    return first ? { row: first.row, col: first.col, dir: first.direction } : null;
  });
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const wantFocus = useRef(false);
  const skipReset = useRef(true);

  const contentSource = sharedSource || customSource;
  const customModel = useMemo(
    () => (contentSource.trim() ? buildPuzzle(contentSource) : null),
    [contentSource],
  );
  const selected =
    puzzleId === CUSTOM_ID ? null : builtIns.find((puzzle) => puzzle.id === puzzleId);
  const source = selected?.source ?? contentSource;
  const model = selected?.model ?? customModel ?? builtIns[0]!.model;
  // Keep students' attempts separate from the teacher's answers on a shared device.
  const sig = `${teacher ? "professor:" : "aluno:"}${signature(model)}`;
  const fills = progress[sig] ?? {};
  const helped = helpHistory[sig] === true;
  const matrix = useMemo(() => puzzleMatrix(model), [model]);
  const across = model.words.filter((word) => word.direction === "across");
  const down = model.words.filter((word) => word.direction === "down");

  const current = active
    ? model.words.find(
        (word) =>
          word.direction === active.dir &&
          cellsOf(word).some((cell) => cell.row === active.row && cell.col === active.col),
      )
    : undefined;

  useEffect(() => {
    const restoreActivity = () => {
      const saved = readSave();
      const incoming = readActivityLocation(window.location.href);
      setLocation(incoming);
      setBaseUrl(window.location.origin + window.location.pathname);
      setActivityError(incoming.error || "");
      setSharedSource("");
      setPuzzleId(builtIns[0]!.id);
      setEditing(false);
      setChecked(false);
      setRevealAll(false);
      setRevealed({});
      if (saved) {
        setCustomSource(saved.customSource);
        // Migrate previous attempts into the teacher namespace only.
        const migrate = <T,>(values: Record<string, T>) =>
          Object.fromEntries(
            Object.entries(values).map(([key, value]) => [
              key.startsWith("professor:") || key.startsWith("aluno:") ? key : `professor:${key}`,
              value,
            ]),
          );
        setProgress(migrate(saved.progress));
        setHelpHistory(migrate(saved.helped));
        if (incoming.teacher && !incoming.puzzleId) {
          setPuzzleId(
            saved.puzzleId === CUSTOM_ID || builtIns.some((puzzle) => puzzle.id === saved.puzzleId)
              ? saved.puzzleId
              : builtIns[0]!.id,
          );
        }
        if (incoming.teacher && saved.puzzleId === CUSTOM_ID && saved.customSource.trim()) {
          setDraft(saved.customSource);
        }
      }
      if (incoming.puzzleId) setPuzzleId(incoming.puzzleId);
      if (incoming.source) {
        const shared = buildPuzzle(incoming.source);
        if (shared.words.length === 0 || shared.issues.length > 0 || shared.omitted.length > 0) {
          setActivityError(
            "A atividade deste link contém palavras inválidas ou sem encaixe. Peça ao professor um novo link.",
          );
        } else {
          setSharedSource(incoming.source);
          setPuzzleId(CUSTOM_ID);
        }
      }
      setHydrated(true);
    };
    restoreActivity();
    window.addEventListener("hashchange", restoreActivity);
    window.addEventListener("popstate", restoreActivity);
    return () => {
      window.removeEventListener("hashchange", restoreActivity);
      window.removeEventListener("popstate", restoreActivity);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const previous = readSave();
    const payload: Save = {
      puzzleId: teacher ? puzzleId : (previous?.puzzleId ?? builtIns[0]!.id),
      customSource,
      progress,
      helped: helpHistory,
    };
    try {
      setStorageWarning(
        writeSave(localStorage, payload)
          ? ""
          : "Não foi possível salvar neste navegador. Mantenha esta página aberta para preservar sua tentativa.",
      );
    } catch {
      setStorageWarning(
        "O armazenamento está indisponível. Sua tentativa será mantida apenas nesta página.",
      );
    }
  }, [hydrated, puzzleId, customSource, progress, helpHistory, teacher]);

  useEffect(() => {
    if (skipReset.current) {
      skipReset.current = false;
      return;
    }
    setChecked(false);
    setRevealAll(false);
    setRevealed({});
    const first = model.words.find((word) => word.direction === "across") ?? model.words[0];
    setActive(first ? { row: first.row, col: first.col, dir: first.direction } : null);
  }, [sig, model.words]);

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    activeRef.current?.focus();
  }, [active]);

  const solved =
    model.words.length > 0 && model.words.every((word) => wordCellsMatch(word, fills, "correct"));
  const filledWords = model.words.filter((word) =>
    wordCellsMatch(word, fills, canCheck ? "correct" : "full"),
  ).length;

  function focusWord(word: PlacedWord) {
    const cells = cellsOf(word);
    const empty = cells.find((cell) => !(fills[cellKey(cell.row, cell.col)] ?? ""));
    const target = empty ?? cells[0]!;
    wantFocus.current = true;
    setActive({ row: target.row, col: target.col, dir: word.direction });
  }

  function moveBy(rowDelta: number, colDelta: number) {
    if (!active) return;
    const row = active.row + rowDelta;
    const col = active.col + colDelta;
    const cell = matrix[row]?.[col];
    if (!cell) return;
    const preferred: Direction = rowDelta !== 0 ? "down" : "across";
    const dir =
      preferred === "across" && cell.acrossId
        ? "across"
        : preferred === "down" && cell.downId
          ? "down"
          : cell.acrossId
            ? "across"
            : "down";
    wantFocus.current = true;
    setActive({ row, col, dir });
  }

  function stepInWord(delta: number) {
    if (!current || !active) return false;
    const cells = cellsOf(current);
    const index = cells.findIndex((cell) => cell.row === active.row && cell.col === active.col);
    const next = cells[index + delta];
    if (!next) return false;
    wantFocus.current = true;
    setActive({ row: next.row, col: next.col, dir: current.direction });
    return true;
  }

  function writeCell(row: number, col: number, letter: string) {
    setProgress((prev) => {
      const board = { ...(prev[sig] ?? {}) };
      const key = cellKey(row, col);
      if (letter) board[key] = letter;
      else delete board[key];
      return { ...prev, [sig]: board };
    });
  }

  function typeLetter(raw: string) {
    if (!active || revealAll) return;
    const letter = normalizeAnswer(raw);
    if (letter.length !== 1) return;
    if (current && revealed[current.id]) {
      setRevealed((prev) => ({ ...prev, [current.id]: false }));
    }
    writeCell(active.row, active.col, letter);
    stepInWord(1);
  }

  function erase() {
    if (!active || revealAll) return;
    const key = cellKey(active.row, active.col);
    if (fills[key]) {
      writeCell(active.row, active.col, "");
      return;
    }
    if (!current) return;
    const cells = cellsOf(current);
    const index = cells.findIndex((cell) => cell.row === active.row && cell.col === active.col);
    const prev = cells[index - 1];
    if (!prev) return;
    writeCell(prev.row, prev.col, "");
    wantFocus.current = true;
    setActive({ row: prev.row, col: prev.col, dir: current.direction });
  }

  function cycleWord(delta: number) {
    const order = [...across, ...down];
    if (order.length === 0) return;
    const index = current ? order.findIndex((word) => word.id === current.id) : -1;
    const next = order[(index + delta + order.length) % order.length]!;
    focusWord(next);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveBy(0, -1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveBy(0, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveBy(-1, 0);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveBy(1, 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      cycleWord(event.shiftKey ? -1 : 1);
    } else if (event.key === "Backspace") {
      event.preventDefault();
      erase();
    } else if (event.key === "Escape" && revealAll) {
      setRevealAll(false);
    } else if (event.key.length === 1) {
      const letter = normalizeAnswer(event.key);
      if (letter.length === 1) {
        event.preventDefault();
        typeLetter(letter);
      }
    }
  }

  function selectCell(row: number, col: number, cell: MatrixCell) {
    if (active && active.row === row && active.col === col && cell.acrossId && cell.downId) {
      wantFocus.current = true;
      setActive({ row, col, dir: active.dir === "across" ? "down" : "across" });
      return;
    }
    const dir: Direction =
      active?.dir === "down" && cell.downId ? "down" : cell.acrossId ? "across" : "down";
    wantFocus.current = true;
    setActive({ row, col, dir });
  }

  function revealWord() {
    if (!teacher || !current) return;
    setHelpHistory((prev) => ({ ...prev, [sig]: true }));
    setRevealed((prev) => ({ ...prev, [current.id]: true }));
  }

  function openGabarito() {
    if (!teacher) return;
    setHelpHistory((prev) => ({ ...prev, [sig]: true }));
    setRevealAll(true);
    setChecked(true);
  }

  function clearBoard() {
    setProgress((prev) => ({ ...prev, [sig]: {} }));
    setChecked(false);
    setRevealAll(false);
    setRevealed({});
    setHelpHistory((prev) => ({ ...prev, [sig]: false }));
  }

  function openEditor() {
    if (!teacher) return;
    setDraft(source || builtIns[0]!.source);
    setEditing(true);
  }

  function applyDraft() {
    if (!teacher) return;
    const next = buildPuzzle(draft);
    if (next.words.length === 0 || next.issues.length > 0 || next.omitted.length > 0) return;
    setCustomSource(draft);
    setPuzzleId(CUSTOM_ID);
    setEditing(false);
  }

  function printSheet(blank: boolean) {
    const clear = () => {
      delete document.body.dataset.print;
      window.removeEventListener("afterprint", clear);
    };
    window.addEventListener("afterprint", clear);
    if (blank) document.body.dataset.print = "blank";
    window.print();
  }

  const draftModel = useMemo(() => (editing ? buildPuzzle(draft) : null), [editing, draft]);

  useEffect(() => {
    if (editing) editorRef.current?.focus();
  }, [editing]);
  const chips = [
    ...builtIns.map((puzzle) => ({ id: puzzle.id, label: puzzle.model.title })),
    ...(teacher && customSource.trim()
      ? [{ id: CUSTOM_ID, label: customModel?.title || "Meu texto" }]
      : []),
  ];

  if (!hydrated)
    return (
      <main className="mx-auto max-w-6xl p-6" aria-busy="true">
        <h1 className="font-display text-3xl">Palavras Cruzadas</h1>
        <p role="status" className="mt-3">
          Preparando sua atividade…
        </p>
      </main>
    );
  if (activityError)
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="font-display text-3xl">Atividade indisponível</h1>
        <p role="alert" className="mt-4">
          {activityError}
        </p>
        <a className="tool-button mt-6" href="/?modo=aluno">
          Ver as atividades disponíveis
        </a>
      </main>
    );

  return (
    <div ref={appRoot} className={`${location?.embedded ? "" : "min-h-screen"} bg-paper text-ink`}>
      <EmbedBridge enabled={location?.embedded === true} root={appRoot} />
      <div className="h-1 bg-brass" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <img
              src="/capa-cruzadinha.webp"
              alt="Cruzadinha em papel com as palavras História, Conhecimento, Filosofia e Aprendizagem e um lápis."
              width={2752}
              height={1536}
              fetchPriority="high"
              className="no-print mb-4 block h-auto w-full max-w-sm rounded-lg"
            />
            <p className="text-xs font-semibold tracking-widest text-brass-deep uppercase">
              Escaninho Digital · {teacher ? "Área do professor" : "Atividade do aluno"}
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium text-ink">Palavras Cruzadas</h1>
            <p className="mt-2 text-pretty text-ink-soft">
              {teacher
                ? "Prepare o conteúdo e compartilhe a atividade com sua turma."
                : "Escolha uma casa, leia a dica e escreva. Seu progresso é salvo neste navegador."}
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            {canCheck ? (
              <ToolButton onClick={() => setChecked(true)} tone="primary">
                <Check className="size-4" aria-hidden />
                Conferir
              </ToolButton>
            ) : null}
            {teacher ? (
              <ToolButton onClick={revealWord} disabled={!current || revealAll}>
                <Eye className="size-4" aria-hidden />
                Revelar
              </ToolButton>
            ) : null}
            {teacher ? (
              <ToolButton onClick={openGabarito}>
                <BookOpen className="size-4" aria-hidden />
                Gabarito
              </ToolButton>
            ) : null}
            <ToolButton onClick={clearBoard}>
              <Eraser className="size-4" aria-hidden />
              Limpar
            </ToolButton>
            {teacher ? (
              <ToolButton onClick={openEditor}>
                <PenLine className="size-4" aria-hidden />
                Conteúdo
              </ToolButton>
            ) : null}
            <ToolButton onClick={() => printSheet(false)}>
              <Printer className="size-4" aria-hidden />
              Imprimir
            </ToolButton>
            {!teacher && !location?.embedded ? (
              <a className="tool-button bg-ink text-paper" href="/?modo=professor">
                <PenLine className="size-4" aria-hidden />
                Sou professor · Criar atividade
              </a>
            ) : null}
          </div>
        </header>

        <div className="print-student-info" aria-label="Identificação do aluno">
          <span><strong>Nome:</strong> <i /></span>
          <span><strong>Turma:</strong> <i /></span>
          <span><strong>Data:</strong> <i /></span>
        </div>

        {teacher && !editing ? (
          <div className="no-print flex flex-wrap items-center justify-between gap-3 border-y border-line py-4">
            <div className="max-w-xl text-sm text-ink-soft">
              <h2 className="mb-2 font-semibold text-ink">Prepare e envie sua atividade</h2>
              <ol className="list-inside list-decimal space-y-1">
                <li>Abra <strong>Conteúdo</strong> para editar as palavras e dicas.</li>
                <li>Clique em <strong>Montar grade</strong> para aplicar sua lista.</li>
                <li>Use <strong>Compartilhar atividade</strong>: link, WhatsApp, QR code e apresentação.</li>
              </ol>
              <p className="mt-2">Os alunos recebem a atividade sem Revelar, Gabarito ou editor.</p>
            </div>
            <Suspense
              fallback={
                <span role="status" className="text-sm">
                  Preparando compartilhamento…
                </span>
              }
            >
              <ShareDialog
                baseUrl={baseUrl}
                puzzleId={puzzleId}
                source={source}
                title={model.title}
              />
            </Suspense>
          </div>
        ) : null}

        {!sharedSource && (!location?.puzzleId || teacher) ? (
          <section className="no-print grid gap-3" aria-labelledby="activity-gallery-title">
            <h2 id="activity-gallery-title" className="font-display text-2xl">
              Galeria de atividades
            </h2>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
              {chips.map((chip) => {
                const on = chip.id === puzzleId && !editing;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setPuzzleId(chip.id);
                      setEditing(false);
                    }}
                    className={
                      on
                        ? "h-11 shrink-0 rounded-full bg-ink px-4 text-sm font-semibold text-paper"
                        : "h-11 shrink-0 rounded-full bg-paper-deep px-4 text-sm font-semibold text-ink"
                    }
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {storageWarning ? (
          <p role="status" className="no-print text-sm text-miss">
            {storageWarning}
          </p>
        ) : null}

        {editing ? (
          <Editor
            draft={draft}
            model={draftModel!}
            editorRef={editorRef}
            onChange={setDraft}
            onCancel={() => setEditing(false)}
            onApply={applyDraft}
            onLoad={(id) => {
              const puzzle = builtIns.find((item) => item.id === id);
              if (puzzle) setDraft(puzzle.source);
            }}
          />
        ) : (
          <div className="activity-layout grid items-start gap-8 lg:grid-cols-2">
            <section className="sheet mx-auto w-full max-w-xl lg:mx-0">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl font-medium">{model.title}</h2>
                <p className="tabular-nums text-sm text-ink-soft">
                  {filledWords} de {model.words.length}
                </p>
              </div>
              {model.note ? (
                <p className="mt-1 text-pretty text-sm text-ink-soft">{model.note}</p>
              ) : null}
              <div className="mt-3 h-1 bg-line">
                <div
                  className="h-1 bg-brass"
                  style={{
                    width: model.words.length
                      ? `${Math.round((filledWords / model.words.length) * 100)}%`
                      : "0%",
                  }}
                />
              </div>

              {solved ? (
                <p
                  role="status"
                  className="no-print mt-4 bg-ink px-4 py-3 font-display text-lg text-paper"
                >
                  {!teacher
                    ? "Cruzadinha completa. Muito bem!"
                    : helped
                      ? "Grade fechada, com alguma ajuda no caminho."
                      : "Cruzadinha completa, sem o gabarito."}
                </p>
              ) : null}

              {revealAll ? (
                <p className="no-print mt-4 flex items-center justify-between gap-3 bg-paper-deep px-4 py-3 text-sm">
                  <span>Gabarito aberto. As letras não entram na sua tentativa.</span>
                  <button
                    type="button"
                    className="font-semibold text-brass-deep"
                    onClick={() => setRevealAll(false)}
                  >
                    Fechar
                  </button>
                </p>
              ) : null}

              {model.omitted.length > 0 ? (
                <p className="mt-4 text-sm text-miss">
                  Sem encaixe: {model.omitted.map((item) => item.answer).join(", ")}. Mude uma letra
                  em comum ou trave a posição.
                </p>
              ) : null}

              <p className="mt-4 min-h-14 font-display text-xl text-pretty">
                {current ? (
                  <>
                    <span className="text-brass-deep">{current.number}. </span>
                    {current.clue}
                  </>
                ) : (
                  "Escolha uma casa da grade."
                )}
              </p>
              <p className="sr-only" aria-live="polite">
                {current
                  ? `${current.direction === "across" ? "Horizontal" : "Vertical"} ${current.number}. ${current.clue}`
                  : ""}
              </p>

              <div
                className="mt-3 grid gap-px bg-ink p-px"
                style={{ gridTemplateColumns: `repeat(${model.cols}, minmax(0, 1fr))` }}
                role="group"
                aria-describedby="grid-instructions"
                aria-label={model.title}
              >
                {matrix.map((row, rowIndex) =>
                  row.map((cell, colIndex) => {
                    if (!cell)
                      return (
                        <div
                          key={cellKey(rowIndex, colIndex)}
                          className="blocked-cell aspect-square bg-ink"
                          aria-hidden="true"
                        />
                      );
                    const on = active?.row === rowIndex && active?.col === colIndex;
                    const inWord = Boolean(
                      current &&
                      ((current.direction === "across" && cell.acrossId === current.id) ||
                        (current.direction === "down" && cell.downId === current.id)),
                    );
                    const shown = shownLetter(cell, rowIndex, colIndex, fills, revealed, revealAll);
                    const mark = cellMark(shown, cell.letter, checked, revealAll, revealed, cell);
                    const state = on
                      ? "on"
                      : mark === "bad"
                        ? "bad"
                        : mark === "ok"
                          ? "ok"
                          : inWord
                            ? "word"
                            : "idle";
                    return (
                      <button
                        key={cellKey(rowIndex, colIndex)}
                        ref={on ? activeRef : undefined}
                        type="button"
                        tabIndex={on ? 0 : -1}
                        data-state={state}
                        aria-label={`Linha ${rowIndex + 1}, coluna ${colIndex + 1}${cell.number ? `, início ${cell.number}` : ""}. ${shown ? `Letra ${shown}` : "Vazia"}${mark === "bad" ? ", resposta incorreta" : ""}${mark === "ok" ? ", resposta correta" : ""}`}
                        aria-current={on ? "true" : undefined}
                        onClick={() => selectCell(rowIndex, colIndex, cell)}
                        onKeyDown={onKeyDown}
                        className="sq relative aspect-square touch-manipulation bg-paper text-ink data-[state=bad]:bg-miss-soft data-[state=bad]:text-miss data-[state=ok]:text-brass-deep data-[state=on]:bg-brass data-[state=word]:bg-paper-deep"
                      >
                        {cell.number ? <span className="sq-num">{cell.number}</span> : null}
                        <span className="sq-letter">{shown}</span>
                      </button>
                    );
                  }),
                )}
              </div>

              <p id="grid-instructions" className="no-print mt-2 text-sm text-ink-soft">
                Setas movem. Letras escrevem. Backspace apaga. Enter troca de palavra; Shift+Enter
                volta. Tab sai da grade. Clique novamente num cruzamento para mudar a direção.
              </p>

              <div className="no-print mt-3 grid grid-cols-9 gap-1 md:hidden">
                {LETTERS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => typeLetter(letter)}
                    className="h-11 rounded-md bg-paper-deep font-display text-ink"
                  >
                    {letter}
                  </button>
                ))}
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={erase}
                  className="col-span-2 h-11 rounded-md bg-ink font-semibold text-paper"
                >
                  Apagar
                </button>
              </div>

              <button
                type="button"
                className="no-print mt-3 text-sm font-semibold text-brass-deep"
                onClick={() => printSheet(true)}
              >
                Imprimir folha em branco
              </button>
            </section>

            <section className="grid gap-6">
              <ClueColumn
                title="Horizontais"
                words={across}
                currentId={current?.id}
                fills={fills}
                canCheck={canCheck}
                checked={checked}
                revealed={revealed}
                revealAll={revealAll}
                onPick={focusWord}
              />
              <ClueColumn
                title="Verticais"
                words={down}
                currentId={current?.id}
                fills={fills}
                canCheck={canCheck}
                checked={checked}
                revealed={revealed}
                revealAll={revealAll}
                onPick={focusWord}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function shownLetter(
  cell: MatrixCell,
  row: number,
  col: number,
  fills: Record<string, string>,
  revealed: Record<string, boolean>,
  revealAll: boolean,
) {
  const acrossId = cell.acrossId;
  const downId = cell.downId;
  if (revealAll || (acrossId && revealed[acrossId]) || (downId && revealed[downId]))
    return cell.letter;
  return fills[cellKey(row, col)] ?? "";
}

function cellMark(
  shown: string,
  solution: string,
  checked: boolean,
  revealAll: boolean,
  revealed: Record<string, boolean>,
  cell: MatrixCell,
) {
  if (!shown) return "";
  const forced =
    revealAll ||
    (cell.acrossId ? revealed[cell.acrossId] : false) ||
    (cell.downId ? revealed[cell.downId] : false);
  if (forced) return "ok";
  if (!checked) return "";
  return shown === solution ? "ok" : "bad";
}

function wordTone(
  word: PlacedWord,
  fills: Record<string, string>,
  canCheck: boolean,
  checked: boolean,
  revealed: Record<string, boolean>,
  revealAll: boolean,
) {
  if (revealAll || revealed[word.id]) return "shown";
  const cells = cellsOf(word);
  const values = cells.map((cell) => fills[cellKey(cell.row, cell.col)] ?? "");
  if (!canCheck)
    return values.every(Boolean) ? "filled" : values.some(Boolean) ? "partial" : "empty";
  if (values.every((value, index) => value === word.answer[index])) return "done";
  if (checked && values.some((value, index) => value && value !== word.answer[index])) return "bad";
  if (values.some(Boolean)) return "partial";
  return "empty";
}

function ClueColumn({
  title,
  words,
  currentId,
  fills,
  canCheck,
  checked,
  revealed,
  revealAll,
  onPick,
}: {
  title: string;
  words: PlacedWord[];
  currentId?: string;
  fills: Record<string, string>;
  canCheck: boolean;
  checked: boolean;
  revealed: Record<string, boolean>;
  revealAll: boolean;
  onPick: (word: PlacedWord) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-xl">{title}</h2>
      <ul className="mt-3 grid gap-2">
        {words.map((word) => {
          const tone = wordTone(word, fills, canCheck, checked, revealed, revealAll);
          const on = word.id === currentId;
          return (
            <li key={word.id}>
              <button
                type="button"
                aria-current={on ? "true" : undefined}
                onClick={() => onPick(word)}
                className={
                  on
                    ? "w-full border-l-4 border-brass bg-paper-deep px-3 py-3 text-left"
                    : "w-full border-l-4 border-transparent px-3 py-3 text-left hover:bg-paper-deep"
                }
              >
                <span className="text-sm font-semibold text-brass-deep tabular-nums">
                  {word.number}.{" "}
                </span>
                <span className="text-pretty">{word.clue}</span>
                {tone === "done" ? (
                  <span className="ml-2 text-sm font-semibold text-brass-deep">certa</span>
                ) : null}
                {tone === "filled" ? (
                  <span className="ml-2 text-sm text-ink-soft">preenchida</span>
                ) : null}
                {tone === "bad" ? (
                  <span className="ml-2 text-sm font-semibold text-miss">rever</span>
                ) : null}
                {tone === "shown" ? (
                  <span className="ml-2 text-sm font-semibold text-ink-soft">gabarito</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  tone = "ghost",
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "primary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        tone === "primary"
          ? "inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-40"
          : "inline-flex h-11 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}

function Editor({
  draft,
  model,
  editorRef,
  onChange,
  onCancel,
  onApply,
  onLoad,
}: {
  draft: string;
  model: PuzzleModel;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onCancel: () => void;
  onApply: () => void;
  onLoad: (id: string) => void;
}) {
  const issues = model.issues;
  const blocked = model.words.length === 0 || issues.length > 0 || model.omitted.length > 0;
  return (
    <section className="grid gap-4">
      <div className="max-w-3xl">
        <h2 className="font-display text-2xl">Conteúdo da cruzadinha</h2>
        <p className="mt-2 text-pretty text-ink-soft">
          Uma resposta por linha. A grade é montada de novo a partir dessa lista. Acentos não entram
          nas casas: Razão vira RAZAO.
        </p>
        <pre className="mt-3 max-w-full overflow-x-auto bg-paper-deep p-4 text-sm text-ink">{`PALAVRA | Dica que o aluno lê
OUTRA | Segunda dica
# Título na primeira linha com cerquilha

Posição travada, se quiser desenhar a grade:
CASA | lar | 1,1,H
AMOR | afeto | 1,2,V`}</pre>
      </div>
      <label className="grid gap-2 text-sm font-semibold">
        Partir de um exemplo
        <select
          className="h-11 max-w-xs border border-line bg-paper px-3 font-sans text-base font-normal"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) onLoad(event.target.value);
          }}
        >
          <option value="" disabled>
            Escolher
          </option>
          {builtIns.map((puzzle) => (
            <option key={puzzle.id} value={puzzle.id}>
              {puzzle.model.title}
            </option>
          ))}
        </select>
      </label>
      <textarea
        ref={editorRef}
        aria-invalid={blocked}
        aria-describedby="editor-feedback"
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        spellCheck
        className="min-h-80 w-full border border-line bg-paper p-4 font-mono text-base leading-relaxed text-ink"
        aria-label="Lista de palavras e dicas"
      />
      <div id="editor-feedback" role="status">
        {issues.length > 0 ? (
          <ul className="grid gap-1 text-sm text-miss">
            {issues.map((issue) => (
              <li key={`${issue.line}-${issue.answer}`}>
                {issue.line > 0 ? `Linha ${issue.line}: ` : "Posicionamento: "}{" "}
                {issue.answer ? `${issue.answer} — ` : ""}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
        {model.omitted.length > 0 ? (
          <p className="text-sm text-miss">
            Sem encaixe: {model.omitted.map((word) => word.answer).join(", ")}. Ajuste as palavras
            ou posições antes de montar.
          </p>
        ) : null}
        <p className="text-sm text-ink-soft">
          Prévia: {model.words.length} palavras, {model.rows} linhas e {model.cols} colunas.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <ToolButton onClick={onApply} tone="primary" disabled={blocked}>
          Montar grade
        </ToolButton>
        <ToolButton onClick={onCancel}>Voltar</ToolButton>
      </div>
      {blocked ? (
        <p className="text-sm text-ink-soft">
          Corrija os avisos e inclua ao menos uma palavra válida para montar a grade.
        </p>
      ) : null}
    </section>
  );
}
