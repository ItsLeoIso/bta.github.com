import test from "node:test";
import assert from "node:assert/strict";
import { FighterAnimator, resolveAnimationName } from "../src/animation/FighterAnimator.js";
import { DEFAULT_ANIMATIONS } from "../src/characters/CharacterDefinitions.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function fighter() {
  return {
    state: {
      locomotion: STATES.locomotion.STANDING,
      action: STATES.action.NONE,
      reaction: STATES.reaction.NONE
    },
    actionData: {},
    guardData: null
  };
}

test("idle animation advances and loops on fixed simulation frames", () => {
  const actor = fighter();
  const animator = new FighterAnimator(DEFAULT_ANIMATIONS);
  assert.equal(animator.update(actor).spriteFrame, 0);
  for (let frame = 0; frame < 12; frame += 1) animator.update(actor);
  assert.equal(actor.animation.clipName, "idle");
  assert.equal(actor.animation.spriteFrame, 1);
  for (let frame = 0; frame < 12; frame += 1) animator.update(actor);
  assert.equal(actor.animation.spriteFrame, 0);
});

test("attack and special actions select move-specific animation clips", () => {
  const actor = fighter();
  actor.state.action = STATES.action.ATTACK;
  actor.actionData.moveId = "medium";
  assert.equal(resolveAnimationName(actor), "attack-medium");
  const animator = new FighterAnimator(DEFAULT_ANIMATIONS);
  assert.equal(animator.update(actor).clipName, "attack-medium");
  actor.state.action = STATES.action.SPECIAL;
  actor.actionData.moveId = "arcLance";
  assert.equal(animator.update(actor).clipName, "special-arc-lance");
});

test("reaction clips take priority over current attacks and locomotion", () => {
  const actor = fighter();
  actor.state.action = STATES.action.ATTACK;
  actor.actionData.moveId = "heavy";
  actor.state.reaction = STATES.reaction.GUARD_BREAK;
  const animator = new FighterAnimator(DEFAULT_ANIMATIONS);
  assert.equal(animator.update(actor).clipName, "reaction-guard-break");
});

test("guard height, dash type, and locomotion map to distinct clips", () => {
  const actor = fighter();
  actor.state.action = STATES.action.GUARD;
  actor.guardData = { guardHeight: "low" };
  assert.equal(resolveAnimationName(actor), "guard-low");

  actor.state.action = STATES.action.DASH;
  actor.actionData.dashType = "backdash";
  assert.equal(resolveAnimationName(actor), "dash-backdash");

  actor.state.action = STATES.action.NONE;
  actor.state.locomotion = STATES.locomotion.FALLING;
  assert.equal(resolveAnimationName(actor), "fall");
});

test("non-looping clips stop on their final frame and report completion", () => {
  const actor = fighter();
  actor.state.locomotion = STATES.locomotion.JUMPING;
  const animator = new FighterAnimator(DEFAULT_ANIMATIONS);
  animator.update(actor);
  for (let frame = 0; frame < 70; frame += 1) animator.update(actor);
  assert.equal(actor.animation.clipName, "jump");
  assert.equal(actor.animation.frameIndex, 1);
  assert.equal(actor.animation.finished, true);
});
