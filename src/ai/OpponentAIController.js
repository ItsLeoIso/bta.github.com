import { FIGHTER_STATES } from "../state/FighterStateController.js";

/**
 * Deterministic, frame-stepped CPU opponent. It closes distance, rotates through
 * the prototype move set, and guards only after a configurable startup reaction.
 */
export class OpponentAIController {
  constructor({
    attackRange = 205,
    guardRange = 245,
    attackCooldownFrames = 30,
    blockDurationFrames = 10,
    blockCooldownFrames = 45,
    blockReactionFrames = 8,
    moveCycle = ["light", "medium", "heavy", "special"]
  } = {}) {
    if (!Number.isFinite(attackRange) || attackRange <= 0) {
      throw new RangeError("AI attack range must be positive.");
    }
    if (!Number.isFinite(guardRange) || guardRange < attackRange) {
      throw new RangeError("AI guard range must be at least the attack range.");
    }
    if (
      !Number.isInteger(attackCooldownFrames) || attackCooldownFrames < 0 ||
      !Number.isInteger(blockDurationFrames) || blockDurationFrames < 1 ||
      !Number.isInteger(blockCooldownFrames) || blockCooldownFrames < 0 ||
      !Number.isInteger(blockReactionFrames) || blockReactionFrames < 0
    ) {
      throw new RangeError("AI timing values must be valid frame counts.");
    }
    if (!Array.isArray(moveCycle) || moveCycle.length === 0 ||
        moveCycle.some(move => !["light", "medium", "heavy", "special"].includes(move))) {
      throw new RangeError("AI move cycle must contain valid combat actions.");
    }
    Object.assign(this, {
      attackRange, guardRange, attackCooldownFrames,
      blockDurationFrames, blockCooldownFrames, blockReactionFrames,
      moveCycle: [...moveCycle]
    });
    this.reset();
  }

  hasReactableStartup(target) {
    if (target.state?.action !== FIGHTER_STATES.action.ATTACK) return false;
    const data = target.actionData ?? {};
    const startupElapsed = data.phase === "startup"
      ? (data.phaseFrame ?? 0)
      : data.phase === "active"
        ? (data.startupFrames ?? 0)
        : 0;
    return startupElapsed >= this.blockReactionFrames;
  }

  update(fighter, target) {
    const canAct =
      fighter.state.action === FIGHTER_STATES.action.NONE &&
      fighter.state.reaction === FIGHTER_STATES.reaction.NONE;
    // The decision delay is a neutral-time pause. Spending frames in attack,
    // hitstun, blockstun, or guard must not silently consume the CPU's breather.
    if (canAct && this.blockFramesRemaining === 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - 1);
    }
    this.blockCooldown = Math.max(0, this.blockCooldown - 1);
    fighter.facing = Math.sign(target.x - fighter.x) || fighter.facing || 1;
    const distance = Math.abs(target.x - fighter.x);
    const facing = Math.sign(target.x - fighter.x) || 1;
    const away = -facing;

    let axis = 0;
    const down = [];
    const pressed = [];

    if (this.blockFramesRemaining > 0) {
      this.blockFramesRemaining -= 1;
      axis = away;
      if (this.guardHeight === "low") down.push("crouch");
    } else if (
      fighter.state.action === FIGHTER_STATES.action.NONE &&
      fighter.state.reaction === FIGHTER_STATES.reaction.NONE &&
      fighter.onGround &&
      this.blockCooldown === 0 &&
      distance <= this.guardRange &&
      this.hasReactableStartup(target)
    ) {
      this.blockFramesRemaining = this.blockDurationFrames - 1;
      this.blockCooldown = this.blockCooldownFrames;
      this.guardHeight = target.actionData.hitLevel === "low" ? "low" : "high";
      axis = away;
      if (this.guardHeight === "low") down.push("crouch");
    } else if (canAct) {
      if (distance > this.attackRange) {
        axis = facing;
      } else if (this.attackCooldown === 0) {
        let move = this.moveCycle[this.moveIndex % this.moveCycle.length];
        if (!fighter.onGround && move === "heavy") move = "light";
        pressed.push(move);
        this.moveIndex += 1;
        // Let the CPU make its opening approach / attack without a startup wait.
    // Every later attack earns the full neutral-time decision delay.
    this.attackCooldown = 0;
      }
    }

    if (axis !== this.previousAxis) {
      if (axis > 0) pressed.push("right");
      if (axis < 0) pressed.push("left");
      this.previousAxis = axis;
    }

    const pressedSet = new Set(pressed);
    const downSet = new Set(down);
    return {
      getWorldAxis: () => axis,
      wasPressed: action => pressedSet.has(action),
      isDown: action => downSet.has(action)
    };
  }

  reset() {
    this.attackCooldown = this.attackCooldownFrames;
    this.blockCooldown = 0;
    this.blockFramesRemaining = 0;
    this.guardHeight = "high";
    this.moveIndex = 0;
    this.previousAxis = 0;
  }
}
