import { getCharacterDefinition } from "../characters/CharacterDefinitions.js";
import { KNOWN_INPUT_MASK } from "../input/BitmaskInput.js";
import { SNAPSHOT_SCHEMA_VERSION } from "../engine/Arena.js";
import { computeContentVersion } from "./StateChecksum.js";

export const ONLINE_PROTOCOL_VERSION = 1;
export const SIMULATION_VERSION = SNAPSHOT_SCHEMA_VERSION;
export const INPUT_PACKET_HEADER_BYTES = 16;
export const MAX_PACKET_INPUT_COUNT = 16;
export const DEFAULT_REDUNDANCY_COUNT = 8;

export const MIN_INPUT_DELAY = 0;
export const MAX_INPUT_DELAY = 4;
export const DEFAULT_INPUT_DELAY = 2;
export const MIN_ROLLBACK_WINDOW = 1;
export const MAX_ROLLBACK_WINDOW = 12;
export const DEFAULT_ROLLBACK_WINDOW = 8;

/**
 * Encodes an unreliable `"inputs"` channel packet in canonical little-endian binary:
 * - Offset  0 (Uint8):  protocolVersion
 * - Offset  1 (Uint8):  inputCount (1..16)
 * - Offset  2 (Uint16): sessionId
 * - Offset  4 (Uint32): packetSeq
 * - Offset  8 (Uint32): latestFrame
 * - Offset 12 (Uint32): ackFrame (0xffffffff when no remote frame confirmed yet)
 * - Offset 16 (Uint16[inputCount]): masks for latestFrame, latestFrame-1, ...
 */
export function encodeInputPacket({
  protocolVersion = ONLINE_PROTOCOL_VERSION,
  sessionId = 0,
  packetSeq = 0,
  latestFrame = 0,
  ackFrame = -1,
  masks = []
}) {
  if (!Number.isInteger(protocolVersion) || protocolVersion < 0 || protocolVersion > 255) {
    throw new RangeError("protocolVersion must be a Uint8 integer.");
  }
  if (!Number.isInteger(sessionId) || sessionId < 0 || sessionId > 0xffff) {
    throw new RangeError("sessionId must be a Uint16 integer.");
  }
  if (!Number.isInteger(packetSeq) || packetSeq < 0 || packetSeq > 0xffffffff) {
    throw new RangeError("packetSeq must be a Uint32 integer.");
  }
  if (!Number.isInteger(latestFrame) || latestFrame < 0 || latestFrame > 0xffffffff) {
    throw new RangeError("latestFrame must be a Uint32 integer.");
  }
  if (!Number.isInteger(ackFrame) || ackFrame < -1 || ackFrame > 0xfffffffe) {
    throw new RangeError("ackFrame must be -1 or a valid confirmed frame index.");
  }
  if (!Array.isArray(masks) || masks.length < 1 || masks.length > MAX_PACKET_INPUT_COUNT) {
    throw new RangeError(`masks must contain between 1 and ${MAX_PACKET_INPUT_COUNT} entries.`);
  }

  const inputCount = masks.length;
  const buffer = new ArrayBuffer(INPUT_PACKET_HEADER_BYTES + inputCount * 2);
  const view = new DataView(buffer);
  view.setUint8(0, protocolVersion);
  view.setUint8(1, inputCount);
  view.setUint16(2, sessionId, true);
  view.setUint32(4, packetSeq >>> 0, true);
  view.setUint32(8, latestFrame >>> 0, true);
  view.setUint32(12, ackFrame < 0 ? 0xffffffff : ackFrame >>> 0, true);

  for (let index = 0; index < inputCount; index += 1) {
    const mask = masks[index];
    if (!Number.isInteger(mask) || mask < 0 || mask > 0xffff) {
      throw new RangeError("Every input mask must be a Uint16 integer.");
    }
    view.setUint16(INPUT_PACKET_HEADER_BYTES + index * 2, mask & KNOWN_INPUT_MASK, true);
  }
  return buffer;
}

/**
 * Decodes and validates a binary `"inputs"` packet. Returns `{ ok: true, packet }`
 * or `{ ok: false, reason }` without throwing on malformed network payloads.
 */
export function decodeInputPacket(payload) {
  let bytes;
  if (payload instanceof ArrayBuffer) {
    bytes = new Uint8Array(payload);
  } else if (ArrayBuffer.isView(payload)) {
    bytes = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
  } else {
    return { ok: false, reason: "Input packet must be an ArrayBuffer or TypedArray." };
  }

  if (bytes.byteLength < INPUT_PACKET_HEADER_BYTES + 2) {
    return { ok: false, reason: "Input packet is shorter than minimum header + 1 mask." };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const protocolVersion = view.getUint8(0);
  if (protocolVersion !== ONLINE_PROTOCOL_VERSION) {
    return { ok: false, reason: `Unsupported protocol version: ${protocolVersion}` };
  }

  const inputCount = view.getUint8(1);
  if (inputCount < 1 || inputCount > MAX_PACKET_INPUT_COUNT) {
    return { ok: false, reason: `Invalid inputCount: ${inputCount}` };
  }

  const expectedBytes = INPUT_PACKET_HEADER_BYTES + inputCount * 2;
  if (bytes.byteLength !== expectedBytes) {
    return {
      ok: false,
      reason: `Packet byte length mismatch: expected ${expectedBytes}, got ${bytes.byteLength}`
    };
  }

  const sessionId = view.getUint16(2, true);
  const packetSeq = view.getUint32(4, true);
  const latestFrame = view.getUint32(8, true);
  const rawAck = view.getUint32(12, true);
  const ackFrame = rawAck === 0xffffffff ? -1 : rawAck;

  const masks = new Array(inputCount);
  for (let index = 0; index < inputCount; index += 1) {
    masks[index] = view.getUint16(INPUT_PACKET_HEADER_BYTES + index * 2, true) & KNOWN_INPUT_MASK;
  }

  return {
    ok: true,
    packet: {
      protocolVersion,
      inputCount,
      sessionId,
      packetSeq,
      latestFrame,
      ackFrame,
      masks
    }
  };
}

export function createMatchConfig({
  sessionId,
  slot0CharacterId = "striker",
  slot1CharacterId = "cpu-rival",
  inputDelay = DEFAULT_INPUT_DELAY,
  maxRollback = DEFAULT_ROLLBACK_WINDOW,
  roundsToWin = 2,
  roundDurationFrames = 99 * 60,
  contentVersion = computeContentVersion()
} = {}) {
  const resolvedSessionId = Number.isInteger(sessionId)
    ? sessionId & 0xffff
    : Math.floor(Math.random() * 0xffff) + 1;
  return {
    type: "MATCH_CONFIG",
    protocolVersion: ONLINE_PROTOCOL_VERSION,
    simVersion: SIMULATION_VERSION,
    contentVersion,
    sessionId: resolvedSessionId,
    slots: {
      slot0CharacterId,
      slot1CharacterId
    },
    matchConfig: {
      inputDelay,
      maxRollback,
      roundsToWin,
      roundDurationFrames
    }
  };
}

/**
 * Validates that a remote `MATCH_CONFIG` handshake message is compatible with
 * the local game version, registered characters, and rollback bounds.
 */
export function validateMatchConfig(remoteConfig, {
  expectedContentVersion = computeContentVersion()
} = {}) {
  if (!remoteConfig || typeof remoteConfig !== "object" || remoteConfig.type !== "MATCH_CONFIG") {
    return { ok: false, reason: "Missing or malformed MATCH_CONFIG payload." };
  }
  if (remoteConfig.protocolVersion !== ONLINE_PROTOCOL_VERSION) {
    return {
      ok: false,
      reason: `Protocol version mismatch (local v${ONLINE_PROTOCOL_VERSION}, remote v${remoteConfig.protocolVersion}).`
    };
  }
  if (remoteConfig.simVersion !== SIMULATION_VERSION) {
    return {
      ok: false,
      reason: `Simulation schema mismatch (local v${SIMULATION_VERSION}, remote v${remoteConfig.simVersion}).`
    };
  }
  if (remoteConfig.contentVersion !== expectedContentVersion) {
    return {
      ok: false,
      reason: `Content/balance version mismatch (local ${expectedContentVersion}, remote ${remoteConfig.contentVersion}).`
    };
  }
  if (!Number.isInteger(remoteConfig.sessionId) || remoteConfig.sessionId < 0 || remoteConfig.sessionId > 0xffff) {
    return { ok: false, reason: "Invalid sessionId in MATCH_CONFIG." };
  }

  const slot0Id = remoteConfig.slots?.slot0CharacterId;
  const slot1Id = remoteConfig.slots?.slot1CharacterId;
  if (!getCharacterDefinition(slot0Id) || !getCharacterDefinition(slot1Id)) {
    return { ok: false, reason: `Unknown character ID in MATCH_CONFIG (${slot0Id} vs ${slot1Id}).` };
  }

  const cfg = remoteConfig.matchConfig ?? {};
  if (!Number.isInteger(cfg.inputDelay) || cfg.inputDelay < MIN_INPUT_DELAY || cfg.inputDelay > MAX_INPUT_DELAY) {
    return { ok: false, reason: `Invalid inputDelay: ${cfg.inputDelay}` };
  }
  if (!Number.isInteger(cfg.maxRollback) || cfg.maxRollback < MIN_ROLLBACK_WINDOW || cfg.maxRollback > MAX_ROLLBACK_WINDOW) {
    return { ok: false, reason: `Invalid maxRollback: ${cfg.maxRollback}` };
  }
  if (!Number.isInteger(cfg.roundsToWin) || cfg.roundsToWin < 1 || cfg.roundsToWin > 10) {
    return { ok: false, reason: `Invalid roundsToWin: ${cfg.roundsToWin}` };
  }
  if (!Number.isInteger(cfg.roundDurationFrames) || cfg.roundDurationFrames < 60) {
    return { ok: false, reason: `Invalid roundDurationFrames: ${cfg.roundDurationFrames}` };
  }

  return { ok: true };
}
