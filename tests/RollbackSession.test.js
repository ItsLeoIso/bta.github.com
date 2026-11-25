import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
import { BitmaskInputAdapter, INPUT_BITS } from "../src/input/BitmaskInput.js";
import { computeSnapshotChecksum, formatChecksum } from "../src/net/StateChecksum.js";
import { RollbackSession } from "../src/net/RollbackSession.js";

function createSeededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Generates deterministic, realistic fighting-game input streams (walking, dashes,
 * jumps, crouches, Light/Medium/Heavy combos, QCF Arc Lance, Energy Shots, blocking).
 */
function buildCombatInputStream(seed, frameCount) {
  const rng = createSeededRng(seed);
  const masks = new Array(frameCount).fill(0);
  let frame = 0;

  while (frame < frameCount) {
    const roll = rng();
    if (roll < 0.14 && frame + 4 < frameCount) {
      // QCF motion + Special (both facing directions covered over the match).
      const forward = rng() < 0.5 ? INPUT_BITS.right : INPUT_BITS.left;
      masks[frame] = INPUT_BITS.crouch;
      masks[frame + 1] = INPUT_BITS.crouch | forward;
      masks[frame + 2] = forward | INPUT_BITS.special;
      masks[frame + 3] = 0;
      frame += 4;
    } else if (roll < 0.28 && frame + 5 < frameCount) {
      // Double-tap dash (ground or air).
      const dir = rng() < 0.5 ? INPUT_BITS.right : INPUT_BITS.left;
      masks[frame] = dir;
      masks[frame + 1] = 0;
      masks[frame + 2] = dir;
      masks[frame + 3] = dir;
      masks[frame + 4] = 0;
      frame += 5;
    } else if (roll < 0.48 && frame + 8 < frameCount) {
      // Light -> Medium -> Heavy or Special pressure sequence.
      masks[frame] = INPUT_BITS.light;
      masks[frame + 1] = 0;
      masks[frame + 2] = 0;
      masks[frame + 3] = INPUT_BITS.medium;
      masks[frame + 4] = 0;
      masks[frame + 5] = rng() < 0.5 ? INPUT_BITS.heavy : INPUT_BITS.special;
      masks[frame + 6] = 0;
      frame += 7;
    } else if (roll < 0.65 && frame + 8 < frameCount) {
      // Jump + air attack / air projectile.
      const dir = rng() < 0.33 ? INPUT_BITS.left : rng() < 0.66 ? INPUT_BITS.right : 0;
      masks[frame] = INPUT_BITS.jump | dir;
      masks[frame + 1] = dir;
      masks[frame + 2] = dir;
      masks[frame + 3] = INPUT_BITS.light;
      masks[frame + 4] = 0;
      masks[frame + 5] = INPUT_BITS.special;
      frame += 6;
    } else if (roll < 0.82 && frame + 10 < frameCount) {
      // Hold direction / crouch guard for several frames.
      const hold =
        (rng() < 0.5 ? INPUT_BITS.left : INPUT_BITS.right) |
        (rng() < 0.4 ? INPUT_BITS.crouch : 0);
      const len = 4 + Math.floor(rng() * 6);
      for (let i = 0; i < len && frame < frameCount; i += 1, frame += 1) {
        masks[frame] = hold;
      }
    } else {
      // Short neutral gap or single button press.
      masks[frame] = rng() < 0.35 ? INPUT_BITS.special : 0;
      frame += 1;
    }
  }
  return masks;
}

/**
 * Runs a zero-latency canonical reference Arena simulation and returns
 * a Map<stateFrame, checksum> for every frame 0..frameCount.
 */
function runZeroLatencyReference(p1Masks, p2Masks, {
  slot0CharacterId = "striker",
  slot1CharacterId = "cpu-rival",
  inputDelay = 2
} = {}) {
  const arena = new Arena({
    opponentAIEnabled: false,
    trainingMode: false,
    playerCharacterId: slot0CharacterId,
    opponentCharacterId: slot1CharacterId
  });
  const adapters = [new BitmaskInputAdapter(), new BitmaskInputAdapter()];
  const checksums = new Map();
  const snapshots = new Map();

  const totalFrames = Math.min(p1Masks.length, p2Masks.length);
  const saveAt = frame => {
    const snap = arena.saveState({
      inputMasks: [adapters[0].getPreviousMask(), adapters[1].getPreviousMask()]
    });
    snapshots.set(frame, snap);
    checksums.set(frame, computeSnapshotChecksum(snap));
  };

  saveAt(0);
  for (let frame = 0; frame < totalFrames; frame += 1) {
    const m0 = frame < inputDelay ? 0 : p1Masks[frame - inputDelay];
    const m1 = frame < inputDelay ? 0 : p2Masks[frame - inputDelay];
    arena.update(
      1 / 60,
      adapters[0].nextFrame(m0),
      adapters[1].nextFrame(m1),
      { allowLocalRematchConfirm: false }
    );
    saveAt(frame + 1);
  }
  return { checksums, snapshots, arena };
}

test("Arena.saveState and loadState round-trip produces identical future simulation and checksums", () => {
  const p1Masks = buildCombatInputStream(101, 240);
  const p2Masks = buildCombatInputStream(202, 240);

  const arenaA = new Arena({ playerCharacterId: "striker", opponentCharacterId: "cpu-rival" });
  const adaptersA = [new BitmaskInputAdapter(), new BitmaskInputAdapter()];

  let midSnapshot = null;
  for (let frame = 0; frame < 240; frame += 1) {
    if (frame === 120) {
      midSnapshot = JSON.parse(
        JSON.stringify(
          arenaA.saveState({
            inputMasks: [adaptersA[0].getPreviousMask(), adaptersA[1].getPreviousMask()]
          })
        )
      );
    }
    arenaA.update(
      1 / 60,
      adaptersA[0].nextFrame(p1Masks[frame]),
      adaptersA[1].nextFrame(p2Masks[frame]),
      { allowLocalRematchConfirm: false }
    );
  }

  // Restore midSnapshot into a brand-new Arena (after JSON round-trip to guarantee zero object refs / -Infinity)
  const arenaB = new Arena({ playerCharacterId: "striker", opponentCharacterId: "cpu-rival" });
  const adaptersB = [new BitmaskInputAdapter(), new BitmaskInputAdapter()];
  arenaB.loadState(midSnapshot);
  adaptersB[0].setPreviousMask(midSnapshot.inputMasks[0]);
  adaptersB[1].setPreviousMask(midSnapshot.inputMasks[1]);

  for (let frame = 120; frame < 240; frame += 1) {
    arenaB.update(
      1 / 60,
      adaptersB[0].nextFrame(p1Masks[frame]),
      adaptersB[1].nextFrame(p2Masks[frame]),
      { isResimulating: true, allowLocalRematchConfirm: false }
    );
  }

  const finalA = arenaA.saveState({
    inputMasks: [adaptersA[0].getPreviousMask(), adaptersA[1].getPreviousMask()]
  });
  const finalB = arenaB.saveState({
    inputMasks: [adaptersB[0].getPreviousMask(), adaptersB[1].getPreviousMask()]
  });

  assert.deepEqual(finalB, finalA);
  assert.equal(computeSnapshotChecksum(finalB), computeSnapshotChecksum(finalA));
  // Resimulation must not trigger cosmetic effects on arenaB.
  assert.equal(arenaB.combatEffects.particles.length, 0);
});

test("two RollbackSession peers stay bit-identical over 600+ frames under seeded lag, jitter, loss, duplication, reordering, and stalls", () => {
  const seeds = [1337, 42069, 9001];

  for (const seed of seeds) {
    const rng = createSeededRng(seed);
    const totalMatchFrames = 620;
    const inputDelay = 2;
    const maxRollback = 8;

    const p1Masks = buildCombatInputStream(seed * 3 + 1, totalMatchFrames + 40);
    const p2Masks = buildCombatInputStream(seed * 7 + 2, totalMatchFrames + 40);
    const reference = runZeroLatencyReference(p1Masks, p2Masks, { inputDelay });

    const inFlightInputs = [];
    const inFlightControls = [];
    const desyncs = [];
    let tickClock = 0;

    const enqueuePacket = (toSlot, buffer, stallActive) => {
      // 12% packet drop rate (still recoverable via 8-frame redundancy).
      if (rng() < 0.12) return;
      // Base 1..4 tick latency + occasional jitter/reordering + simulated burst stall.
      const delay = stallActive
        ? 9 + Math.floor(rng() * 5)
        : 1 + Math.floor(rng() * 4);
      inFlightInputs.push({ deliverAt: tickClock + delay, toSlot, buffer });
      // 10% packet duplication with different arrival delay to force out-of-order & duplicates.
      if (rng() < 0.10) {
        inFlightInputs.push({
          deliverAt: tickClock + delay + 1 + Math.floor(rng() * 3),
          toSlot,
          buffer: buffer.slice(0)
        });
      }
    };

    const enqueueControl = (toSlot, message) => {
      const delay = 1 + Math.floor(rng() * 3);
      inFlightControls.push({ deliverAt: tickClock + delay, toSlot, message });
    };

    const peer0 = new RollbackSession({
      localSlot: 0,
      sessionId: 0x2a2a,
      inputDelay,
      maxRollback,
      checksumIntervalFrames: 30,
      onSendInputPacket: buf => enqueuePacket(1, buf, tickClock >= 240 && tickClock <= 262),
      onSendControl: msg => enqueueControl(1, msg),
      onDesync: info => desyncs.push({ slot: 0, info })
    });
    const peer1 = new RollbackSession({
      localSlot: 1,
      sessionId: 0x2a2a,
      inputDelay,
      maxRollback,
      checksumIntervalFrames: 30,
      onSendInputPacket: buf => enqueuePacket(0, buf, tickClock >= 410 && tickClock <= 432),
      onSendControl: msg => enqueueControl(0, msg),
      onDesync: info => desyncs.push({ slot: 1, info })
    });

    const peers = [peer0, peer1];
    const localInputCursors = [0, 0];

    // Run until both peers have confirmed and simulated at least totalMatchFrames.
    for (tickClock = 0; tickClock < 1400; tickClock += 1) {
      // Deliver due unreliable input packets (intentionally shuffled for reordering).
      for (let i = inFlightInputs.length - 1; i >= 0; i -= 1) {
        if (inFlightInputs[i].deliverAt <= tickClock) {
          const item = inFlightInputs.splice(i, 1)[0];
          peers[item.toSlot].receiveInputPacket(item.buffer);
        }
      }
      // Deliver due reliable control packets (checksums).
      for (let i = inFlightControls.length - 1; i >= 0; i -= 1) {
        if (inFlightControls[i].deliverAt <= tickClock) {
          const item = inFlightControls.splice(i, 1)[0];
          if (item.message.type === "CHECKSUM") {
            peers[item.toSlot].receiveChecksum(item.message);
          }
        }
      }

      // Tick both peers (with slight random wall-clock jitter on peer1 to trigger rollbacks & stalls).
      const r0 = peer0.tick(p1Masks[localInputCursors[0]] ?? 0);
      if (r0.advanced) localInputCursors[0] += 1;

      const r1 = peer1.tick(p2Masks[localInputCursors[1]] ?? 0);
      if (r1.advanced) localInputCursors[1] += 1;

      // Verify frame-for-frame canonical equality at the latest mutually confirmed state frame.
      const commonConfirmed = Math.min(
        peer0.getMutuallyConfirmedStateFrame(),
        peer1.getMutuallyConfirmedStateFrame(),
        totalMatchFrames
      );
      if (commonConfirmed > 0 && peer0.pendingRollbackFrame === null && peer1.pendingRollbackFrame === null) {
        const c0 = peer0.getCanonicalChecksumAt(commonConfirmed);
        const c1 = peer1.getCanonicalChecksumAt(commonConfirmed);
        const cRef = reference.checksums.get(commonConfirmed);
        if (c0 !== null && c1 !== null) {
          assert.equal(
            c0,
            cRef,
            `Seed ${seed}: Peer 0 diverged from zero-latency reference at frame ${commonConfirmed} (${formatChecksum(c0)} != ${formatChecksum(cRef)})`
          );
          assert.equal(
            c1,
            cRef,
            `Seed ${seed}: Peer 1 diverged from zero-latency reference at frame ${commonConfirmed} (${formatChecksum(c1)} != ${formatChecksum(cRef)})`
          );
        }
      }

      if (
        peer0.getMutuallyConfirmedStateFrame() >= totalMatchFrames &&
        peer1.getMutuallyConfirmedStateFrame() >= totalMatchFrames
      ) {
        break;
      }
    }

    assert.equal(desyncs.length, 0, `Seed ${seed} reported unexpected desyncs: ${JSON.stringify(desyncs)}`);
    assert.ok(peer0.getMutuallyConfirmedStateFrame() >= totalMatchFrames, `Seed ${seed}: peer0 did not finish`);
    assert.ok(peer1.getMutuallyConfirmedStateFrame() >= totalMatchFrames, `Seed ${seed}: peer1 did not finish`);
    assert.ok(peer0.totalRollbacks + peer1.totalRollbacks > 0, `Seed ${seed}: expected real rollbacks under latency`);
    assert.ok(peer0.totalStallTicks + peer1.totalStallTicks > 0, `Seed ${seed}: expected stall protection during burst outage`);
    assert.ok(peer0.lastVerifiedChecksumFrame >= 570, `Seed ${seed}: expected periodic checksum confirmations`);
    assert.ok(peer1.lastVerifiedChecksumFrame >= 570, `Seed ${seed}: expected periodic checksum confirmations`);
  }
});

test("RollbackSession detects and reports state desync via periodic checksum exchange", () => {
  const desyncEvents = [];
  const peer0 = new RollbackSession({
    localSlot: 0,
    sessionId: 55,
    inputDelay: 1,
    checksumIntervalFrames: 30,
    onSendInputPacket: buf => peer1.receiveInputPacket(buf),
    onSendControl: msg => {
      if (msg.type === "CHECKSUM") peer1.receiveChecksum(msg);
    },
    onDesync: info => desyncEvents.push({ slot: 0, info })
  });
  const peer1 = new RollbackSession({
    localSlot: 1,
    sessionId: 55,
    inputDelay: 1,
    checksumIntervalFrames: 30,
    onSendInputPacket: buf => peer0.receiveInputPacket(buf),
    onSendControl: msg => {
      if (msg.type === "CHECKSUM") peer0.receiveChecksum(msg);
    },
    onDesync: info => desyncEvents.push({ slot: 1, info })
  });

  for (let frame = 0; frame < 35; frame += 1) {
    if (frame === 15) {
      // Deliberately corrupt peer1's fighter position to simulate a bug/cheat desync.
      peer1.arena.player.x += 5;
    }
    peer0.tick(INPUT_BITS.right);
    peer1.tick(INPUT_BITS.left);
  }

  assert.equal(peer0.desynced, true);
  assert.equal(peer1.desynced, true);
  assert.ok(desyncEvents.length >= 1);
  assert.equal(desyncEvents[0].info.frame, 30);
});

test("RollbackSession recommends wall-clock pacing stretch without skipping numbered simulation frames", () => {
  const session = new RollbackSession({
    localSlot: 0,
    sessionId: 7,
    inputDelay: 2,
    maxRollback: 8
  });

  assert.equal(session.getRecommendedStepIntervalMs(), 1000 / 60);
  // Advance 5 frames locally with no remote packets -> frameAdvantage > 1 -> stretches pacing.
  for (let i = 0; i < 5; i += 1) {
    const step = session.tick(0);
    assert.equal(step.advanced, true);
    assert.equal(step.frame, i);
  }
  assert.ok(session.getFrameAdvantage() > 1);
  assert.ok(session.getRecommendedStepIntervalMs() > 1000 / 60);

  // Advancing past maxRollback stalls cleanly instead of skipping or diverging.
  let stalled = false;
  for (let i = 0; i < 12; i += 1) {
    const step = session.tick(0);
    if (step.stalled) {
      stalled = true;
      break;
    }
  }
  assert.equal(stalled, true);
  assert.equal(session.stalled, true);
});
