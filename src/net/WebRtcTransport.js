export const DEFAULT_ICE_SERVERS = Object.freeze([
  Object.freeze({ urls: "stun:stun.l.google.com:19302" }),
  Object.freeze({ urls: "stun:stun1.l.google.com:19302" })
]);

const INVITE_PREFIX = "BTA1:";
const ICE_GATHER_TIMEOUT_MS = 3500;

function toBase64Url(text) {
  let base64;
  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(text, "utf8").toString("base64");
  } else {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(encoded) {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (encoded.length % 4)) % 4);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Encodes an SDP offer or answer into a compact copy-paste invite token (`BTA1:...`).
 */
export function encodeSignalCode(description) {
  if (!description || (description.type !== "offer" && description.type !== "answer") || typeof description.sdp !== "string") {
    throw new TypeError("Signal description must include type ('offer'|'answer') and sdp string.");
  }
  const compact = JSON.stringify({ v: 1, t: description.type === "offer" ? "o" : "a", s: description.sdp });
  return INVITE_PREFIX + toBase64Url(compact);
}

/**
 * Decodes and validates a `BTA1:...` copy-paste invite/answer token.
 */
export function decodeSignalCode(rawCode) {
  if (typeof rawCode !== "string") {
    return { ok: false, reason: "Invite code must be a string." };
  }
  const cleaned = rawCode.replace(/\s+/g, "").trim();
  if (!cleaned.startsWith(INVITE_PREFIX)) {
    return { ok: false, reason: "Invalid invite code prefix (expected BTA1:...)." };
  }
  try {
    const json = fromBase64Url(cleaned.slice(INVITE_PREFIX.length));
    const parsed = JSON.parse(json);
    if (!parsed || parsed.v !== 1 || (parsed.t !== "o" && parsed.t !== "a") || typeof parsed.s !== "string") {
      return { ok: false, reason: "Malformed invite payload." };
    }
    return {
      ok: true,
      description: {
        type: parsed.t === "o" ? "offer" : "answer",
        sdp: parsed.s
      }
    };
  } catch {
    return { ok: false, reason: "Could not decode invite code. Check that the full code was pasted." };
  }
}

/**
 * Dual-channel WebRTC peer-to-peer transport:
 * - `"inputs"`: unreliable, unordered binary ArrayBuffer channel for 60 Hz input packets.
 * - `"control"`: reliable, ordered JSON channel for handshake, character select, checksums, and pings.
 *
 * ICE servers are injected cleanly so STUN is the default and TURN can be configured
 * without touching transport or rollback logic.
 */
export class WebRtcTransport {
  constructor({
    iceServers = DEFAULT_ICE_SERVERS,
    iceGatherTimeoutMs = ICE_GATHER_TIMEOUT_MS,
    PeerConnectionClass = globalThis.RTCPeerConnection,
    onOpen = () => {},
    onClose = () => {},
    onError = () => {},
    onInputPacket = () => {},
    onControlMessage = () => {},
    onIceCandidate = () => {},
    onConnectionStateChange = () => {}
  } = {}) {
    this.iceServers = Array.isArray(iceServers) && iceServers.length > 0
      ? iceServers
      : DEFAULT_ICE_SERVERS;
    this.iceGatherTimeoutMs = iceGatherTimeoutMs;
    this.PeerConnectionClass = PeerConnectionClass;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onError = onError;
    this.onInputPacket = onInputPacket;
    this.onControlMessage = onControlMessage;
    this.onIceCandidate = onIceCandidate;
    this.onConnectionStateChange = onConnectionStateChange;

    this.pc = null;
    this.inputsChannel = null;
    this.controlChannel = null;
    this.role = null;
    this.opened = false;
    this.closed = false;
    this.pendingIceCandidates = [];
    this.remoteDescriptionSet = false;
  }

  ensurePeerConnection(role) {
    if (typeof this.PeerConnectionClass !== "function") {
      throw new Error("WebRTC (RTCPeerConnection) is not supported in this browser.");
    }
    if (this.pc) this.close({ silent: true });

    this.role = role;
    this.opened = false;
    this.closed = false;
    this.pendingIceCandidates = [];
    this.remoteDescriptionSet = false;

    const pc = new this.PeerConnectionClass({
      iceServers: this.iceServers.map(server => ({ ...server }))
    });
    this.pc = pc;

    pc.onicecandidate = event => {
      if (event?.candidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this.onConnectionStateChange(state);
      if (state === "failed" || state === "disconnected" || state === "closed") {
        this.handleDisconnect(state);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "failed" || state === "closed") {
        this.handleDisconnect("ice-" + state);
      }
    };

    if (role === "host") {
      this.attachControlChannel(pc.createDataChannel("control", { ordered: true }));
      this.attachInputsChannel(
        pc.createDataChannel("inputs", { ordered: false, maxRetransmits: 0 })
      );
    } else {
      pc.ondatachannel = event => {
        const channel = event?.channel;
        if (!channel) return;
        if (channel.label === "control") this.attachControlChannel(channel);
        else if (channel.label === "inputs") this.attachInputsChannel(channel);
      };
    }

    return pc;
  }

  attachControlChannel(channel) {
    this.controlChannel = channel;
    channel.onopen = () => this.checkBothChannelsOpen();
    channel.onclose = () => this.handleDisconnect("control-closed");
    channel.onerror = error => this.onError(error?.error ?? error ?? new Error("Control channel error"));
    channel.onmessage = event => {
      try {
        const parsed = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        this.onControlMessage(parsed);
      } catch {
        // Ignore malformed non-JSON control messages cleanly.
      }
    };
  }

  attachInputsChannel(channel) {
    this.inputsChannel = channel;
    try {
      channel.binaryType = "arraybuffer";
    } catch {
      // Some mock DataChannel implementations expose binaryType read-only.
    }
    channel.onopen = () => this.checkBothChannelsOpen();
    channel.onclose = () => this.handleDisconnect("inputs-closed");
    channel.onerror = error => this.onError(error?.error ?? error ?? new Error("Inputs channel error"));
    channel.onmessage = event => {
      const data = event.data;
      if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        this.onInputPacket(data);
      } else if (typeof Blob !== "undefined" && data instanceof Blob) {
        data.arrayBuffer().then(buf => this.onInputPacket(buf)).catch(() => {});
      }
    };
  }

  checkBothChannelsOpen() {
    if (this.opened || this.closed) return;
    if (
      this.controlChannel?.readyState === "open" &&
      this.inputsChannel?.readyState === "open"
    ) {
      this.opened = true;
      this.onOpen();
    }
  }

  handleDisconnect(reason) {
    if (this.closed) return;
    this.closed = true;
    this.opened = false;
    this.onClose(reason);
  }

  waitForIceGathering(pc) {
    if (pc.iceGatheringState === "complete") {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pc.removeEventListener?.("icegatheringstatechange", onStateChange);
        resolve();
      };
      const onStateChange = () => {
        if (pc.iceGatheringState === "complete") done();
      };
      const timer = setTimeout(done, this.iceGatherTimeoutMs);
      if (typeof pc.addEventListener === "function") {
        pc.addEventListener("icegatheringstatechange", onStateChange);
      } else {
        const prev = pc.onicegatheringstatechange;
        pc.onicegatheringstatechange = event => {
          prev?.(event);
          onStateChange();
        };
      }
    });
  }

  async createDirectOffer() {
    const pc = this.ensurePeerConnection("host");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.waitForIceGathering(pc);
    return encodeSignalCode(pc.localDescription ?? offer);
  }

  async acceptDirectOffer(offerCode) {
    const decoded = decodeSignalCode(offerCode);
    if (!decoded.ok || decoded.description.type !== "offer") {
      throw new Error(decoded.ok ? "Expected an offer invite code, not an answer." : decoded.reason);
    }
    const pc = this.ensurePeerConnection("guest");
    await pc.setRemoteDescription(decoded.description);
    this.remoteDescriptionSet = true;
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.waitForIceGathering(pc);
    return encodeSignalCode(pc.localDescription ?? answer);
  }

  async acceptDirectAnswer(answerCode) {
    if (!this.pc || this.role !== "host") {
      throw new Error("Create a Direct Invite first before pasting a guest answer.");
    }
    const decoded = decodeSignalCode(answerCode);
    if (!decoded.ok || decoded.description.type !== "answer") {
      throw new Error(decoded.ok ? "Expected an answer code from the guest." : decoded.reason);
    }
    await this.pc.setRemoteDescription(decoded.description);
    this.remoteDescriptionSet = true;
  }

  // --- Trickle ICE signaling helpers (used with room-code SignalingClient) ---

  async createSignalingOffer() {
    const pc = this.ensurePeerConnection("host");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return pc.localDescription ?? offer;
  }

  async acceptSignalingOffer(description) {
    const pc = this.ensurePeerConnection("guest");
    await pc.setRemoteDescription(description);
    this.remoteDescriptionSet = true;
    await this.flushPendingIceCandidates();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return pc.localDescription ?? answer;
  }

  async acceptSignalingAnswer(description) {
    if (!this.pc || this.role !== "host") {
      throw new Error("Host peer connection is not ready for an answer.");
    }
    await this.pc.setRemoteDescription(description);
    this.remoteDescriptionSet = true;
    await this.flushPendingIceCandidates();
  }

  async addIceCandidate(candidate) {
    if (!this.pc || !candidate) return;
    if (!this.remoteDescriptionSet) {
      this.pendingIceCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      // Ignore late/stale ICE candidates once connected.
    }
  }

  async flushPendingIceCandidates() {
    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      try {
        await this.pc?.addIceCandidate(candidate);
      } catch {
        // Ignore stale candidates.
      }
    }
  }

  sendInputPacket(buffer) {
    if (this.inputsChannel?.readyState !== "open") return false;
    try {
      this.inputsChannel.send(buffer);
      return true;
    } catch {
      return false;
    }
  }

  sendControl(message) {
    if (this.controlChannel?.readyState !== "open") return false;
    try {
      this.controlChannel.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  isOpen() {
    return this.opened && !this.closed;
  }

  close({ silent = false } = {}) {
    const wasClosed = this.closed;
    this.closed = true;
    this.opened = false;
    try { this.inputsChannel?.close(); } catch { /* ignore */ }
    try { this.controlChannel?.close(); } catch { /* ignore */ }
    try { this.pc?.close(); } catch { /* ignore */ }
    this.inputsChannel = null;
    this.controlChannel = null;
    this.pc = null;
    if (!silent && !wasClosed) {
      this.onClose("local-close");
    }
  }
}
