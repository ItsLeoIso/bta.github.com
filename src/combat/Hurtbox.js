import { FIGHTER_STATES } from "../state/FighterStateController.js";

/**
 * Combat hurtboxes describe the hittable body volume. They are intentionally
 * independent of pushboxes, which only keep fighters from passing through one
 * another.
 */
// CanvasRenderer draws the fighter at 3x: 42x76 standing and 42x48 crouching.
// Combat volumes intentionally cover the complete visible silhouette, not a
// limb-accurate anatomical target.
export const HURTBOX_PROFILES = Object.freeze({
  standing: Object.freeze({ halfWidth: 63, height: 228 }),
  crouching: Object.freeze({ halfWidth: 63, height: 144 }),
  airborne: Object.freeze({ halfWidth: 63, height: 228 })
});

export function getHurtbox(fighter, profiles = HURTBOX_PROFILES) {
  const locomotion = fighter.state?.locomotion;
  const profile = locomotion === FIGHTER_STATES.locomotion.CROUCHING
    ? profiles.crouching
    : locomotion === FIGHTER_STATES.locomotion.JUMPING ||
        locomotion === FIGHTER_STATES.locomotion.FALLING
      ? profiles.airborne
      : profiles.standing;

  return {
    left: fighter.x - profile.halfWidth,
    right: fighter.x + profile.halfWidth,
    top: fighter.y - profile.height,
    bottom: fighter.y
  };
}
