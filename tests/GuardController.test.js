import test from "node:test";
import assert from "node:assert/strict";
import { GuardController, BLOCK_PROFILES } from "../src/combat/GuardController.js";
import { FighterStateController, FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";
import { Arena } from "../src/engine/Arena.js";

function fighter() {
  const value = {
    x: 200, y: 440, facing: 1, onGround: true, health: 1, vx: 0,
    airHorizontalVelocity: 0, guardData: null, reactionData: null,
    state: { locomotion: STATES.locomotion.STANDING, action: STATES.action.NONE, reaction: STATES.reaction.NONE },
    actionData: {}
  };
  value.stateController = new FighterStateController();
  value.stateController.initialize(value);
  return value;
}

function input(axis = -1, crouch = false) {
  return {
    getWorldAxis: () => axis,
    getAxis: () => axis,
    isDown: action => action === "crouch" && crouch
  };
}

test("holding away starts a standing high guard and releasing back ends it", () => {
  const guard = new GuardController({ stateController: new FighterStateController() });
  const target = fighter();
  guard.update(target, input(-1));
  assert.equal(target.state.action, STATES.action.GUARD);
  assert.equal(target.guardData.guardHeight, "high");
  guard.update(target, input(0));
  assert.equal(target.state.action, STATES.action.NONE);
});

test("holding away plus crouch starts a low guard stance", () => {
  const guard = new GuardController({ stateController: new FighterStateController() });
  const target = fighter();
  guard.update(target, input(-1, true));
  assert.equal(target.guardData.guardHeight, "low");
  assert.equal(target.state.locomotion, STATES.locomotion.CROUCHING);
});

test("blocking applies blockstun and pushback without reducing health", () => {
  const guard = new GuardController({ stateController: new FighterStateController() });
  const attacker = fighter();
  attacker.x = 100;
  const defender = fighter();
  defender.state.action = STATES.action.GUARD;
  defender.guardData = { guardHeight: "high" };
  const result = guard.applyBlock({ type: "block", hitLevel: "mid", moveId: "medium", attacker, defender });
  assert.equal(defender.health, 1);
  assert.equal(defender.state.reaction, STATES.reaction.BLOCKSTUN);
  assert.equal(defender.reactionData.remainingFrames, BLOCK_PROFILES.mid.blockstunFrames);
  assert.ok(defender.vx > 0);
  assert.equal(result.health, 1);
  assert.equal(defender.state.action, STATES.action.NONE);
});

test("Arena holds the player in place while back is held and supports crouch guard", () => {
  const arena = new Arena();
  const startX = arena.player.x;
  const backInput = { getWorldAxis: () => -1, wasPressed: () => false, isDown: action => action === "crouch" };
  arena.update(0.1, backInput);
  assert.equal(arena.player.x, startX);
  assert.equal(arena.player.state.action, STATES.action.GUARD);
  assert.equal(arena.player.guardData.guardHeight, "low");
});
