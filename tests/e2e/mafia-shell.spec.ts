import { expect, test } from "@playwright/test";

test("renders the secure production entry without horizontal overflow", async ({ page }) => {
  await page.goto("./");

  await expect(page).toHaveTitle('Мафия "Абдулкадыров"');
  await expect(
    page.getByRole("heading", { name: /Вход по телефону|Подключите игровой сервер/ })
  ).toBeVisible();
  await expect(page.locator(".mafia-wordmark")).toContainText("MAFIA");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
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
