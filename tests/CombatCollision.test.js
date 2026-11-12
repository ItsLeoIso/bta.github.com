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
      hitbox: { offsetX: 24, offsetY: -228, width: 126, height: 80 }
    }
  });
}

test("standing, crouching, and airborne hurtboxes use distinct profiles", () => {
  const standing = getHurtbox(fighter());
  const crouching = getHurtbox(fighter({ locomotion: STATES.locomotion.CROUCHING }));
  const airborne = getHurtbox(fighter({ locomotion: STATES.locomotion.JUMPING }));

  assert.equal(standing.top, -28);
  assert.equal(standing.left, 37);
  assert.equal(crouching.top, 56);
  assert.equal(crouching.left, 37);
  assert.equal(airborne.top, -28);
  assert.equal(airborne.left, 37);
});

test("attack hitboxes exist only during active frames and before the first hit", () => {
  const attacker = activeAttacker();
  assert.deepEqual(getActiveAttackHitbox(attacker), {
    left: 124, right: 250, top: -28, bottom: 52
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
    left: -50, right: 76, top: -28, bottom: 52
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

test("standard attacks hit standing and airborne targets but pass over crouching targets", () => {
  const attacker = activeAttacker();
  const crouching = fighter({ x: 200, y: 200, locomotion: STATES.locomotion.CROUCHING });
  const airborne = fighter({ x: 200, y: 200, locomotion: STATES.locomotion.FALLING });

  assert.equal(resolveAttackCollision(attacker, crouching), null);
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
  const highTarget = fighter({ x: 200, y: -300 });
  assert.equal(resolveAttackCollision(attacker, highTarget), null);
});

test("every combat hurtbox is at least as large as the visible fighter silhouette", () => {
  const standing = getHurtbox(fighter());
  const crouching = getHurtbox(fighter({ locomotion: STATES.locomotion.CROUCHING }));
  const airborne = getHurtbox(fighter({ locomotion: STATES.locomotion.JUMPING }));

  for (const box of [standing, crouching, airborne]) {
    assert.ok(box.right - box.left >= 126);
  }
  assert.equal(standing.bottom - standing.top, 228);
  assert.equal(crouching.bottom - crouching.top, 144);
  assert.equal(airborne.bottom - airborne.top, 228);
});

test("attack hitboxes keep their reach while staying within the upper-body band", async () => {
  const { ATTACK_DEFINITIONS } = await import("../src/combat/AttackController.js");
  const boxes = ["light", "medium", "heavy"].map(id => ATTACK_DEFINITIONS[id].hitbox);

  assert.deepEqual(boxes.map(box => box.width), [126, 160, 190]);
  assert.ok(boxes.every(box => box.height === 80));
  assert.ok(boxes.every(box => box.offsetY === -228));
  assert.ok(boxes[0].width < boxes[1].width);
  assert.ok(boxes[1].width < boxes[2].width);
});
