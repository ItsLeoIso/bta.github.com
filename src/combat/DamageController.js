import { FIGHTER_STATES } from "../state/FighterStateController.js";

export const DAMAGE_PROFILES = Object.freeze({
  light: Object.freeze({ damage: 0.06, chipDamage: 0.006, hitstunFrames: 12, knockback: 180, reaction: "hitstun" }),
  medium: Object.freeze({ damage: 0.10, chipDamage: 0.01, hitstunFrames: 18, knockback: 260, reaction: "hitstun" }),
  heavy: Object.freeze({ damage: 0.15, chipDamage: 0.015, hitstunFrames: 30, knockback: 360, reaction: "knockdown" }),
  special: Object.freeze({ damage: 0.08, chipDamage: 0.008, hitstunFrames: 18, knockback: 280, reaction: "hitstun" }),
  directionalSpecial: Object.freeze({ damage: 0.08, chipDamage: 0.008, hitstunFrames: 18, knockback: 280, reaction: "hitstun" })
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Applies confirmed hits, block chip damage, and temporary hit reactions. */
export class DamageController {
  applyHit(event, { damageScale = 1 } = {}) {
    if (!event || event.type !== "hit") return null;
    const profile = DAMAGE_PROFILES[event.moveId] ?? DAMAGE_PROFILES.medium;
    const defender = event.defender;
    const actualDamage = profile.damage * clamp(damageScale, 0.4, 1);
    defender.health = clamp((defender.health ?? 1) - actualDamage, 0, 1);
    const direction = Math.sign(event.knockbackDirection ?? 0) ||
      Math.sign(defender.x - event.attacker.x) || event.attacker.facing || 1;
    defender.reactionData = {
      remainingFrames: profile.hitstunFrames,
      totalFrames: profile.hitstunFrames,
      knockbackVelocity: direction * profile.knockback,
      damage: actualDamage,
      moveId: event.moveId
    };
    defender.vx = defender.reactionData.knockbackVelocity;
    defender.airHorizontalVelocity = defender.vx;

    // Medium is the prototype launcher. It only pops a grounded target; later
    // aerial hits preserve their current juggle trajectory instead of re-launching.
    if (event.launchVelocity > 0 && defender.onGround !== false) {
      defender.vy = -Math.abs(event.launchVelocity);
      defender.onGround = false;
      defender.stateController?.setLocomotion?.(
        defender,
        FIGHTER_STATES.locomotion.JUMPING
      );
    }

    defender.stateController?.setReaction?.(
      defender,
      FIGHTER_STATES.reaction[profile.reaction.toUpperCase()]
    );
    return { ...profile, damage: actualDamage, health: defender.health, defender };
  }

  /** Blocks deal 10% of the move's normal damage as chip in this prototype. */
  applyChipDamage(event) {
    if (!event || event.type !== "block") return null;
    const profile = DAMAGE_PROFILES[event.moveId] ?? DAMAGE_PROFILES.medium;
    const defender = event.defender;
    const damage = profile.chipDamage ?? 0;
    defender.health = clamp((defender.health ?? 1) - damage, 0, 1);
    return { damage, health: defender.health, defender };
  }

  update(fighter) {
    const data = fighter.reactionData;
    if (!data || fighter.state?.reaction === FIGHTER_STATES.reaction.NONE) return;
    data.remainingFrames = Math.max(0, data.remainingFrames - 1);
    data.knockbackVelocity *= 0.82;
    if (data.remainingFrames === 0) {
      fighter.reactionData = null;
      fighter.vx = 0;
      fighter.airHorizontalVelocity = 0;
      fighter.stateController?.clearReaction?.(fighter);
    }
  }
}
