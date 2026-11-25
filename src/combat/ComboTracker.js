import { FIGHTER_STATES, isGrounded } from "../state/FighterStateController.js";

/**
 * Tracks a hit-confirmed combo only while the defender is still in a reaction.
 * The fixed-frame window is a safety timeout, not extra hitstun or invulnerability.
 */
export class ComboTracker {
  constructor({
    comboWindowFrames = 45,
    maxJuggleHits = 3,
    damageScaleStep = 0.1,
    minimumDamageScale = 0.4
  } = {}) {
    if (!Number.isInteger(comboWindowFrames) || comboWindowFrames < 1) {
      throw new RangeError("Combo window must be a positive frame count.");
    }
    if (!Number.isInteger(maxJuggleHits) || maxJuggleHits < 1) {
      throw new RangeError("Maximum juggle hits must be a positive integer.");
    }
    if (!Number.isFinite(damageScaleStep) || damageScaleStep < 0 || damageScaleStep > 1) {
      throw new RangeError("Combo damage scale step must be between 0 and 1.");
    }
    if (!Number.isFinite(minimumDamageScale) || minimumDamageScale <= 0 || minimumDamageScale > 1) {
      throw new RangeError("Minimum combo damage scale must be in (0, 1].");
    }
    Object.assign(this, { comboWindowFrames, maxJuggleHits, damageScaleStep, minimumDamageScale });
    this.combos = new Map();
  }

  defenderIsInReaction(defender) {
    // Legacy test fixtures without a state channel retain their time-window behaviour.
    return defender?.state?.reaction !== FIGHTER_STATES.reaction.NONE;
  }

  update() {
    for (const [defender, combo] of this.combos) {
      if (!this.defenderIsInReaction(defender)) {
        this.combos.delete(defender);
        continue;
      }
      combo.remainingFrames = Math.max(0, combo.remainingFrames - 1);
      if (combo.remainingFrames === 0) this.combos.delete(defender);
    }
  }

  canRegisterHit(event) {
    const combo = this.combos.get(event?.defender);
    if (
      !combo ||
      combo.attacker !== event.attacker ||
      combo.remainingFrames <= 0 ||
      !this.defenderIsInReaction(event.defender)
    ) return true;

    return isGrounded(event.defender) || combo.juggleHits < this.maxJuggleHits;
  }

  getDamageScale(event) {
    const combo = this.combos.get(event?.defender);
    if (
      !combo ||
      combo.attacker !== event.attacker ||
      combo.remainingFrames <= 0 ||
      !this.defenderIsInReaction(event.defender)
    ) return 1;
    return Math.max(this.minimumDamageScale, 1 - combo.hitCount * this.damageScaleStep);
  }

  recordHit(event, damage, { wasAirborne = !isGrounded(event?.defender) } = {}) {
    const defender = event.defender;
    let combo = this.combos.get(defender);
    if (
      !combo ||
      combo.attacker !== event.attacker ||
      combo.remainingFrames <= 0 ||
      !this.defenderIsInReaction(defender)
    ) {
      combo = {
        attacker: event.attacker,
        hitCount: 0,
        totalDamage: 0,
        juggleHits: 0,
        airCombo: false,
        remainingFrames: this.comboWindowFrames
      };
    }
    combo.hitCount += 1;
    combo.totalDamage += damage;
    combo.remainingFrames = this.comboWindowFrames;
    if (wasAirborne) {
      combo.juggleHits += 1;
      combo.airCombo = true;
    }
    this.combos.set(defender, combo);
    return { ...combo };
  }

  getComboForAttacker(attacker) {
    for (const [defender, combo] of this.combos) {
      if (
        combo.attacker === attacker &&
        combo.remainingFrames > 0 &&
        this.defenderIsInReaction(defender)
      ) return { ...combo };
    }
    return null;
  }

  saveState(fighters = []) {
    const entries = [];
    for (const [defender, combo] of this.combos) {
      const defenderSlot = Number.isInteger(defender?.slot)
        ? defender.slot
        : fighters.indexOf(defender);
      const attackerSlot = Number.isInteger(combo.attacker?.slot)
        ? combo.attacker.slot
        : fighters.indexOf(combo.attacker);
      if (defenderSlot < 0 || attackerSlot < 0) continue;
      entries.push({
        defenderSlot,
        attackerSlot,
        hitCount: combo.hitCount,
        totalDamage: combo.totalDamage,
        juggleHits: combo.juggleHits,
        airCombo: Boolean(combo.airCombo),
        remainingFrames: combo.remainingFrames
      });
    }
    entries.sort((a, b) => a.defenderSlot - b.defenderSlot);
    return entries;
  }

  loadState(snapshot = [], fighters = []) {
    this.combos.clear();
    if (!Array.isArray(snapshot)) return;
    for (const entry of snapshot) {
      const defender = fighters[entry.defenderSlot];
      const attacker = fighters[entry.attackerSlot];
      if (!defender || !attacker) continue;
      this.combos.set(defender, {
        attacker,
        hitCount: entry.hitCount,
        totalDamage: entry.totalDamage,
        juggleHits: entry.juggleHits,
        airCombo: Boolean(entry.airCombo),
        remainingFrames: entry.remainingFrames
      });
    }
  }

  reset() {
    this.combos.clear();
  }
}
