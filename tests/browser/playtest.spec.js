import { test, expect } from "@playwright/test";

test("title, mode menu, Online notice, and Arcade pause flow", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveTitle("BTA — Belt to Ass");
  await page.getByRole("button", { name: "Start BTA" }).click();
  await expect(page.locator("#front-menu")).toHaveAttribute("data-screen", "intro");
  await expect(page.getByRole("heading", { name: "MAIN MENU" })).toBeVisible({ timeout: 5000 });

  await page.getByRole("button", { name: /ONLINE/ }).click();
  await expect(page.getByText(/NETWORK MATCHMAKING IS NOT CONNECTED YET/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "MAIN MENU" })).toBeVisible();

  await page.getByRole("button", { name: /ARCADE/ }).click();
  await expect(page.getByRole("heading", { name: "SELECT YOUR FIGHTER" })).toBeVisible();
  await expect(page.locator('[data-testid="character-select-player"]')).toHaveAttribute("data-character-id", "striker");
  await page.getByRole("button", { name: /CONFIRM FIGHTER/ }).click();
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
  await expect(page.getByRole("button", { name: "Start BTA" })).toBeVisible();
  await page.keyboard.press("x");
  await expect(page.locator("#front-menu")).toHaveAttribute("data-screen", "intro");
  await expect(page.getByRole("heading", { name: "MAIN MENU" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /TRAINING/ }).click();
  await expect(page.getByRole("heading", { name: "SELECT YOUR FIGHTER" })).toBeVisible();
  await page.getByRole("button", { name: /CONFIRM FIGHTER/ }).click();
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


test("active match visibly renders both fighters and the screen-space HUD", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start BTA" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "MAIN MENU" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /TRAINING/ }).click();
  await expect(page.getByRole("heading", { name: "SELECT YOUR FIGHTER" })).toBeVisible();
  await page.getByRole("button", { name: /CONFIRM FIGHTER/ }).click();
  await expect(page.locator("#engine-status")).toContainText("TRAINING MODE");

  const sampleCanvas = () => page.locator("#game-canvas").evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    const scale = Math.min(rect.width / 960, rect.height / 540);
    const offsetX = (rect.width - 960 * scale) / 2;
    const offsetY = (rect.height - 540 * scale) / 2;
    const ratioX = canvas.width / rect.width;
    const ratioY = canvas.height / rect.height;
    const pixel = (worldX, worldY) => {
      const x = Math.max(0, Math.min(canvas.width - 1, Math.round((worldX * scale + offsetX) * ratioX)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.round((worldY * scale + offsetY) * ratioY)));
      return Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3);
    };
    const transform = context.getTransform();
    return {
      player: pixel(300, 400),
      opponent: pixel(660, 400),
      playerHealth: pixel(60, 35),
      transform: {
        a: transform.a,
        d: transform.d,
        e: transform.e,
        f: transform.f,
        expectedScale: ratioX
      }
    };
  });

  await expect.poll(sampleCanvas).toMatchObject({
    player: [217, 212, 226],
    opponent: [141, 135, 152],
    playerHealth: [217, 212, 226]
  });
  const rendered = await sampleCanvas();
  expect(rendered.transform.e).toBe(0);
  expect(rendered.transform.f).toBe(0);
  expect(Math.abs(rendered.transform.a - rendered.transform.expectedScale)).toBeLessThan(0.01);
  expect(Math.abs(rendered.transform.d - rendered.transform.expectedScale)).toBeLessThan(0.01);
  expect(pageErrors).toEqual([]);
});


test("character select changes the player and opposing fighter before launching", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start BTA" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "MAIN MENU" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /ARCADE/ }).click();
  const playerCard = page.locator('[data-testid="character-select-player"]');
  const opponentCard = page.locator(".character-card--opponent");

  await expect(playerCard).toHaveAttribute("data-character-id", "striker");
  await expect(opponentCard).toHaveAttribute("data-character-id", "cpu-rival");
  await page.keyboard.press("ArrowRight");
  await expect(playerCard).toHaveAttribute("data-character-id", "cpu-rival");
  await expect(opponentCard).toHaveAttribute("data-character-id", "striker");
  await page.getByRole("button", { name: /CONFIRM FIGHTER/ }).click();
  await expect(page.locator("#engine-status")).toContainText("ARCADE MODE");
  await expect(page.locator("#game-canvas")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
