import test from "node:test";
import assert from "node:assert/strict";
import { GuardController, BLOCK_PROFILES, GUARD_BREAK_FRAMES, GUARD_REGEN_DELAY_FRAMES } from "../src/combat/GuardController.js";
import { DamageController } from "../src/combat/DamageController.js";
import { FighterStateController, FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";
import { Arena } from "../src/engine/Arena.js";

function fighter() {
  const value = {
    x: 200, y: 440, facing: 1, onGround: true, health: 1, vx: 0,
    airHorizontalVelocity: 0, guardData: null, reactionData: null,
    guardMeter: 100, guardMeterRecoveryDelayFrames: 0,
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

test("blocking applies chip damage, guard damage, blockstun and pushback", () => {
  const guard = new GuardController({ stateController: new FighterStateController() });
  const attacker = fighter();
  attacker.x = 100;
  const defender = fighter();
  defender.state.action = STATES.action.GUARD;
  defender.guardData = { guardHeight: "high" };

  const event = { type: "block", hitLevel: "mid", moveId: "medium", attacker, defender };
  const chip = new DamageController().applyChipDamage(event);
  event.chipDamage = chip.damage;
  const result = guard.applyBlock(event);

  assert.equal(defender.health, 0.99);
  assert.equal(defender.guardMeter, 70);
  assert.equal(defender.guardMeterRecoveryDelayFrames, GUARD_REGEN_DELAY_FRAMES);
  assert.equal(defender.state.reaction, STATES.reaction.BLOCKSTUN);
  assert.equal(defender.reactionData.remainingFrames, BLOCK_PROFILES.mid.blockstunFrames);
  assert.ok(defender.vx > 0);
  assert.equal(result.health, 0.99);
  assert.equal(result.chipDamage, 0.01);
  assert.equal(result.guardBroken, false);
  assert.equal(defender.state.action, STATES.action.NONE);
});

test("repeated blocked heavy attacks break guard and cause a longer reaction", () => {
  const states = new FighterStateController();
  const guard = new GuardController({ stateController: states });
  const attacker = fighter();
  attacker.x = 100;
  const defender = fighter();

  let result;
  for (let block = 0; block < 3; block += 1) {
    states.clearReaction(defender);
    states.startAction(defender, STATES.action.GUARD, { guardHeight: "low" });
    defender.guardData = { guardHeight: "low" };
    result = guard.applyBlock({
      type: "block", hitLevel: "low", moveId: "heavy", attacker, defender
    });
  }

  assert.equal(defender.guardMeter, 0);
  assert.equal(result.guardBroken, true);
  assert.equal(result.outcome, "guardBreak");
  assert.equal(defender.state.reaction, STATES.reaction.GUARD_BREAK);
  assert.equal(defender.reactionData.remainingFrames, GUARD_BREAK_FRAMES);
  assert.equal(defender.state.action, STATES.action.NONE);

  const damage = new DamageController();
  for (let frame = 0; frame < GUARD_BREAK_FRAMES; frame += 1) damage.update(defender);
  assert.equal(defender.state.reaction, STATES.reaction.NONE);
});

test("guard meter regeneration waits until its full delay has elapsed", () => {
  const guard = new GuardController({ stateController: new FighterStateController() });
  const target = fighter();
  target.guardMeter = 50;
  target.guardMeterRecoveryDelayFrames = GUARD_REGEN_DELAY_FRAMES;

  for (let frame = 0; frame < GUARD_REGEN_DELAY_FRAMES; frame += 1) {
    guard.update(target, input(0));
  }
  assert.equal(target.guardMeter, 50);
  guard.update(target, input(0));
  assert.ok(target.guardMeter > 50);
});

test("Arena allows crouch-guard retreat at 12.5% walking speed", () => {
  const arena = new Arena();
  const startX = arena.player.x;
  const backInput = { getWorldAxis: () => -1, wasPressed: () => false, isDown: action => action === "crouch" };
  arena.update(0.1, backInput);
  assert.equal(arena.player.state.action, STATES.action.GUARD);
  assert.equal(arena.player.guardData.guardHeight, "low");
  assert.equal(arena.player.x, startX - 3.75);
});

test("standing guard retreat moves at 25% walking speed", () => {
  const arena = new Arena();
  const startX = arena.player.x;
  const backInput = { getWorldAxis: () => -1, wasPressed: () => false, isDown: () => false };
  arena.update(0.1, backInput);
  assert.equal(arena.player.state.action, STATES.action.GUARD);
  assert.equal(arena.player.x, startX - 7.5);
});

test("back is interpreted relative to facing after the fighters cross sides", () => {
  const guard = new GuardController({ stateController: new FighterStateController() });
  const target = fighter();
  target.facing = -1;
  guard.update(target, input(1));
  assert.equal(target.state.action, STATES.action.GUARD);
  assert.equal(target.guardData.guardHeight, "high");
});

test("ordinary crouch movement uses 12.5% of normal walking speed", () => {
  const arena = new Arena();
  const startX = arena.player.x;
  const crouchWalkInput = {
    getWorldAxis: () => 1,
    wasPressed: () => false,
    isDown: action => action === "crouch"
  };
  arena.update(0.1, crouchWalkInput);
  assert.equal(arena.player.state.action, STATES.action.NONE);
  assert.equal(arena.player.state.locomotion, STATES.locomotion.CROUCHING);
  assert.equal(arena.player.x, startX + 3.75);
});
