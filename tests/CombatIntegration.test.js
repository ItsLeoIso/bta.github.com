import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
import { getActiveAttackHitbox } from "../src/combat/Hitbox.js";

function input({ axis = 0, pressed = [], down = [] } = {}) {
  return {
    getWorldAxis: () => axis,
    wasPressed: action => pressed.includes(action),
    isDown: action => down.includes(action)
  };
}

const neutral = input();

test("Arena resolves a Light hit only when its active frames overlap the opponent hurtbox", () => {
  const arena = new Arena();
  arena.player.x = 400;
  arena.opponent.x = 510;

  arena.update(1 / 60, input({ pressed: ["light"] }));
  assert.equal(arena.lastCombatEvent, null);
  assert.equal(getActiveAttackHitbox(arena.player), null);

  for (let frame = 0; frame < 4; frame += 1) {
    arena.update(1 / 60, neutral);
    assert.equal(arena.lastCombatEvent, null);
  }

  arena.update(1 / 60, neutral);
  assert.equal(arena.lastCombatEvent?.type, "hit");
  assert.equal(arena.lastCombatEvent?.moveId, "light");
  assert.equal(arena.player.actionData.hitConfirmed, true);
  assert.equal(arena.opponent.health, 1, "damage is reserved for the next combat milestone");
  assert.equal(arena.lastHit.moveName, "Light");
});

test("Arena preserves a miss so a later active frame can still connect", () => {
  const arena = new Arena();
  arena.player.x = 300;
  arena.opponent.x = 660;

  arena.update(1 / 60, input({ pressed: ["heavy"] }));
  for (let frame = 0; frame < 12; frame += 1) arena.update(1 / 60, neutral);
  assert.equal(arena.player.actionData.phase, "active");
  assert.notEqual(arena.player.actionData.hitConfirmed, true);
  assert.equal(arena.lastCombatEvent, null);

  arena.opponent.x = 440;
  arena.player.facing = 1;
  arena.update(1 / 60, neutral);
  assert.equal(arena.lastCombatEvent?.type, "hit");
});
