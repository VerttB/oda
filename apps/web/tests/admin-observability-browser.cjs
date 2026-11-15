// Fixtures exclusivas deste teste: nenhuma API real é acessada.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createRequire } = require("node:module");
const path = require("node:path");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");
const { chromium } = createRequire(
  path.resolve(__dirname, "../../scraper/package.json"),
)("playwright");
const base = process.env.WEB_TEST_URL || "http://127.0.0.1:4013";
test("painel administrativo mostra dados, paginação, filtros, falha de Redis e exportação", async () => {
  let server, browser;
  try {
    if (!process.env.WEB_TEST_URL) {
      const vite = path.join(
        path.dirname(
          createRequire(path.resolve(__dirname, "../package.json")).resolve(
            "vite/package.json",
          ),
        ),
        "bin/vite.js",
      );
      server = spawn(
        process.execPath,
        [vite, "--host", "127.0.0.1", "--port", "4013", "--strictPort"],
        {
          cwd: path.resolve(__dirname, ".."),
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      let startup = "";
      server.stdout.on("data", (chunk) => {
        startup = (startup + chunk).slice(-4000);
      });
      server.stderr.on("data", (chunk) => {
        startup = (startup + chunk).slice(-4000);
      });
      let ready = false;
      for (let n = 0; n < 160; n++) {
        if (server.exitCode !== null) break;
        try {
          if (
            (
              await fetch(base + "/@vite/client", {
                signal: AbortSignal.timeout(1000),
              })
            ).ok
          ) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 250));
      }
      assert.ok(ready, "Frontend de teste não iniciou. " + startup);
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(() =>
      sessionStorage.setItem("oda.admin.access-token", "token-de-teste"),
    );
    let redisDown = false,
      exports = 0;
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/")) {
        assert.ok(route.request().headers().authorization);
        let body = {};
        if (url.pathname.endsWith("/admin/logs/metricas"))
          body = {
            serie: [
              {
                dia: "2026-11-12",
                processamento: "ETL_PESQUISADORES",
                escopo: "default",
                sucessos: 8,
                falhas: 2,
                processados: 10,
              },
            ],
            errosPorTipoRetidos: [{ tipoErro: "FALHA_ETL", total: 2 }],
            resumo: {
              processados: 10,
              sucessos: 8,
              falhas: 2,
              taxaSucesso: 80,
            },
          };
        if (url.pathname.endsWith("/admin/logs/execucoes"))
          body = {
            total: 26,
            pagina: 1,
            limite: 25,
            dados: [
              {
                id: "lote-teste",
                modulo: "ETL",
                status: "CONCLUIDO",
                inicio: "2026-11-12",
                sucessos: 8,
                falhas: 2,
              },
            ],
          };
        if (url.pathname.endsWith("/admin/filas")) {
          if (redisDown)
            return route.fulfill({
              status: 503,
              contentType: "application/json",
              body: "{}",
            });
          body = {
            total: 1,
            filas: [
              {
                fila: "etl-pesquisadores",
                estado: "PROCESSANDO",
                workersAtivos: 1,
                concorrenciaGlobal: 2,
                contadores: {
                  waiting: 2000,
                  active: 1,
                  prioritized: 0,
                  paused: 0,
                  failed: 2,
                },
              },
            ],
          };
        }
        if (url.pathname.endsWith("/admin/consistencia-dados/ultima"))
          body = {
            estado: "PARCIAL",
            finalizadoEm: "2026-11-12",
            resultado: {
              metricas: [],
              alertas: [
                {
                  dgpId: "1234567890123456",
                  regra: "SEM_LIDER",
                  mensagem: "Grupo sem líder cadastrado.",
                },
              ],
            },
          };
        if (url.pathname.endsWith("/itens"))
          body = {
            total: 26,
            pagina: 1,
            limite: 25,
            dados: [
              {
                id: "item-teste",
                entidadeId: "1234567890123456",
                status: "ERRO",
                etapa: "ETL_GRUPO_CARGA",
                mensagemErro: "Falha simulada para teste",
              },
            ],
          };
        if (url.pathname.endsWith("/exportacao")) {
          exports++;
          return route.fulfill({
            contentType: "text/csv",
            headers: {
              "Content-Disposition": "attachment; filename=oda-pipelines.csv",
            },
            body: "id,status\nteste,ERRO",
          });
        }
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      }
      if (url.origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/admin/");
    await page
      .getByRole("heading", { name: "Operação e qualidade dos dados" })
      .waitFor();
    await page.getByText("2000 aguardando", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Ver itens", exact: true }).click();
    await page.getByText("Falha simulada para teste").waitFor();
    await page
      .getByRole("button", { name: "Próxima", exact: true })
      .last()
      .click();
    await page.getByText("Página 2", { exact: true }).waitFor();
    await page
      .getByLabel("Processamento", { exact: true })
      .selectOption("ETL_PESQUISADORES");
    assert.equal(
      new URL(page.url()).searchParams.get("processamento"),
      "ETL_PESQUISADORES",
    );
    await page
      .getByText("Grupo sem líder cadastrado.", { exact: false })
      .waitFor();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Exportar CSV", exact: true })
      .click();
    await download;
    assert.equal(exports, 1);
    const audit = path.resolve(__dirname, "../../../audit/observabilidade");
    await fs.mkdir(audit, { recursive: true });
    await page.screenshot({
      path: path.join(audit, "desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(
      () => document.querySelector("aside")?.getBoundingClientRect().right <= 0,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "A página não deve transbordar horizontalmente no celular.",
    );
    await page.screenshot({
      path: path.join(audit, "mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    redisDown = true;
    await page.reload();
    await page
      .getByText("O histórico permanece disponível.", { exact: false })
      .waitFor({ timeout: 25000 });
    await page
      .getByRole("heading", { name: "Execuções", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
});
