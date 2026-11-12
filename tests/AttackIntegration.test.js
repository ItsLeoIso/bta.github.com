import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function input({ axis = 0, pressed = [], down = [] } = {}) {
  return {
    getWorldAxis: () => axis,
    wasPressed: action => pressed.includes(action),
    isDown: action => down.includes(action)
  };
}

test("Arena starts a timed attack from the mapped player input", () => {
  const arena = new Arena();
  const fighter = arena.player;

  arena.update(1 / 60, input({ pressed: ["medium"] }));

  assert.equal(fighter.state.action, STATES.action.ATTACK);
  assert.equal(fighter.actionData.moveId, "medium");
  assert.equal(fighter.actionData.phase, "startup");
  assert.equal(fighter.actionData.phaseFrame, 1);
});

test("Arena preserves each attack's height classification in action data", () => {
  const arena = new Arena();
  arena.update(1 / 60, input({ pressed: ["light"] }));
  assert.equal(arena.player.actionData.hitLevel, "high");

  const secondArena = new Arena();
  secondArena.update(1 / 60, input({ pressed: ["medium"] }));
  assert.equal(secondArena.player.actionData.hitLevel, "mid");

  const thirdArena = new Arena();
  thirdArena.update(1 / 60, input({ pressed: ["heavy"] }));
  assert.equal(thirdArena.player.actionData.hitLevel, "low");
});

test("ground movement and jump input are locked while an attack is active", () => {
  const arena = new Arena();
  const fighter = arena.player;
  const startX = fighter.x;

  arena.update(1 / 60, input({ axis: 1, pressed: ["light"] }));
  arena.update(1 / 60, input({ axis: 1, pressed: ["jump"] }));

  assert.equal(fighter.state.action, STATES.action.ATTACK);
  assert.equal(fighter.x, startX);
  assert.equal(fighter.onGround, true);
  assert.equal(fighter.vx, 0);
});

test("the arena unlocks movement after the complete attack recovery", () => {
  const arena = new Arena();
  const fighter = arena.player;
  const startX = fighter.x;

  arena.update(1 / 60, input({ pressed: ["light"] }));
  for (let frame = 0; frame < 18; frame += 1) {
    arena.update(1 / 60, input({ axis: 1 }));
  }

  assert.equal(fighter.state.action, STATES.action.NONE);
  assert.ok(fighter.x > startX);
});

test("the attack phase is available to the live inspector as fighter action data", () => {
  const arena = new Arena();
  arena.update(1 / 60, input({ pressed: ["heavy"] }));

  assert.equal(arena.player.actionData.phase, "startup");
  assert.equal(arena.player.actionData.startupFrames, 12);
  assert.equal(arena.player.lastAttackData.name, "Heavy");
});
