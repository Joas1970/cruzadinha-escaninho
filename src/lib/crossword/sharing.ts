import LZString from "lz-string";
import { PUZZLES } from "../../data/puzzles.ts";

export const MAX_SHARED_SOURCE = 12000;
export const MAX_SHARED_TOKEN = 10000;
export const MAX_QR_LENGTH = 1800;

export type ActivityLocation = {
  teacher: boolean;
  embedded: boolean;
  canCheck: boolean;
  puzzleId: string | null;
  source: string | null;
  error: string | null;
};

export function readActivityLocation(href: string): ActivityLocation {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const embedded = url.searchParams.get("incorporar") === "1";
  const token = hash.get("atividade");
  const result: ActivityLocation = {
    teacher: !embedded && url.searchParams.get("modo") === "professor" && token === null,
    embedded,
    canCheck: url.searchParams.get("conferir") !== "0",
    puzzleId: null,
    source: null,
    error: null,
  };
  const id = url.searchParams.get("tema");
  if (id !== null) {
    if (PUZZLES.some((puzzle) => puzzle.id === id)) result.puzzleId = id;
    else result.error = "O tema deste link não foi encontrado. Peça um novo link ao professor.";
  }
  if (token !== null) {
    try {
      if (!token || token.length > MAX_SHARED_TOKEN || !/^[A-Za-z0-9+\-$ ]+$/.test(token))
        throw new Error();
      const decoded = LZString.decompressFromEncodedURIComponent(token);
      if (!decoded || decoded.length > MAX_SHARED_SOURCE * 6 + 100) throw new Error();
      const data: unknown = JSON.parse(decoded);
      if (
        !data ||
        typeof data !== "object" ||
        !("v" in data) ||
        data.v !== 1 ||
        !("source" in data) ||
        typeof data.source !== "string" ||
        !data.source.trim() ||
        data.source.length > MAX_SHARED_SOURCE
      )
        throw new Error();
      result.source = data.source;
      result.puzzleId = null;
      result.error = null;
    } catch {
      result.error =
        "Este link de atividade está incompleto ou inválido. Peça um novo link ao professor.";
    }
  }
  return result;
}

export function activityUrl(
  base: string,
  activity: { puzzleId: string; source: string },
  canCheck = true,
): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("modo", "aluno");
  if (!canCheck) url.searchParams.set("conferir", "0");
  if (PUZZLES.some((puzzle) => puzzle.id === activity.puzzleId)) {
    url.searchParams.set("tema", activity.puzzleId);
  } else {
    if (!activity.source.trim() || activity.source.length > MAX_SHARED_SOURCE)
      throw new Error(
        "O conteúdo é muito extenso para compartilhar por link. Reduza para até 12 mil caracteres.",
      );
    const token = LZString.compressToEncodedURIComponent(
      JSON.stringify({ v: 1, source: activity.source }),
    );
    if (token.length > MAX_SHARED_TOKEN)
      throw new Error(
        "O conteúdo é muito extenso para compartilhar por link. Reduza as dicas e tente novamente.",
      );
    url.hash = new URLSearchParams({ atividade: token }).toString();
  }
  return url.href;
}

export function embedUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.set("modo", "aluno");
  url.searchParams.set("incorporar", "1");
  return url.href;
}

function html(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

export function embedCode(href: string, title: string): string {
  const url = new URL(href);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Endereço de incorporação inválido");
  return `<iframe data-cruzadinha-embed src="${html(embedUrl(url.href))}" title="${html(`Palavras Cruzadas — ${title}`)}" width="100%" height="1100" style="border:0;display:block;width:100%;" loading="lazy" allow="fullscreen"></iframe>\n<script async src="${html(new URL("/embed.js", url).href)}"></script>\n<p><a href="${html(url.href)}" target="_blank" rel="noopener">Abrir atividade em uma nova aba</a></p>`;
}

export function activityMessage(title: string, url: string): string {
  return `Atividade: ${title}\nComplete a cruzadinha com base no conteúdo estudado. Seu progresso será salvo neste navegador.\n${url}`;
}
