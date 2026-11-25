import test from "node:test";
import assert from "node:assert/strict";
import { Arena, MAX_FIGHTER_SEPARATION, resolveFighterSeparation } from "../src/engine/Arena.js";
import { INPUT_BITS, BitmaskInputAdapter } from "../src/input/BitmaskInput.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function stepMasks(arena, p1Adapter, p2Adapter, p1Mask = 0, p2Mask = 0, dt = 1 / 60) {
  arena.update(dt, p1Adapter.nextFrame(p1Mask), p2Adapter.nextFrame(p2Mask));
}

test("Arena assigns canonical Slot 0 and Slot 1 identities and exposes fighters array", () => {
  const arena = new Arena({ playerCharacterId: "striker", opponentCharacterId: "striker" });
  assert.equal(arena.player.slot, 0);
  assert.equal(arena.opponent.slot, 1);
  assert.equal(arena.fighters[0], arena.player);
  assert.equal(arena.fighters[1], arena.opponent);
});

test("Slot 1 executes facing-relative QCF Arc Lance through the shared input pipeline", () => {
  const arena = new Arena({ playerCharacterId: "striker", opponentCharacterId: "striker" });
  const p1 = new BitmaskInputAdapter();
  const p2 = new BitmaskInputAdapter();

  arena.player.x = 600;
  arena.opponent.x = 1100;

  // Slot 1 faces left (-1): QCF is crouch -> crouch+left -> left+special.
  stepMasks(arena, p1, p2, 0, INPUT_BITS.crouch);
  stepMasks(arena, p1, p2, 0, INPUT_BITS.crouch | INPUT_BITS.left);
  stepMasks(arena, p1, p2, 0, INPUT_BITS.left | INPUT_BITS.special);

  assert.equal(arena.opponent.state.action, STATES.action.SPECIAL);
  assert.equal(arena.opponent.actionData.moveId, "arcLance");
  assert.equal(arena.opponent.actionData.moveName, "Arc Lance");
  assert.equal(arena.opponent.actionData.startupFrames, 14);
  assert.equal(arena.commandFeedbackText, "ARC LANCE");

  for (let frame = 0; frame < 13; frame += 1) stepMasks(arena, p1, p2, 0, 0);
  assert.equal(arena.projectileController.projectiles.length, 1);
  const projectile = arena.projectileController.projectiles[0];
  assert.equal(projectile.owner, arena.opponent);
  assert.equal(projectile.moveId, "arcLance");
  assert.equal(projectile.velocityX, -390);
  assert.equal(projectile.radius, 26);

  // Let the Arc Lance travel into Slot 0 and deal its 14% hit damage.
  let hit = null;
  for (let frame = 0; frame < 90 && !hit; frame += 1) {
    stepMasks(arena, p1, p2, 0, 0);
    if (arena.lastCombatEvent?.moveId === "arcLance") hit = arena.lastCombatEvent;
  }
  assert.ok(hit, "Slot 1 Arc Lance should connect with Slot 0");
  assert.equal(hit.type, "hit");
  assert.equal(hit.attacker, arena.opponent);
  assert.equal(hit.defender, arena.player);
  assert.ok(Math.abs(arena.player.health - 0.86) < 1e-9);
});

test("Slot 1 buffers attacks during recovery and cancels confirmed hits into specials", () => {
  const arena = new Arena({ playerCharacterId: "striker", opponentCharacterId: "striker" });
  const p1 = new BitmaskInputAdapter();
  const p2 = new BitmaskInputAdapter();

  // Put Slot 1 in range of Slot 0 to test hit-confirm Light -> Special cancel.
  arena.player.x = 800;
  arena.opponent.x = 910;

  stepMasks(arena, p1, p2, 0, INPUT_BITS.light);
  let lightHit = false;
  for (let frame = 0; frame < 8 && !lightHit; frame += 1) {
    stepMasks(arena, p1, p2, 0, 0);
    lightHit ||= arena.opponent.actionData?.hitOutcome === "hit";
  }
  assert.equal(lightHit, true, "Slot 1 Light should connect with Slot 0");

  // Cancel the confirmed Light directly into Energy Shot on the next frame.
  stepMasks(arena, p1, p2, 0, INPUT_BITS.special);
  assert.equal(arena.opponent.state.action, STATES.action.SPECIAL);
  assert.equal(arena.opponent.actionData.moveId, "special");
  assert.deepEqual(arena.opponent.lastCancelData, {
    type: "hit",
    fromMoveId: "light",
    toMoveId: "special"
  });

  // Reset and verify Slot 1 8-frame recovery buffering on whiff.
  arena.resetFighters();
  p1.reset();
  p2.reset();
  arena.player.x = 600;
  arena.opponent.x = 1200;

  stepMasks(arena, p1, p2, 0, INPUT_BITS.light);
  // Advance to 3 frames before Light ends (total 18 frames: 5 startup + 3 active + 10 recovery).
  for (let frame = 0; frame < 14; frame += 1) stepMasks(arena, p1, p2, 0, 0);
  // Press Medium while still in Light recovery -> should buffer.
  stepMasks(arena, p1, p2, 0, INPUT_BITS.medium);
  assert.equal(arena.opponentInputBuffer.pending?.action, "medium");

  for (let frame = 0; frame < 4; frame += 1) stepMasks(arena, p1, p2, 0, 0);
  assert.equal(arena.opponent.state.action, STATES.action.ATTACK);
  assert.equal(arena.opponent.actionData.moveId, "medium");
  assert.equal(arena.opponentInputBuffer.pending, null);
});

test("Slot 1 directional guard blocks and releases symmetrically when driven by player2Input", () => {
  const arena = new Arena({ playerCharacterId: "striker", opponentCharacterId: "striker" });
  const p1 = new BitmaskInputAdapter();
  const p2 = new BitmaskInputAdapter();

  arena.player.x = 800;
  arena.opponent.x = 910;

  // Slot 1 holds right (away from Slot 0) to standing-guard Slot 0's High Light.
  stepMasks(arena, p1, p2, INPUT_BITS.light, INPUT_BITS.right);
  assert.equal(arena.opponent.state.action, STATES.action.GUARD);

  let blocked = null;
  for (let frame = 0; frame < 8 && !blocked; frame += 1) {
    stepMasks(arena, p1, p2, 0, INPUT_BITS.right);
    if (arena.lastCombatEvent?.type === "block") blocked = arena.lastCombatEvent;
  }
  assert.ok(blocked, "Slot 1 holding away should block Slot 0 Light");
  assert.equal(arena.opponent.guardMeter, 80);

  // Wait for blockstun to end, then release right -> guard ends cleanly.
  for (let frame = 0; frame < 10; frame += 1) stepMasks(arena, p1, p2, 0, 0);
  assert.equal(arena.opponent.state.action, STATES.action.NONE);
});

test("mirrored Slot 0 and Slot 1 inputs produce exact mirror-symmetric simulation", () => {
  const arena = new Arena({ playerCharacterId: "striker", opponentCharacterId: "striker" });
  const p1 = new BitmaskInputAdapter();
  const p2 = new BitmaskInputAdapter();

  // Both walk inward for 15 frames, jump forward, then trade simultaneous Light attacks.
  for (let frame = 0; frame < 15; frame += 1) {
    stepMasks(arena, p1, p2, INPUT_BITS.right, INPUT_BITS.left);
  }
  assert.ok(Math.abs((arena.player.x + arena.opponent.x) - arena.worldWidth) < 1e-9);

  // Neutral pause, then both walk inward until in Light range and press Light on the same frame.
  arena.player.x = 900;
  arena.opponent.x = 1020;
  stepMasks(arena, p1, p2, 0, 0);
  stepMasks(arena, p1, p2, INPUT_BITS.light, INPUT_BITS.light);

  for (let frame = 0; frame < 6; frame += 1) stepMasks(arena, p1, p2, 0, 0);

  assert.equal(arena.player.health, arena.opponent.health);
  assert.ok(arena.player.health < 1, "Simultaneous Light attacks should trade");
  assert.equal(arena.player.state.reaction, STATES.reaction.HITSTUN);
  assert.equal(arena.opponent.state.reaction, STATES.reaction.HITSTUN);
  assert.ok(Math.abs((arena.player.x + arena.opponent.x) - arena.worldWidth) < 1e-9);
});

test("symmetric fighter separation stops the backing fighter without dragging the stationary opponent", () => {
  const arena = new Arena({ playerCharacterId: "striker", opponentCharacterId: "striker" });
  const p1 = new BitmaskInputAdapter();
  const p2 = new BitmaskInputAdapter();

  // Start at exact max separation; Slot 1 walks right (outward) while Slot 0 stands still.
  arena.player.x = 400;
  arena.opponent.x = 400 + MAX_FIGHTER_SEPARATION;
  for (let frame = 0; frame < 10; frame += 1) {
    stepMasks(arena, p1, p2, 0, INPUT_BITS.right);
  }
  assert.equal(arena.player.x, 400, "Stationary Slot 0 must not be dragged by Slot 1");
  assert.equal(arena.opponent.x, 400 + MAX_FIGHTER_SEPARATION);

  // Mirror: Slot 0 walks left (outward) while Slot 1 stands still.
  for (let frame = 0; frame < 10; frame += 1) {
    stepMasks(arena, p1, p2, INPUT_BITS.left, 0);
  }
  assert.equal(arena.opponent.x, 400 + MAX_FIGHTER_SEPARATION, "Stationary Slot 1 must not be dragged by Slot 0");
  assert.equal(arena.player.x, 400);

  // Both walk outward simultaneously -> both stay symmetrically clamped at max separation.
  for (let frame = 0; frame < 10; frame += 1) {
    stepMasks(arena, p1, p2, INPUT_BITS.left, INPUT_BITS.right);
  }
  assert.equal(arena.player.x, 400);
  assert.equal(arena.opponent.x, 400 + MAX_FIGHTER_SEPARATION);

  // Static excess (dt=0 teleport) splits equally with zero Slot 0 bias.
  const first = { x: 100, previousX: 100 };
  const second = { x: 1800, previousX: 1800 };
  resolveFighterSeparation(first, second);
  assert.equal(second.x - first.x, MAX_FIGHTER_SEPARATION);
  assert.equal((first.x + second.x) / 2, 950);
});

test("explicit player2Input overrides opponentAI and resetFighters clears Slot 1 history and buffer", () => {
  const arena = new Arena({ opponentAIEnabled: true });
  const p1 = new BitmaskInputAdapter();
  const p2 = new BitmaskInputAdapter();

  // Explicit neutral player2Input prevents opponentAI from walking forward.
  for (let frame = 0; frame < 10; frame += 1) {
    stepMasks(arena, p1, p2, 0, 0);
  }
  assert.equal(arena.opponent.x, 1140);

  // Populate Slot 1 command history & input buffer, then verify resetFighters clears both.
  stepMasks(arena, p1, p2, 0, INPUT_BITS.crouch);
  stepMasks(arena, p1, p2, 0, INPUT_BITS.light);
  stepMasks(arena, p1, p2, 0, INPUT_BITS.medium);
  assert.ok(arena.opponentCommandHistory.entries.length > 0);
  assert.equal(arena.opponentInputBuffer.pending?.action, "medium");

  arena.resetFighters();
  assert.equal(arena.opponentCommandHistory.entries.length, 0);
  assert.equal(arena.opponentInputBuffer.pending, null);
});
