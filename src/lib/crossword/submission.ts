import LZString from "lz-string";

export type SubmittedAnswer = {
  number: number;
  direction: "across" | "down";
  clue: string;
  answer: string;
};

export type ActivitySubmission = {
  v: 1;
  title: string;
  student: string;
  classroom: string;
  completeCount: number;
  totalCount: number;
  answers: SubmittedAnswer[];
};

export const MAX_SUBMISSION_TOKEN = 8000;
export const MAX_SUBMISSION_QR_LENGTH = 1800;

export function submissionUrl(base: string, submission: ActivitySubmission): string | null {
  try {
    const url = new URL(base);
    const token = LZString.compressToEncodedURIComponent(JSON.stringify(submission));
    if (!token || token.length > MAX_SUBMISSION_TOKEN) return null;
    const basePath = url.pathname.replace(/\/+$/, "");
    url.pathname = `${basePath}/entrega` || "/entrega";
    url.search = "";
    url.hash = new URLSearchParams({ resposta: token }).toString();
    return url.href.length <= MAX_SUBMISSION_QR_LENGTH ? url.href : null;
  } catch {
    return null;
  }
}

export function readSubmission(token: string): ActivitySubmission | null {
  if (!token || token.length > MAX_SUBMISSION_TOKEN || !/^[A-Za-z0-9+\-$% ]+$/.test(token))
    return null;
  try {
    const decoded = LZString.decompressFromEncodedURIComponent(token);
    if (!decoded || decoded.length > 50_000) return null;
    const value: unknown = JSON.parse(decoded);
    if (!value || typeof value !== "object") return null;
    const data = value as Record<string, unknown>;
    if (
      data.v !== 1 ||
      typeof data.title !== "string" || data.title.length > 180 ||
      typeof data.student !== "string" || data.student.length > 100 ||
      typeof data.classroom !== "string" || data.classroom.length > 80 ||
      !Number.isInteger(data.completeCount) || !Number.isInteger(data.totalCount) ||
      !Array.isArray(data.answers) || data.answers.length > 100
    ) return null;

    const answers: SubmittedAnswer[] = [];
    for (const item of data.answers) {
      if (!item || typeof item !== "object") return null;
      const answer = item as Record<string, unknown>;
      if (
        !Number.isInteger(answer.number) ||
        (answer.direction !== "across" && answer.direction !== "down") ||
        typeof answer.clue !== "string" || answer.clue.length > 500 ||
        typeof answer.answer !== "string" || answer.answer.length > 60
      ) return null;
      answers.push({
        number: answer.number as number,
        direction: answer.direction,
        clue: answer.clue,
        answer: answer.answer,
      });
    }

    const completeCount = data.completeCount as number;
    const totalCount = data.totalCount as number;
    if (completeCount < 0 || totalCount < 0 || completeCount > totalCount || totalCount !== answers.length)
      return null;

    return {
      v: 1,
      title: data.title,
      student: data.student,
      classroom: data.classroom,
      completeCount,
      totalCount,
      answers,
    };
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

export function submissionText(submission: ActivitySubmission) {
  const section = (direction: SubmittedAnswer["direction"], title: string) => {
    const entries = submission.answers.filter((item) => item.direction === direction);
    return entries.length
      ? [title, ...entries.flatMap((item) => [
          `${item.number}. ${item.clue}`,
          `Resposta: ${/^_+$/.test(item.answer) ? "(nÃ£o preenchida)" : item.answer.replace(/_/g, "□")}`,
          "",
        ])]
      : [];
  };
  return [
    "ATIVIDADE DE PALAVRAS CRUZADAS",
    `Atividade: ${submission.title}`,
    `Nome: ${submission.student || "(nÃ£o informado)"}`,
    `Turma: ${submission.classroom || "(nÃ£o informada)"}`,
    `Palavras preenchidas: ${submission.completeCount} de ${submission.totalCount}`,
    "",
    ...section("across", "HORIZONTAIS"),
    ...section("down", "VERTICAIS"),
  ].join("\n");
}

export function submissionHtml(submission: ActivitySubmission) {
  const text = escapeHtml(submissionText(submission));
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(submission.title)} — Respostas</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; background: #fff; color: #24211d; }
    body { max-width: 760px; margin: 0 auto; padding: 28px 20px; line-height: 1.65; background: #fff; color: #24211d; }
    h1 { font-size: 1.35rem; margin: 0 0 1rem; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
    @media print { body { max-width: none; padding: 0; } }
  </style>
</head>
<body><h1>Respostas da atividade</h1><pre>${text}</pre></body>
</html>`;
}
