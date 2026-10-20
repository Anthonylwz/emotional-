const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
let server, browser, base;
before(async () => {
  const root = path.resolve(__dirname, "..");
  server = http.createServer((req, res) => {
    const filename = path.resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://local").pathname),
    );
    if (!filename.startsWith(root + path.sep) && filename !== root) {
      res.writeHead(403).end();
      return;
    }
    const file = filename === root ? path.join(root, "index.html") : filename;
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404).end();
        return;
      }
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".jpg": "image/jpeg",
      };
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
      });
      res.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function pageFor(t, options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // External players are mocked: these tests verify our behavior, not third-party availability.
  await page.route(/https:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  t.after(async () => {
    assert.deepEqual(errors, []);
    await context.close();
  });
  return page;
}
test("favorites persist, filter correctly, and can be erased", async (t) => {
  const page = await pageFor(t);
  await page.goto(base);
  assert.equal(await page.locator(".category").count(), 4);
  assert.equal(
    await page.locator("#result-count").textContent(),
    "44 momentos",
  );
  await page.locator(".favorite-button").first().click();
  await page.reload();
  assert.equal(await page.locator("#favorite-count").textContent(), "1");
  await page.locator('[data-filter="favorites"]').click();
  assert.equal(await page.locator(".media-card").count(), 1);
  await page.locator(".favorite-button").click();
  assert.equal(await page.locator("#empty").isVisible(), true);
  assert.equal(
    await page
      .locator("#clear-filters")
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.locator("#clear-filters").click();
  await page.locator(".favorite-button").first().click();
  await page.locator("#open-privacy").click();
  await page.locator("#erase-favorites").click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("emotional:favorites:v1")),
    "[]",
  );
});
test("category loading survives filtering and creator search", async (t) => {
  const page = await pageFor(t);
  await page.goto(base);
  await page
    .locator('[aria-label="Cargar más en Canciones en español"]')
    .click();
  assert.equal(
    await page.locator('section[data-category="spanish"] .media-card').count(),
    6,
  );
  await page.locator('[data-filter="english"]').click();
  await page.locator('[data-filter="spanish"]').click();
  assert.equal(
    await page.locator('section[data-category="spanish"] .media-card').count(),
    6,
  );
  await page.locator('[data-filter="all"]').click();
  await page.locator("#search").fill("leakersclub");
  assert.equal(await page.locator(".media-card").count(), 1);
  assert.match(
    await page.locator(".video-meta h4").textContent(),
    /leakersclub/,
  );
  await page.locator("#search").fill("no-such-creator");
  assert.equal(await page.locator("#empty").isVisible(), true);
});
test("YouTube waits for API, handles player errors, retries and closes with keyboard", async (t) => {
  const page = await pageFor(t);
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      contentType: "text/javascript",
      body: `window.YT={PlayerState:{ENDED:0},Player:function(container,options){window.playersCreated=(window.playersCreated||0)+1;const frame=document.createElement('iframe');frame.title='Mock YouTube';container.replaceWith(frame);this.destroy=()=>frame.remove();this.playVideo=()=>{};setTimeout(()=>{options.events.onReady({target:this});options.events.onError({data:100})},30)}};window.onYouTubeIframeAPIReady();`,
    });
  });
  await page.goto(base);
  assert.equal(await page.locator('script[src*="youtube.com"]').count(), 0);
  const trigger = page.locator(".poster").first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.locator("#retry-player").waitFor({ state: "visible" });
  assert.match(
    await page.locator("#player-status").textContent(),
    /no está disponible/,
  );
  await page.locator("#retry-player").click();
  await page.waitForFunction(() => window.playersCreated === 2);
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !document.querySelector("#player-stage iframe"),
  );
  assert.equal(
    await page.locator("#player-dialog").evaluate((node) => node.open),
    false,
  );
  assert.equal(await page.locator("#player-stage iframe").count(), 0);
  assert.equal(
    await trigger.evaluate((node) => node === document.activeElement),
    true,
  );
});
test("failed API loading exposes a usable direct link", async (t) => {
  const page = await pageFor(t);
  await page.goto(base);
  await page.locator(".poster").first().click();
  await page.locator("#retry-player").waitFor({ state: "visible" });
  assert.match(
    await page.locator("#player-status").textContent(),
    /YouTube no pudo cargarse/,
  );
  assert.match(
    await page.locator("#external-video").getAttribute("href"),
    /youtube.com\/watch\?v=/,
  );
});
test("closing before API readiness does not resurrect a player", async (t) => {
  const page = await pageFor(t);
  await page.route("https://www.youtube.com/iframe_api", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      contentType: "text/javascript",
      body: `window.YT={Player:function(){window.unexpectedPlayer=true}};window.onYouTubeIframeAPIReady();`,
    });
  });
  await page.goto(base);
  await page.locator(".poster").first().click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => !!window.unexpectedPlayer), false);
  assert.equal(await page.locator("#player-stage").textContent(), "");
});
test("mobile layouts fit viewport and Yape dialog traps focus and closes", async (t) => {
  const page = await pageFor(t, { reducedMotion: "reduce" });
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow at ${width}px`,
    );
    assert.equal(
      await page
        .locator(".orbit")
        .first()
        .evaluate((node) => getComputedStyle(node).animationName),
      "none",
    );
    await page.locator("#open-yape").click();
    const bounds = await page.locator("#yape-dialog").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.closest("dialog")?.id),
      "yape-dialog",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .locator("#open-yape")
        .evaluate((node) => node === document.activeElement),
      true,
    );
  }
  if (process.env.SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
    await page.unrouteAll();
    await page.goto(base);
    await page.locator(".poster").first().waitFor();
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images]
          .filter((img) => img.loading !== "lazy")
          .map((img) => img.decode().catch(() => {})),
      );
    });
    await page.locator(".community").scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(process.env.SCREENSHOT_DIR, "emotional-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(process.env.SCREENSHOT_DIR, "emotional-mobile.png"),
      fullPage: true,
    });
  }
});
test("blocked storage does not stop browsing or favoriting", async (t) => {
  const page = await pageFor(t);
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  await page.goto(base);
  await page.locator(".favorite-button").first().click();
  assert.equal(await page.locator("#favorite-count").textContent(), "1");
  assert.match(
    await page.locator("#toast").textContent(),
    /no permite guardarlos/,
  );
});
