import { getHurtbox } from "./Hurtbox.js";
import { getActiveAttackHitbox } from "./Hitbox.js";

export function boxesOverlap(first, second) {
  return first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top;
}

/**
 * Resolves at most one hit per attack action. This reports a combat event only;
 * health loss and hitstun are kept for the damage/reaction milestone.
 */
export function resolveAttackCollision(attacker, defender) {
  const hitbox = getActiveAttackHitbox(attacker);
  if (!hitbox) return null;

  const hurtbox = getHurtbox(defender);
  if (!boxesOverlap(hitbox, hurtbox)) return null;

  attacker.actionData.hitConfirmed = true;
  return {
    type: "hit",
    moveId: attacker.actionData.moveId,
    moveName: attacker.actionData.moveName,
    attacker,
    defender,
    hitbox,
    hurtbox,
    attackFrame: attacker.actionData.phaseFrame
  };
}
