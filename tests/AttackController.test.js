import test from "node:test";
import assert from "node:assert/strict";
import { AttackController, ATTACK_DEFINITIONS } from "../src/combat/AttackController.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function makeFighter({ onGround = true, locomotion = STATES.locomotion.STANDING } = {}) {
  return {
    onGround,
    crouching: locomotion === STATES.locomotion.CROUCHING,
    state: {
      locomotion,
      action: STATES.action.NONE,
      reaction: STATES.reaction.NONE
    },
    actionData: { dashType: null, remaining: 0, velocity: 0 },
    lastAttackData: null
  };
}

function input(pressed = []) {
  return { wasPressed: action => pressed.includes(action) };
}

const noInput = input();

test("attack definitions expose prototype startup, active, and recovery frames", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(ATTACK_DEFINITIONS).map(([id, move]) => [
      id,
      [move.startupFrames, move.activeFrames, move.recoveryFrames]
    ])),
    {
      light: [5, 3, 10],
      medium: [8, 4, 15],
      heavy: [12, 5, 21]
    }
  );
});

test("Light starts on the pressed edge and advances through all three phases", () => {
  const controller = new AttackController();
  const fighter = makeFighter();

  controller.update(fighter, input(["light"]));
  assert.equal(fighter.state.action, STATES.action.ATTACK);
  assert.equal(fighter.actionData.phase, "startup");
  assert.equal(fighter.actionData.phaseFrame, 1);

  for (let frame = 0; frame < 4; frame += 1) controller.update(fighter, noInput);
  assert.equal(fighter.actionData.phase, "startup");
  assert.equal(fighter.actionData.phaseFrame, 5);

  controller.update(fighter, noInput);
  assert.equal(fighter.actionData.phase, "active");
  assert.equal(fighter.actionData.phaseFrame, 1);

  controller.update(fighter, noInput);
  controller.update(fighter, noInput);
  assert.equal(fighter.actionData.phase, "active");
  assert.equal(fighter.actionData.phaseFrame, 3);

  controller.update(fighter, noInput);
  assert.equal(fighter.actionData.phase, "recovery");
  assert.equal(fighter.actionData.phaseFrame, 1);

  for (let frame = 1; frame < 10; frame += 1) controller.update(fighter, noInput);
  assert.equal(fighter.actionData.phase, "recovery");
  assert.equal(fighter.actionData.phaseFrame, 10);

  controller.update(fighter, noInput);
  assert.equal(fighter.state.action, STATES.action.NONE);
  assert.equal(fighter.actionData.moveId, undefined);
});

test("Medium and Heavy input select their own move definitions", () => {
  for (const [button, expected] of [["medium", "medium"], ["heavy", "heavy"]]) {
    const controller = new AttackController();
    const fighter = makeFighter();
    controller.update(fighter, input([button]));
    assert.equal(fighter.actionData.moveId, expected);
    assert.equal(fighter.actionData.moveName, expected[0].toUpperCase() + expected.slice(1));
  }
});

test("attacks cannot start in the air or during another action", () => {
  const controller = new AttackController();
  const airborne = makeFighter({ onGround: false });
  controller.update(airborne, input(["light"]));
  assert.equal(airborne.state.action, STATES.action.NONE);

  const busy = makeFighter();
  busy.state.action = STATES.action.DASH;
  controller.update(busy, input(["heavy"]));
  assert.equal(busy.state.action, STATES.action.DASH);
});

test("attacks cannot be started while a reaction is active", () => {
  const controller = new AttackController();
  const fighter = makeFighter();
  fighter.state.reaction = STATES.reaction.HITSTUN;

  controller.update(fighter, input(["light"]));

  assert.equal(fighter.state.action, STATES.action.NONE);
  assert.equal(fighter.lastAttackData, null);
});

test("attacks cannot be restarted during startup, active, or recovery", () => {
  const controller = new AttackController();
  const fighter = makeFighter();
  controller.update(fighter, input(["light"]));
  const initialMove = fighter.actionData.moveId;

  controller.update(fighter, input(["heavy"]));

  assert.equal(fighter.actionData.moveId, initialMove);
});

test("walk stops on attack start and crouching stance is preserved", () => {
  const controller = new AttackController();
  const walking = makeFighter({ locomotion: STATES.locomotion.WALKING });
  controller.update(walking, input(["light"]));
  assert.equal(walking.state.locomotion, STATES.locomotion.STANDING);

  const crouching = makeFighter({ locomotion: STATES.locomotion.CROUCHING });
  controller.update(crouching, input(["light"]));
  assert.equal(crouching.state.locomotion, STATES.locomotion.CROUCHING);
});

test("advantage remains unset until hit and block resolution exist", () => {
  const controller = new AttackController();
  const fighter = makeFighter();
  controller.update(fighter, input(["light"]));

  assert.equal(fighter.lastAttackData.hitAdvantage, null);
  assert.equal(fighter.lastAttackData.blockAdvantage, null);
});
