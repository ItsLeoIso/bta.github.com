/**
 * Tracks one active combo per defender. The timer is fixed-step simulation
 * frames; airborne juggle hits are capped to prevent infinite re-launch routes.
 */
export class ComboTracker {
  constructor({ comboWindowFrames = 45, maxJuggleHits = 3, damageScaleStep = 0.1, minimumDamageScale = 0.4 } = {}) {
    if (!Number.isInteger(comboWindowFrames) || comboWindowFrames < 1) throw new RangeError("Combo window must be a positive frame count.");
    if (!Number.isInteger(maxJuggleHits) || maxJuggleHits < 1) throw new RangeError("Maximum juggle hits must be a positive integer.");
    if (!Number.isFinite(damageScaleStep) || damageScaleStep < 0 || damageScaleStep > 1) throw new RangeError("Combo damage scale step must be between 0 and 1.");
    if (!Number.isFinite(minimumDamageScale) || minimumDamageScale <= 0 || minimumDamageScale > 1) throw new RangeError("Minimum combo damage scale must be in (0, 1].");
    Object.assign(this, { comboWindowFrames, maxJuggleHits, damageScaleStep, minimumDamageScale });
    this.combos = new Map();
  }

  update() {
    for (const [defender, combo] of this.combos) {
      combo.remainingFrames = Math.max(0, combo.remainingFrames - 1);
      if (combo.remainingFrames === 0) this.combos.delete(defender);
    }
  }

  canRegisterHit(event) {
    const combo = this.combos.get(event?.defender);
    if (!combo || combo.attacker !== event.attacker || combo.remainingFrames <= 0) return true;
    return event.defender.onGround !== false || combo.juggleHits < this.maxJuggleHits;
  }

  getDamageScale(event) {
    const combo = this.combos.get(event?.defender);
    if (!combo || combo.attacker !== event.attacker || combo.remainingFrames <= 0) return 1;
    return Math.max(this.minimumDamageScale, 1 - combo.hitCount * this.damageScaleStep);
  }

  recordHit(event, damage, { wasAirborne = event?.defender?.onGround === false } = {}) {
    const defender = event.defender;
    let combo = this.combos.get(defender);
    if (!combo || combo.attacker !== event.attacker || combo.remainingFrames <= 0) {
      combo = { attacker: event.attacker, hitCount: 0, totalDamage: 0, juggleHits: 0, airCombo: false, remainingFrames: this.comboWindowFrames };
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
    for (const combo of this.combos.values()) {
      if (combo.attacker === attacker && combo.remainingFrames > 0) return { ...combo };
    }
    return null;
  }

  reset() { this.combos.clear(); }
}
