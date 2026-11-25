import { FIGHTER_STATES, FighterStateController } from "../state/FighterStateController.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const SIM_HZ = 60;

function secondsToFrames(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds * SIM_HZ));
}

function deltaToFrames(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.max(1, Math.round(deltaSeconds * SIM_HZ));
}

/**
 * First-pass anime-fighter movement. Distances are arena units and timers run
 * on canonical 60 Hz integer frame counters for rollback determinism.
 * Horizontal controls are screen-relative and never reverse when fighters cross.
 * Dash type (forward dash or backdash) is determined relative to facing.
 *
 * FighterStateController owns stance/action state. Physics values such as onGround
 * remain available as measurements, while crouching and dash fields are mirrors
 * maintained by the state controller for older engine systems.
 */
export class MovementController {
  constructor({
    doubleTapWindow = 0.24,
    groundDashSpeed = 700,
    backdashSpeed = 540,
    airDashSpeed = 650,
    groundDashDuration = 0.16,
    backdashDuration = 0.22,
    airDashDuration = 0.14,
    jumpVelocity = 760,
    gravity = 1800,
    groundSpeed = 300,
    crouchSpeedMultiplier = 0.125,
    airSpeed = 260,
    groundDashCooldown = 0.45,
    stateController = new FighterStateController()
  } = {}) {
    Object.assign(this, {
      doubleTapWindow, groundDashSpeed, backdashSpeed, airDashSpeed,
      groundDashDuration, backdashDuration, airDashDuration,
      jumpVelocity, gravity, groundSpeed, crouchSpeedMultiplier,
      airSpeed, groundDashCooldown
    });
    this.doubleTapWindowFrames = secondsToFrames(doubleTapWindow);
    this.groundDashDurationFrames = secondsToFrames(groundDashDuration);
    this.backdashDurationFrames = secondsToFrames(backdashDuration);
    this.airDashDurationFrames = secondsToFrames(airDashDuration);
    this.groundDashCooldownFrames = secondsToFrames(groundDashCooldown);
    this.stateController = stateController;
    const controller = this;
    this.lastTap = {
      get left() {
        return controller.lastTapFrame.left === null ? -Infinity : controller.lastTapFrame.left / SIM_HZ;
      },
      set left(value) {
        controller.lastTapFrame.left = Number.isFinite(value) ? Math.round(value * SIM_HZ) : null;
      },
      get right() {
        return controller.lastTapFrame.right === null ? -Infinity : controller.lastTapFrame.right / SIM_HZ;
      },
      set right(value) {
        controller.lastTapFrame.right = Number.isFinite(value) ? Math.round(value * SIM_HZ) : null;
      }
    };
    this.reset();
  }

  get elapsed() {
    return this.elapsedFrames / SIM_HZ;
  }

  reset() {
    this.elapsedFrames = 0;
    this.lastTapFrame = { left: null, right: null };
  }

  saveState() {
    return {
      elapsedFrames: this.elapsedFrames,
      lastTapFrame: {
        left: this.lastTapFrame.left,
        right: this.lastTapFrame.right
      }
    };
  }

  loadState(snapshot) {
    this.elapsedFrames = Number.isInteger(snapshot?.elapsedFrames) ? snapshot.elapsedFrames : 0;
    this.lastTapFrame = {
      left: Number.isInteger(snapshot?.lastTapFrame?.left) ? snapshot.lastTapFrame.left : null,
      right: Number.isInteger(snapshot?.lastTapFrame?.right) ? snapshot.lastTapFrame.right : null
    };
  }

  update(fighter, input, deltaSeconds, { floorY, minX, maxX }) {
    const states = this.stateController;
    states.initialize(fighter);
    const stepFrames = deltaToFrames(deltaSeconds);
    this.elapsedFrames += stepFrames;

    const currentCooldownFrames = Number.isInteger(fighter.groundDashCooldownFrames)
      ? fighter.groundDashCooldownFrames
      : secondsToFrames(fighter.groundDashCooldownRemaining ?? 0);
    fighter.groundDashCooldownFrames = Math.max(0, currentCooldownFrames - stepFrames);
    fighter.groundDashCooldownRemaining = fighter.groundDashCooldownFrames / SIM_HZ;

    const worldAxis = input.getWorldAxis
      ? input.getWorldAxis("horizontal")
      : input.getAxis("horizontal", fighter.facing) * fighter.facing;
    const pressedWorldAxis =
      Number(input.wasPressed?.("right") ?? false) -
      Number(input.wasPressed?.("left") ?? false);
    const jumpPressed = Boolean(input.wasPressed?.("jump"));
    const groundSpeed = fighter.moveSpeed ?? this.groundSpeed;

    fighter.onGround = fighter.y >= floorY && fighter.vy >= 0;
    if (fighter.onGround) {
      fighter.y = floorY;
      fighter.vy = 0;
      fighter.airDashAvailable = true;
      fighter.airProjectileAvailable = true;

      // A landing changes locomotion before an action (such as a dash) can start.
      if (
        fighter.state.locomotion === FIGHTER_STATES.locomotion.JUMPING ||
        fighter.state.locomotion === FIGHTER_STATES.locomotion.FALLING
      ) {
        states.setLocomotion(
          fighter,
          input.isDown("crouch")
            ? FIGHTER_STATES.locomotion.CROUCHING
            : worldAxis !== 0
              ? FIGHTER_STATES.locomotion.WALKING
              : FIGHTER_STATES.locomotion.STANDING
        );
      }
    } else if (
      fighter.state.locomotion !== FIGHTER_STATES.locomotion.JUMPING &&
      fighter.state.locomotion !== FIGHTER_STATES.locomotion.FALLING
    ) {
      states.setLocomotion(fighter, FIGHTER_STATES.locomotion.FALLING);
    }

    // A backward double-tap begins with a guard tap. Let that same sequence
    // continue while guarding, then cancel guard only when the backdash starts.
    const tappingBackward = pressedWorldAxis * fighter.facing < 0;
    const canStartDash =
      fighter.state.action === FIGHTER_STATES.action.NONE ||
      (fighter.state.action === FIGHTER_STATES.action.GUARD && tappingBackward);
    if (pressedWorldAxis !== 0 &&
        !jumpPressed &&
        canStartDash &&
        fighter.state.reaction === FIGHTER_STATES.reaction.NONE) {
      const direction = pressedWorldAxis > 0 ? "right" : "left";
      const opposite = direction === "right" ? "left" : "right";
      const previousTap = this.lastTapFrame[direction];
      const isDoubleTap =
        previousTap !== null &&
        this.elapsedFrames - previousTap <= this.doubleTapWindowFrames;
      this.lastTapFrame[opposite] = null;
      if (isDoubleTap) {
        this.lastTapFrame[direction] = null;
        if (fighter.state.action === FIGHTER_STATES.action.GUARD) {
          states.endAction(fighter, FIGHTER_STATES.action.GUARD);
          fighter.guardData = null;
        }
        this.startDash(fighter, pressedWorldAxis);
      } else {
        this.lastTapFrame[direction] = this.elapsedFrames;
      }
    }

    if (fighter.onGround &&
        fighter.state.action === FIGHTER_STATES.action.NONE &&
        fighter.state.reaction === FIGHTER_STATES.reaction.NONE &&
        jumpPressed) {
      fighter.vy = -this.jumpVelocity;
      fighter.onGround = false;
      fighter.y -= 0.001;
      states.setLocomotion(fighter, FIGHTER_STATES.locomotion.JUMPING);
      // Commit to the jump direction at takeoff: neutral is vertical,
      // directional jumps keep their horizontal trajectory until landing.
      fighter.airHorizontalVelocity = worldAxis === 0 ? 0 : worldAxis * this.airSpeed;
    }

    const wantsCrouch =
      fighter.onGround &&
      fighter.state.action === FIGHTER_STATES.action.NONE &&
      fighter.state.reaction === FIGHTER_STATES.reaction.NONE &&
      input.isDown("crouch");
    if (wantsCrouch) {
      states.setLocomotion(fighter, FIGHTER_STATES.locomotion.CROUCHING);
    } else if (
      fighter.onGround &&
      fighter.state.action === FIGHTER_STATES.action.NONE &&
      fighter.state.reaction === FIGHTER_STATES.reaction.NONE &&
      fighter.state.locomotion === FIGHTER_STATES.locomotion.CROUCHING
    ) {
      states.setLocomotion(fighter, FIGHTER_STATES.locomotion.STANDING);
    }

    const dashWasActive = fighter.state.action === FIGHTER_STATES.action.DASH;
    if (dashWasActive) {
      const currentRemainingFrames = Number.isInteger(fighter.actionData.remainingFrames)
        ? fighter.actionData.remainingFrames
        : secondsToFrames(fighter.actionData.remaining ?? 0);
      fighter.actionData.remainingFrames = Math.max(0, currentRemainingFrames - stepFrames);
      fighter.actionData.remaining = fighter.actionData.remainingFrames / SIM_HZ;
      if (fighter.actionData.remainingFrames > 0) {
        fighter.vx = fighter.actionData.velocity;
      } else {
        const completedDashType = fighter.actionData.dashType;
        if (completedDashType === "air") {
          fighter.airHorizontalVelocity =
            Math.sign(fighter.actionData.velocity) * this.airSpeed;
        }
        states.endAction(fighter, FIGHTER_STATES.action.DASH);
        fighter.vx = fighter.onGround
          ? worldAxis * groundSpeed *
            (fighter.state.locomotion === FIGHTER_STATES.locomotion.CROUCHING
              ? this.crouchSpeedMultiplier
              : 1)
          : fighter.airHorizontalVelocity ?? 0;
      }
    } else if (fighter.state.reaction !== FIGHTER_STATES.reaction.NONE) {
      // Hit reactions control horizontal motion through their knockback velocity.
      fighter.vx = fighter.reactionData?.knockbackVelocity ?? 0;
    } else if (fighter.state.action === FIGHTER_STATES.action.GUARD) {
      // Guarding permits a deliberate retreat, with stance-specific reduced speed.
      const movingBackward = worldAxis * fighter.facing < 0;
      const guardMultiplier =
        fighter.state.locomotion === FIGHTER_STATES.locomotion.CROUCHING
          ? this.crouchSpeedMultiplier
          : 0.25;
      fighter.vx = movingBackward
        ? worldAxis * groundSpeed * guardMultiplier
        : 0;
    } else if (fighter.state.action === FIGHTER_STATES.action.ATTACK) {
      // Grounded attacks lock movement; airborne attacks retain committed drift.
      fighter.vx = fighter.onGround ? 0 : fighter.airHorizontalVelocity ?? 0;
    } else if (fighter.state.action === FIGHTER_STATES.action.SPECIAL) {
      // Projectile startup cancels horizontal momentum; keep x locked for the move.
      // Gravity still runs below, so an airborne fighter falls during the special.
      fighter.vx = 0;
    } else if (fighter.onGround) {
      const speedMultiplier =
        fighter.state.locomotion === FIGHTER_STATES.locomotion.CROUCHING
          ? this.crouchSpeedMultiplier
          : 1;
      fighter.vx = worldAxis * groundSpeed * speedMultiplier;
    } else {
      fighter.vx = fighter.airHorizontalVelocity ?? 0;
    }

    fighter.x = clamp(fighter.x + fighter.vx * deltaSeconds, minX, maxX);
    if (!fighter.onGround) {
      if (
        fighter.state.action === FIGHTER_STATES.action.DASH &&
        fighter.actionData.dashType === "air" &&
        (fighter.actionData.remainingFrames ?? 0) > 0
      ) {
        fighter.vy = 0;
      } else {
        fighter.vy += this.gravity * deltaSeconds;
      }
      fighter.y += fighter.vy * deltaSeconds;
      if (fighter.y >= floorY) {
        fighter.y = floorY;
        fighter.vy = 0;
        fighter.onGround = true;
        fighter.airDashAvailable = true;
        fighter.airProjectileAvailable = true;
        // Keep locomotion in sync on the touchdown frame even when special
        // recovery continues to lock the fighter on the ground.
        if (
          fighter.state.action === FIGHTER_STATES.action.SPECIAL &&
          (fighter.state.locomotion === FIGHTER_STATES.locomotion.JUMPING ||
            fighter.state.locomotion === FIGHTER_STATES.locomotion.FALLING)
        ) {
          states.setLocomotion(fighter, FIGHTER_STATES.locomotion.STANDING);
        }
        if (fighter.state.action === FIGHTER_STATES.action.DASH &&
            fighter.actionData.dashType === "air") {
          states.endAction(fighter, FIGHTER_STATES.action.DASH);
        }
      }
    }

    if (fighter.onGround &&
        fighter.state.action === FIGHTER_STATES.action.NONE &&
        fighter.state.reaction === FIGHTER_STATES.reaction.NONE) {
      const nextLocomotion = input.isDown("crouch")
        ? FIGHTER_STATES.locomotion.CROUCHING
        : fighter.vx !== 0
          ? FIGHTER_STATES.locomotion.WALKING
          : FIGHTER_STATES.locomotion.STANDING;
      states.setLocomotion(fighter, nextLocomotion);
    } else if (
      !fighter.onGround &&
      fighter.state.locomotion === FIGHTER_STATES.locomotion.JUMPING &&
      fighter.vy >= 0
    ) {
      states.setLocomotion(fighter, FIGHTER_STATES.locomotion.FALLING);
    }

    states.syncCompatibilityFields(fighter);
  }

  startDash(fighter, worldDirection) {
    const states = this.stateController;
    states.initialize(fighter);
    if (fighter.state.action !== FIGHTER_STATES.action.NONE) return false;

    const sign = Math.sign(worldDirection);
    if (sign === 0) return false;
    const forward = sign * fighter.facing > 0;
    if (fighter.onGround) {
      const cooldownFrames = Number.isInteger(fighter.groundDashCooldownFrames)
        ? fighter.groundDashCooldownFrames
        : secondsToFrames(fighter.groundDashCooldownRemaining ?? 0);
      if (cooldownFrames <= 0) {
        const dashType = forward ? "forward" : "backdash";
        const durationFrames = forward ? this.groundDashDurationFrames : this.backdashDurationFrames;
        const velocity = sign * (forward ? this.groundDashSpeed : this.backdashSpeed);
        const started = states.startAction(fighter, FIGHTER_STATES.action.DASH, {
          dashType,
          remainingFrames: durationFrames,
          remaining: durationFrames / SIM_HZ,
          velocity
        });
        if (!started) return false;
        if (fighter.state.locomotion === FIGHTER_STATES.locomotion.CROUCHING) {
          states.setLocomotion(fighter, FIGHTER_STATES.locomotion.STANDING);
        }
        fighter.groundDashCooldownFrames = this.groundDashCooldownFrames;
        fighter.groundDashCooldownRemaining = fighter.groundDashCooldownFrames / SIM_HZ;
        return true;
      }
      return false;
    } else if (fighter.airDashAvailable) {
      const started = states.startAction(fighter, FIGHTER_STATES.action.DASH, {
        dashType: "air",
        remainingFrames: this.airDashDurationFrames,
        remaining: this.airDashDurationFrames / SIM_HZ,
        velocity: sign * this.airDashSpeed
      });
      if (!started) return false;
      fighter.vy = 0;
      // Air dash changes the locked trajectory; it does not enable free steering.
      fighter.airHorizontalVelocity = sign * this.airDashSpeed;
      fighter.airDashAvailable = false;
      return true;
    }
    return false;
  }
}