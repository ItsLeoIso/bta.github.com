export const ROUND_PHASES = Object.freeze({
  ACTIVE: "active",
  ROUND_INTRO: "roundIntro",
  ROUND_OVER: "roundOver",
  MATCH_OVER: "matchOver"
});

export const ROUND_DEFAULTS = Object.freeze({
  durationSeconds: 99,
  roundsToWin: 2,
  resultSeconds: 2.25,
  introSeconds: 1.1,
  fightBannerSeconds: 0.85
});

const HEALTH_EPSILON = 1e-9;
const SIM_HZ = 60;

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function secondsToFrames(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds * SIM_HZ));
}

function deltaToFrames(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.max(1, Math.round(deltaSeconds * SIM_HZ));
}

function winnerToSlot(winner) {
  if (winner === "player") return 0;
  if (winner === "opponent") return 1;
  return null;
}

function slotToWinner(slot) {
  if (slot === 0) return "player";
  if (slot === 1) return "opponent";
  return null;
}

/**
 * Owns round timing and match progression.
 *
 * Prototype defaults are 99 seconds per round and first-to-two round wins.
 * Gameplay timers run on canonical 60 Hz integer frame counts for rollback determinism.
 */
export class RoundController {
  constructor({
    durationSeconds = ROUND_DEFAULTS.durationSeconds,
    roundsToWin = ROUND_DEFAULTS.roundsToWin,
    resultSeconds = ROUND_DEFAULTS.resultSeconds,
    introSeconds = ROUND_DEFAULTS.introSeconds,
    fightBannerSeconds = ROUND_DEFAULTS.fightBannerSeconds
  } = {}) {
    if (!isPositiveNumber(durationSeconds)) {
      throw new RangeError("Round duration must be a positive number.");
    }
    if (!Number.isInteger(roundsToWin) || roundsToWin < 1) {
      throw new RangeError("Rounds to win must be a positive integer.");
    }
    if (!Number.isFinite(resultSeconds) || resultSeconds < 0) {
      throw new RangeError("Round result duration cannot be negative.");
    }
    if (!Number.isFinite(introSeconds) || introSeconds < 0) {
      throw new RangeError("Round intro duration cannot be negative.");
    }
    if (!Number.isFinite(fightBannerSeconds) || fightBannerSeconds < 0) {
      throw new RangeError("Fight banner duration cannot be negative.");
    }

    this.durationSeconds = durationSeconds;
    this.durationFrames = secondsToFrames(durationSeconds);
    this.roundsToWin = roundsToWin;
    this.resultSeconds = resultSeconds;
    this.resultFrames = secondsToFrames(resultSeconds);
    this.introSeconds = introSeconds;
    this.introFrames = secondsToFrames(introSeconds);
    this.fightBannerSeconds = fightBannerSeconds;
    this.resetMatch();
  }

  get timerRemaining() {
    return this.timerRemainingFrames / SIM_HZ;
  }

  set timerRemaining(seconds) {
    this.timerRemainingFrames = secondsToFrames(seconds);
  }

  get phaseRemaining() {
    return this.phaseRemainingFrames / SIM_HZ;
  }

  set phaseRemaining(seconds) {
    this.phaseRemainingFrames = secondsToFrames(seconds);
  }

  resetMatch() {
    this.roundNumber = 1;
    this.score = { player: 0, opponent: 0 };
    this.matchWinner = null;
    this.roundWinner = null;
    this.resultReason = null;
    this.phase = ROUND_PHASES.ACTIVE;
    this.phaseRemainingFrames = 0;
    this.timerRemainingFrames = this.durationFrames;
    this.bannerText = "ROUND 1 · FIGHT!";
    this.bannerRemaining = this.fightBannerSeconds;
  }

  saveState() {
    return {
      roundNumber: this.roundNumber,
      score: [this.score.player, this.score.opponent],
      phase: this.phase,
      phaseRemainingFrames: this.phaseRemainingFrames,
      timerRemainingFrames: this.timerRemainingFrames,
      roundWinnerSlot: winnerToSlot(this.roundWinner),
      matchWinnerSlot: winnerToSlot(this.matchWinner),
      resultReason: this.resultReason
    };
  }

  loadState(snapshot) {
    if (!snapshot) return;
    this.roundNumber = snapshot.roundNumber;
    this.score = {
      player: snapshot.score[0],
      opponent: snapshot.score[1]
    };
    this.phase = snapshot.phase;
    this.phaseRemainingFrames = snapshot.phaseRemainingFrames;
    this.timerRemainingFrames = snapshot.timerRemainingFrames;
    this.roundWinner = slotToWinner(snapshot.roundWinnerSlot);
    this.matchWinner = slotToWinner(snapshot.matchWinnerSlot);
    this.resultReason = snapshot.resultReason;
  }

  update(deltaSeconds, {
    playerHealth = 1,
    opponentHealth = 1,
    confirmPressed = false
  } = {}) {
    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    const stepFrames = deltaToFrames(delta);

    if (this.phase === ROUND_PHASES.MATCH_OVER) {
      if (confirmPressed) {
        this.resetMatch();
        return { type: "matchReset" };
      }
      return null;
    }

    if (this.phase === ROUND_PHASES.ROUND_INTRO) {
      this.phaseRemainingFrames = Math.max(0, this.phaseRemainingFrames - stepFrames);
      if (this.phaseRemainingFrames === 0) {
        this.beginActiveRound();
        return { type: "roundStart" };
      }
      return null;
    }

    if (this.phase === ROUND_PHASES.ROUND_OVER) {
      this.phaseRemainingFrames = Math.max(0, this.phaseRemainingFrames - stepFrames);
      if (this.phaseRemainingFrames === 0) {
        if (this.score.player >= this.roundsToWin) {
          this.matchWinner = "player";
          this.phase = ROUND_PHASES.MATCH_OVER;
          return { type: "matchEnd" };
        }
        if (this.score.opponent >= this.roundsToWin) {
          this.matchWinner = "opponent";
          this.phase = ROUND_PHASES.MATCH_OVER;
          return { type: "matchEnd" };
        }

        this.roundNumber += 1;
        this.beginRoundIntro();
        return { type: "nextRound" };
      }
      return null;
    }

    if (this.phase !== ROUND_PHASES.ACTIVE) return null;

    this.bannerRemaining = Math.max(0, this.bannerRemaining - delta);

    const playerHealthValue = Number.isFinite(playerHealth) ? playerHealth : 0;
    const opponentHealthValue = Number.isFinite(opponentHealth) ? opponentHealth : 0;
    const playerKnockedOut = playerHealthValue <= 0;
    const opponentKnockedOut = opponentHealthValue <= 0;

    // KO takes precedence over timeout when both happen on the same update.
    if (playerKnockedOut || opponentKnockedOut) {
      if (playerKnockedOut && opponentKnockedOut) {
        this.finishRound(null, "doubleKO");
      } else {
        this.finishRound(playerKnockedOut ? "opponent" : "player", "ko");
      }
      return { type: "roundEnd" };
    }

    this.timerRemainingFrames = Math.max(0, this.timerRemainingFrames - stepFrames);
    if (this.timerRemainingFrames === 0) {
      const difference = playerHealthValue - opponentHealthValue;
      const winner = Math.abs(difference) <= HEALTH_EPSILON
        ? null
        : difference > 0
          ? "player"
          : "opponent";
      this.finishRound(winner, "timeout");
      return { type: "roundEnd" };
    }

    return null;
  }

  finishRound(winner, reason) {
    if (this.phase !== ROUND_PHASES.ACTIVE) return false;
    if (winner !== null && winner !== "player" && winner !== "opponent") {
      throw new RangeError("Round winner must be player, opponent, or null.");
    }

    this.roundWinner = winner;
    this.resultReason = reason;
    if (winner) this.score[winner] += 1;
    this.phase = ROUND_PHASES.ROUND_OVER;
    this.phaseRemainingFrames = this.resultFrames;
    this.bannerRemaining = 0;
    return true;
  }

  beginRoundIntro() {
    this.phase = ROUND_PHASES.ROUND_INTRO;
    this.phaseRemainingFrames = this.introFrames;
    this.timerRemainingFrames = this.durationFrames;
    this.roundWinner = null;
    this.resultReason = null;
    this.bannerText = "ROUND " + this.roundNumber;
    this.bannerRemaining = 0;
  }

  beginActiveRound() {
    this.phase = ROUND_PHASES.ACTIVE;
    this.phaseRemainingFrames = 0;
    this.timerRemainingFrames = this.durationFrames;
    this.bannerText = "FIGHT!";
    this.bannerRemaining = this.fightBannerSeconds;
  }
}
