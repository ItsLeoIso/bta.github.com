import { test, expect } from "@playwright/test";

test("title, mode menu, Online notice, and Arcade pause flow", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveTitle("BTA — Belt to Ass");
  await page.getByRole("button", { name: /PRESS ENTER TO START/ }).click();
  await expect(page.getByRole("heading", { name: "MAIN MENU" })).toBeVisible();

  await page.getByRole("button", { name: /ONLINE/ }).click();
  await expect(page.getByText(/NETWORK MATCHMAKING IS NOT CONNECTED YET/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "MAIN MENU" })).toBeVisible();

  await page.getByRole("button", { name: /ARCADE/ }).click();
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#engine-status")).toContainText("ARCADE MODE");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
  await page.getByRole("button", { name: /RESUME/ }).click();
  await expect(page.locator("#front-menu")).toBeHidden();

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /EXIT TO MENU/ }).click();
  await expect(page.getByRole("heading", { name: "MAIN MENU" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("Training starts, resets the dummy, and keeps the canvas sized on mobile-width viewports", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: /PRESS ENTER TO START/ }).click();
  await page.getByRole("button", { name: /TRAINING/ }).click();
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#engine-status")).toContainText("TRAINING MODE");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "PAUSED" })).toBeVisible();
  await page.getByRole("button", { name: /RESET POSITIONS/ }).click();
  await expect(page.locator("#front-menu")).toBeHidden();
  await expect(page.locator("#engine-status")).toContainText("TRAINING MODE");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.locator("#game-canvas").evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && canvas.width > 0 && canvas.height > 0;
  })).toBe(true);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /EXIT TO MENU/ }).click();
  await expect(page.getByRole("heading", { name: "MAIN MENU" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
