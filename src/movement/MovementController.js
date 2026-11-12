import { FIGHTER_STATES, FighterStateController } from "../state/FighterStateController.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * First-pass anime-fighter movement. Distances are arena units and time is seconds.
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
    this.stateController = stateController;
    this.elapsed = 0;
    this.lastTap = { left: -Infinity, right: -Infinity };
  }

  update(fighter, input, deltaSeconds, { floorY, minX, maxX }) {
    const states = this.stateController;
    states.initialize(fighter);
    this.elapsed += deltaSeconds;
    fighter.groundDashCooldownRemaining = Math.max(
      0,
      (fighter.groundDashCooldownRemaining ?? 0) - deltaSeconds
    );

    const worldAxis = input.getWorldAxis
      ? input.getWorldAxis("horizontal")
      : input.getAxis("horizontal", fighter.facing) * fighter.facing;
    const pressedWorldAxis =
      Number(input.wasPressed?.("right") ?? false) -
      Number(input.wasPressed?.("left") ?? false);

    fighter.onGround = fighter.y >= floorY && fighter.vy >= 0;
    if (fighter.onGround) {
      fighter.y = floorY;
      fighter.vy = 0;
      fighter.airDashAvailable = true;

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

    if (pressedWorldAxis !== 0 &&
        fighter.state.action === FIGHTER_STATES.action.NONE &&
        fighter.state.reaction === FIGHTER_STATES.reaction.NONE) {
      const direction = pressedWorldAxis > 0 ? "right" : "left";
      const opposite = direction === "right" ? "left" : "right";
      const previousTap = this.lastTap[direction];
      const isDoubleTap = this.elapsed - previousTap <= this.doubleTapWindow;
      this.lastTap[opposite] = -Infinity;
      if (isDoubleTap) {
        this.lastTap[direction] = -Infinity;
        this.startDash(fighter, pressedWorldAxis);
      } else {
        this.lastTap[direction] = this.elapsed;
      }
    }

    if (fighter.onGround &&
        fighter.state.action === FIGHTER_STATES.action.NONE &&
        fighter.state.reaction === FIGHTER_STATES.reaction.NONE &&
        input.wasPressed?.("jump")) {
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
      fighter.actionData.remaining = Math.max(
        0,
        fighter.actionData.remaining - deltaSeconds
      );
      if (fighter.actionData.remaining > 0) {
        fighter.vx = fighter.actionData.velocity;
      } else {
        const completedDashType = fighter.actionData.dashType;
        if (completedDashType === "air") {
          fighter.airHorizontalVelocity =
            Math.sign(fighter.actionData.velocity) * this.airSpeed;
        }
        states.endAction(fighter, FIGHTER_STATES.action.DASH);
        fighter.vx = fighter.onGround
          ? worldAxis * this.groundSpeed *
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
        ? worldAxis * this.groundSpeed * guardMultiplier
        : 0;
    } else if (fighter.state.action === FIGHTER_STATES.action.ATTACK) {
      // Attacks lock grounded horizontal control.
      fighter.vx = fighter.onGround ? 0 : fighter.airHorizontalVelocity ?? 0;
    } else if (fighter.onGround) {
      const speedMultiplier =
        fighter.state.locomotion === FIGHTER_STATES.locomotion.CROUCHING
          ? this.crouchSpeedMultiplier
          : 1;
      fighter.vx = worldAxis * this.groundSpeed * speedMultiplier;
    } else {
      fighter.vx = fighter.airHorizontalVelocity ?? 0;
    }

    fighter.x = clamp(fighter.x + fighter.vx * deltaSeconds, minX, maxX);
    if (!fighter.onGround) {
      if (
        fighter.state.action === FIGHTER_STATES.action.DASH &&
        fighter.actionData.dashType === "air" &&
        fighter.actionData.remaining > 0
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
      if ((fighter.groundDashCooldownRemaining ?? 0) <= 0) {
        const dashType = forward ? "forward" : "backdash";
        const duration = forward ? this.groundDashDuration : this.backdashDuration;
        const velocity = sign * (forward ? this.groundDashSpeed : this.backdashSpeed);
        const started = states.startAction(fighter, FIGHTER_STATES.action.DASH, {
          dashType,
          remaining: duration,
          velocity
        });
        if (!started) return false;
        if (fighter.state.locomotion === FIGHTER_STATES.locomotion.CROUCHING) {
          states.setLocomotion(fighter, FIGHTER_STATES.locomotion.STANDING);
        }
        fighter.groundDashCooldownRemaining = this.groundDashCooldown;
        return true;
      }
      return false;
    } else if (fighter.airDashAvailable) {
      const started = states.startAction(fighter, FIGHTER_STATES.action.DASH, {
        dashType: "air",
        remaining: this.airDashDuration,
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
