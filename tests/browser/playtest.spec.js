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
  await expect(page.getByRole("heading", { name: /ONLINE · 1V1 ROLLBACK/ })).toBeVisible();
  await expect(page.getByTestId("online-create-invite")).toBeVisible();
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

test("two peers connect via WebRTC Direct Invite, run a live online rollback match, and handle forfeit cleanly", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();
  const pageErrors = [];
  hostPage.on("pageerror", error => pageErrors.push("host: " + error.message));
  guestPage.on("pageerror", error => pageErrors.push("guest: " + error.message));

  const openOnlineLobby = async page => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Start BTA" })).toBeVisible();
    await page.getByRole("button", { name: "Start BTA" }).click();
    await expect(page.getByRole("heading", { name: "MAIN MENU" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /ONLINE/ }).click();
    await expect(page.getByRole("heading", { name: /ONLINE · 1V1 ROLLBACK/ })).toBeVisible();
  };

  try {
    await Promise.all([openOnlineLobby(hostPage), openOnlineLobby(guestPage)]);

    // 1. Host creates Direct Invite code
    await hostPage.getByTestId("online-create-invite").click();
    await expect.poll(async () => (await hostPage.getByTestId("online-offer-output").inputValue()).startsWith("BTA1:"), { timeout: 10000 }).toBe(true);
    const offerCode = await hostPage.getByTestId("online-offer-output").inputValue();

    // 2. Guest pastes offer and creates Answer code
    await guestPage.getByTestId("online-offer-input").fill(offerCode);
    await guestPage.getByTestId("online-create-answer").click();
    await expect.poll(async () => (await guestPage.getByTestId("online-answer-output").inputValue()).startsWith("BTA1:"), { timeout: 10000 }).toBe(true);
    const answerCode = await guestPage.getByTestId("online-answer-output").inputValue();

    // 3. Host applies Answer -> real WebRTC P2P DataChannels open -> both enter Online Character Select
    await hostPage.getByTestId("online-answer-input").fill(answerCode);
    await hostPage.getByTestId("online-connect-answer").click();

    await expect(hostPage.getByRole("heading", { name: /ONLINE · SELECT YOUR FIGHTER/ })).toBeVisible({ timeout: 10000 });
    await expect(guestPage.getByRole("heading", { name: /ONLINE · SELECT YOUR FIGHTER/ })).toBeVisible({ timeout: 10000 });

    // 4. Both peers click Ready -> MATCH_CONFIG handshake completes -> live 60 Hz rollback match launches
    await hostPage.getByTestId("online-ready-btn").click();
    await guestPage.getByTestId("online-ready-btn").click();

    await expect(hostPage.locator("#engine-status")).toContainText("ONLINE ROLLBACK", { timeout: 10000 });
    await expect(guestPage.locator("#engine-status")).toContainText("ONLINE ROLLBACK", { timeout: 10000 });
    await expect(hostPage.locator("#game-canvas")).toBeVisible();
    await expect(guestPage.locator("#game-canvas")).toBeVisible();

    // 5. Exchange real keyboard inputs for >1s over WebRTC DataChannels (passing 60+ frames & checksums)
    await hostPage.keyboard.down("KeyD");
    await guestPage.keyboard.down("KeyA");
    await hostPage.waitForTimeout(350);
    await hostPage.keyboard.press("KeyH");
    await guestPage.keyboard.press("KeyJ");
    await hostPage.waitForTimeout(800);
    await hostPage.keyboard.up("KeyD");
    await guestPage.keyboard.up("KeyA");

    await expect(hostPage.locator("#engine-status")).not.toContainText("DESYNC");
    await expect(guestPage.locator("#engine-status")).not.toContainText("DESYNC");

    // 6. Host opens non-blocking Online Menu and Forfeits -> Guest sees forfeit disconnect cleanly
    await hostPage.keyboard.press("Escape");
    await expect(hostPage.getByRole("heading", { name: "ONLINE MENU" })).toBeVisible();
    await hostPage.getByRole("button", { name: /FORFEIT & EXIT/ }).click();
    await expect(hostPage.getByRole("heading", { name: "MAIN MENU" })).toBeVisible();
    await expect(guestPage.locator("#online-match-bar")).toContainText(/FORFEITED|DISCONNECTED/i, { timeout: 8000 });

    expect(pageErrors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
