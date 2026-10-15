import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { activityUrl, readActivityLocation } from "../src/lib/crossword/sharing.ts";

const url = process.argv[2] || "http://127.0.0.1:8080/";
if (
  !/^http:\/\/127\.0\.0\.1:808[01]\/$/.test(url) &&
  !["https://cruzadinha-escaninho.vercel.app/", "https://cruzadinha.professorjoas.com.br/"].includes(url)
)
  throw new Error("Use o servidor local ou o domínio publicado da atividade");
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.QA_BROWSER_PATH,
});
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Palavras Cruzadas", exact: true }).waitFor();
    await page.getByText("Atividade do aluno", { exact: false }).waitFor();
    for (const name of ["Revelar", "Gabarito", "Conteúdo", "Compartilhar atividade"])
      assert.equal(await page.getByRole("button", { name, exact: true }).count(), 0);
    await page.screenshot({
      path: `screenshots/student-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    await page.goto(new URL("?modo=professor", url).href, { waitUntil: "networkidle" });
    await page.getByText("Área do professor", { exact: false }).waitFor();
    const grid = page.getByRole("group", { name: "O Iluminismo", exact: true });
    const first = grid.locator('button[tabindex="0"]');
    const label = await first.getAttribute("aria-label");
    assert.match(label, /Linha \d+, coluna \d+/);
    await first.focus();
    await page.keyboard.press("a");
    await page.keyboard.press("Tab");
    assert.equal(await grid.evaluate((node) => node.contains(document.activeElement)), false);
    await page.getByRole("button", { name: "Gabarito", exact: true }).click();
    await page.reload({ waitUntil: "networkidle" });
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("palavras-cruzadas-v1")),
    );
    assert.ok(Object.values(saved.helped).includes(true));
    assert.ok(Object.values(saved.progress).some((board) => Object.values(board).includes("A")));
    await page.getByRole("button", { name: "Conteúdo", exact: true }).click();
    const editor = page.getByRole("textbox", { name: "Lista de palavras e dicas" });
    await editor.fill("CASA | lar | 1,1,H\nSOL | estrela | 1,1,V");
    assert.equal(await page.getByRole("button", { name: "Montar grade" }).isDisabled(), true);
    assert.match(await page.locator("#editor-feedback").innerText(), /Linha 2/);
    await editor.fill("AAA | primeira\nBBB | segunda");
    assert.match(await page.locator("#editor-feedback").innerText(), /Sem encaixe/);
    await editor.fill("# Teste\nCASA | lar | 1,1,H\nAMOR | afeto | 1,2,V");
    await page.getByRole("button", { name: "Montar grade" }).click();
    await page.getByRole("heading", { name: "Teste", exact: true }).waitFor();
    await page
      .getByRole("group", { name: "Teste", exact: true })
      .locator('button[tabindex="0"]')
      .press("x");
    await page.getByRole("button", { name: "Compartilhar atividade", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const studentLink = dialog.getByRole("textbox", { name: "Link para os alunos" });
    const sharedUrl = await studentLink.inputValue();
    assert.match(readActivityLocation(sharedUrl).source, /CASA/);
    assert.equal(readActivityLocation(sharedUrl).teacher, false);
    assert.equal(await dialog.locator("svg[role=img], .share-qr svg").count(), 1);
    await dialog.getByRole("button", { name: "Copiar link", exact: true }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), sharedUrl);
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Baixar QR code" }).click();
    assert.equal((await downloadPromise).suggestedFilename(), "qr-cruzadinha-escaninho.svg");
    const whatsapp = await dialog.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
    assert.ok(new URL(whatsapp).searchParams.get("text").includes(sharedUrl));
    await dialog.getByLabel("Permitir que os alunos confiram as respostas").uncheck();
    const noCheckUrl = await studentLink.inputValue();
    await dialog.getByText("Incorporar em uma página do site", { exact: true }).click();
    const code = await dialog.getByRole("textbox", { name: "Código de incorporação" }).inputValue();
    assert.ok(code.includes("incorporar=1"));
    await dialog.getByRole("button", { name: "Apresentar para a turma" }).click();
    await dialog.getByRole("heading", { name: "Teste", exact: true }).waitFor();
    assert.equal(await dialog.evaluate((node) => node.scrollWidth > node.clientWidth), false);
    await page.screenshot({
      path: `screenshots/share-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    const student = await context.newPage();
    student.on("pageerror", (error) => errors.push(error.message));
    await student.goto(noCheckUrl, { waitUntil: "networkidle" });
    await student.getByRole("heading", { name: "Teste", exact: true }).waitFor();
    for (const name of ["Revelar", "Gabarito", "Conteúdo", "Conferir"])
      assert.equal(await student.getByRole("button", { name, exact: true }).count(), 0);
    assert.equal(
      await student
        .locator(".sq-letter")
        .allTextContents()
        .then((letters) => letters.every((letter) => letter === "")),
      true,
    );
    await student
      .getByRole("group", { name: "Teste", exact: true })
      .locator('button[tabindex="0"]')
      .press("c");
    await student.reload({ waitUntil: "networkidle" });
    await student.getByRole("heading", { name: "Teste", exact: true }).waitFor();
    assert.ok((await student.locator(".sq-letter").allTextContents()).includes("C"));
    const changed = activityUrl(url, {
      puzzleId: "custom",
      source: "# Outra atividade\nCASA | lar | 1,1,H\nAMOR | afeto | 1,2,V",
    });
    await student.evaluate((next) => { window.location.hash = new URL(next).hash; }, changed);
    await student.getByRole("heading", { name: "Outra atividade", exact: true }).waitFor();
    await student.goto(new URL("?tema=grecia", url).href, { waitUntil: "networkidle" });
    await student.getByRole("heading", { name: "Grécia antiga", exact: true }).waitFor();
    await student.goto(new URL("#atividade=quebrado", url).href, { waitUntil: "networkidle" });
    await student.getByRole("heading", { name: "Atividade indisponível" }).waitFor();
    // Test the complete parent/iframe height protocol with the real embed helper.
    const host = new URL("/__qa_embed", url).href;
    await student.route(host, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><body>${code}</body></html>`,
      }),
    );
    await student.goto(host, { waitUntil: "networkidle" });
    const frame = student.frameLocator("iframe[data-cruzadinha-embed]");
    await frame.getByRole("heading", { name: "Teste", exact: true }).waitFor();
    assert.equal(await frame.getByRole("button", { name: "Gabarito", exact: true }).count(), 0);
    await student.waitForFunction(() => document.querySelector("iframe").style.height !== "");
    assert.ok(
      await student.locator("iframe").evaluate((node) => parseInt(node.style.height, 10) > 100),
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({
      path: `screenshots/current-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `${mobile ? "Mobile" : "Desktop"}: modos, compartilhamento, QR, conteúdo personalizado, persistência e incorporação OK`,
    );
  }
} finally {
  await browser.close();
}
