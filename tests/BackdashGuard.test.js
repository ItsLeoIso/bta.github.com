import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function input(axis = 0, pressed = []) {
  return {
    getWorldAxis: () => axis,
    wasPressed: action => pressed.includes(action),
    isDown: () => false
  };
}

test("standing backward double-tap cancels guard and starts a backdash", () => {
  const arena = new Arena();
  const startX = arena.player.x;

  // First backward tap briefly enters standing guard.
  arena.update(1 / 60, input(-1, ["left"]));
  assert.equal(arena.player.state.action, STATES.action.GUARD);
  assert.equal(arena.player.guardData.guardHeight, "high");

  // Release between taps, then tap backward again inside the double-tap window.
  arena.update(0.08, input());
  arena.update(1 / 60, input(-1, ["left"]));

  assert.equal(arena.player.dashType, "backdash");
  assert.equal(arena.player.state.action, STATES.action.DASH);
  assert.equal(arena.player.guardData, null);
  assert.ok(arena.player.vx < 0);
  assert.ok(arena.player.x < startX);
});

test("standing backward double-tap still backdashes when facing left", () => {
  const arena = new Arena();
  arena.player.x = 800;

  arena.update(1 / 60, input(1, ["right"]));
  arena.update(0.08, input());
  arena.update(1 / 60, input(1, ["right"]));

  assert.equal(arena.player.facing, -1);
  assert.equal(arena.player.dashType, "backdash");
  assert.ok(arena.player.vx > 0);
});
