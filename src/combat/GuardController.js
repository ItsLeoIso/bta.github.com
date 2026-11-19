import { FIGHTER_STATES } from "../state/FighterStateController.js";

export const BLOCK_PROFILES = Object.freeze({
  high: Object.freeze({ blockstunFrames: 8, knockback: 55 }),
  mid: Object.freeze({ blockstunFrames: 8, knockback: 55 }),
  low: Object.freeze({ blockstunFrames: 10, knockback: 70 })
});

export const GUARD_METER_MAX = 100;
export const GUARD_METER_REGEN_PER_SECOND = 18;
export const GUARD_REGEN_DELAY_FRAMES = 90;
export const GUARD_BREAK_FRAMES = 45;

// Move strength determines how much pressure a blocked attack adds.
export const GUARD_DAMAGE = Object.freeze({
  light: 20,
  medium: 30,
  heavy: 45,
  special: 25
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Directional guard: hold away; add crouch to defend against low attacks. */
export class GuardController {
  constructor({ stateController } = {}) {
    this.stateController = stateController;
  }

  update(fighter, input) {
    const states = this.stateController;
    states.initialize(fighter);
    fighter.guardMeter = clamp(fighter.guardMeter ?? GUARD_METER_MAX, 0, GUARD_METER_MAX);
    fighter.guardMeterRecoveryDelayFrames = Math.max(0, fighter.guardMeterRecoveryDelayFrames ?? 0);
    const recoveryWasDelayed = fighter.guardMeterRecoveryDelayFrames > 0;
    if (recoveryWasDelayed) fighter.guardMeterRecoveryDelayFrames -= 1;

    const axis = input.getWorldAxis
      ? input.getWorldAxis("horizontal")
      : input.getAxis("horizontal", fighter.facing) * fighter.facing;
    const holdingBack = axis * fighter.facing < 0;
    const crouchGuard = Boolean(input.isDown?.("crouch"));
    const jumpPressed = Boolean(input.wasPressed?.("jump"));

    if (fighter.state.action === FIGHTER_STATES.action.GUARD) {
      // Jump takes priority over holding back: release guard so W+A / W+D
      // can always start a directional jump, including out of guard.
      if (!fighter.onGround || jumpPressed || !holdingBack) {
        states.endAction(fighter, FIGHTER_STATES.action.GUARD);
        fighter.guardData = null;
      } else {
        fighter.guardData.guardHeight = crouchGuard ? "low" : "high";
        states.setLocomotion(
          fighter,
          crouchGuard
            ? FIGHTER_STATES.locomotion.CROUCHING
            : FIGHTER_STATES.locomotion.STANDING
        );
      }
    } else if (
      !jumpPressed &&
      holdingBack &&
      fighter.onGround &&
      fighter.state.action === FIGHTER_STATES.action.NONE &&
      fighter.state.reaction === FIGHTER_STATES.reaction.NONE &&
      fighter.guardMeter > 0
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

    if (
      !recoveryWasDelayed &&
      fighter.guardMeterRecoveryDelayFrames === 0 &&
      fighter.state.action !== FIGHTER_STATES.action.GUARD &&
      fighter.state.reaction === FIGHTER_STATES.reaction.NONE
    ) {
      fighter.guardMeter = clamp(
        fighter.guardMeter + GUARD_METER_REGEN_PER_SECOND / 60,
        0,
        GUARD_METER_MAX
      );
    }
  }

  applyBlock(event) {
    if (!event || event.type !== "block") return null;
    const defender = event.defender;
    const profile = BLOCK_PROFILES[event.hitLevel] ?? BLOCK_PROFILES.mid;
    const direction = Math.sign(event.knockbackDirection ?? 0) ||
      Math.sign(defender.x - event.attacker.x) || defender.facing || 1;
    const guardDamage = GUARD_DAMAGE[event.moveId] ?? GUARD_DAMAGE.medium;

    defender.guardMeter = clamp(
      (defender.guardMeter ?? GUARD_METER_MAX) - guardDamage,
      0,
      GUARD_METER_MAX
    );
    defender.guardMeterRecoveryDelayFrames = GUARD_REGEN_DELAY_FRAMES;
    defender.guardData = null;

    const guardBroken = defender.guardMeter <= 0;
    const reactionFrames = guardBroken ? GUARD_BREAK_FRAMES : profile.blockstunFrames;
    const knockback = guardBroken ? profile.knockback * 1.5 : profile.knockback;
    defender.reactionData = {
      remainingFrames: reactionFrames,
      totalFrames: reactionFrames,
      knockbackVelocity: direction * knockback,
      damage: 0,
      moveId: event.moveId,
      blocked: true,
      guardBreak: guardBroken
    };
    defender.vx = defender.reactionData.knockbackVelocity;
    defender.airHorizontalVelocity = defender.vx;

    const states = defender.stateController ?? this.stateController;
    states?.setReaction?.(
      defender,
      guardBroken
        ? FIGHTER_STATES.reaction.GUARD_BREAK
        : FIGHTER_STATES.reaction.BLOCKSTUN
    );

    return {
      ...profile,
      outcome: guardBroken ? "guardBreak" : "block",
      guardBroken,
      guardDamage,
      guardMeter: defender.guardMeter,
      chipDamage: event.chipDamage ?? 0,
      health: defender.health,
      defender
    };
  }
}
