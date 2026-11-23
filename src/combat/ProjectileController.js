import { getHurtbox } from "./Hurtbox.js";
import { boxesOverlap } from "./CombatCollision.js";
import { FIGHTER_STATES, FighterStateController, isGrounded } from "../state/FighterStateController.js";

export const PROJECTILE_DEFAULTS = Object.freeze({
  startupFrames: 8,
  recoveryFrames: 18,
  speed: 540,
  radius: 18,
  lifetimeSeconds: 2.5,
  spawnOffsetX: 76,
  spawnOffsetY: -150,
  moveId: "special",
  moveName: "Energy Shot",
  hitLevel: "mid"
});

export const MOTION_SPECIAL_DEFAULTS = Object.freeze({
  moveId: "arcLance",
  moveName: "Arc Lance",
  hitLevel: "mid",
  startupFrames: 14,
  recoveryFrames: 26,
  speed: 390,
  radius: 26,
  lifetimeSeconds: 2.8
});

function resolveSpecialDirection(fighter) {
  const facing = Math.sign(fighter.facing) || 1;
  if (isGrounded(fighter)) {
    return { x: facing, y: 0, directional: false };
  }
  // Airborne Energy Shot is always angled down and toward the opponent.
  const diagonal = 1 / Math.sqrt(2);
  return { x: facing * diagonal, y: diagonal, directional: false };
}

/**
 * Handles the forward Energy Shot and the separate QCF Arc Lance.
 * Grounded Energy Shots travel forward; airborne shots angle down-forward.
 * The ordinary Special button never accepts free-aim directional input.
 */
export class ProjectileController {
  constructor({
    stateController = new FighterStateController(),
    startupFrames = PROJECTILE_DEFAULTS.startupFrames,
    recoveryFrames = PROJECTILE_DEFAULTS.recoveryFrames,
    speed = PROJECTILE_DEFAULTS.speed,
    radius = PROJECTILE_DEFAULTS.radius,
    lifetimeSeconds = PROJECTILE_DEFAULTS.lifetimeSeconds,
    spawnOffsetX = PROJECTILE_DEFAULTS.spawnOffsetX,
    spawnOffsetY = PROJECTILE_DEFAULTS.spawnOffsetY
  } = {}) {
    if (!Number.isInteger(startupFrames) || startupFrames < 1) {
      throw new RangeError("Projectile startup must be a positive frame count.");
    }
    if (!Number.isInteger(recoveryFrames) || recoveryFrames < 1) {
      throw new RangeError("Projectile recovery must be a positive frame count.");
    }
    if (!Number.isFinite(speed) || speed <= 0) {
      throw new RangeError("Projectile speed must be positive.");
    }
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new RangeError("Projectile radius must be positive.");
    }
    if (!Number.isFinite(lifetimeSeconds) || lifetimeSeconds <= 0) {
      throw new RangeError("Projectile lifetime must be positive.");
    }

    Object.assign(this, {
      stateController,
      startupFrames,
      recoveryFrames,
      speed,
      radius,
      lifetimeSeconds,
      spawnOffsetX,
      spawnOffsetY
    });
    this.projectiles = [];
    this.nextProjectileId = 1;
  }

  canStartSpecial(fighter, input, { allowAttackCancel = false } = {}) {
    this.stateController.initialize(fighter);
    fighter.airProjectileAvailable ??= true;
    if (!input.wasPressed?.("special")) return false;
    if (fighter.state.reaction !== FIGHTER_STATES.reaction.NONE) return false;

    const inNeutral = fighter.state.action === FIGHTER_STATES.action.NONE;
    const cancelingAttack =
      allowAttackCancel &&
      fighter.state.action === FIGHTER_STATES.action.ATTACK;
    if (!inNeutral && !cancelingAttack) return false;

    if (!isGrounded(fighter) && !fighter.airProjectileAvailable) return false;
    return true;
  }

  updateFighter(fighter, input) {
    const states = this.stateController;
    states.initialize(fighter);
    fighter.airProjectileAvailable ??= true;

    if (fighter.state.action === FIGHTER_STATES.action.SPECIAL) {
      this.advanceSpecial(fighter);
      return true;
    }

    if (!this.canStartSpecial(fighter, input)) return false;

    const isMotionSpecial = input.specialMove === MOTION_SPECIAL_DEFAULTS.moveId;
    const specialFacing = Math.sign(input.specialFacing ?? fighter.facing) || 1;
    const direction = isMotionSpecial
      ? { x: specialFacing, y: 0, directional: false }
      : resolveSpecialDirection(fighter);
    const isAirProjectile = !isGrounded(fighter);

    const move = isMotionSpecial ? MOTION_SPECIAL_DEFAULTS : PROJECTILE_DEFAULTS;
    const startupFrames = move.startupFrames ?? this.startupFrames;
    const recoveryFrames = move.recoveryFrames ?? this.recoveryFrames;
    const started = states.startAction(
      fighter,
      FIGHTER_STATES.action.SPECIAL,
      {
        moveId: move.moveId,
        moveName: move.moveName,
        hitLevel: move.hitLevel,
        startupFrames,
        recoveryFrames,
        projectileSpeed: move.speed ?? this.speed,
        projectileRadius: move.radius ?? this.radius,
        projectileLifetimeSeconds: move.lifetimeSeconds ?? this.lifetimeSeconds,
        elapsedFrames: 0,
        phase: "startup",
        phaseFrame: 0,
        projectileSpawned: false,
        directionX: direction.x,
        directionY: direction.y,
        hitAdvantage: null,
        blockAdvantage: null
      }
    );
    if (!started) return false;

    if (isAirProjectile) fighter.airProjectileAvailable = false;
    // Every projectile special cancels stored movement momentum immediately.
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.airHorizontalVelocity = 0;

    fighter.lastAttackData = {
      moveId: move.moveId,
      moveName: move.moveName,
      hitLevel: move.hitLevel,
      startupFrames,
      activeFrames: null,
      recoveryFrames,
      hitAdvantage: null,
      blockAdvantage: null
    };
    this.advanceSpecial(fighter);
    return true;
  }

  advanceSpecial(fighter) {
    const data = fighter.actionData;
    data.elapsedFrames = (data.elapsedFrames ?? 0) + 1;

    const startupFrames = data.startupFrames ?? this.startupFrames;
    const recoveryFrames = data.recoveryFrames ?? this.recoveryFrames;
    if (data.elapsedFrames <= startupFrames) {
      data.phase = "startup";
      data.phaseFrame = data.elapsedFrames;
      if (data.elapsedFrames === startupFrames) {
        this.spawnProjectile(fighter, {
          directionX: data.directionX,
          directionY: data.directionY,
          moveId: data.moveId,
          moveName: data.moveName,
          hitLevel: data.hitLevel,
          speed: data.projectileSpeed,
          radius: data.projectileRadius,
          lifetimeSeconds: data.projectileLifetimeSeconds
        });
        data.projectileSpawned = true;
        data.phase = "recovery";
        data.phaseFrame = 0;
      }
      return;
    }

    data.phase = "recovery";
    data.phaseFrame = data.elapsedFrames - startupFrames;
    if (data.phaseFrame >= recoveryFrames) {
      this.stateController.endAction(fighter, FIGHTER_STATES.action.SPECIAL);
    }
  }

  spawnProjectile(fighter, moveData = {}) {
    const requestedX = Number.isFinite(moveData.directionX)
      ? moveData.directionX
      : Math.sign(fighter.facing) || 1;
    const requestedY = Number.isFinite(moveData.directionY) ? moveData.directionY : 0;
    const magnitude = Math.hypot(requestedX, requestedY) || 1;
    const directionX = requestedX / magnitude;
    const directionY = requestedY / magnitude;
    // Vertical shots still approach from the fighter's facing side for guard checks.
    const direction = Math.sign(directionX) || Math.sign(fighter.facing) || 1;
    const spawnDirectionX = Math.sign(directionX) || Math.sign(fighter.facing) || 1;
    const projectile = {
      id: this.nextProjectileId++,
      owner: fighter,
      x: fighter.x + spawnDirectionX * this.spawnOffsetX,
      y: fighter.y + this.spawnOffsetY + directionY * this.spawnOffsetX,
      direction,
      directionX,
      directionY,
      velocityX: directionX * (moveData.speed ?? this.speed),
      velocityY: directionY * (moveData.speed ?? this.speed),
      radius: moveData.radius ?? this.radius,
      remainingSeconds: moveData.lifetimeSeconds ?? this.lifetimeSeconds,
      moveId: moveData.moveId ?? PROJECTILE_DEFAULTS.moveId,
      moveName: moveData.moveName ?? PROJECTILE_DEFAULTS.moveName,
      hitLevel: moveData.hitLevel ?? PROJECTILE_DEFAULTS.hitLevel
    };
    this.projectiles.push(projectile);
    return projectile;
  }

  updateProjectiles(deltaSeconds, fighters = [], {
    minX = -68,
    maxX = 1028,
    minY = -Infinity,
    maxY = Infinity,
    floorY = Infinity
  } = {}) {
    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    const events = [];

    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.x += projectile.velocityX * delta;
      projectile.y += projectile.velocityY * delta;
      projectile.remainingSeconds -= delta;

      if (
        projectile.remainingSeconds <= 0 ||
        projectile.x + projectile.radius < minX ||
        projectile.x - projectile.radius > maxX ||
        projectile.y + projectile.radius < minY ||
        projectile.y - projectile.radius > maxY
      ) {
        this.projectiles.splice(index, 1);
        continue;
      }

      const hitbox = {
        left: projectile.x - projectile.radius,
        right: projectile.x + projectile.radius,
        top: projectile.y - projectile.radius,
        bottom: projectile.y + projectile.radius
      };

      let contact = null;
      for (const defender of fighters) {
        if (defender === projectile.owner || (defender.health ?? 1) <= 0) continue;
        const hurtbox = getHurtbox(defender);
        if (!boxesOverlap(hitbox, hurtbox)) continue;

        const ownerData = projectile.owner.actionData ?? {};
        const attackerRecoveryFrames =
          projectile.owner.state?.action === FIGHTER_STATES.action.SPECIAL &&
          ownerData.phase === "recovery"
            ? Math.max(0, (ownerData.recoveryFrames ?? 0) - (ownerData.phaseFrame ?? 0))
            : 0;

        contact = {
          type: "contact",
          moveId: projectile.moveId,
          moveName: projectile.moveName,
          hitLevel: projectile.hitLevel,
          attacker: projectile.owner,
          defender,
          hitbox,
          hurtbox,
          projectile,
          projectileDirection: projectile.direction,
          knockbackDirection: projectile.direction,
          attackerRecoveryFrames
        };
        break;
      }

      if (contact) {
        events.push(contact);
        this.projectiles.splice(index, 1);
      } else if (projectile.velocityY > 0 && projectile.y + projectile.radius >= floorY) {
        this.projectiles.splice(index, 1);
      }
    }

    return events.reverse();
  }

  clear() {
    this.projectiles.length = 0;
  }
}
