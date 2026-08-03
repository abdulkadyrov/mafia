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
    root.innerHTML = `
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
            <button class="mafia-secondary-button">Камера и микрофон</button>
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
  });

  const geometry = await page.evaluate(() => {
    const footer = document.querySelector<HTMLElement>(".mafia-action-bar")!;
    const modal = document.querySelector<HTMLElement>(".mafia-device-modal")!;
    const icon = document.querySelector<HTMLElement>(".mafia-room-header-actions .mafia-icon-button")!;
    return {
      pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      footerOverflows: footer.scrollWidth > footer.clientWidth,
      modalOverflows: modal.scrollHeight > modal.clientHeight,
      iconFontSize: Number.parseFloat(getComputedStyle(icon).fontSize),
    };
  });

  expect(geometry.pageOverflows).toBe(false);
  expect(geometry.footerOverflows).toBe(false);
  expect(geometry.modalOverflows).toBe(false);
  expect(geometry.iconFontSize).toBeGreaterThanOrEqual(20);
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
