import { Arena } from "../engine/Arena.js";
import { BitmaskInputAdapter, KNOWN_INPUT_MASK } from "../input/BitmaskInput.js";
import { computeSnapshotChecksum, formatChecksum } from "./StateChecksum.js";
import {
  DEFAULT_INPUT_DELAY,
  DEFAULT_REDUNDANCY_COUNT,
  DEFAULT_ROLLBACK_WINDOW,
  decodeInputPacket,
  encodeInputPacket
} from "./PacketCodec.js";

const FIXED_STEP_SECONDS = 1 / 60;
const BASE_STEP_MS = 1000 / 60;

/**
 * GGPO-style rollback netcode session wrapping the canonical Slot 0 / Slot 1 Arena.
 *
 * - Numbered simulation frames (0, 1, 2, ...) are NEVER skipped.
 * - Frame advantage is smoothed via wall-clock pacing recommendations only.
 * - Remote predictions repeat the last confirmed bitmask and roll back cleanly
 *   when real remote inputs differ, gating cosmetic VFX during resimulation.
 * - Periodic FNV-1a checksums on mutually confirmed frames detect desyncs immediately.
 */
export class RollbackSession {
  constructor({
    localSlot = 0,
    sessionId = 1,
    slot0CharacterId = "striker",
    slot1CharacterId = "cpu-rival",
    inputDelay = DEFAULT_INPUT_DELAY,
    maxRollback = DEFAULT_ROLLBACK_WINDOW,
    redundancyCount = DEFAULT_REDUNDANCY_COUNT,
    checksumIntervalFrames = 30,
    onSendInputPacket = () => {},
    onSendControl = () => {},
    onDesync = () => {},
    onProtocolError = () => {}
  } = {}) {
    if (localSlot !== 0 && localSlot !== 1) {
      throw new RangeError("localSlot must be 0 (Host/P1) or 1 (Guest/P2).");
    }
    if (!Number.isInteger(inputDelay) || inputDelay < 0 || inputDelay > 4) {
      throw new RangeError("inputDelay must be an integer between 0 and 4.");
    }
    if (!Number.isInteger(maxRollback) || maxRollback < 1 || maxRollback > 12) {
      throw new RangeError("maxRollback must be an integer between 1 and 12.");
    }
    if (!Number.isInteger(redundancyCount) || redundancyCount < 1 || redundancyCount > 16) {
      throw new RangeError("redundancyCount must be an integer between 1 and 16.");
    }

    this.localSlot = localSlot;
    this.remoteSlot = localSlot === 0 ? 1 : 0;
    this.sessionId = sessionId & 0xffff;
    this.slot0CharacterId = slot0CharacterId;
    this.slot1CharacterId = slot1CharacterId;
    this.inputDelay = inputDelay;
    this.maxRollback = maxRollback;
    this.redundancyCount = redundancyCount;
    this.checksumIntervalFrames = checksumIntervalFrames;
    this.snapshotRetention = maxRollback + 6;
    this.maxReceiveHorizon = maxRollback + 16;

    this.onSendInputPacket = onSendInputPacket;
    this.onSendControl = onSendControl;
    this.onDesync = onDesync;
    this.onProtocolError = onProtocolError;

    this.arena = new Arena({
      opponentAIEnabled: false,
      trainingMode: false,
      playerCharacterId: slot0CharacterId,
      opponentCharacterId: slot1CharacterId
    });
    this.adapters = [new BitmaskInputAdapter(), new BitmaskInputAdapter()];
    this.resetSessionState();
  }

  resetSessionState({ sessionId = this.sessionId } = {}) {
    this.sessionId = sessionId & 0xffff;
    this.arena.rounds.resetMatch();
    this.arena.resetFighters();
    this.adapters[0].reset();
    this.adapters[1].reset();

    // Number of simulation frames executed so far; next frame to run is currentFrame.
    this.currentFrame = 0;
    this.confirmedRemoteFrame = this.inputDelay - 1;
    this.lastConfirmedRemoteMask = 0;
    this.remoteAckFrame = -1;
    this.highestRemoteFrameSeen = this.inputDelay - 1;
    this.highestPacketSeqReceived = -1;
    this.nextPacketSeq = 1;

    this.localInputs = new Map();
    this.remoteInputs = new Map();
    this.predictedRemoteInputs = new Map();
    this.snapshots = new Map();
    this.localChecksums = new Map();
    this.remoteChecksums = new Map();
    this.lastPublishedChecksumFrame = 0;

    // Pre-seed initial inputDelay frames with neutral (0) for both slots so frame 0
    // can begin immediately with identical confirmed inputs on both peers.
    for (let frame = 0; frame < this.inputDelay; frame += 1) {
      this.localInputs.set(frame, 0);
      this.remoteInputs.set(frame, 0);
    }

    this.pendingRollbackFrame = null;
    this.desynced = false;
    this.desyncInfo = null;
    this.stalled = false;

    // Telemetry
    this.lastRollbackFrames = 0;
    this.maxObservedRollbackFrames = 0;
    this.totalRollbacks = 0;
    this.totalStallTicks = 0;
    this.packetsSent = 0;
    this.packetsReceived = 0;
    this.packetsDroppedInvalid = 0;
    this.lastVerifiedChecksumFrame = 0;
    this.lastVerifiedChecksum = null;
  }

  /**
   * Samples local input for the current tick, transmits a redundant binary
   * packet, performs any pending rollback resimulation, and advances exactly
   * one numbered simulation frame unless stalled at the maxRollback boundary.
   */
  tick(localInputMask) {
    const cleanMask = (Number(localInputMask) >>> 0) & KNOWN_INPUT_MASK;

    // Apply any misprediction rollbacks queued from recent remote packets before advancing.
    if (this.pendingRollbackFrame !== null) {
      this.performRollback(this.pendingRollbackFrame);
      this.pendingRollbackFrame = null;
    }

    // Hard rollback window stall: never advance beyond confirmedRemoteFrame + maxRollback.
    if (this.currentFrame - this.confirmedRemoteFrame > this.maxRollback) {
      this.stalled = true;
      this.totalStallTicks += 1;
      // Re-transmit latest known local inputs so packet drops recover immediately.
      this.transmitLatestInputs();
      return {
        advanced: false,
        stalled: true,
        frame: this.currentFrame,
        rollbackFrames: 0
      };
    }

    this.stalled = false;
    const targetInputFrame = this.currentFrame + this.inputDelay;
    this.localInputs.set(targetInputFrame, cleanMask);
    this.transmitInputsForFrame(targetInputFrame);

    const frame = this.currentFrame;
    this.saveFrameSnapshot(frame);
    this.simulateFrame(frame, { isResimulating: false });
    this.currentFrame += 1;
    // Save the post-frame snapshot at currentFrame so mutually confirmed checksums
    // can hash the exact settled state at frame N.
    this.saveFrameSnapshot(this.currentFrame);

    this.publishConfirmedChecksums();
    this.pruneHistory();

    return {
      advanced: true,
      stalled: false,
      frame,
      rollbackFrames: this.lastRollbackFrames
    };
  }

  /**
   * Re-transmits the most recent local input packet (used during stalls or heartbeats).
   */
  transmitLatestInputs() {
    const latestFrame = this.currentFrame + this.inputDelay - 1;
    if (latestFrame < 0 || !this.localInputs.has(latestFrame)) return false;
    this.transmitInputsForFrame(latestFrame);
    return true;
  }

  transmitInputsForFrame(latestFrame) {
    const masks = [];
    for (let offset = 0; offset < this.redundancyCount; offset += 1) {
      const frame = latestFrame - offset;
      if (frame < 0) break;
      const mask = this.localInputs.get(frame);
      if (mask === undefined) break;
      masks.push(mask);
    }
    if (masks.length === 0) return;

    const buffer = encodeInputPacket({
      sessionId: this.sessionId,
      packetSeq: this.nextPacketSeq++,
      latestFrame,
      ackFrame: this.confirmedRemoteFrame,
      masks
    });
    this.packetsSent += 1;
    this.onSendInputPacket(buffer);
  }

  /**
   * Processes a raw binary `"inputs"` packet following exact out-of-order,
   * duplicate-safe reconstruction rules.
   */
  receiveInputPacket(payload) {
    const decoded = decodeInputPacket(payload);
    if (!decoded.ok) {
      this.packetsDroppedInvalid += 1;
      return { accepted: false, reason: decoded.reason };
    }

    const packet = decoded.packet;
    if (packet.sessionId !== this.sessionId) {
      this.packetsDroppedInvalid += 1;
      return { accepted: false, reason: "Session ID mismatch." };
    }

    this.packetsReceived += 1;
    if (packet.packetSeq > this.highestPacketSeqReceived) {
      this.highestPacketSeqReceived = packet.packetSeq;
    }
    if (packet.latestFrame > this.highestRemoteFrameSeen) {
      this.highestRemoteFrameSeen = packet.latestFrame;
    }
    if (packet.ackFrame > this.remoteAckFrame) {
      this.remoteAckFrame = packet.ackFrame;
    }

    const previousConfirmed = this.confirmedRemoteFrame;
    for (let index = 0; index < packet.inputCount; index += 1) {
      const frame = packet.latestFrame - index;
      if (frame < 0) break;
      if (frame <= this.confirmedRemoteFrame) continue;
      if (frame > this.confirmedRemoteFrame + this.maxReceiveHorizon) continue;

      const existing = this.remoteInputs.get(frame);
      if (existing !== undefined && existing !== packet.masks[index]) {
        this.onProtocolError({
          reason: `Conflicting remote input mask received for frame ${frame}.`,
          frame,
          existing,
          received: packet.masks[index]
        });
        continue;
      }
      this.remoteInputs.set(frame, packet.masks[index]);
    }

    // Advance contiguous confirmedRemoteFrame and check predictions for misprediction.
    let earliestMisprediction = this.pendingRollbackFrame;
    while (this.remoteInputs.has(this.confirmedRemoteFrame + 1)) {
      const nextFrame = this.confirmedRemoteFrame + 1;
      const confirmedMask = this.remoteInputs.get(nextFrame);
      this.confirmedRemoteFrame = nextFrame;
      this.lastConfirmedRemoteMask = confirmedMask;

      if (nextFrame < this.currentFrame) {
        const predictedMask = this.predictedRemoteInputs.get(nextFrame);
        if (predictedMask !== undefined && predictedMask !== confirmedMask) {
          if (earliestMisprediction === null || nextFrame < earliestMisprediction) {
            earliestMisprediction = nextFrame;
          }
        }
      }
    }

    if (earliestMisprediction !== null) {
      this.pendingRollbackFrame = earliestMisprediction;
    }

    if (this.confirmedRemoteFrame > previousConfirmed) {
      // If we rolled back or just confirmed frames without misprediction, we can
      // publish newly settled checksums immediately on next check.
      if (this.pendingRollbackFrame === null) {
        this.publishConfirmedChecksums();
      }
    }

    return {
      accepted: true,
      confirmedRemoteFrame: this.confirmedRemoteFrame,
      rollbackQueued: this.pendingRollbackFrame !== null
    };
  }

  performRollback(targetFrame) {
    if (targetFrame >= this.currentFrame) return 0;

    const snapshot = this.snapshots.get(targetFrame);
    if (!snapshot) {
      this.desynced = true;
      this.desyncInfo = {
        frame: targetFrame,
        reason: `Rollback window exceeded: missing snapshot for frame ${targetFrame}.`
      };
      this.onDesync(this.desyncInfo);
      return 0;
    }

    const rollbackFrames = this.currentFrame - targetFrame;
    this.arena.loadState(snapshot);
    this.adapters[0].setPreviousMask(snapshot.inputMasks[0]);
    this.adapters[1].setPreviousMask(snapshot.inputMasks[1]);

    for (let simFrame = targetFrame; simFrame < this.currentFrame; simFrame += 1) {
      this.saveFrameSnapshot(simFrame);
      this.simulateFrame(simFrame, { isResimulating: true });
    }
    this.saveFrameSnapshot(this.currentFrame);

    this.lastRollbackFrames = rollbackFrames;
    this.totalRollbacks += 1;
    if (rollbackFrames > this.maxObservedRollbackFrames) {
      this.maxObservedRollbackFrames = rollbackFrames;
    }

    this.publishConfirmedChecksums();
    return rollbackFrames;
  }

  simulateFrame(frame, { isResimulating = false } = {}) {
    const localMask = this.localInputs.get(frame) ?? 0;
    let remoteMask;
    if (frame <= this.confirmedRemoteFrame && this.remoteInputs.has(frame)) {
      remoteMask = this.remoteInputs.get(frame);
      this.predictedRemoteInputs.delete(frame);
    } else {
      remoteMask = this.lastConfirmedRemoteMask;
      this.predictedRemoteInputs.set(frame, remoteMask);
    }

    const slot0Mask = this.localSlot === 0 ? localMask : remoteMask;
    const slot1Mask = this.localSlot === 1 ? localMask : remoteMask;

    const p1Frame = this.adapters[0].nextFrame(slot0Mask);
    const p2Frame = this.adapters[1].nextFrame(slot1Mask);
    this.arena.update(FIXED_STEP_SECONDS, p1Frame, p2Frame, {
      isResimulating,
      allowLocalRematchConfirm: false
    });
  }

  saveFrameSnapshot(frame) {
    const snapshot = this.arena.saveState({
      inputMasks: [
        this.adapters[0].getPreviousMask(),
        this.adapters[1].getPreviousMask()
      ]
    });
    this.snapshots.set(frame, snapshot);
  }

  /**
   * Returns the highest frame N for which BOTH peers' inputs 0..N-1 are
   * confirmed and simulated, so snapshots.get(N) is completely final.
   */
  getMutuallyConfirmedStateFrame() {
    return Math.min(this.currentFrame, this.confirmedRemoteFrame + 1);
  }

  getCanonicalChecksumAt(stateFrame) {
    const snapshot = this.snapshots.get(stateFrame);
    if (!snapshot) return null;
    return computeSnapshotChecksum(snapshot);
  }

  publishConfirmedChecksums() {
    if (this.checksumIntervalFrames < 1 || this.pendingRollbackFrame !== null) return;
    const confirmedStateFrame = this.getMutuallyConfirmedStateFrame();
    let nextCheckFrame = this.lastPublishedChecksumFrame + this.checksumIntervalFrames;
    while (nextCheckFrame <= confirmedStateFrame) {
      const snapshot = this.snapshots.get(nextCheckFrame);
      if (snapshot) {
        const checksum = computeSnapshotChecksum(snapshot);
        this.localChecksums.set(nextCheckFrame, checksum);
        this.onSendControl({
          type: "CHECKSUM",
          sessionId: this.sessionId,
          frame: nextCheckFrame,
          checksum
        });
        this.compareChecksums(nextCheckFrame);
      }
      this.lastPublishedChecksumFrame = nextCheckFrame;
      nextCheckFrame += this.checksumIntervalFrames;
    }
  }

  receiveChecksum({ sessionId, frame, checksum }) {
    if (sessionId !== this.sessionId) return false;
    if (!Number.isInteger(frame) || !Number.isInteger(checksum)) return false;
    this.remoteChecksums.set(frame, checksum >>> 0);
    return this.compareChecksums(frame);
  }

  compareChecksums(frame) {
    const local = this.localChecksums.get(frame);
    const remote = this.remoteChecksums.get(frame);
    if (local === undefined || remote === undefined) return false;

    if (local !== remote) {
      this.desynced = true;
      this.desyncInfo = {
        frame,
        localChecksum: formatChecksum(local),
        remoteChecksum: formatChecksum(remote),
        reason: `State desync at frame ${frame} (local ${formatChecksum(local)} != remote ${formatChecksum(remote)}).`
      };
      this.onDesync(this.desyncInfo);
      return false;
    }

    this.lastVerifiedChecksumFrame = Math.max(this.lastVerifiedChecksumFrame, frame);
    this.lastVerifiedChecksum = formatChecksum(local);
    this.localChecksums.delete(frame);
    this.remoteChecksums.delete(frame);
    return true;
  }

  pruneHistory() {
    const minKeepSnapshot = Math.max(
      0,
      Math.min(this.currentFrame - this.snapshotRetention, this.confirmedRemoteFrame)
    );
    for (const frame of this.snapshots.keys()) {
      if (frame < minKeepSnapshot) this.snapshots.delete(frame);
    }

    const minKeepLocal = Math.max(0, Math.min(this.remoteAckFrame - this.redundancyCount, this.confirmedRemoteFrame - 2));
    for (const frame of this.localInputs.keys()) {
      if (frame < minKeepLocal) this.localInputs.delete(frame);
    }

    const minKeepRemote = Math.max(0, this.confirmedRemoteFrame - this.snapshotRetention);
    for (const frame of this.remoteInputs.keys()) {
      if (frame < minKeepRemote) this.remoteInputs.delete(frame);
    }
    for (const frame of this.predictedRemoteInputs.keys()) {
      if (frame <= this.confirmedRemoteFrame) this.predictedRemoteInputs.delete(frame);
    }
  }

  /**
   * Estimates how many simulation frames ahead of the remote peer we currently are.
   * Used strictly to adjust wall-clock pacing — numbered frames are never skipped.
   */
  getFrameAdvantage() {
    const estimatedRemoteSimFrame = Math.max(0, this.highestRemoteFrameSeen - this.inputDelay + 1);
    return this.currentFrame - estimatedRemoteSimFrame;
  }

  /**
   * Recommends the wall-clock step interval in milliseconds for the browser loop.
   * When consistently ahead by >1 frame, stretches pacing slightly (up to +3ms)
   * so the slower peer catches up cleanly without skipping frame numbers.
   */
  getRecommendedStepIntervalMs() {
    const advantage = this.getFrameAdvantage();
    if (advantage <= 1) return BASE_STEP_MS;
    const stretchMs = Math.min(3.0, (advantage - 1) * 1.25);
    return BASE_STEP_MS + stretchMs;
  }

  getStats() {
    return {
      localSlot: this.localSlot,
      sessionId: this.sessionId,
      currentFrame: this.currentFrame,
      confirmedRemoteFrame: this.confirmedRemoteFrame,
      frameAdvantage: this.getFrameAdvantage(),
      inputDelay: this.inputDelay,
      maxRollback: this.maxRollback,
      lastRollbackFrames: this.lastRollbackFrames,
      maxObservedRollbackFrames: this.maxObservedRollbackFrames,
      totalRollbacks: this.totalRollbacks,
      totalStallTicks: this.totalStallTicks,
      stalled: this.stalled,
      desynced: this.desynced,
      desyncInfo: this.desyncInfo,
      lastVerifiedChecksumFrame: this.lastVerifiedChecksumFrame,
      lastVerifiedChecksum: this.lastVerifiedChecksum,
      packetsSent: this.packetsSent,
      packetsReceived: this.packetsReceived,
      packetsDroppedInvalid: this.packetsDroppedInvalid
    };
  }
}
