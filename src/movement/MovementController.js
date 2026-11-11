const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * First-pass anime-fighter movement. Distances are arena units and time is seconds.
 * Double-taps are resolved in logical forward/back directions, so they reverse
 * automatically when the fighter changes sides.
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
    airSpeed = 260,
    groundDashCooldown = 0.45
  } = {}) {
    Object.assign(this, {
      doubleTapWindow, groundDashSpeed, backdashSpeed, airDashSpeed,
      groundDashDuration, backdashDuration, airDashDuration,
      jumpVelocity, gravity, groundSpeed, airSpeed, groundDashCooldown
    });
    this.elapsed = 0;
    this.lastTap = { forward: -Infinity, backward: -Infinity };
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
    const logicalAxis = worldAxis * fighter.facing;
    const pressedWorldAxis =
      Number(input.wasPressed?.("right") ?? false) -
      Number(input.wasPressed?.("left") ?? false);
    const pressedLogicalAxis = pressedWorldAxis * fighter.facing;

    fighter.onGround = fighter.y >= floorY && fighter.vy >= 0;
    if (fighter.onGround) {
      fighter.y = floorY;
      fighter.vy = 0;
      fighter.airDashAvailable = true;
    }

    if (pressedLogicalAxis !== 0) {
      const direction = pressedLogicalAxis > 0 ? "forward" : "backward";
      const previousTap = this.lastTap[direction];
      const isDoubleTap = this.elapsed - previousTap <= this.doubleTapWindow;
      this.lastTap[direction] = this.elapsed;
      if (isDoubleTap) this.startDash(fighter, direction);
    }

    if (fighter.onGround && input.wasPressed?.("jump")) {
      fighter.vy = -this.jumpVelocity;
      fighter.onGround = false;
      fighter.y -= 0.001;
      fighter.crouching = false;
      // Commit to the jump direction at takeoff: neutral is vertical,
      // directional jumps keep their horizontal trajectory until landing.
      fighter.airHorizontalVelocity = logicalAxis === 0 ? 0 : logicalAxis * this.airSpeed;
    }

    if (fighter.dashRemaining > 0) {
      fighter.dashRemaining = Math.max(0, fighter.dashRemaining - deltaSeconds);
      fighter.vx = fighter.dashVelocity;
      if (fighter.dashRemaining === 0) {
        fighter.dashVelocity = 0;
        fighter.dashType = null;
      }
    } else if (fighter.onGround) {
      fighter.vx = logicalAxis * this.groundSpeed;
    } else {
      fighter.vx = fighter.airHorizontalVelocity ?? 0;
    }

    fighter.crouching = fighter.onGround && fighter.dashRemaining <= 0 && input.isDown("crouch");
    fighter.x = clamp(fighter.x + fighter.vx * deltaSeconds, minX, maxX);
    if (!fighter.onGround) {
      fighter.vy += this.gravity * deltaSeconds;
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

  startDash(fighter, direction) {
    const forward = direction === "forward";
    const sign = forward ? fighter.facing : -fighter.facing;
    if (fighter.onGround) {
      if ((fighter.groundDashCooldownRemaining ?? 0) <= 0) {
        fighter.groundDashCooldownRemaining = this.groundDashCooldown;
        fighter.dashType = forward ? "forward" : "backdash";
        fighter.dashRemaining = forward ? this.groundDashDuration : this.backdashDuration;
        fighter.dashVelocity = sign * (forward ? this.groundDashSpeed : this.backdashSpeed);
      }
    } else if (fighter.airDashAvailable) {
      fighter.dashType = "air";
      fighter.dashRemaining = this.airDashDuration;
      fighter.dashVelocity = sign * this.airDashSpeed;
      fighter.vy = 0;
      // Air dash changes the locked trajectory; it does not enable free steering.
      fighter.airHorizontalVelocity = sign * this.airDashSpeed;
      fighter.airDashAvailable = false;
    }
  }
}
