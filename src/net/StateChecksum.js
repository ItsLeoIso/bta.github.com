import { getAvailableCharacters } from "../characters/CharacterDefinitions.js";

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const floatBuffer = new ArrayBuffer(8);
const floatView = new DataView(floatBuffer);
const floatBytes = new Uint8Array(floatBuffer);

function hashByte(hash, byte) {
  return Math.imul(hash ^ (byte & 0xff), FNV_PRIME) >>> 0;
}

function hashString(hash, text) {
  let next = hashByte(hash, 0x73); // 's'
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    next = hashByte(next, code & 0xff);
    next = hashByte(next, (code >>> 8) & 0xff);
  }
  return hashByte(next, 0x00);
}

function hashNumber(hash, value) {
  let next = hashByte(hash, 0x6e); // 'n'
  if (!Number.isFinite(value)) {
    throw new RangeError("Canonical snapshot contains non-finite number: " + value);
  }
  // Normalize -0 to +0 so IEEE-754 signed zero never causes a false desync.
  const normalized = Object.is(value, -0) ? 0 : value;
  floatView.setFloat64(0, normalized, true);
  for (let index = 0; index < 8; index += 1) {
    next = hashByte(next, floatBytes[index]);
  }
  return next;
}

function hashCanonicalValue(hash, value) {
  if (value === null || value === undefined) {
    return hashByte(hash, 0x30); // '0'
  }
  const type = typeof value;
  if (type === "boolean") {
    return hashByte(hash, value ? 0x54 : 0x46); // 'T' / 'F'
  }
  if (type === "number") {
    return hashNumber(hash, value);
  }
  if (type === "string") {
    return hashString(hash, value);
  }
  if (Array.isArray(value)) {
    let next = hashByte(hash, 0x5b); // '['
    for (let index = 0; index < value.length; index += 1) {
      next = hashCanonicalValue(next, value[index]);
    }
    return hashByte(next, 0x5d); // ']'
  }
  if (type === "object") {
    let next = hashByte(hash, 0x7b); // '{'
    const keys = Object.keys(value);
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      next = hashString(next, key);
      next = hashCanonicalValue(next, value[key]);
    }
    return hashByte(next, 0x7d); // '}'
  }
  throw new TypeError("Unsupported canonical snapshot value type: " + type);
}

/**
 * Computes a deterministic 32-bit FNV-1a checksum over a canonical plain-data
 * ArenaSnapshot. Never pass live objects or cosmetic state into this function.
 */
export function computeSnapshotChecksum(snapshot) {
  return hashCanonicalValue(FNV_OFFSET_BASIS, snapshot) >>> 0;
}

export function formatChecksum(checksum) {
  return (checksum >>> 0).toString(16).padStart(8, "0");
}

/**
 * Computes a deterministic content version tag covering all registered
 * character stats and move-set definitions for pre-match compatibility checks.
 */
export function computeContentVersion() {
  const characters = getAvailableCharacters().map(character => ({
    id: character.id,
    stats: character.stats,
    moveSet: character.moveSet
  }));
  return formatChecksum(computeSnapshotChecksum(characters));
}
