import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://127.0.0.1:8080/";
if (!/^http:\/\/127\.0\.0\.1:808[01]\/$/.test(url)) throw new Error("Use o servidor local da atividade");
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER_PATH });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Palavras Cruzadas", exact: true }).waitFor();
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
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("palavras-cruzadas-v1")));
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
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `screenshots/current-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`${mobile ? "Mobile" : "Desktop"}: navegação, persistência, editor e renderização OK`);
  }
} finally {
  await browser.close();
}
