import { FIGHTER_STATES } from "../state/FighterStateController.js";

export const BLOCK_PROFILES = Object.freeze({
  high: Object.freeze({ blockstunFrames: 8, knockback: 55 }),
  mid: Object.freeze({ blockstunFrames: 8, knockback: 55 }),
  low: Object.freeze({ blockstunFrames: 10, knockback: 70 })
});

/** Directional guard: hold away; add crouch to defend against low attacks. */
export class GuardController {
  constructor({ stateController } = {}) {
    this.stateController = stateController;
  }

  update(fighter, input) {
    const states = this.stateController;
    states.initialize(fighter);
    const axis = input.getWorldAxis
      ? input.getWorldAxis("horizontal")
      : input.getAxis("horizontal", fighter.facing) * fighter.facing;
    const holdingBack = axis * fighter.facing < 0;
    const crouchGuard = Boolean(input.isDown?.("crouch"));

    if (fighter.state.action === FIGHTER_STATES.action.GUARD) {
      if (!fighter.onGround || !holdingBack) {
        states.endAction(fighter, FIGHTER_STATES.action.GUARD);
        fighter.guardData = null;
        return;
      }
      fighter.guardData.guardHeight = crouchGuard ? "low" : "high";
      states.setLocomotion(
        fighter,
        crouchGuard
          ? FIGHTER_STATES.locomotion.CROUCHING
          : FIGHTER_STATES.locomotion.STANDING
      );
      return;
    }

    if (
      holdingBack &&
      fighter.onGround &&
      fighter.state.action === FIGHTER_STATES.action.NONE &&
      fighter.state.reaction === FIGHTER_STATES.reaction.NONE
    ) {
      const guardHeight = crouchGuard ? "low" : "high";
      if (states.startAction(fighter, FIGHTER_STATES.action.GUARD, { guardHeight })) {
        fighter.guardData = { guardHeight };
        states.setLocomotion(
          fighter,
          crouchGuard
            ? FIGHTER_STATES.locomotion.CROUCHING
            : FIGHTER_STATES.locomotion.STANDING
        );
      }
    }
  }

  applyBlock(event) {
    if (!event || event.type !== "block") return null;
    const defender = event.defender;
    const profile = BLOCK_PROFILES[event.hitLevel] ?? BLOCK_PROFILES.mid;
    const direction = Math.sign(defender.x - event.attacker.x) || defender.facing || 1;
    defender.reactionData = {
      remainingFrames: profile.blockstunFrames,
      totalFrames: profile.blockstunFrames,
      knockbackVelocity: direction * profile.knockback,
      damage: 0,
      moveId: event.moveId,
      blocked: true
    };
    defender.vx = defender.reactionData.knockbackVelocity;
    defender.airHorizontalVelocity = defender.vx;
    defender.stateController?.setReaction?.(
      defender,
      FIGHTER_STATES.reaction.BLOCKSTUN
    );
    defender.guardData = null;
    return { ...profile, health: defender.health, defender };
  }
}
