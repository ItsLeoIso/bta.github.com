import test from "node:test";
import assert from "node:assert/strict";
import { getHurtbox } from "../src/combat/Hurtbox.js";
import { getActiveAttackHitbox } from "../src/combat/Hitbox.js";
import { boxesOverlap, resolveAttackCollision } from "../src/combat/CombatCollision.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function fighter({
  x = 100,
  y = 200,
  facing = 1,
  locomotion = STATES.locomotion.STANDING,
  action = STATES.action.NONE,
  actionData = {}
} = {}) {
  return {
    x, y, facing,
    state: { locomotion, action, reaction: STATES.reaction.NONE },
    actionData
  };
}

function activeAttacker({ facing = 1, hitConfirmed = false } = {}) {
  return fighter({
    x: 100,
    y: 200,
    facing,
    action: STATES.action.ATTACK,
    actionData: {
      moveId: "light",
      moveName: "Light",
      phase: "active",
      phaseFrame: 1,
      hitConfirmed,
      hitbox: { offsetX: 28, offsetY: -72, width: 90, height: 52 }
    }
  });
}

test("standing, crouching, and airborne hurtboxes use distinct profiles", () => {
  const standing = getHurtbox(fighter());
  const crouching = getHurtbox(fighter({ locomotion: STATES.locomotion.CROUCHING }));
  const airborne = getHurtbox(fighter({ locomotion: STATES.locomotion.JUMPING }));

  assert.equal(standing.top, 124);
  assert.equal(standing.left, 66);
  assert.equal(crouching.top, 152);
  assert.equal(crouching.left, 62);
  assert.equal(airborne.top, 134);
  assert.equal(airborne.left, 68);
});

test("attack hitboxes exist only during active frames and before the first hit", () => {
  const attacker = activeAttacker();
  assert.deepEqual(getActiveAttackHitbox(attacker), {
    left: 128, right: 218, top: 128, bottom: 180
  });

  attacker.actionData.phase = "startup";
  assert.equal(getActiveAttackHitbox(attacker), null);
  attacker.actionData.phase = "active";
  attacker.actionData.hitConfirmed = true;
  assert.equal(getActiveAttackHitbox(attacker), null);
});

test("attack hitbox mirrors correctly when the fighter faces left", () => {
  const attacker = activeAttacker({ facing: -1 });
  assert.deepEqual(getActiveAttackHitbox(attacker), {
    left: -18, right: 72, top: 128, bottom: 180
  });
});

test("rectangle collision requires positive overlap on both axes", () => {
  const first = { left: 0, right: 10, top: 0, bottom: 10 };
  assert.equal(boxesOverlap(first, { left: 9, right: 20, top: 9, bottom: 20 }), true);
  assert.equal(boxesOverlap(first, { left: 10, right: 20, top: 0, bottom: 10 }), false);
  assert.equal(boxesOverlap(first, { left: 0, right: 10, top: 10, bottom: 20 }), false);
});

test("overlapping active hitbox and standing hurtbox produce one hit event", () => {
  const attacker = activeAttacker();
  const defender = fighter({ x: 200, y: 200 });

  const event = resolveAttackCollision(attacker, defender);
  assert.equal(event.type, "hit");
  assert.equal(event.moveId, "light");
  assert.equal(event.defender, defender);
  assert.equal(attacker.actionData.hitConfirmed, true);
  assert.equal(resolveAttackCollision(attacker, defender), null);
});

test("crouching and airborne hurtboxes can be hit when their volumes overlap", () => {
  const attacker = activeAttacker();
  const crouching = fighter({ x: 200, y: 200, locomotion: STATES.locomotion.CROUCHING });
  const airborne = fighter({ x: 200, y: 200, locomotion: STATES.locomotion.FALLING });

  assert.ok(resolveAttackCollision(attacker, crouching));
  assert.ok(resolveAttackCollision(activeAttacker(), airborne));
});

test("misses are not consumed and may connect on a later active frame", () => {
  const attacker = activeAttacker();
  const defender = fighter({ x: 500, y: 200 });

  assert.equal(resolveAttackCollision(attacker, defender), null);
  assert.equal(attacker.actionData.hitConfirmed, false);

  defender.x = 200;
  assert.ok(resolveAttackCollision(attacker, defender));
});

test("attacks do not hit targets outside the vertical volume", () => {
  const attacker = activeAttacker();
  const highTarget = fighter({ x: 200, y: 80 });
  assert.equal(resolveAttackCollision(attacker, highTarget), null);
});
