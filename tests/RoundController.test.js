import test from "node:test";
import assert from "node:assert/strict";
import { ROUND_PHASES, RoundController } from "../src/combat/RoundController.js";

function advanceToNextRound(rounds, playerHealth = 1, opponentHealth = 1) {
  rounds.update(rounds.resultSeconds, { playerHealth, opponentHealth });
  return rounds.update(rounds.introSeconds, { playerHealth, opponentHealth });
}

test("a new match starts at round one with a full 99-second timer and no score", () => {
  const rounds = new RoundController();
  assert.equal(rounds.phase, ROUND_PHASES.ACTIVE);
  assert.equal(rounds.roundNumber, 1);
  assert.equal(rounds.timerRemaining, 99);
  assert.deepEqual(rounds.score, { player: 0, opponent: 0 });
  assert.equal(rounds.bannerText, "ROUND 1 · FIGHT!");
});

test("the timer counts down only during active combat", () => {
  const rounds = new RoundController({
    durationSeconds: 10,
    introSeconds: 2,
    fightBannerSeconds: 0
  });
  rounds.update(3);
  rounds.finishRound("player", "ko");
  rounds.update(1);
  assert.equal(rounds.phase, ROUND_PHASES.ROUND_OVER);
  assert.equal(rounds.timerRemaining, 7);
});

test("KO awards a round immediately and starts the next round after the result screen", () => {
  const rounds = new RoundController({
    resultSeconds: 0.5,
    introSeconds: 0.25,
    fightBannerSeconds: 0
  });
  const result = rounds.update(1 / 60, { playerHealth: 0.5, opponentHealth: 0 });
  assert.deepEqual(result, { type: "roundEnd" });
  assert.equal(rounds.phase, ROUND_PHASES.ROUND_OVER);
  assert.equal(rounds.roundWinner, "player");
  assert.equal(rounds.resultReason, "ko");
  assert.equal(rounds.score.player, 1);

  const nextRound = advanceToNextRound(rounds);
  assert.deepEqual(nextRound, { type: "roundStart" });
  assert.equal(rounds.roundNumber, 2);
  assert.equal(rounds.phase, ROUND_PHASES.ACTIVE);
  assert.equal(rounds.timerRemaining, 99);
  assert.deepEqual(rounds.score, { player: 1, opponent: 0 });
});

test("timeout awards the round to the fighter with more remaining health", () => {
  const rounds = new RoundController({
    durationSeconds: 1,
    resultSeconds: 0.25,
    fightBannerSeconds: 0
  });
  const result = rounds.update(1, { playerHealth: 0.4, opponentHealth: 0.2 });
  assert.deepEqual(result, { type: "roundEnd" });
  assert.equal(rounds.resultReason, "timeout");
  assert.equal(rounds.roundWinner, "player");
  assert.equal(rounds.score.player, 1);
});

test("a timeout tie and a double KO are draws with no score awarded", () => {
  const timeout = new RoundController({ durationSeconds: 1, fightBannerSeconds: 0 });
  timeout.update(1, { playerHealth: 0.5, opponentHealth: 0.5 });
  assert.equal(timeout.roundWinner, null);
  assert.equal(timeout.resultReason, "timeout");
  assert.deepEqual(timeout.score, { player: 0, opponent: 0 });

  const doubleKo = new RoundController({ fightBannerSeconds: 0 });
  doubleKo.update(1 / 60, { playerHealth: 0, opponentHealth: 0 });
  assert.equal(doubleKo.roundWinner, null);
  assert.equal(doubleKo.resultReason, "doubleKO");
  assert.deepEqual(doubleKo.score, { player: 0, opponent: 0 });
});

test("two round wins end a best-of-three match and Enter resets it for a rematch", () => {
  const rounds = new RoundController({
    resultSeconds: 0.1,
    introSeconds: 0.1,
    fightBannerSeconds: 0
  });

  rounds.update(1 / 60, { playerHealth: 1, opponentHealth: 0 });
  rounds.update(0.1);
  rounds.update(0.1);
  rounds.update(1 / 60, { playerHealth: 1, opponentHealth: 0 });
  assert.equal(rounds.score.player, 2);
  assert.equal(rounds.phase, ROUND_PHASES.ROUND_OVER);

  const matchEnd = rounds.update(0.1);
  assert.deepEqual(matchEnd, { type: "matchEnd" });
  assert.equal(rounds.phase, ROUND_PHASES.MATCH_OVER);
  assert.equal(rounds.matchWinner, "player");

  const rematch = rounds.update(0, { confirmPressed: true });
  assert.deepEqual(rematch, { type: "matchReset" });
  assert.equal(rounds.phase, ROUND_PHASES.ACTIVE);
  assert.equal(rounds.roundNumber, 1);
  assert.deepEqual(rounds.score, { player: 0, opponent: 0 });
  assert.equal(rounds.timerRemaining, 99);
});

test("round defaults reject invalid durations and scoring targets", () => {
  assert.throws(() => new RoundController({ durationSeconds: 0 }), RangeError);
  assert.throws(() => new RoundController({ roundsToWin: 1.5 }), RangeError);
});
