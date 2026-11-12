import { FIGHTER_STATES } from "../state/FighterStateController.js";

export const DAMAGE_PROFILES = Object.freeze({
  light: Object.freeze({ damage: 0.06, hitstunFrames: 12, knockback: 180, reaction: "hitstun" }),
  medium: Object.freeze({ damage: 0.10, hitstunFrames: 18, knockback: 260, reaction: "hitstun" }),
  heavy: Object.freeze({ damage: 0.15, hitstunFrames: 30, knockback: 360, reaction: "knockdown" })
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Applies confirmed hits and advances temporary hit reactions at 60 Hz. */
export class DamageController {
  applyHit(event) {
    if (!event || event.type !== "hit") return null;
    const profile = DAMAGE_PROFILES[event.moveId] ?? DAMAGE_PROFILES.medium;
    const defender = event.defender;
    defender.health = clamp((defender.health ?? 1) - profile.damage, 0, 1);
    const direction = Math.sign(defender.x - event.attacker.x) || event.attacker.facing || 1;
    defender.reactionData = {
      remainingFrames: profile.hitstunFrames,
      totalFrames: profile.hitstunFrames,
      knockbackVelocity: direction * profile.knockback,
      damage: profile.damage,
      moveId: event.moveId
    };
    defender.vx = defender.reactionData.knockbackVelocity;
    defender.airHorizontalVelocity = defender.vx;
    defender.stateController?.setReaction?.(defender, FIGHTER_STATES.reaction[profile.reaction.toUpperCase()]);
    return { ...profile, health: defender.health, defender };
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
