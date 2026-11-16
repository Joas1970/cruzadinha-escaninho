export const STORAGE_KEY = "palavras-cruzadas-v1";

export type Save = {
  puzzleId: string;
  customSource: string;
  progress: Record<string, Record<string, string>>;
  helped: Record<string, boolean>;
  gallery: Array<{ id: string; source: string }>;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseSave(raw: string): Save {
  const value: unknown = JSON.parse(raw);
  if (!record(value)) throw new Error("Dados de progresso inválidos");
  const progress: Save["progress"] = {};
  if (record(value.progress)) {
    for (const [signature, board] of Object.entries(value.progress)) {
      if (!record(board)) continue;
      const cells: Record<string, string> = {};
      for (const [key, letter] of Object.entries(board)) {
        if (/^\d{1,2},\d{1,2}$/.test(key) && typeof letter === "string" && /^[A-Z]$/.test(letter)) {
          cells[key] = letter;
        }
      }
      Object.defineProperty(progress, signature, {
        value: cells,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  const helped: Save["helped"] = {};
  if (record(value.helped)) {
    for (const [key, flag] of Object.entries(value.helped)) {
      if (flag === true)
        Object.defineProperty(helped, key, {
          value: true,
          enumerable: true,
          writable: true,
          configurable: true,
        });
    }
  }
  return {
    puzzleId: typeof value.puzzleId === "string" ? value.puzzleId : "iluminismo",
    customSource: typeof value.customSource === "string" ? value.customSource : "",
    progress,
    helped,
    gallery: Array.isArray(value.gallery)
      ? value.gallery
          .filter(
            (item): item is { id: string; source: string } =>
              record(item) &&
              typeof item.id === "string" &&
              typeof item.source === "string" &&
              item.source.length <= 40_000,
          )
          .slice(0, 100)
      : [],
  };
}

export function writeSave(storage: Pick<Storage, "setItem">, save: Save): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
