import test from "node:test";
import assert from "node:assert/strict";
import {
  ONLINE_PROTOCOL_VERSION,
  SIMULATION_VERSION,
  encodeInputPacket,
  decodeInputPacket,
  createMatchConfig,
  validateMatchConfig
} from "../src/net/PacketCodec.js";
import { INPUT_BITS } from "../src/input/BitmaskInput.js";
import { computeContentVersion } from "../src/net/StateChecksum.js";

test("encodeInputPacket and decodeInputPacket round-trip exact 32-byte redundant binary layout", () => {
  const masks = [
    INPUT_BITS.right | INPUT_BITS.light,
    INPUT_BITS.right,
    INPUT_BITS.crouch | INPUT_BITS.right,
    INPUT_BITS.crouch,
    0,
    INPUT_BITS.jump | INPUT_BITS.special,
    INPUT_BITS.left,
    INPUT_BITS.heavy
  ];

  const buffer = encodeInputPacket({
    sessionId: 0x1234,
    packetSeq: 42,
    latestFrame: 120,
    ackFrame: 115,
    masks
  });
  assert.equal(buffer.byteLength, 32);

  const decoded = decodeInputPacket(buffer);
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.packet, {
    protocolVersion: ONLINE_PROTOCOL_VERSION,
    inputCount: 8,
    sessionId: 0x1234,
    packetSeq: 42,
    latestFrame: 120,
    ackFrame: 115,
    masks
  });
});

test("encodeInputPacket supports ackFrame = -1 sentinel and zeroes reserved mask bits", () => {
  const buffer = encodeInputPacket({
    sessionId: 9,
    packetSeq: 1,
    latestFrame: 0,
    ackFrame: -1,
    masks: [0xff00 | INPUT_BITS.special]
  });
  assert.equal(buffer.byteLength, 18);

  const decoded = decodeInputPacket(buffer);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.packet.ackFrame, -1);
  assert.deepEqual(decoded.packet.masks, [INPUT_BITS.special]);
});

test("decodeInputPacket rejects truncated, mismatched-length, and wrong-version packets", () => {
  assert.equal(decodeInputPacket("not-binary").ok, false);
  assert.equal(decodeInputPacket(new ArrayBuffer(10)).ok, false);

  const valid = encodeInputPacket({
    sessionId: 1,
    packetSeq: 1,
    latestFrame: 5,
    ackFrame: 3,
    masks: [0, 1, 2]
  });
  // Corrupt protocol version.
  const wrongVersion = new Uint8Array(valid.slice(0));
  wrongVersion[0] = 99;
  assert.equal(decodeInputPacket(wrongVersion).ok, false);

  // Corrupt inputCount to mismatch buffer length.
  const wrongCount = new Uint8Array(valid.slice(0));
  wrongCount[1] = 8;
  assert.equal(decodeInputPacket(wrongCount).ok, false);

  // Zero inputCount is invalid.
  const zeroCount = new Uint8Array(valid.slice(0));
  zeroCount[1] = 0;
  assert.equal(decodeInputPacket(zeroCount).ok, false);
});

test("createMatchConfig and validateMatchConfig reject incompatible protocol, sim, content, or characters", () => {
  const config = createMatchConfig({
    sessionId: 777,
    slot0CharacterId: "striker",
    slot1CharacterId: "cpu-rival",
    inputDelay: 2,
    maxRollback: 8
  });

  assert.equal(config.protocolVersion, ONLINE_PROTOCOL_VERSION);
  assert.equal(config.simVersion, SIMULATION_VERSION);
  assert.equal(config.contentVersion, computeContentVersion());
  assert.equal(validateMatchConfig(config).ok, true);

  assert.equal(validateMatchConfig({ ...config, protocolVersion: 99 }).ok, false);
  assert.equal(validateMatchConfig({ ...config, simVersion: 99 }).ok, false);
  assert.equal(validateMatchConfig({ ...config, contentVersion: "deadbeef" }).ok, false);
  assert.equal(
    validateMatchConfig({
      ...config,
      slots: { slot0CharacterId: "ghost", slot1CharacterId: "striker" }
    }).ok,
    false
  );
  assert.equal(
    validateMatchConfig({
      ...config,
      matchConfig: { ...config.matchConfig, inputDelay: 9 }
    }).ok,
    false
  );
});
