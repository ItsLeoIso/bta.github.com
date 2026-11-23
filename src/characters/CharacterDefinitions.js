import { DEFAULT_MOVE_SET } from "./MoveSets.js";

export const DEFAULT_ANIMATIONS = Object.freeze({
  idle: Object.freeze({frames:Object.freeze([0,1]),frameDurationFrames:12,loop:true}),
  walk: Object.freeze({frames:Object.freeze([2,3,4,5]),frameDurationFrames:6,loop:true}),
  crouch: Object.freeze({frames:Object.freeze([6,7]),frameDurationFrames:10,loop:true}),
  jump: Object.freeze({frames:Object.freeze([8,9]),frameDurationFrames:7,loop:false}),
  fall: Object.freeze({frames:Object.freeze([10,10]),frameDurationFrames:10,loop:true}),
  "dash-forward": Object.freeze({frames:Object.freeze([11,12]),frameDurationFrames:4,loop:false}),
  "dash-backdash": Object.freeze({frames:Object.freeze([13,14]),frameDurationFrames:5,loop:false}),
  "air-dash": Object.freeze({frames:Object.freeze([15,16]),frameDurationFrames:4,loop:false}),
  "guard-high": Object.freeze({frames:Object.freeze([17]),frameDurationFrames:8,loop:true}),
  "guard-low": Object.freeze({frames:Object.freeze([18]),frameDurationFrames:8,loop:true}),
  "attack-light": Object.freeze({frames:Object.freeze([19,20,21,22,23]),frameDurationFrames:3,loop:false}),
  "attack-medium": Object.freeze({frames:Object.freeze([24,25,26,27,28,29]),frameDurationFrames:3,loop:false}),
  "attack-heavy": Object.freeze({frames:Object.freeze([30,31,32,33,34,35]),frameDurationFrames:4,loop:false}),
  "special-energy-shot": Object.freeze({frames:Object.freeze([36,37,38,39,40]),frameDurationFrames:4,loop:false}),
  "special-arc-lance": Object.freeze({frames:Object.freeze([41,42,43,44,45]),frameDurationFrames:5,loop:false}),
  "reaction-hitstun": Object.freeze({frames:Object.freeze([46,47]),frameDurationFrames:4,loop:true}),
  "reaction-blockstun": Object.freeze({frames:Object.freeze([48]),frameDurationFrames:6,loop:true}),
  "reaction-guard-break": Object.freeze({frames:Object.freeze([49,50]),frameDurationFrames:5,loop:true}),
  "reaction-knockdown": Object.freeze({frames:Object.freeze([51]),frameDurationFrames:8,loop:true}),
  "reaction-wakeup": Object.freeze({frames:Object.freeze([52,53]),frameDurationFrames:6,loop:false})
});

const PLACEHOLDER_SPRITE_SHEET = Object.freeze({
  src: null,
  frameWidth: 48,
  frameHeight: 80,
  columns: 8,
  scale: 3,
  pivotX: 0.5,
  pivotY: 1
});

function defineCharacter(definition) {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("Character definition must be an object.");
  }
  if (!/^[a-z0-9-]+$/.test(definition.id ?? "")) {
    throw new TypeError("Character id must be a lowercase slug.");
  }
  if (typeof definition.name !== "string" || !definition.name.trim()) {
    throw new TypeError("Character name is required.");
  }
  for (const key of ["moveSpeed", "damageMultiplier"]) {
    if (!Number.isFinite(definition.stats?.[key]) || definition.stats[key] <= 0) {
      throw new RangeError("Character " + key + " must be positive.");
    }
  }
  return Object.freeze({
    ...definition,
    stats: Object.freeze({ ...definition.stats }),
    moveSet: definition.moveSet ?? DEFAULT_MOVE_SET,
    animations: definition.animations ?? DEFAULT_ANIMATIONS,
    spriteSheet: definition.spriteSheet ?? PLACEHOLDER_SPRITE_SHEET
  });
}

export const STRIKER = defineCharacter({
  id: "striker",
  name: "Striker",
  displayName: "PLAYER 01",
  archetype: "All-rounder",
  description: "A straightforward all-rounder built around clean confirms and reliable pressure.",
  stats: Object.freeze({ moveSpeed: 300, damageMultiplier: 1 }),
  moveSet: DEFAULT_MOVE_SET,
  animations: DEFAULT_ANIMATIONS,
  spriteSheet: PLACEHOLDER_SPRITE_SHEET
});

export const CPU_RIVAL = defineCharacter({
  id: "cpu-rival",
  name: "CPU Rival",
  displayName: "CPU RIVAL",
  archetype: "Training opponent",
  description: "A slightly slower rival with a small damage modifier for the prototype CPU matchup.",
  stats: Object.freeze({ moveSpeed: 260, damageMultiplier: 1.05 }),
  moveSet: DEFAULT_MOVE_SET,
  animations: DEFAULT_ANIMATIONS,
  spriteSheet: PLACEHOLDER_SPRITE_SHEET
});

export const CHARACTER_REGISTRY = Object.freeze({
  [STRIKER.id]: STRIKER,
  [CPU_RIVAL.id]: CPU_RIVAL
});

export function getCharacterDefinition(id) {
  return CHARACTER_REGISTRY[id] ?? null;
}

export function getAvailableCharacters() {
  return Object.values(CHARACTER_REGISTRY);
}
