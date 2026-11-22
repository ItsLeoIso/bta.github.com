import test from "node:test";
import assert from "node:assert/strict";
import { OpponentAIController } from "../src/ai/OpponentAIController.js";
import { Arena } from "../src/engine/Arena.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function fighter(x, facing = 1) {
  return {
    x, y: 440, facing, onGround: true,
    state: { locomotion: STATES.locomotion.STANDING, action: STATES.action.NONE, reaction: STATES.reaction.NONE },
    actionData: {}
  };
}

test("CPU approaches the target using screen-relative movement", () => {
  const cpu = fighter(500, -1);
  const target = fighter(200, 1);
  const ai = new OpponentAIController();
  const input = ai.update(cpu, target);

  assert.equal(input.getWorldAxis(), -1);
  assert.equal(input.wasPressed("left"), true);
  assert.equal(input.wasPressed("right"), false);
});

test("CPU selects a deterministic attack when it reaches its attack range", () => {
  const cpu = fighter(400, -1);
  const target = fighter(200, 1);
  const ai = new OpponentAIController({ attackCooldownFrames: 0 });
  const input = ai.update(cpu, target);

  assert.equal(input.getWorldAxis(), 0);
  assert.equal(input.wasPressed("light"), true);
  assert.equal(input.wasPressed("medium"), false);

  cpu.state.action = STATES.action.ATTACK;
  const duringAttack = ai.update(cpu, target);
  assert.equal(duringAttack.wasPressed("light"), false);
});

test("CPU briefly crouch-blocks a visible active low attack", () => {
  const cpu = fighter(300, -1);
  const player = fighter(200, 1);
  player.state.action = STATES.action.ATTACK;
  player.actionData = { phase: "active", startupFrames: 12, hitLevel: "low" };
  const ai = new OpponentAIController();
  const input = ai.update(cpu, player);

  assert.equal(input.getWorldAxis(), 1);
  assert.equal(input.isDown("crouch"), true);
  assert.equal(ai.blockFramesRemaining, 9);
});

test("CPU profile is enabled for the browser match and both sides exchange attacks", () => {
  const arena = new Arena({ opponentAIEnabled: true });
  assert.equal(arena.player.moveSpeed, 300);
  assert.equal(arena.player.damageMultiplier, 1);
  assert.equal(arena.opponent.moveSpeed, 260);
  assert.equal(arena.opponent.damageMultiplier, 1.05);

  for (let frame = 0; frame < 100; frame += 1) {
    arena.update(1 / 60, { getWorldAxis: () => 0, wasPressed: () => false, isDown: () => false });
    if (arena.player.health < 1) break;
  }

  assert.ok(arena.opponent.x < 1140, "CPU should walk toward the player");
  assert.ok(arena.player.health < 1, "CPU should be able to land a real attack");
});

test("CPU is opt-in in the isolated Arena simulation harness", () => {
  const arena = new Arena();
  arena.update(1 / 60, { getWorldAxis: () => 0, wasPressed: () => false, isDown: () => false });
  assert.equal(arena.opponentAI, null);
  assert.equal(arena.opponent.x, 1140);
});

test("invalid AI ranges and timing values are rejected", () => {
  assert.throws(() => new OpponentAIController({ attackRange: 0 }), RangeError);
  assert.throws(() => new OpponentAIController({ guardRange: 10 }), RangeError);
  assert.throws(() => new OpponentAIController({ attackCooldownFrames: -1 }), RangeError);
  assert.throws(() => new OpponentAIController({ blockReactionFrames: -1 }), RangeError);
});
