import { getHurtbox } from "./Hurtbox.js";
import { boxesOverlap } from "./CombatCollision.js";
import { FIGHTER_STATES, FighterStateController, isGrounded } from "../state/FighterStateController.js";

import { MOTION_SPECIAL_DEFAULTS, PROJECTILE_DEFAULTS } from "../characters/MoveSets.js";
export { MOTION_SPECIAL_DEFAULTS, PROJECTILE_DEFAULTS } from "../characters/MoveSets.js";

const SIM_HZ = 60;
const DIAGONAL_UNIT = 0.7071067811865475;

function secondsToFrames(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds * SIM_HZ));
}

function deltaToFrames(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.max(1, Math.round(deltaSeconds * SIM_HZ));
}

function resolveSpecialDirection(fighter) {
  const facing = Math.sign(fighter.facing) || 1;
  if (isGrounded(fighter)) {
    return { x: facing, y: 0, directional: false };
  }
  // Airborne Energy Shot is always angled down and toward the opponent.
  return { x: facing * DIAGONAL_UNIT, y: DIAGONAL_UNIT, directional: false };
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

    const projectileMoves = fighter.character?.moveSet?.projectiles;
    const energyShot = projectileMoves?.energyShot ?? PROJECTILE_DEFAULTS;
    const arcLance = projectileMoves?.arcLance ?? MOTION_SPECIAL_DEFAULTS;
    const isMotionSpecial = input.specialMove === arcLance.moveId;
    const specialFacing = Math.sign(input.specialFacing ?? fighter.facing) || 1;
    const direction = isMotionSpecial
      ? { x: specialFacing, y: 0, directional: false }
      : resolveSpecialDirection(fighter);
    const isAirProjectile = !isGrounded(fighter);

    const move = isMotionSpecial ? arcLance : energyShot;
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
        projectileSpawnOffsetX: move.spawnOffsetX ?? this.spawnOffsetX,
        projectileSpawnOffsetY: move.spawnOffsetY ?? this.spawnOffsetY,
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
          lifetimeSeconds: data.projectileLifetimeSeconds,
          spawnOffsetX: data.projectileSpawnOffsetX,
          spawnOffsetY: data.projectileSpawnOffsetY
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
    let directionX;
    let directionY;
    if (requestedY === 0) {
      directionX = Math.sign(requestedX) || Math.sign(fighter.facing) || 1;
      directionY = 0;
    } else if (Math.abs(Math.abs(requestedX) - Math.abs(requestedY)) < 1e-9) {
      directionX = Math.sign(requestedX) * DIAGONAL_UNIT;
      directionY = Math.sign(requestedY) * DIAGONAL_UNIT;
    } else {
      const magnitude = Math.hypot(requestedX, requestedY) || 1;
      directionX = requestedX / magnitude;
      directionY = requestedY / magnitude;
    }
    // Vertical shots still approach from the fighter's facing side for guard checks.
    const direction = Math.sign(directionX) || Math.sign(fighter.facing) || 1;
    const spawnDirectionX = Math.sign(directionX) || Math.sign(fighter.facing) || 1;
    const remainingFrames = secondsToFrames(moveData.lifetimeSeconds ?? this.lifetimeSeconds);
    const projectile = {
      id: this.nextProjectileId++,
      owner: fighter,
      ownerSlot: Number.isInteger(fighter.slot) ? fighter.slot : 0,
      x: fighter.x + spawnDirectionX * (moveData.spawnOffsetX ?? this.spawnOffsetX),
      y: fighter.y + (moveData.spawnOffsetY ?? this.spawnOffsetY) + directionY * (moveData.spawnOffsetX ?? this.spawnOffsetX),
      direction,
      directionX,
      directionY,
      velocityX: directionX * (moveData.speed ?? this.speed),
      velocityY: directionY * (moveData.speed ?? this.speed),
      radius: moveData.radius ?? this.radius,
      remainingFrames,
      remainingSeconds: remainingFrames / SIM_HZ,
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
    const stepFrames = deltaToFrames(delta);
    const events = [];

    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.x += projectile.velocityX * delta;
      projectile.y += projectile.velocityY * delta;
      const currentFrames = Number.isInteger(projectile.remainingFrames)
        ? projectile.remainingFrames
        : secondsToFrames(projectile.remainingSeconds);
      projectile.remainingFrames = currentFrames - stepFrames;
      projectile.remainingSeconds = projectile.remainingFrames / SIM_HZ;

      if (
        projectile.remainingFrames <= 0 ||
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

  saveState() {
    return {
      nextProjectileId: this.nextProjectileId,
      items: this.projectiles.map(projectile => ({
        id: projectile.id,
        ownerSlot: Number.isInteger(projectile.ownerSlot)
          ? projectile.ownerSlot
          : (Number.isInteger(projectile.owner?.slot) ? projectile.owner.slot : 0),
        x: projectile.x,
        y: projectile.y,
        direction: projectile.direction,
        directionX: projectile.directionX,
        directionY: projectile.directionY,
        velocityX: projectile.velocityX,
        velocityY: projectile.velocityY,
        radius: projectile.radius,
        remainingFrames: Number.isInteger(projectile.remainingFrames)
          ? projectile.remainingFrames
          : secondsToFrames(projectile.remainingSeconds),
        moveId: projectile.moveId,
        moveName: projectile.moveName,
        hitLevel: projectile.hitLevel
      }))
    };
  }

  loadState(snapshot, fighters = []) {
    this.nextProjectileId = Number.isInteger(snapshot?.nextProjectileId) ? snapshot.nextProjectileId : 1;
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    this.projectiles = items.map(item => ({
      id: item.id,
      owner: fighters[item.ownerSlot] ?? fighters[0] ?? null,
      ownerSlot: item.ownerSlot,
      x: item.x,
      y: item.y,
      direction: item.direction,
      directionX: item.directionX,
      directionY: item.directionY,
      velocityX: item.velocityX,
      velocityY: item.velocityY,
      radius: item.radius,
      remainingFrames: item.remainingFrames,
      remainingSeconds: item.remainingFrames / SIM_HZ,
      moveId: item.moveId,
      moveName: item.moveName,
      hitLevel: item.hitLevel
    }));
  }

  clear() {
    this.projectiles.length = 0;
  }
}
