import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { buildPuzzle } from "./engine";

const MAX_SOURCE_LENGTH = 40_000;
const CURATOR_COOKIE = "__Host-crossword-curator";
const SESSION_SECONDS = 60 * 60 * 24 * 14;

function curatorEmails() {
  return new Set(
    (process.env.CURATOR_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  );
}

function curatorPassword() {
  const password = process.env.CURATOR_PASSWORD?.trim();
  return password && password.length >= 16 ? password : null;
}

async function assertSameSite() {
  const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
  assertSameSiteRequest();
}

async function readCuratorSession() {
  const password = curatorPassword();
  if (!password || curatorEmails().size === 0) return null;

  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(CURATOR_COOKIE);
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", password).update(payload).digest("base64url");
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof session.email !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now() ||
      !curatorEmails().has(session.email)
    ) {
      return null;
    }
    return session.email;
  } catch {
    return null;
  }
}

async function createCuratorSession(email: string) {
  const password = curatorPassword();
  if (!password) throw new Error("A senha do curador não está configurada.");
  const payload = Buffer.from(
    JSON.stringify({ email, expiresAt: Date.now() + SESSION_SECONDS * 1000 }),
  ).toString("base64url");
  const { createHmac } = await import("node:crypto");
  const signature = createHmac("sha256", password).update(payload).digest("base64url");
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(CURATOR_COOKIE, `${payload}.${signature}`, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_SECONDS,
  });
}

const curatorMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    await assertSameSite();
    const email = await readCuratorSession();
    if (!email) throw new Error("Entre na área do curador para administrar a galeria.");
    return next({ context: { curatorEmail: email } });
  },
);

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

export const getCuratorAccess = createServerFn({ method: "GET" }).handler(async () => ({
  configured: Boolean(curatorPassword() && curatorEmails().size),
  allowed: Boolean(await readCuratorSession()),
}));

export const loginCurator = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => {
    if (
      typeof input?.email !== "string" ||
      typeof input?.password !== "string" ||
      input.email.length > 254 ||
      input.password.length > 256
    ) {
      throw new Error("Informe um e-mail e uma senha válidos.");
    }
    return input;
  })
  .handler(async ({ data }) => {
    await assertSameSite();
    const email = data.email.trim().toLocaleLowerCase("en-US");
    const allowed = curatorEmails().has(email);
    const configuredPassword = curatorPassword();
    if (!configuredPassword || curatorEmails().size === 0) {
      return {
        ok: false as const,
        message: "O acesso do curador ainda não foi configurado na Vercel.",
      };
    }

    const { timingSafeEqual } = await import("node:crypto");
    const submitted = Buffer.from(data.password);
    const expected = Buffer.from(configuredPassword);
    const passwordMatches =
      submitted.length === expected.length && timingSafeEqual(submitted, expected);
    if (!allowed || !passwordMatches) {
      return { ok: false as const, message: "E-mail ou senha incorretos." };
    }

    await createCuratorSession(email);
    return { ok: true as const };
  });

export const logoutCurator = createServerFn({ method: "POST" })
  .middleware([curatorMiddleware])
  .handler(async () => {
    const { deleteCookie } = await import("@tanstack/react-start/server");
    deleteCookie(CURATOR_COOKIE, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
    return { ok: true };
  });

export const saveCuratedActivity = createServerFn({ method: "POST" })
  .validator((input: { id?: string; source: string }) => input)
  .middleware([curatorMiddleware])
  .handler(async ({ data }) => {
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
  .middleware([curatorMiddleware])
  .handler(async ({ data }) => {
    await requirePersistentDatabase();
    if (!data.id.startsWith("public-")) throw new Error("Identificador de atividade inválido.");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query("delete from curated_crossword where id = $1", [
      data.id.slice("public-".length),
    ]);
    return { ok: true };
  });
