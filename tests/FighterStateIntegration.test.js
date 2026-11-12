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

test("movement updates standing, walking, and crouching locomotion states", () => {
  const arena = new Arena();
  const fighter = arena.player;

  arena.update(0.1, input({ axis: 1 }));
  assert.equal(fighter.state.locomotion, STATES.locomotion.WALKING);

  arena.update(0.1, input({ down: ["crouch"] }));
  assert.equal(fighter.state.locomotion, STATES.locomotion.CROUCHING);
  assert.equal(fighter.crouching, true);

  arena.update(0.1, input());
  assert.equal(fighter.state.locomotion, STATES.locomotion.STANDING);
  assert.equal(fighter.crouching, false);
});

test("jumping transitions to falling and returns to standing on landing", () => {
  const arena = new Arena();
  const fighter = arena.player;

  arena.update(1 / 60, input({ pressed: ["jump"] }));
  assert.equal(fighter.state.locomotion, STATES.locomotion.JUMPING);

  for (let frame = 0; frame < 30; frame += 1) {
    arena.update(1 / 60, input());
  }
  assert.equal(fighter.state.locomotion, STATES.locomotion.FALLING);

  for (let frame = 0; frame < 60; frame += 1) {
    arena.update(1 / 60, input());
  }
  assert.equal(fighter.onGround, true);
  assert.equal(fighter.state.locomotion, STATES.locomotion.STANDING);
});

test("ground dash is represented as an action and clears on completion", () => {
  const arena = new Arena();
  const fighter = arena.player;

  assert.equal(arena.movement.startDash(fighter, 1), true);
  assert.equal(fighter.state.action, STATES.action.DASH);
  assert.equal(fighter.actionData.dashType, "forward");

  arena.update(0.2, input());
  assert.equal(fighter.state.action, STATES.action.NONE);
  assert.equal(fighter.actionData.dashType, null);
  assert.equal(fighter.dashType, null);
});
