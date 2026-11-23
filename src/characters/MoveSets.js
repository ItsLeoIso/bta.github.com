// Shared prototype move data. Character definitions may replace individual entries
// without changing the combat controllers or the input / collision pipeline.
export const ATTACK_DEFINITIONS = Object.freeze({
  light: Object.freeze({
    id: "light", name: "Light", hitLevel: "high",
    startupFrames: 5, activeFrames: 3, recoveryFrames: 10,
    hitAdvantage: null, blockAdvantage: null,
    airAllowed: true, jumpCancelOnHit: true,
    cancelOnHit: Object.freeze(["medium", "heavy", "special"]),
    airCancelOnHit: Object.freeze(["medium", "special"]),
    hitbox: Object.freeze({ offsetX: 24, offsetY: -220, width: 126, height: 72 })
  }),
  medium: Object.freeze({
    id: "medium", name: "Medium", hitLevel: "mid",
    startupFrames: 8, activeFrames: 4, recoveryFrames: 15,
    hitAdvantage: null, blockAdvantage: null,
    airAllowed: true, jumpCancelOnHit: true, launchVelocity: 520,
    cancelOnHit: Object.freeze(["heavy", "special"]),
    airCancelOnHit: Object.freeze(["special"]),
    hitbox: Object.freeze({ offsetX: 30, offsetY: -152, width: 160, height: 80 })
  }),
  heavy: Object.freeze({
    id: "heavy", name: "Heavy", hitLevel: "low",
    startupFrames: 12, activeFrames: 5, recoveryFrames: 21,
    hitAdvantage: null, blockAdvantage: null,
    airAllowed: false, jumpCancelOnHit: false,
    cancelOnHit: Object.freeze([]), airCancelOnHit: Object.freeze([]),
    hitbox: Object.freeze({ offsetX: 36, offsetY: -72, width: 190, height: 72 })
  })
});

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

export const DEFAULT_MOVE_SET = Object.freeze({
  attacks: ATTACK_DEFINITIONS,
  projectiles: Object.freeze({
    energyShot: PROJECTILE_DEFAULTS,
    arcLance: MOTION_SPECIAL_DEFAULTS
  })
});
