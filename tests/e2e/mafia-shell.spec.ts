import { expect, test } from "@playwright/test";

test("renders the secure production entry without horizontal overflow", async ({ page }) => {
  await page.goto("./");

  await expect(page).toHaveTitle('Мафия "Абдулкадыров"');
  await expect(
    page.getByRole("heading", { name: /Вход в игру|Подключите игровой сервер/ })
  ).toBeVisible();
  await expect(page.locator(".mafia-wordmark")).toContainText("MAFIA");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("keeps mobile lobby controls compact and free of horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 345, height: 613 });
  await page.goto("./");
  await page.locator("#root").evaluate((root) => {
    const stableRoot = root.cloneNode(false) as HTMLElement;
    stableRoot.innerHTML = `
      <main class="mafia-page mafia-lobby-page">
        <div class="mafia-game-shell">
          <header class="mafia-room-header">
            <button class="mafia-icon-button">←</button>
            <div class="mafia-room-title"><strong>Вечерняя мафия</strong><button>ⓘ A1B2C3</button></div>
            <div class="mafia-room-header-actions">
              <button class="mafia-icon-button">▦</button>
              <button class="mafia-icon-button">♪</button>
              <button class="mafia-icon-button">⚙</button>
            </div>
          </header>
          <footer class="mafia-action-bar mafia-lobby-actions">
            <div class="mafia-video-controls">
              <button><span>●</span><span class="mafia-action-label--desktop">Микрофон</span><span class="mafia-action-label--mobile">Мик</span></button>
              <button><span>●</span><span class="mafia-action-label--desktop">Камера</span><span class="mafia-action-label--mobile">Кам</span></button>
              <button><span>⚙</span><span class="mafia-action-label--desktop">Устройства</span><span class="mafia-action-label--mobile">Устр.</span></button>
            </div>
            <button class="mafia-secondary-button"><span class="mafia-action-label--desktop">Закрыть вход</span><span class="mafia-action-label--mobile">Закрыть</span></button>
            <button class="mafia-primary-button"><span class="mafia-action-label--desktop">Начать игру</span><span class="mafia-action-label--mobile">Старт</span></button>
          </footer>
        </div>
        <div class="mafia-modal-backdrop mafia-device-backdrop">
          <section class="mafia-modal mafia-device-modal">
            <button class="mafia-modal-close">×</button>
            <span class="mafia-eyebrow">Перед игрой</span>
            <h2>Проверка камеры и микрофона</h2>
            <p>Браузер попросит разрешение. Вы сможете изменить устройства позднее.</p>
            <div class="mafia-device-list">
              <label><strong>Камера</strong><select><option>Системная камера</option></select></label>
              <label><strong>Микрофон</strong><select><option>Системный микрофон</option></select></label>
              <label><strong>Динамик</strong><select><option>Системный динамик</option></select><span>Вывод звука применяется ко всем участникам</span></label>
            </div>
            <div class="mafia-modal-actions">
              <button class="mafia-primary-button">Войти в видеокомнату</button>
              <button class="mafia-secondary-button">Проверить камеру</button>
              <button class="mafia-secondary-button">Проверить микрофон</button>
            </div>
          </section>
        </div>
      </main>`;
    root.replaceWith(stableRoot);
  });

  const geometry = await page.evaluate(() => {
    const footer = document.querySelector<HTMLElement>(".mafia-action-bar")!;
    const modal = document.querySelector<HTMLElement>(".mafia-device-modal")!;
    const icon = document.querySelector<HTMLElement>(".mafia-room-header-actions .mafia-icon-button")!;
    const actionButtons = Array.from(footer.querySelectorAll<HTMLElement>("button"));
    return {
      pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      footerOverflows: footer.scrollWidth > footer.clientWidth,
      modalOverflows: modal.scrollHeight > modal.clientHeight,
      iconFontSize: Number.parseFloat(getComputedStyle(icon).fontSize),
      actionRows: new Set(actionButtons.map((button) => Math.round(button.getBoundingClientRect().top))).size,
      actionButtonWidths: actionButtons.map((button) => Math.round(button.getBoundingClientRect().width)),
    };
  });

  expect(geometry.pageOverflows).toBe(false);
  expect(geometry.footerOverflows).toBe(false);
  expect(geometry.modalOverflows).toBe(false);
  expect(geometry.iconFontSize).toBeGreaterThanOrEqual(20);
  expect(geometry.actionRows).toBe(1);
  expect(Math.max(...geometry.actionButtonWidths) - Math.min(...geometry.actionButtonWidths)).toBeLessThanOrEqual(1);
});

test("shows lobby players as a four-column video grid with overlay details", async ({ page }) => {
  await page.setViewportSize({ width: 345, height: 613 });
  await page.goto("./");
  await page.locator("#root").evaluate((root) => {
    const stableRoot = root.cloneNode(false) as HTMLElement;
    const emptyTiles = Array.from({ length: 7 }, () => `
      <article class="mafia-video-tile mafia-video-tile--empty"><span>＋</span><strong>Свободно</strong></article>
    `).join("");
    stableRoot.innerHTML = `
      <main class="mafia-page mafia-lobby-page">
        <div class="mafia-game-shell">
          <section class="mafia-lobby-main">
            <section class="mafia-video-grid mafia-lobby-player-grid">
              <article class="mafia-video-tile">
                <div class="mafia-video-placeholder"><div class="mafia-avatar mafia-avatar--large">Р</div></div>
                <span class="mafia-video-host-crown">♛</span>
                <button class="mafia-fullscreen-button">⛶</button>
                <div class="mafia-video-label">
                  <div class="mafia-video-identity"><span class="mafia-audio-idle-dot"></span><strong>роза · вы</strong></div>
                  <div class="mafia-video-player-state">
                    <span class="mafia-player-state mafia-player-state--ready">Готов</span>
                    <span class="mafia-video-device-state"><i class="on">● Мик</i><i class="on">● Кам</i><i>◉</i></span>
                  </div>
                </div>
              </article>
              ${emptyTiles}
            </section>
          </section>
        </div>
      </main>`;
    root.replaceWith(stableRoot);
  });

  const geometry = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(".mafia-lobby-player-grid")!;
    const tile = document.querySelector<HTMLElement>(".mafia-video-tile")!;
    const label = document.querySelector<HTMLElement>(".mafia-video-label")!;
    const tileRect = tile.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    return {
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      tiles: grid.children.length,
      labelInsideTile: labelRect.left >= tileRect.left && labelRect.right <= tileRect.right && labelRect.bottom <= tileRect.bottom,
      pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  expect(geometry.columns).toBe(4);
  expect(geometry.tiles).toBe(8);
  expect(geometry.labelInsideTile).toBe(true);
  expect(geometry.pageOverflows).toBe(false);
  await expect(page.locator(".mafia-video-label")).toContainText("роза · вы");
  await expect(page.locator(".mafia-video-label")).toContainText("● Мик");
  await expect(page.locator(".mafia-video-label")).toContainText("● Кам");
});

test("publishes a valid Mafia PWA manifest and service worker", async ({ request }) => {
  const manifestResponse = await request.get("manifest.json");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toContain("Mafia");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192" }),
    expect.objectContaining({ sizes: "512x512" }),
  ]));

  const workerResponse = await request.get("service-worker.js");
  expect(workerResponse.ok()).toBe(true);
  expect(await workerResponse.text()).toContain("isPrivateRequest");
});

test("creates receive-ready WebRTC offers before camera permission is granted", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".mafia-wordmark")).toContainText("MAFIA");
  const sdp = await page.evaluate(async () => {
    const peer = new RTCPeerConnection();
    peer.addTransceiver("audio", { direction: "recvonly" });
    peer.addTransceiver("video", { direction: "recvonly" });
    const offer = await peer.createOffer();
    peer.close();
    return offer.sdp ?? "";
  });

  expect(sdp).toContain("m=audio");
  expect(sdp).toContain("m=video");
});

test("keeps the application shell available offline", async ({ page, context }) => {
  await page.goto("./");
  await expect.poll(async () => {
    try {
      return await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    } catch {
      return false;
    }
  }, { timeout: 15_000 }).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.locator(".mafia-wordmark")).toContainText("MAFIA");
});
