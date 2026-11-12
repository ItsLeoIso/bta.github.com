import test from "node:test";
import assert from "node:assert/strict";
import { getHurtbox } from "../src/combat/Hurtbox.js";
import { getActiveAttackHitbox } from "../src/combat/Hitbox.js";
import { boxesOverlap, resolveAttackCollision } from "../src/combat/CombatCollision.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";
import { ATTACK_DEFINITIONS } from "../src/combat/AttackController.js";

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

function activeAttacker({ moveId = "light", facing = 1, hitConfirmed = false } = {}) {
  const move = ATTACK_DEFINITIONS[moveId];
  return fighter({
    x: 100,
    y: 200,
    facing,
    action: STATES.action.ATTACK,
    actionData: {
      ...move,
      moveId,
      moveName: move.name,
      phase: "active",
      phaseFrame: 1,
      hitConfirmed
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
    left: 124, right: 250, top: -20, bottom: 52
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
    left: -50, right: 76, top: -20, bottom: 52
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
  assert.equal(event.hitLevel, "high");
  assert.equal(event.defender, defender);
  assert.equal(attacker.actionData.hitConfirmed, true);
  assert.equal(resolveAttackCollision(attacker, defender), null);
});

test("high attacks can be crouched under while mid attacks hit crouching targets", () => {
  const crouching = fighter({ x: 200, y: 200, locomotion: STATES.locomotion.CROUCHING });

  const highAttacker = activeAttacker({ moveId: "light" });
  assert.equal(resolveAttackCollision(highAttacker, crouching), null);
  assert.equal(highAttacker.actionData.hitConfirmed, false);
  const midHit = resolveAttackCollision(activeAttacker({ moveId: "medium" }), crouching);
  assert.equal(midHit.hitLevel, "mid");
});

test("low attacks hit grounded targets but pass under airborne targets", () => {
  const standing = fighter({ x: 200, y: 200 });
  const crouching = fighter({ x: 200, y: 200, locomotion: STATES.locomotion.CROUCHING });
  const airborne = fighter({ x: 200, y: 200, locomotion: STATES.locomotion.JUMPING });

  assert.equal(resolveAttackCollision(activeAttacker({ moveId: "heavy" }), standing).hitLevel, "low");
  assert.equal(resolveAttackCollision(activeAttacker({ moveId: "heavy" }), crouching).hitLevel, "low");
  assert.equal(resolveAttackCollision(activeAttacker({ moveId: "heavy" }), airborne), null);
  assert.ok(resolveAttackCollision(activeAttacker({ moveId: "medium" }), airborne));
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

test("attack definitions cover high, mid, and low bands without changing horizontal reach", () => {
  const moves = ["light", "medium", "heavy"].map(id => ATTACK_DEFINITIONS[id]);

  assert.deepEqual(moves.map(move => move.hitLevel), ["high", "mid", "low"]);
  assert.deepEqual(moves.map(move => move.hitbox.width), [126, 160, 190]);
  assert.deepEqual(moves.map(move => move.hitbox.height), [72, 80, 72]);
  assert.deepEqual(moves.map(move => move.hitbox.offsetY), [-220, -152, -72]);
  assert.ok(moves[0].hitbox.offsetY < moves[1].hitbox.offsetY);
  assert.ok(moves[1].hitbox.offsetY < moves[2].hitbox.offsetY);
});


test("standing guard blocks high and mid attacks from the front", () => {
  for (const moveId of ["light", "medium"]) {
    const attacker = activeAttacker({ moveId });
    const defender = fighter({ x: 200, facing: -1, action: STATES.action.GUARD });
    defender.guardData = { guardHeight: "high" };
    const event = resolveAttackCollision(attacker, defender);
    assert.equal(event.type, "block");
    assert.equal(attacker.actionData.hitConfirmed, true);
  }
});

test("crouch guard blocks mid and low attacks but not high attacks", () => {
  for (const moveId of ["medium", "heavy"]) {
    const attacker = activeAttacker({ moveId });
    const defender = fighter({ x: 200, facing: -1, locomotion: STATES.locomotion.CROUCHING, action: STATES.action.GUARD });
    defender.guardData = { guardHeight: "low" };
    assert.equal(resolveAttackCollision(attacker, defender).type, "block");
  }

  const highAttacker = activeAttacker({ moveId: "light" });
  const crouchGuard = fighter({ x: 200, facing: -1, locomotion: STATES.locomotion.CROUCHING, action: STATES.action.GUARD });
  crouchGuard.guardData = { guardHeight: "low" };
  assert.equal(resolveAttackCollision(highAttacker, crouchGuard).type, "hit");
});

test("guard fails against attacks from behind or at the wrong height", () => {
  const rearAttacker = activeAttacker({ moveId: "medium", facing: 1 });
  const facingAway = fighter({ x: 200, facing: -1, action: STATES.action.GUARD });
  facingAway.guardData = { guardHeight: "high" };
  assert.equal(resolveAttackCollision(rearAttacker, facingAway).type, "hit");

  const lowAttacker = activeAttacker({ moveId: "heavy" });
  const standingGuard = fighter({ x: 200, facing: -1, action: STATES.action.GUARD });
  standingGuard.guardData = { guardHeight: "high" };
  assert.equal(resolveAttackCollision(lowAttacker, standingGuard).type, "hit");
});
