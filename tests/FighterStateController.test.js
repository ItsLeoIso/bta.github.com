import test from "node:test";
import assert from "node:assert/strict";
import { FIGHTER_STATES as STATES, FighterStateController } from "../src/state/FighterStateController.js";

function makeFighter() {
  return {
    crouching: false,
    dashType: null,
    dashRemaining: 0,
    dashVelocity: 0
  };
}

test("initialization creates independent locomotion, action, and reaction channels", () => {
  const controller = new FighterStateController();
  const fighter = makeFighter();

  const state = controller.initialize(fighter);

  assert.deepEqual(state, {
    locomotion: STATES.locomotion.STANDING,
    action: STATES.action.NONE,
    reaction: STATES.reaction.NONE
  });
  assert.equal(fighter.crouching, false);
  assert.equal(fighter.dashType, null);
});

test("locomotion follows allowed grounded and airborne transitions", () => {
  const controller = new FighterStateController();
  const fighter = makeFighter();
  controller.initialize(fighter);

  assert.equal(controller.setLocomotion(fighter, STATES.locomotion.WALKING), true);
  assert.equal(controller.setLocomotion(fighter, STATES.locomotion.CROUCHING), true);
  assert.equal(controller.setLocomotion(fighter, STATES.locomotion.JUMPING), true);
  assert.equal(controller.setLocomotion(fighter, STATES.locomotion.FALLING), true);
  assert.equal(controller.setLocomotion(fighter, STATES.locomotion.STANDING), true);
  assert.equal(fighter.state.locomotion, STATES.locomotion.STANDING);
});

test("locomotion rejects illegal transitions and unknown state names", () => {
  const controller = new FighterStateController();
  const fighter = makeFighter();
  controller.initialize(fighter);
  controller.setLocomotion(fighter, STATES.locomotion.FALLING);

  assert.equal(controller.setLocomotion(fighter, STATES.locomotion.JUMPING), false);
  assert.equal(fighter.state.locomotion, STATES.locomotion.FALLING);
  assert.throws(
    () => controller.setLocomotion(fighter, "teleporting"),
    /Unknown locomotion state/
  );
});

test("actions cannot overlap and can only be ended by the matching action", () => {
  const controller = new FighterStateController();
  const fighter = makeFighter();
  controller.initialize(fighter);

  assert.equal(controller.startAction(fighter, STATES.action.DASH, {
    dashType: "forward",
    remaining: 0.16,
    velocity: 700
  }), true);
  assert.equal(controller.startAction(fighter, STATES.action.ATTACK), false);
  assert.equal(controller.endAction(fighter, STATES.action.ATTACK), false);
  assert.equal(fighter.state.action, STATES.action.DASH);

  assert.equal(controller.endAction(fighter, STATES.action.DASH), true);
  assert.equal(fighter.state.action, STATES.action.NONE);
  assert.equal(fighter.actionData.dashType, null);
});

test("locomotion and action are independent state channels", () => {
  const controller = new FighterStateController();
  const fighter = makeFighter();
  controller.initialize(fighter);
  controller.setLocomotion(fighter, STATES.locomotion.JUMPING);

  assert.equal(controller.startAction(fighter, STATES.action.DASH, {
    dashType: "air",
    remaining: 0.14,
    velocity: 650
  }), true);

  assert.equal(fighter.state.locomotion, STATES.locomotion.JUMPING);
  assert.equal(fighter.state.action, STATES.action.DASH);
  assert.equal(fighter.actionData.dashType, "air");
});

test("reaction interrupts actions and prevents new actions until cleared", () => {
  const controller = new FighterStateController();
  const fighter = makeFighter();
  controller.initialize(fighter);
  controller.startAction(fighter, STATES.action.ATTACK, { moveName: "light" });

  assert.equal(controller.setReaction(fighter, STATES.reaction.HITSTUN), true);
  assert.equal(fighter.state.action, STATES.action.NONE);
  assert.equal(controller.startAction(fighter, STATES.action.GUARD), false);

  assert.equal(controller.clearReaction(fighter), true);
  assert.equal(fighter.state.reaction, STATES.reaction.NONE);
  assert.equal(controller.startAction(fighter, STATES.action.GUARD), true);
});

test("higher-priority reactions cannot be overwritten by lower-priority reactions", () => {
  const controller = new FighterStateController();
  const fighter = makeFighter();
  controller.initialize(fighter);

  assert.equal(controller.setReaction(fighter, STATES.reaction.KNOCKDOWN), true);
  assert.equal(controller.setReaction(fighter, STATES.reaction.HITSTUN), false);
  assert.equal(controller.setReaction(fighter, STATES.reaction.WAKEUP), false);
  assert.equal(fighter.state.reaction, STATES.reaction.KNOCKDOWN);

  assert.equal(controller.clearReaction(fighter), true);
  assert.equal(fighter.state.reaction, STATES.reaction.NONE);
});

test("compatibility fields mirror crouching and dash state", () => {
  const controller = new FighterStateController();
  const fighter = makeFighter();
  controller.initialize(fighter);

  controller.setLocomotion(fighter, STATES.locomotion.CROUCHING);
  assert.equal(fighter.crouching, true);

  controller.startAction(fighter, STATES.action.DASH, {
    dashType: "backdash",
    remaining: 0.22,
    velocity: -540
  });
  assert.equal(fighter.dashType, "backdash");
  assert.equal(fighter.dashRemaining, 0.22);
  assert.equal(fighter.dashVelocity, -540);

  controller.endAction(fighter, STATES.action.DASH);
  assert.equal(fighter.dashType, null);
  assert.equal(fighter.dashRemaining, 0);
  assert.equal(fighter.dashVelocity, 0);
});
