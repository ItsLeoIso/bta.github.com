import { getAvailableCharacters } from "../characters/CharacterDefinitions.js";
import { ROUND_PHASES } from "../combat/RoundController.js";
import {
  DEFAULT_INPUT_DELAY,
  DEFAULT_ROLLBACK_WINDOW,
  MAX_INPUT_DELAY,
  MIN_INPUT_DELAY,
  createMatchConfig,
  validateMatchConfig
} from "./PacketCodec.js";
import { RollbackSession } from "./RollbackSession.js";
import { WebRtcTransport, DEFAULT_ICE_SERVERS } from "./WebRtcTransport.js";
import { SignalingClient } from "./SignalingClient.js";

export const ONLINE_PHASES = Object.freeze({
  LOBBY: "lobby",
  DIRECT_HOST_WAITING: "direct-host-waiting",
  DIRECT_GUEST_ANSWERING: "direct-guest-answering",
  ROOM_CONNECTING: "room-connecting",
  ROOM_WAITING: "room-waiting",
  CONNECTING_P2P: "connecting-p2p",
  CHARACTER_SELECT: "character-select",
  HANDSHAKING: "handshaking",
  IN_MATCH: "in-match",
  DISCONNECTED: "disconnected",
  ERROR: "error"
});

const PING_INTERVAL_MS = 1000;
const HEARTBEAT_TIMEOUT_MS = 6000;

/**
 * Orchestrates the complete online 1v1 lifecycle:
 * - Zero-backend Direct Invite (Base64 SDP copy/paste) OR Room-Code Signaling
 * - Dual-channel WebRTC P2P connection
 * - Synchronized Online Character Select + MATCH_CONFIG version handshake
 * - GGPO-style RollbackSession with RTT ping, checksum verification, two-player
 *   rematch voting, forfeit, and clean disconnect handling.
 */
export class OnlineMatchController {
  constructor({
    iceServers = DEFAULT_ICE_SERVERS,
    signalingUrl = "",
    inputDelay = DEFAULT_INPUT_DELAY,
    maxRollback = DEFAULT_ROLLBACK_WINDOW,
    now = () => Date.now(),
    createTransport = null,
    createSignaling = null,
    onStateChange = () => {},
    onMatchStart = () => {},
    onMatchEnd = () => {}
  } = {}) {
    this.iceServers = iceServers;
    this.signalingUrl = signalingUrl;
    this.inputDelay = inputDelay;
    this.maxRollback = maxRollback;
    this.now = now;
    this.createTransport = createTransport;
    this.createSignaling = createSignaling;
    this.onStateChange = onStateChange;
    this.onMatchStart = onMatchStart;
    this.onMatchEnd = onMatchEnd;

    this.characters = getAvailableCharacters();
    this.phase = ONLINE_PHASES.LOBBY;
    this.connectionMethod = "direct"; // "direct" | "room"
    this.localSlot = null; // 0 (Host) | 1 (Guest)
    this.roomCode = "";
    this.localOfferCode = "";
    this.localAnswerCode = "";
    this.statusMessage = "Choose Direct Invite (no server required) or connect via Room Code.";
    this.errorMessage = "";

    this.localCharacterId = this.characters[0]?.id ?? "striker";
    this.remoteCharacterId = this.characters[1]?.id ?? this.localCharacterId;
    this.localReady = false;
    this.remoteReady = false;

    this.localRematchVote = false;
    this.remoteRematchVote = false;
    this.forfeitedBySlot = null;

    this.rttMs = null;
    this.lastPeerActivityAt = 0;
    this.lastPingSentAt = 0;
    this.pendingPingId = 0;
    this.pendingPingSentAt = 0;

    this.transport = null;
    this.signaling = null;
    this.session = null;
    this.pendingHostMatchConfig = null;
    this.heartbeatTimer = null;
  }

  getViewModel() {
    const stats = this.session?.getStats() ?? null;
    const arena = this.session?.arena ?? null;
    const matchOver = arena?.rounds?.phase === ROUND_PHASES.MATCH_OVER;

    return {
      phase: this.phase,
      connectionMethod: this.connectionMethod,
      localSlot: this.localSlot,
      remoteSlot: this.localSlot === null ? null : (this.localSlot === 0 ? 1 : 0),
      signalingUrl: this.signalingUrl,
      inputDelay: this.inputDelay,
      maxRollback: this.maxRollback,
      roomCode: this.roomCode,
      localOfferCode: this.localOfferCode,
      localAnswerCode: this.localAnswerCode,
      statusMessage: this.statusMessage,
      errorMessage: this.errorMessage,
      characters: this.characters.map(c => ({
        id: c.id,
        name: c.name,
        archetype: c.archetype,
        description: c.description,
        stats: { ...c.stats }
      })),
      localCharacterId: this.localCharacterId,
      remoteCharacterId: this.remoteCharacterId,
      localReady: this.localReady,
      remoteReady: this.remoteReady,
      localRematchVote: this.localRematchVote,
      remoteRematchVote: this.remoteRematchVote,
      forfeitedBySlot: this.forfeitedBySlot,
      matchOver,
      rttMs: this.rttMs,
      stats
    };
  }

  notify() {
    this.onStateChange(this.getViewModel());
  }

  setInputDelay(delay) {
    if (!Number.isInteger(delay) || delay < MIN_INPUT_DELAY || delay > MAX_INPUT_DELAY) return false;
    this.inputDelay = delay;
    this.notify();
    return true;
  }

  setSignalingUrl(url) {
    this.signalingUrl = String(url ?? "").trim();
    this.notify();
  }

  setIceServers(iceServers) {
    if (Array.isArray(iceServers) && iceServers.length > 0) {
      this.iceServers = iceServers;
    }
  }

  buildTransport() {
    const callbacks = {
      iceServers: this.iceServers,
      onOpen: () => this.handleTransportOpen(),
      onClose: reason => this.handleTransportClose(reason),
      onError: error => this.handleError(error instanceof Error ? error.message : String(error)),
      onInputPacket: buffer => this.handleInputPacket(buffer),
      onControlMessage: message => this.handleControlMessage(message),
      onIceCandidate: candidate => {
        if (this.signaling?.connected) {
          this.signaling.sendSignal({ kind: "ice", candidate });
        }
      },
      onConnectionStateChange: state => {
        if (state === "connecting") {
          this.statusMessage = "Establishing peer-to-peer WebRTC link...";
          this.notify();
        }
      }
    };
    return this.createTransport ? this.createTransport(callbacks) : new WebRtcTransport(callbacks);
  }

  buildSignaling(url) {
    const callbacks = {
      url,
      onRoomCreated: roomCode => {
        this.roomCode = roomCode;
        this.phase = ONLINE_PHASES.ROOM_WAITING;
        this.statusMessage = `Room ${roomCode} ready. Share this code with your opponent.`;
        this.notify();
      },
      onRoomJoined: roomCode => {
        this.roomCode = roomCode;
        this.phase = ONLINE_PHASES.CONNECTING_P2P;
        this.statusMessage = `Joined room ${roomCode}. Waiting for host WebRTC offer...`;
        this.notify();
      },
      onPeerJoined: () => {
        this.handleSignalingPeerJoined().catch(err => this.handleError(err.message));
      },
      onSignal: payload => {
        this.handleSignalingPayload(payload).catch(err => this.handleError(err.message));
      },
      onPeerLeft: () => {
        if (this.phase !== ONLINE_PHASES.IN_MATCH && !this.transport?.isOpen()) {
          this.handleError("Opponent left the room before P2P connection completed.");
        }
      },
      onError: err => this.handleError(err.message),
      onClose: () => {
        if (this.phase === ONLINE_PHASES.ROOM_WAITING || this.phase === ONLINE_PHASES.ROOM_CONNECTING) {
          this.handleError("Signaling server disconnected before match link opened.");
        }
      }
    };
    return this.createSignaling ? this.createSignaling(callbacks) : new SignalingClient(callbacks);
  }

  // --- Mode A: Zero-backend Direct Invite (Copy / Paste) ---

  async createDirectInvite() {
    this.teardownConnections();
    this.connectionMethod = "direct";
    this.localSlot = 0;
    this.errorMessage = "";
    this.localOfferCode = "";
    this.localAnswerCode = "";
    this.statusMessage = "Gathering ICE candidates for Direct Invite...";
    this.phase = ONLINE_PHASES.DIRECT_HOST_WAITING;
    this.notify();

    try {
      this.transport = this.buildTransport();
      const offerCode = await this.transport.createDirectOffer();
      this.localOfferCode = offerCode;
      this.statusMessage = "Invite ready! Copy and send to your opponent, then paste their Answer code below.";
      this.notify();
      return offerCode;
    } catch (error) {
      this.handleError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async acceptDirectInvite(offerCode) {
    this.teardownConnections();
    this.connectionMethod = "direct";
    this.localSlot = 1;
    this.errorMessage = "";
    this.localOfferCode = "";
    this.localAnswerCode = "";
    this.statusMessage = "Processing host invite and gathering ICE candidates...";
    this.phase = ONLINE_PHASES.DIRECT_GUEST_ANSWERING;
    this.notify();

    try {
      this.transport = this.buildTransport();
      const answerCode = await this.transport.acceptDirectOffer(offerCode);
      this.localAnswerCode = answerCode;
      this.statusMessage = "Answer ready! Copy and send this code back to the host. Match opens automatically once they connect.";
      this.notify();
      return answerCode;
    } catch (error) {
      this.handleError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async completeDirectInvite(answerCode) {
    if (!this.transport || this.localSlot !== 0) {
      this.handleError("Create a Direct Invite first before applying an answer code.");
      return false;
    }
    this.errorMessage = "";
    this.phase = ONLINE_PHASES.CONNECTING_P2P;
    this.statusMessage = "Applying guest answer and opening P2P channels...";
    this.notify();

    try {
      await this.transport.acceptDirectAnswer(answerCode);
      return true;
    } catch (error) {
      this.handleError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  // --- Mode B: Room-Code Signaling ---

  async createRoom(url = this.signalingUrl) {
    this.teardownConnections();
    this.connectionMethod = "room";
    this.localSlot = 0;
    this.signalingUrl = String(url ?? "").trim();
    this.errorMessage = "";
    this.roomCode = "";
    this.phase = ONLINE_PHASES.ROOM_CONNECTING;
    this.statusMessage = "Connecting to room-code signaling server...";
    this.notify();

    try {
      this.signaling = this.buildSignaling(this.signalingUrl);
      await this.signaling.connect();
      this.signaling.createRoom();
      return true;
    } catch (error) {
      this.handleError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async joinRoom(roomCode, url = this.signalingUrl) {
    this.teardownConnections();
    this.connectionMethod = "room";
    this.localSlot = 1;
    this.signalingUrl = String(url ?? "").trim();
    this.errorMessage = "";
    this.roomCode = String(roomCode ?? "").trim().toUpperCase();
    if (!this.roomCode) {
      this.handleError("Enter a room code to join.");
      return false;
    }
    this.phase = ONLINE_PHASES.ROOM_CONNECTING;
    this.statusMessage = `Joining room ${this.roomCode}...`;
    this.notify();

    try {
      this.signaling = this.buildSignaling(this.signalingUrl);
      await this.signaling.connect();
      this.signaling.joinRoom(this.roomCode);
      return true;
    } catch (error) {
      this.handleError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async handleSignalingPeerJoined() {
    this.phase = ONLINE_PHASES.CONNECTING_P2P;
    this.statusMessage = "Opponent joined! Negotiating peer-to-peer WebRTC link...";
    this.notify();
    this.transport = this.buildTransport();
    const offer = await this.transport.createSignalingOffer();
    this.signaling?.sendSignal({ kind: "sdp", description: offer });
  }

  async handleSignalingPayload(payload) {
    if (!payload) return;
    if (payload.kind === "sdp" && payload.description) {
      if (payload.description.type === "offer") {
        this.transport = this.buildTransport();
        const answer = await this.transport.acceptSignalingOffer(payload.description);
        this.signaling?.sendSignal({ kind: "sdp", description: answer });
      } else if (payload.description.type === "answer") {
        await this.transport?.acceptSignalingAnswer(payload.description);
      }
    } else if (payload.kind === "ice" && payload.candidate) {
      await this.transport?.addIceCandidate(payload.candidate);
    }
  }

  // --- Connected peer lifecycle ---

  handleTransportOpen() {
    // Signaling is no longer needed once direct P2P channels are open.
    this.signaling?.close();
    this.signaling = null;

    this.lastPeerActivityAt = this.now();
    this.localReady = false;
    this.remoteReady = false;
    this.localRematchVote = false;
    this.remoteRematchVote = false;
    this.forfeitedBySlot = null;
    this.localCharacterId = this.characters[this.localSlot === 0 ? 0 : 1]?.id ?? this.characters[0].id;
    this.remoteCharacterId = this.characters[this.localSlot === 0 ? 1 : 0]?.id ?? this.characters[0].id;

    this.phase = ONLINE_PHASES.CHARACTER_SELECT;
    this.statusMessage = "P2P Connected! Pick your fighter and press Ready.";
    this.startHeartbeatLoop();
    this.sendCharSelectState();
    this.sendPing();
    this.notify();
  }

  handleTransportClose(reason) {
    this.stopHeartbeatLoop();
    if (this.phase === ONLINE_PHASES.LOBBY) return;
    this.phase = ONLINE_PHASES.DISCONNECTED;
    this.statusMessage = "Connection closed (" + reason + ").";
    this.notify();
  }

  handleError(message) {
    this.stopHeartbeatLoop();
    this.errorMessage = message;
    this.statusMessage = message;
    this.phase = ONLINE_PHASES.ERROR;
    this.notify();
  }

  // --- Online Character Select & MATCH_CONFIG handshake ---

  selectCharacter(characterId) {
    if (this.phase !== ONLINE_PHASES.CHARACTER_SELECT) return false;
    if (!this.characters.some(c => c.id === characterId)) return false;
    this.localCharacterId = characterId;
    this.localReady = false;
    this.sendCharSelectState();
    this.notify();
    return true;
  }

  cycleCharacter(direction) {
    if (this.phase !== ONLINE_PHASES.CHARACTER_SELECT) return false;
    const currentIndex = Math.max(0, this.characters.findIndex(c => c.id === this.localCharacterId));
    const nextIndex = (currentIndex + Math.sign(direction) + this.characters.length) % this.characters.length;
    return this.selectCharacter(this.characters[nextIndex].id);
  }

  toggleReady() {
    if (this.phase !== ONLINE_PHASES.CHARACTER_SELECT) return false;
    this.localReady = !this.localReady;
    this.sendCharSelectState();
    this.tryBeginHandshake();
    this.notify();
    return true;
  }

  sendCharSelectState() {
    this.transport?.sendControl({
      type: "CHAR_SELECT",
      characterId: this.localCharacterId,
      ready: this.localReady
    });
  }

  tryBeginHandshake() {
    if (this.phase !== ONLINE_PHASES.CHARACTER_SELECT) return;
    if (!this.localReady || !this.remoteReady) return;
    this.phase = ONLINE_PHASES.HANDSHAKING;
    this.statusMessage = "Verifying match configuration...";

    if (this.localSlot === 0) {
      const config = createMatchConfig({
        slot0CharacterId: this.localCharacterId,
        slot1CharacterId: this.remoteCharacterId,
        inputDelay: this.inputDelay,
        maxRollback: this.maxRollback
      });
      this.pendingHostMatchConfig = config;
      this.transport?.sendControl(config);
    }
    this.notify();
  }

  startSynchronizedMatch(config) {
    this.localRematchVote = false;
    this.remoteRematchVote = false;
    this.forfeitedBySlot = null;
    this.session = new RollbackSession({
      localSlot: this.localSlot,
      sessionId: config.sessionId,
      slot0CharacterId: config.slots.slot0CharacterId,
      slot1CharacterId: config.slots.slot1CharacterId,
      inputDelay: config.matchConfig.inputDelay,
      maxRollback: config.matchConfig.maxRollback,
      checksumIntervalFrames: 30,
      onSendInputPacket: buffer => this.transport?.sendInputPacket(buffer),
      onSendControl: message => this.transport?.sendControl(message),
      onDesync: info => {
        this.statusMessage = info.reason;
        this.notify();
      }
    });
    this.phase = ONLINE_PHASES.IN_MATCH;
    this.statusMessage = "ONLINE MATCH LIVE · ROLLBACK ACTIVE";
    this.onMatchStart(this.session, this.getViewModel());
    this.notify();
  }

  // --- In-Match Stepping, Rematch Voting & Forfeit ---

  stepLocalFrame(localInputMask) {
    if (this.phase !== ONLINE_PHASES.IN_MATCH || !this.session) {
      return { advanced: false, stalled: false, frame: 0, rollbackFrames: 0 };
    }
    const prevPhase = this.session.arena.rounds.phase;
    const result = this.session.tick(localInputMask);
    const nextPhase = this.session.arena.rounds.phase;
    if (prevPhase !== ROUND_PHASES.MATCH_OVER && nextPhase === ROUND_PHASES.MATCH_OVER) {
      this.onMatchEnd(this.getViewModel());
      this.notify();
    }
    return result;
  }

  getRecommendedStepIntervalMs() {
    return this.session?.getRecommendedStepIntervalMs() ?? (1000 / 60);
  }

  voteRematch() {
    if (this.phase !== ONLINE_PHASES.IN_MATCH) return false;
    this.localRematchVote = true;
    this.transport?.sendControl({ type: "REMATCH_VOTE", ready: true });
    this.tryExecuteRematch();
    this.notify();
    return true;
  }

  tryExecuteRematch() {
    if (!this.localRematchVote || !this.remoteRematchVote) return;
    if (this.localSlot === 0) {
      const config = createMatchConfig({
        slot0CharacterId: this.localCharacterId,
        slot1CharacterId: this.remoteCharacterId,
        inputDelay: this.inputDelay,
        maxRollback: this.maxRollback
      });
      this.pendingHostMatchConfig = config;
      this.phase = ONLINE_PHASES.HANDSHAKING;
      this.transport?.sendControl(config);
      this.notify();
    }
  }

  requestCharacterSelect() {
    if (!this.transport?.isOpen()) return false;
    this.transport.sendControl({ type: "RETURN_CHAR_SELECT" });
    this.enterCharacterSelect();
    return true;
  }

  enterCharacterSelect() {
    this.session = null;
    this.localReady = false;
    this.remoteReady = false;
    this.localRematchVote = false;
    this.remoteRematchVote = false;
    this.forfeitedBySlot = null;
    this.phase = ONLINE_PHASES.CHARACTER_SELECT;
    this.statusMessage = "Pick your fighter and press Ready.";
    this.sendCharSelectState();
    this.notify();
  }

  forfeitAndExit() {
    const activeTransport = this.transport;
    if (activeTransport?.isOpen()) {
      activeTransport.sendControl({ type: "FORFEIT", slot: this.localSlot });
      // Detach immediately from local controller and defer closing the channel
      // briefly so the FORFEIT message flushes reliably before socket teardown.
      this.transport = null;
      setTimeout(() => activeTransport.close({ silent: true }), 40);
    }
    this.disconnect();
  }

  // --- Incoming Packets & Control Messages ---

  handleInputPacket(buffer) {
    this.lastPeerActivityAt = this.now();
    if (this.phase !== ONLINE_PHASES.IN_MATCH || !this.session) return;
    this.session.receiveInputPacket(buffer);
  }

  handleControlMessage(message) {
    if (!message || typeof message !== "object") return;
    this.lastPeerActivityAt = this.now();

    switch (message.type) {
      case "CHAR_SELECT":
        if (typeof message.characterId === "string") {
          this.remoteCharacterId = message.characterId;
        }
        this.remoteReady = Boolean(message.ready);
        this.tryBeginHandshake();
        this.notify();
        break;

      case "MATCH_CONFIG": {
        if (this.localSlot !== 1) return;
        const validation = validateMatchConfig(message);
        if (!validation.ok) {
          this.transport?.sendControl({ type: "MATCH_REJECT", reason: validation.reason });
          this.handleError("Match handshake rejected: " + validation.reason);
          return;
        }
        this.inputDelay = message.matchConfig.inputDelay;
        this.maxRollback = message.matchConfig.maxRollback;
        this.transport?.sendControl({ type: "MATCH_READY", sessionId: message.sessionId });
        this.startSynchronizedMatch(message);
        break;
      }

      case "MATCH_READY": {
        if (this.localSlot !== 0 || !this.pendingHostMatchConfig) return;
        if (message.sessionId !== this.pendingHostMatchConfig.sessionId) return;
        const config = this.pendingHostMatchConfig;
        this.pendingHostMatchConfig = null;
        this.startSynchronizedMatch(config);
        break;
      }

      case "MATCH_REJECT":
        this.pendingHostMatchConfig = null;
        this.handleError("Opponent rejected match config: " + (message.reason ?? "version mismatch"));
        break;

      case "CHECKSUM":
        this.session?.receiveChecksum(message);
        break;

      case "PING":
        this.transport?.sendControl({ type: "PONG", id: message.id });
        break;

      case "PONG":
        if (message.id === this.pendingPingId && this.pendingPingSentAt > 0) {
          this.rttMs = Math.max(0, Math.round(this.now() - this.pendingPingSentAt));
          this.notify();
        }
        break;

      case "REMATCH_VOTE":
        this.remoteRematchVote = Boolean(message.ready);
        this.tryExecuteRematch();
        this.notify();
        break;

      case "RETURN_CHAR_SELECT":
        this.enterCharacterSelect();
        break;

      case "FORFEIT":
        this.forfeitedBySlot = Number.isInteger(message.slot) ? message.slot : (this.localSlot === 0 ? 1 : 0);
        this.phase = ONLINE_PHASES.DISCONNECTED;
        this.statusMessage = "Opponent forfeited the match.";
        this.stopHeartbeatLoop();
        this.transport?.close({ silent: true });
        this.notify();
        break;

      default:
        break;
    }
  }

  // --- Heartbeat & Cleanup ---

  sendPing() {
    if (!this.transport?.isOpen()) return;
    this.pendingPingId += 1;
    this.pendingPingSentAt = this.now();
    this.lastPingSentAt = this.pendingPingSentAt;
    this.transport.sendControl({ type: "PING", id: this.pendingPingId });
  }

  checkHeartbeat() {
    if (!this.transport?.isOpen()) return;
    const current = this.now();
    if (current - this.lastPeerActivityAt > HEARTBEAT_TIMEOUT_MS) {
      this.handleTransportClose("peer-timeout");
      this.transport?.close({ silent: true });
      return;
    }
    if (current - this.lastPingSentAt >= PING_INTERVAL_MS) {
      this.sendPing();
    }
  }

  startHeartbeatLoop() {
    this.stopHeartbeatLoop();
    if (typeof setInterval === "function") {
      this.heartbeatTimer = setInterval(() => this.checkHeartbeat(), PING_INTERVAL_MS);
    }
  }

  stopHeartbeatLoop() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  teardownConnections() {
    this.stopHeartbeatLoop();
    this.signaling?.close();
    this.signaling = null;
    this.transport?.close({ silent: true });
    this.transport = null;
    this.session = null;
    this.pendingHostMatchConfig = null;
  }

  disconnect() {
    this.teardownConnections();
    this.phase = ONLINE_PHASES.LOBBY;
    this.localSlot = null;
    this.roomCode = "";
    this.localOfferCode = "";
    this.localAnswerCode = "";
    this.rttMs = null;
    this.localReady = false;
    this.remoteReady = false;
    this.localRematchVote = false;
    this.remoteRematchVote = false;
    this.forfeitedBySlot = null;
    this.errorMessage = "";
    this.statusMessage = "Choose Direct Invite (no server required) or connect via Room Code.";
    this.notify();
  }
}
