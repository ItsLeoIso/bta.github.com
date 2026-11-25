import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeSignalCode,
  decodeSignalCode,
  WebRtcTransport,
  DEFAULT_ICE_SERVERS
} from "../src/net/WebRtcTransport.js";
import { OnlineMatchController, ONLINE_PHASES } from "../src/net/OnlineMatchController.js";
import { INPUT_BITS } from "../src/input/BitmaskInput.js";
import { MenuController, MENU_SCREENS } from "../src/ui/MenuController.js";

/**
 * In-memory paired mock RTCPeerConnection for deterministic Node testing of
 * WebRtcTransport + OnlineMatchController without real sockets.
 */
function createLinkedMockWebRtc() {
  const instances = [];

  class MockDataChannel {
    constructor(label, options = {}) {
      this.label = label;
      this.options = options;
      this.readyState = "connecting";
      this.binaryType = "arraybuffer";
      this.peer = null;
      this.onopen = null;
      this.onclose = null;
      this.onerror = null;
      this.onmessage = null;
    }
    send(data) {
      if (this.readyState !== "open" || !this.peer || this.peer.readyState !== "open") return;
      const payload = data instanceof ArrayBuffer ? data.slice(0) : data;
      queueMicrotask(() => {
        if (this.peer?.readyState === "open") {
          this.peer.onmessage?.({ data: payload });
        }
      });
    }
    close() {
      if (this.readyState === "closed") return;
      this.readyState = "closed";
      this.onclose?.();
      if (this.peer && this.peer.readyState !== "closed") {
        this.peer.readyState = "closed";
        this.peer.onclose?.();
      }
    }
  }

  class MockPeerConnection {
    constructor(config) {
      this.config = config;
      this.iceGatheringState = "complete";
      this.connectionState = "new";
      this.iceConnectionState = "new";
      this.localDescription = null;
      this.remoteDescription = null;
      this.channels = new Map();
      this.addedCandidates = [];
      this.onicecandidate = null;
      this.ondatachannel = null;
      this.onconnectionstatechange = null;
      this.oniceconnectionstatechange = null;
      this.id = instances.length;
      instances.push(this);
    }
    createDataChannel(label, options) {
      const ch = new MockDataChannel(label, options);
      this.channels.set(label, ch);
      return ch;
    }
    async createOffer() {
      return { type: "offer", sdp: `mock-offer-from-${this.id}` };
    }
    async createAnswer() {
      return { type: "answer", sdp: `mock-answer-from-${this.id}` };
    }
    async setLocalDescription(desc) {
      this.localDescription = desc;
    }
    async setRemoteDescription(desc) {
      this.remoteDescription = desc;
      // When host receives guest's answer, link both peers' data channels and open them.
      if (desc.type === "answer") {
        const guestId = Number(desc.sdp.replace("mock-answer-from-", ""));
        const guestPc = instances[guestId];
        if (guestPc) {
          this.connectionState = "connected";
          guestPc.connectionState = "connected";
          for (const [label, hostCh] of this.channels) {
            const guestCh = new MockDataChannel(label, hostCh.options);
            hostCh.peer = guestCh;
            guestCh.peer = hostCh;
            guestPc.channels.set(label, guestCh);
            guestPc.ondatachannel?.({ channel: guestCh });
            hostCh.readyState = "open";
            guestCh.readyState = "open";
            hostCh.onopen?.();
            guestCh.onopen?.();
          }
        }
      }
    }
    async addIceCandidate(candidate) {
      this.addedCandidates.push(candidate);
    }
    close() {
      this.connectionState = "closed";
      for (const ch of this.channels.values()) ch.close();
    }
  }

  return { MockPeerConnection, instances };
}

test("encodeSignalCode and decodeSignalCode round-trip invite codes and reject malformed input", () => {
  const offer = { type: "offer", sdp: "v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n" };
  const code = encodeSignalCode(offer);
  assert.ok(code.startsWith("BTA1:"));

  // Whitespace / line breaks pasted from chat apps should still decode cleanly.
  const messy = code.slice(0, 12) + "\n  " + code.slice(12) + " \r\n";
  const decoded = decodeSignalCode(messy);
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.description, offer);

  assert.equal(decodeSignalCode("INVALID:abc").ok, false);
  assert.equal(decodeSignalCode("BTA1:!!!not-base64!!!").ok, false);
  assert.equal(decodeSignalCode(null).ok, false);
});

test("WebRtcTransport accepts pluggable ICE/TURN servers and queues early ICE candidates", async () => {
  const { MockPeerConnection, instances } = createLinkedMockWebRtc();
  const customIce = [
    ...DEFAULT_ICE_SERVERS,
    { urls: "turn:turn.example.com:3478", username: "u", credential: "p" }
  ];

  const transport = new WebRtcTransport({
    iceServers: customIce,
    PeerConnectionClass: MockPeerConnection
  });
  await transport.createSignalingOffer();
  const pc = instances[0];
  assert.equal(pc.config.iceServers.length, 3);
  assert.equal(pc.config.iceServers[2].urls, "turn:turn.example.com:3478");

  // Candidate arriving before remote description must be queued, not dropped.
  await transport.addIceCandidate({ candidate: "candidate:1" });
  assert.equal(pc.addedCandidates.length, 0);

  await transport.acceptSignalingAnswer({ type: "answer", sdp: "mock-answer-from-99" });
  assert.equal(pc.addedCandidates.length, 1);
  transport.close({ silent: true });
});

test("OnlineMatchController completes full Direct Invite -> Character Select -> Rollback Match -> Rematch -> Forfeit lifecycle", async () => {
  const { MockPeerConnection } = createLinkedMockWebRtc();
  let fakeTime = 1000;

  const makeTransport = callbacks => new WebRtcTransport({
    ...callbacks,
    PeerConnectionClass: MockPeerConnection
  });

  const host = new OnlineMatchController({
    inputDelay: 2,
    now: () => fakeTime,
    createTransport: makeTransport
  });
  const guest = new OnlineMatchController({
    inputDelay: 2,
    now: () => fakeTime,
    createTransport: makeTransport
  });

  // 1. Direct Invite handshake
  const offerCode = await host.createDirectInvite();
  assert.ok(offerCode.startsWith("BTA1:"));
  assert.equal(host.phase, ONLINE_PHASES.DIRECT_HOST_WAITING);

  const answerCode = await guest.acceptDirectInvite(offerCode);
  assert.ok(answerCode.startsWith("BTA1:"));
  assert.equal(guest.phase, ONLINE_PHASES.DIRECT_GUEST_ANSWERING);

  await host.completeDirectInvite(answerCode);
  await new Promise(resolve => setTimeout(resolve, 10));

  assert.equal(host.phase, ONLINE_PHASES.CHARACTER_SELECT);
  assert.equal(guest.phase, ONLINE_PHASES.CHARACTER_SELECT);
  assert.equal(host.localSlot, 0);
  assert.equal(guest.localSlot, 1);

  // 2. Synchronized Online Character Select + Ready -> MATCH_CONFIG handshake
  host.selectCharacter("striker");
  guest.selectCharacter("cpu-rival");
  host.toggleReady();
  guest.toggleReady();
  await new Promise(resolve => setTimeout(resolve, 15));

  assert.equal(host.phase, ONLINE_PHASES.IN_MATCH);
  assert.equal(guest.phase, ONLINE_PHASES.IN_MATCH);
  assert.ok(host.session);
  assert.ok(guest.session);
  assert.equal(host.session.sessionId, guest.session.sessionId);

  // 3. Simulate 70 live frames exchanging real inputs & verifying 30-frame checksums
  const initialSessionId = host.session.sessionId;
  for (let frame = 0; frame < 70; frame += 1) {
    const p1Mask = frame % 10 < 5 ? INPUT_BITS.right : INPUT_BITS.light;
    const p2Mask = frame % 12 < 6 ? INPUT_BITS.left : INPUT_BITS.special;
    host.stepLocalFrame(p1Mask);
    guest.stepLocalFrame(p2Mask);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  await new Promise(resolve => setTimeout(resolve, 10));

  assert.equal(host.session.desynced, false);
  assert.equal(guest.session.desynced, false);
  assert.ok(host.session.lastVerifiedChecksumFrame >= 60);
  assert.equal(host.session.lastVerifiedChecksum, guest.session.lastVerifiedChecksum);

  // 4. Two-player rematch voting starts a fresh synchronized session
  host.voteRematch();
  assert.equal(host.session.sessionId, initialSessionId, "Single vote must not reset match");
  guest.voteRematch();
  await new Promise(resolve => setTimeout(resolve, 15));

  assert.equal(host.phase, ONLINE_PHASES.IN_MATCH);
  assert.equal(guest.phase, ONLINE_PHASES.IN_MATCH);
  assert.equal(host.session.currentFrame, 0);
  assert.equal(guest.session.currentFrame, 0);
  assert.equal(host.session.sessionId, guest.session.sessionId);

  // 5. Return to Character Select works symmetrically
  guest.requestCharacterSelect();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(host.phase, ONLINE_PHASES.CHARACTER_SELECT);
  assert.equal(guest.phase, ONLINE_PHASES.CHARACTER_SELECT);

  // 6. Forfeit notifies opponent cleanly
  host.forfeitAndExit();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(host.phase, ONLINE_PHASES.LOBBY);
  assert.equal(guest.phase, ONLINE_PHASES.DISCONNECTED);
  assert.equal(guest.forfeitedBySlot, 0);

  host.teardownConnections();
  guest.teardownConnections();
});

test("OnlineMatchController rejects incompatible MATCH_CONFIG versions explicitly", async () => {
  const { MockPeerConnection } = createLinkedMockWebRtc();
  const makeTransport = callbacks => new WebRtcTransport({
    ...callbacks,
    PeerConnectionClass: MockPeerConnection
  });
  const host = new OnlineMatchController({ createTransport: makeTransport });
  const guest = new OnlineMatchController({ createTransport: makeTransport });

  const offer = await host.createDirectInvite();
  const answer = await guest.acceptDirectInvite(offer);
  await host.completeDirectInvite(answer);
  await new Promise(resolve => setTimeout(resolve, 10));

  // Inject an incompatible MATCH_CONFIG directly over control channel.
  host.transport.sendControl({
    type: "MATCH_CONFIG",
    protocolVersion: 99,
    simVersion: 1,
    contentVersion: "mismatch",
    sessionId: 12,
    slots: { slot0CharacterId: "striker", slot1CharacterId: "cpu-rival" },
    matchConfig: { inputDelay: 2, maxRollback: 8, roundsToWin: 2, roundDurationFrames: 5940 }
  });
  await new Promise(resolve => setTimeout(resolve, 15));

  assert.equal(guest.phase, ONLINE_PHASES.ERROR);
  assert.match(guest.errorMessage, /Protocol version mismatch/);
  assert.equal(host.phase, ONLINE_PHASES.ERROR);
  assert.match(host.errorMessage, /rejected/i);

  host.teardownConnections();
  guest.teardownConnections();
});

test("MenuController exposes non-blocking online pause options and calls onForfeitOnline", () => {
  let forfeited = 0;
  const menu = new MenuController({
    onForfeitOnline: () => { forfeited += 1; }
  });
  menu.startOnline();
  assert.equal(menu.mode, "online");
  assert.equal(menu.screen, MENU_SCREENS.PLAYING);

  menu.pause();
  assert.deepEqual(menu.getPauseItems(), ["Resume", "Forfeit & Exit"]);
  menu.selectPauseItem(1);
  assert.equal(forfeited, 1);
  assert.equal(menu.screen, MENU_SCREENS.MAIN);
});
