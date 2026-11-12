import { FIGHTER_STATES } from "../state/FighterStateController.js";

/** Returns the world-space attack volume only while its move is active. */
export function getActiveAttackHitbox(fighter) {
  const data = fighter.actionData;
  if (
    fighter.state?.action !== FIGHTER_STATES.action.ATTACK ||
    data?.phase !== "active" ||
    data.hitConfirmed ||
    !data.hitbox
  ) {
    return null;
  }

  const { offsetX, offsetY, width, height } = data.hitbox;
  const left = fighter.facing >= 0
    ? fighter.x + offsetX
    : fighter.x - offsetX - width;
  const top = fighter.y + offsetY;

  return { left, right: left + width, top, bottom: top + height };
}
