import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { buildPuzzle } from "./engine";

const MAX_SOURCE_LENGTH = 40_000;

function curatorEmails() {
  return new Set(
    (process.env.CURATOR_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  );
}

async function requireCurator(bearerToken?: string) {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const user = await getSessionUser(bearerToken);
  const email = user?.email?.trim().toLocaleLowerCase("en-US");
  if (!email || !curatorEmails().has(email)) {
    throw new Error("Acesso restrito ao curador da galeria.");
  }
}

async function requirePersistentDatabase() {
  const { dbSource } = await import("@/lib/db");
  if (dbSource !== "neon") {
    throw new Error(
      "A galeria permanente precisa de um banco Neon configurado no Vercel (DATABASE_URL).",
    );
  }
}

function validateSource(source: unknown): asserts source is string {
  if (typeof source !== "string" || source.length === 0 || source.length > MAX_SOURCE_LENGTH) {
    throw new Error("O conteúdo da atividade está vazio ou excede o limite permitido.");
  }
  const puzzle = buildPuzzle(source);
  if (!puzzle.words.length || puzzle.issues.length || puzzle.omitted.length) {
    throw new Error("Corrija as palavras e dicas antes de publicar na galeria.");
  }
}

export const listCuratedActivities = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql.query<{ id: string; source: string }>(
    "select id, source from curated_crossword order by created_at asc, id asc",
  );
  return rows.map((row) => ({ id: `public-${row.id}`, source: row.source }));
});

export const getCuratorAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const user = await getSessionUser(context.bearerToken);
    const email = user?.email?.trim().toLocaleLowerCase("en-US");
    return { allowed: Boolean(email && curatorEmails().has(email)) };
  });

export const saveCuratedActivity = createServerFn({ method: "POST" })
  .validator((input: { id?: string; source: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireCurator(context.bearerToken);
    await requirePersistentDatabase();
    validateSource(data.source);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const id = data.id?.startsWith("public-") ? data.id.slice("public-".length) : "";
    if (id) {
      const rows = await sql.query<{ id: string }>(
        "update curated_crossword set source = $1, updated_at = now() where id = $2 returning id",
        [data.source, id],
      );
      if (!rows.length) throw new Error("Esta atividade já não existe na galeria.");
      return { id: `public-${id}`, source: data.source };
    }
    const newId = crypto.randomUUID();
    await sql.query("insert into curated_crossword (id, source) values ($1, $2)", [
      newId,
      data.source,
    ]);
    return { id: `public-${newId}`, source: data.source };
  });

export const deleteCuratedActivity = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireCurator(context.bearerToken);
    await requirePersistentDatabase();
    if (!data.id.startsWith("public-")) throw new Error("Identificador de atividade inválido.");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query("delete from curated_crossword where id = $1", [
      data.id.slice("public-".length),
    ]);
    return { ok: true };
  });
