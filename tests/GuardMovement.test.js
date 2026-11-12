import test from "node:test";
import assert from "node:assert/strict";
import { MovementController } from "../src/movement/MovementController.js";
import { FighterStateController, FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function makeFighter() {
  return {
    x: 200, y: 440, facing: 1, onGround: true, vx: 0, vy: 0,
    health: 1, airDashAvailable: true, airHorizontalVelocity: 0,
    groundDashCooldownRemaining: 0,
    state: {
      locomotion: STATES.locomotion.STANDING,
      action: STATES.action.NONE,
      reaction: STATES.reaction.NONE
    },
    actionData: {}
  };
}

function makeInput(axis, crouch = false) {
  return {
    getWorldAxis: () => axis,
    wasPressed: () => false,
    isDown: action => action === "crouch" && crouch
  };
}

test("ordinary crouch walking is 12.5% of normal walking speed", () => {
  const states = new FighterStateController();
  const movement = new MovementController({ stateController: states });
  const fighter = makeFighter();
  movement.update(fighter, makeInput(1, true), 0.1, {
    floorY: 440, minX: 68, maxX: 892
  });
  assert.equal(fighter.vx, 37.5);
  assert.equal(fighter.x, 203.75);
});

test("standing guard retreat is 25% speed and does not move forward", () => {
  const states = new FighterStateController();
  const movement = new MovementController({ stateController: states });
  const fighter = makeFighter();
  states.startAction(fighter, STATES.action.GUARD, { guardHeight: "high" });
  fighter.guardData = { guardHeight: "high" };
  movement.update(fighter, makeInput(-1), 0.1, {
    floorY: 440, minX: 68, maxX: 892
  });
  assert.equal(fighter.vx, -37.5);
  assert.equal(fighter.x, 196.25);
  movement.update(fighter, makeInput(1), 0.1, {
    floorY: 440, minX: 68, maxX: 892
  });
  assert.equal(fighter.vx, 0);
});

test("crouch guard retreat is 12.5% speed", () => {
  const states = new FighterStateController();
  const movement = new MovementController({ stateController: states });
  const fighter = makeFighter();
  states.startAction(fighter, STATES.action.GUARD, { guardHeight: "low" });
  states.setLocomotion(fighter, STATES.locomotion.CROUCHING);
  fighter.guardData = { guardHeight: "low" };
  movement.update(fighter, makeInput(-1, true), 0.1, {
    floorY: 440, minX: 68, maxX: 892
  });
  assert.equal(fighter.vx, -75);
  assert.equal(fighter.x, 192.5);
});
