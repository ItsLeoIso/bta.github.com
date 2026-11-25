/**
 * Lightweight WebSocket room-code signaling client.
 * Exchanges ONLY room join metadata, SDP offer/answer, and trickle ICE candidates.
 * Zero match traffic passes through this client; once WebRTC DataChannels open,
 * the signaling socket closes automatically.
 */
export class SignalingClient {
  constructor({
    url,
    WebSocketClass = globalThis.WebSocket,
    connectTimeoutMs = 5000,
    onRoomCreated = () => {},
    onRoomJoined = () => {},
    onPeerJoined = () => {},
    onSignal = () => {},
    onPeerLeft = () => {},
    onError = () => {},
    onClose = () => {}
  } = {}) {
    this.url = url;
    this.WebSocketClass = WebSocketClass;
    this.connectTimeoutMs = connectTimeoutMs;
    this.onRoomCreated = onRoomCreated;
    this.onRoomJoined = onRoomJoined;
    this.onPeerJoined = onPeerJoined;
    this.onSignal = onSignal;
    this.onPeerLeft = onPeerLeft;
    this.onError = onError;
    this.onClose = onClose;

    this.socket = null;
    this.roomCode = null;
    this.connected = false;
  }

  connect() {
    if (typeof this.WebSocketClass !== "function") {
      return Promise.reject(new Error("WebSocket is not supported in this environment."));
    }
    if (!this.url || typeof this.url !== "string") {
      return Promise.reject(new Error("Signaling server URL is required for Room Code mode."));
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.close();
        reject(new Error("Timed out connecting to signaling server (" + this.url + "). Use Direct Invite if no server is running."));
      }, this.connectTimeoutMs);

      let socket;
      try {
        socket = new this.WebSocketClass(this.url);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
        return;
      }
      this.socket = socket;

      socket.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.connected = true;
        resolve();
      };

      socket.onerror = () => {
        const error = new Error("Could not connect to signaling server (" + this.url + ").");
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        } else {
          this.onError(error);
        }
      };

      socket.onclose = () => {
        this.connected = false;
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("Signaling connection closed before opening."));
        } else {
          this.onClose();
        }
      };

      socket.onmessage = event => {
        let message;
        try {
          message = JSON.parse(typeof event.data === "string" ? event.data : String(event.data));
        } catch {
          return;
        }
        switch (message?.type) {
          case "ROOM_CREATED":
            this.roomCode = message.roomCode;
            this.onRoomCreated(message.roomCode);
            break;
          case "ROOM_JOINED":
            this.roomCode = message.roomCode;
            this.onRoomJoined(message.roomCode);
            break;
          case "PEER_JOINED":
            this.onPeerJoined();
            break;
          case "SIGNAL":
            this.onSignal(message.payload);
            break;
          case "PEER_LEFT":
            this.onPeerLeft();
            break;
          case "ERROR":
            this.onError(new Error(message.reason ?? "Signaling server error."));
            break;
          default:
            break;
        }
      };
    });
  }

  send(payload) {
    if (!this.socket || !this.connected) return false;
    try {
      this.socket.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  createRoom() {
    return this.send({ type: "CREATE_ROOM" });
  }

  joinRoom(roomCode) {
    const normalized = String(roomCode ?? "").trim().toUpperCase();
    if (!normalized) return false;
    this.roomCode = normalized;
    return this.send({ type: "JOIN_ROOM", roomCode: normalized });
  }

  sendSignal(payload) {
    if (!this.roomCode) return false;
    return this.send({ type: "SIGNAL", roomCode: this.roomCode, payload });
  }

  close() {
    this.connected = false;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      try { socket.close(); } catch { /* ignore */ }
    }
  }
}
