import test from "node:test";
import assert from "node:assert/strict";
import { DamageController, DAMAGE_PROFILES } from "../src/combat/DamageController.js";
import { FighterStateController, FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function makeFighter(x) {
  const fighter = {
    x, health: 1, vx: 0, airHorizontalVelocity: 0, reactionData: null,
    state: { locomotion: STATES.locomotion.STANDING, action: STATES.action.NONE, reaction: STATES.reaction.NONE },
    actionData: {}
  };
  fighter.stateController = new FighterStateController();
  fighter.stateController.initialize(fighter);
  return fighter;
}

test("confirmed light, medium and heavy hits deal increasing damage", () => {
  for (const [moveId, expected] of [["light", 0.94], ["medium", 0.9], ["heavy", 0.85]]) {
    const attacker = makeFighter(100);
    const defender = makeFighter(200);
    const result = new DamageController().applyHit({ type: "hit", moveId, attacker, defender });
    assert.ok(Math.abs(defender.health - expected) < 1e-9);
    assert.equal(result.defender, defender);
  }
});

test("heavy hit applies knockdown while lighter hits apply hitstun", () => {
  const controller = new DamageController();
  const attacker = makeFighter(100);
  const lightTarget = makeFighter(200);
  const heavyTarget = makeFighter(200);
  controller.applyHit({ type: "hit", moveId: "light", attacker, defender: lightTarget });
  controller.applyHit({ type: "hit", moveId: "heavy", attacker, defender: heavyTarget });
  assert.equal(lightTarget.state.reaction, STATES.reaction.HITSTUN);
  assert.equal(heavyTarget.state.reaction, STATES.reaction.KNOCKDOWN);
  assert.equal(heavyTarget.reactionData.remainingFrames, DAMAGE_PROFILES.heavy.hitstunFrames);
});

test("knockback pushes away from the attacker and reaction expires", () => {
  const controller = new DamageController();
  const attacker = makeFighter(300);
  const defender = makeFighter(200);
  controller.applyHit({ type: "hit", moveId: "medium", attacker, defender });
  assert.ok(defender.vx < 0);
  for (let i = 0; i < DAMAGE_PROFILES.medium.hitstunFrames; i++) controller.update(defender);
  assert.equal(defender.state.reaction, STATES.reaction.NONE);
  assert.equal(defender.reactionData, null);
});

test("health cannot fall below zero and non-hit events do nothing", () => {
  const controller = new DamageController();
  const attacker = makeFighter(100);
  const defender = makeFighter(200);
  defender.health = 0.05;
  assert.equal(controller.applyHit({ type: "block", moveId: "heavy", attacker, defender }), null);
  controller.applyHit({ type: "hit", moveId: "heavy", attacker, defender });
  assert.equal(defender.health, 0);
});
