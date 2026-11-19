import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
import { ROUND_PHASES } from "../src/combat/RoundController.js";
import { FIGHTER_STATES } from "../src/state/FighterStateController.js";

function input({ axis = 0, pressed = [], down = [] } = {}) {
  return {
    getWorldAxis: () => axis,
    wasPressed: action => pressed.includes(action),
    isDown: action => down.includes(action)
  };
}

test("Arena stops movement and combat during a round result, then resets both fighters", () => {
  const arena = new Arena();
  arena.player.x = 350;
  arena.opponent.health = 0;

  // The existing combat prototype starts a round immediately. A KO is
  // evaluated at the end of the same fixed update and locks the arena.
  arena.update(1 / 60, input({ axis: 1, down: ["right"] }));
  assert.equal(arena.rounds.phase, ROUND_PHASES.ROUND_OVER);
  assert.equal(arena.rounds.roundWinner, "player");

  const lockedX = arena.player.x;
  arena.player.health = 0.2;
  arena.player.guardMeter = 10;
  arena.update(0.25, input({ axis: 1, down: ["right"] }));
  assert.equal(arena.player.x, lockedX);
  assert.equal(arena.player.health, 0.2);

  const resultRemaining = arena.rounds.phaseRemaining;
  arena.rounds.phaseRemaining = 0;
  arena.update(resultRemaining, input());
  assert.equal(arena.rounds.phase, ROUND_PHASES.ROUND_INTRO);
  assert.equal(arena.rounds.roundNumber, 2);
  assert.equal(arena.player.health, 1);
  assert.equal(arena.opponent.health, 1);
  assert.equal(arena.player.guardMeter, 100);
  assert.equal(arena.player.x, 780);
  assert.equal(arena.opponent.x, 1140);
  assert.equal(arena.cameraX, 480);
  assert.equal(arena.player.state.action, FIGHTER_STATES.action.NONE);
  assert.equal(arena.player.state.reaction, FIGHTER_STATES.reaction.NONE);
});

test("Arena rematch confirmation resets a completed match and its fighters", () => {
  const arena = new Arena();
  arena.rounds.phase = ROUND_PHASES.MATCH_OVER;
  arena.rounds.matchWinner = "player";
  arena.rounds.score.player = 2;
  arena.player.health = 0.1;
  arena.update(1 / 60, input({ pressed: ["Enter"] }));

  assert.equal(arena.rounds.phase, ROUND_PHASES.ACTIVE);
  assert.equal(arena.rounds.matchWinner, null);
  assert.deepEqual(arena.rounds.score, { player: 0, opponent: 0 });
  assert.equal(arena.player.health, 1);
  assert.equal(arena.opponent.health, 1);
});
