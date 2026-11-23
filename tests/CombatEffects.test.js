import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
import { CombatEffects } from "../src/effects/CombatEffects.js";

function event(type, options = {}) {
  return {
    type,
    outcome: options.outcome ?? type,
    moveId: options.moveId ?? "medium",
    hitLevel: options.hitLevel ?? "mid",
    attacker: { x: 100 },
    defender: { x: 180, y: 440 },
    hitbox: { left: 130, right: 195, top: 280, bottom: 360 },
    hurtbox: { left: 150, right: 210, top: 250, bottom: 440 }
  };
}
function input(pressed = []) {
  return {
    getWorldAxis: () => 0,
    wasPressed: action => pressed.includes(action),
    isDown: () => false
  };
}

test("confirmed hits create deterministic sparks and an expanding impact ring", () => {
  const first = new CombatEffects();
  const second = new CombatEffects();
  assert.equal(first.trigger(event("hit")), true);
  assert.equal(second.trigger(event("hit")), true);
  assert.deepEqual(first.particles, second.particles);
  assert.equal(first.particles[0].kind, "ring");
  assert.ok(first.particles.length > 8);
  assert.equal(first.particles[0].x, 172.5);
  assert.equal(first.particles[0].y, 320);
  assert.ok(first.shakeMagnitude > 0);
});

test("blocks use a smaller cool impact than hits and guard breaks are strongest", () => {
  const block = new CombatEffects();
  const hit = new CombatEffects();
  const guardBreak = new CombatEffects();
  block.trigger(event("block"));
  hit.trigger(event("hit"));
  guardBreak.trigger(event("block", { outcome: "guardBreak" }));
  assert.ok(block.shakeMagnitude < hit.shakeMagnitude);
  assert.ok(hit.shakeMagnitude < guardBreak.shakeMagnitude);
  assert.equal(block.particles.length, 7);
  assert.equal(block.particles[0].color, "#e8f7ff");
  assert.equal(guardBreak.particles.length, 16);
});

test("projectile impacts use the projectile contact point", () => {
  const effects = new CombatEffects();
  const impact = event("hit", { moveId: "arcLance" });
  impact.projectile = { x: 318, y: 244 };
  effects.trigger(impact);
  assert.equal(effects.particles[0].x, 318);
  assert.equal(effects.particles[0].y, 244);
  assert.equal(effects.shakeMagnitude, 6.5);
});

test("effects expire, their shake settles, and reset clears all presentation state", () => {
  const effects = new CombatEffects();
  effects.trigger(event("hit"));
  effects.update(0.05);
  assert.ok(effects.particles.length > 0);
  assert.notDeepEqual(effects.getShakeOffset(), { x: 0, y: 0 });
  effects.update(1);
  assert.equal(effects.particles.length, 0);
  assert.deepEqual(effects.getShakeOffset(), { x: 0, y: 0 });
  effects.trigger(event("hit"));
  effects.reset();
  assert.equal(effects.particles.length, 0);
  assert.equal(effects.shakeMagnitude, 0);
  assert.deepEqual(effects.getShakeOffset(), { x: 0, y: 0 });
});

test("non-contact events do not create combat effects", () => {
  const effects = new CombatEffects();
  assert.equal(effects.trigger(event("juggleDrop")), false);
  assert.equal(effects.trigger(null), false);
  assert.equal(effects.particles.length, 0);
});

test("Arena triggers impact effects on real hit confirms and clears them on Training reset", () => {
  const arena = new Arena({ trainingMode: true });
  arena.player.x = 400;
  arena.opponent.x = 510;
  let hit = false;
  for (let frame = 0; frame < 12 && !hit; frame += 1) {
    arena.update(1 / 60, input(frame === 0 ? ["light"] : []));
    hit = arena.lastCombatEvent?.type === "hit";
  }
  assert.equal(hit, true);
  assert.ok(arena.combatEffects.particles.length > 0);
  assert.ok(arena.combatEffects.shakeMagnitude > 0);
  assert.equal(arena.resetTraining(), true);
  assert.equal(arena.combatEffects.particles.length, 0);
  assert.equal(arena.combatEffects.shakeMagnitude, 0);
});
