import assert from "node:assert/strict";
import { chromium } from "playwright";
import { activityUrl } from "../src/lib/crossword/sharing.ts";

const site = process.argv[2] || "http://127.0.0.1:4321/";
if (!["http://127.0.0.1:4321/", "https://www.escaninhodigital.com.br/"].includes(site))
  throw new Error("Domínio de teste inválido");
const app = "https://cruzadinha-escaninho.vercel.app";
const localApp = process.env.LOCAL_EMBED_ORIGIN;
if (localApp && !/^http:\/\/127\.0\.0\.1:808[01]$/.test(localApp))
  throw new Error("Origem local inválida");
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.QA_BROWSER_PATH,
});
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    });
    if (localApp)
      await context.route(`${app}/**`, async (route) => {
        const response = await route.fetch({ url: route.request().url().replace(app, localApp) });
        await route.fulfill({ response });
      });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL("acervo/atividades-e-jogos/", site).href, { waitUntil: "networkidle" });
    const resource = page.getByRole("link", { name: /Resolver cruzadinha/ });
    assert.equal(await resource.getAttribute("href"), "/atividades/cruzadinha/");
    await resource.click();
    const iframe = page.locator("#crossword-frame");
    const frame = page.frameLocator("#crossword-frame");
    await frame.getByRole("heading", { name: "O Iluminismo", exact: true }).waitFor();
    for (const name of ["Revelar", "Gabarito", "Conteúdo"])
      assert.equal(await frame.getByRole("button", { name, exact: true }).count(), 0);
    await page.waitForFunction(
      () => document.querySelector("#crossword-frame").style.height !== "",
    );
    const height = await iframe.evaluate((node) => node.style.height);
    await page.evaluate(() =>
      window.postMessage({ type: "escaninho:crossword:resize", height: 15000 }, "*"),
    );
    assert.equal(await iframe.evaluate((node) => node.style.height), height);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await frame.getByRole("group", { name: "O Iluminismo", exact: true }).screenshot({
      path: `screenshots/escaninho-grid-${mobile ? "mobile" : "desktop"}.png`,
    });
    await page.screenshot({
      path: `screenshots/escaninho-${mobile ? "mobile" : "desktop"}.png`,
      fullPage: true,
    });
    await page.goto(new URL("atividades/cruzadinha/?tema=grecia&conferir=0", site).href, {
      waitUntil: "networkidle",
    });
    await frame.getByRole("heading", { name: "Grécia antiga", exact: true }).waitFor();
    assert.equal(await frame.getByRole("button", { name: "Conferir", exact: true }).count(), 0);
    const shared = new URL(
      activityUrl(app, {
        puzzleId: "custom",
        source: "# Atividade compartilhada\nCASA | lar | 1,1,H\nAMOR | afeto | 1,2,V",
      }),
    );
    const embedded = new URL("atividades/cruzadinha/", site);
    embedded.hash = shared.hash;
    await page.goto(embedded.href, { waitUntil: "networkidle" });
    await frame.getByRole("heading", { name: "Atividade compartilhada", exact: true }).waitFor();
    assert.equal(
      new URL(await page.locator("#crossword-open").getAttribute("href")).hash,
      shared.hash,
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `${mobile ? "Mobile" : "Desktop"}: catálogo do Escaninho, incorporação, altura, temas e links personalizados OK`,
    );
  }
} finally {
  await browser.close();
}
