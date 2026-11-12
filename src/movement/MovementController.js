const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * First-pass anime-fighter movement. Distances are arena units and time is seconds.
 * Horizontal controls are screen-relative and never reverse when fighters cross.
 * Dash type (forward dash or backdash) is determined relative to facing.
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
    crouchSpeedMultiplier = 0.5,
    airSpeed = 260,
    groundDashCooldown = 0.45
  } = {}) {
    Object.assign(this, {
      doubleTapWindow, groundDashSpeed, backdashSpeed, airDashSpeed,
      groundDashDuration, backdashDuration, airDashDuration,
      jumpVelocity, gravity, groundSpeed, crouchSpeedMultiplier,
      airSpeed, groundDashCooldown
    });
    this.elapsed = 0;
    this.lastTap = { left: -Infinity, right: -Infinity };
  }

  update(fighter, input, deltaSeconds, { floorY, minX, maxX }) {
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
    }

    if (pressedWorldAxis !== 0) {
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

    if (fighter.onGround && input.wasPressed?.("jump")) {
      fighter.vy = -this.jumpVelocity;
      fighter.onGround = false;
      fighter.y -= 0.001;
      fighter.crouching = false;
      // Commit to the jump direction at takeoff: neutral is vertical,
      // directional jumps keep their horizontal trajectory until landing.
      fighter.airHorizontalVelocity = worldAxis === 0 ? 0 : worldAxis * this.airSpeed;
    }

    fighter.crouching = fighter.onGround &&
      fighter.dashRemaining <= 0 &&
      input.isDown("crouch");

    const dashWasActive = fighter.dashRemaining > 0;
    if (dashWasActive) {
      fighter.dashRemaining = Math.max(0, fighter.dashRemaining - deltaSeconds);
      if (fighter.dashRemaining > 0) {
        fighter.vx = fighter.dashVelocity;
      } else {
        if (fighter.dashType === "air") {
          fighter.airHorizontalVelocity = Math.sign(fighter.dashVelocity) * this.airSpeed;
        }
        fighter.dashVelocity = 0;
        fighter.dashType = null;
        fighter.vx = fighter.onGround
          ? worldAxis * this.groundSpeed * (fighter.crouching ? this.crouchSpeedMultiplier : 1)
          : fighter.airHorizontalVelocity ?? 0;
      }
    } else if (fighter.onGround) {
      const speedMultiplier = fighter.crouching ? this.crouchSpeedMultiplier : 1;
      fighter.vx = worldAxis * this.groundSpeed * speedMultiplier;
    } else {
      fighter.vx = fighter.airHorizontalVelocity ?? 0;
    }

    fighter.x = clamp(fighter.x + fighter.vx * deltaSeconds, minX, maxX);
    if (!fighter.onGround) {
      if (fighter.dashType === "air" && fighter.dashRemaining > 0) {
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
        fighter.dashType = null;
        fighter.dashRemaining = 0;
      }
    }
  }

  startDash(fighter, worldDirection) {
    if (fighter.dashRemaining > 0) return false;
    const sign = Math.sign(worldDirection);
    const forward = sign * fighter.facing > 0;
    if (fighter.onGround) {
      if ((fighter.groundDashCooldownRemaining ?? 0) <= 0) {
        fighter.groundDashCooldownRemaining = this.groundDashCooldown;
        fighter.dashType = forward ? "forward" : "backdash";
        fighter.dashRemaining = forward ? this.groundDashDuration : this.backdashDuration;
        fighter.dashVelocity = sign * (forward ? this.groundDashSpeed : this.backdashSpeed);
        return true;
      }
      return false;
    } else if (fighter.airDashAvailable) {
      fighter.dashType = "air";
      fighter.dashRemaining = this.airDashDuration;
      fighter.dashVelocity = sign * this.airDashSpeed;
      fighter.vy = 0;
      // Air dash changes the locked trajectory; it does not enable free steering.
      fighter.airHorizontalVelocity = sign * this.airDashSpeed;
      fighter.airDashAvailable = false;
      return true;
    }
    return false;
  }
}
