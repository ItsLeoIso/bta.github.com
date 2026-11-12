import { FIGHTER_STATES } from "../state/FighterStateController.js";

/**
 * Combat hurtboxes describe the hittable body volume. They are intentionally
 * independent of pushboxes, which only keep fighters from passing through one
 * another.
 */
export const HURTBOX_PROFILES = Object.freeze({
  standing: Object.freeze({ halfWidth: 34, height: 76 }),
  crouching: Object.freeze({ halfWidth: 38, height: 48 }),
  airborne: Object.freeze({ halfWidth: 32, height: 66 })
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
