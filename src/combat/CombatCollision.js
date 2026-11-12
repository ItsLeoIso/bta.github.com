import { getHurtbox } from "./Hurtbox.js";
import { getActiveAttackHitbox } from "./Hitbox.js";
import { FIGHTER_STATES } from "../state/FighterStateController.js";

export function boxesOverlap(first, second) {
  return first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top;
}

function canGuardAttack(attacker, defender, hitLevel) {
  if (defender.state?.action !== FIGHTER_STATES.action.GUARD) return false;
  const incomingDirection = Math.sign(attacker.x - defender.x);
  if (incomingDirection === 0 || incomingDirection !== defender.facing) return false;

  const guardHeight = defender.guardData?.guardHeight ??
    defender.actionData?.guardHeight;
  if (hitLevel === "high") return guardHeight === "high";
  if (hitLevel === "low") return guardHeight === "low";
  return guardHeight === "high" || guardHeight === "low";
}

/** Resolve one attack outcome (hit or block) per attack action. */
export function resolveAttackCollision(attacker, defender) {
  const hitbox = getActiveAttackHitbox(attacker);
  if (!hitbox) return null;

  const hitLevel = attacker.actionData.hitLevel ?? "mid";
  const defenderLocomotion = defender.state?.locomotion;

  // Highs can be crouched under; lows pass beneath airborne fighters.
  if (
    hitLevel === "high" &&
    defenderLocomotion === FIGHTER_STATES.locomotion.CROUCHING &&
    defender.state?.action !== FIGHTER_STATES.action.GUARD
  ) return null;
  if (
    hitLevel === "low" &&
    (defenderLocomotion === FIGHTER_STATES.locomotion.JUMPING ||
      defenderLocomotion === FIGHTER_STATES.locomotion.FALLING)
  ) return null;

  const hurtbox = getHurtbox(defender);
  if (!boxesOverlap(hitbox, hurtbox)) return null;

  attacker.actionData.hitConfirmed = true;
  const blocked = canGuardAttack(attacker, defender, hitLevel);
  return {
    type: blocked ? "block" : "hit",
    moveId: attacker.actionData.moveId,
    moveName: attacker.actionData.moveName,
    hitLevel,
    attacker,
    defender,
    hitbox,
    hurtbox,
    attackFrame: attacker.actionData.phaseFrame
  };
}
