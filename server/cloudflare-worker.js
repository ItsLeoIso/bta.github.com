/**
 * Cloudflare Worker + Durable Object room-code signaling relay for BTA.
 *
 * Implements the exact same JSON WebSocket protocol as server/signaling-server.js:
 *   CREATE_ROOM -> ROOM_CREATED { roomCode }
 *   JOIN_ROOM   -> ROOM_JOINED  { roomCode } + PEER_JOINED (to host)
 *   SIGNAL      -> SIGNAL       { roomCode, payload } (forwarded to peer)
 *
 * Zero match traffic touches this worker; once WebRTC P2P DataChannels open,
 * both clients close their signaling WebSockets.
 *
 * wrangler.toml binding example:
 *   [[durable_objects.bindings]]
 *   name = "BTA_ROOMS"
 *   class_name = "BtaSignalingRoom"
 */

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 5; i += 1) code += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  return code;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("BTA Signaling Worker expects WebSocket upgrades.", { status: 426 });
    }
    const id = env.BTA_ROOMS.idFromName("global-lobby");
    const stub = env.BTA_ROOMS.get(id);
    return stub.fetch(request);
  }
};

export class BtaSignalingRoom {
  constructor() {
    this.rooms = new Map(); // code -> { host, guest }
    this.membership = new Map(); // socket -> { code, role }
  }

  send(ws, payload) {
    try { ws.send(JSON.stringify(payload)); } catch { /* ignore */ }
  }

  leave(ws) {
    const info = this.membership.get(ws);
    if (!info) return;
    this.membership.delete(ws);
    const room = this.rooms.get(info.code);
    if (!room) return;
    const other = info.role === "host" ? room.guest : room.host;
    if (other) {
      this.send(other, { type: "PEER_LEFT", roomCode: info.code });
      this.membership.delete(other);
    }
    this.rooms.delete(info.code);
  }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    server.addEventListener("message", event => {
      let msg;
      try { msg = JSON.parse(String(event.data)); } catch { return; }

      if (msg?.type === "CREATE_ROOM") {
        this.leave(server);
        let code = generateRoomCode();
        while (this.rooms.has(code)) code = generateRoomCode();
        this.rooms.set(code, { host: server, guest: null });
        this.membership.set(server, { code, role: "host" });
        this.send(server, { type: "ROOM_CREATED", roomCode: code });
        return;
      }

      if (msg?.type === "JOIN_ROOM") {
        this.leave(server);
        const code = String(msg.roomCode ?? "").trim().toUpperCase();
        const room = this.rooms.get(code);
        if (!room) {
          this.send(server, { type: "ERROR", reason: `Room ${code} was not found.` });
          return;
        }
        if (room.guest) {
          this.send(server, { type: "ERROR", reason: `Room ${code} is already full.` });
          return;
        }
        room.guest = server;
        this.membership.set(server, { code, role: "guest" });
        this.send(server, { type: "ROOM_JOINED", roomCode: code, role: "guest" });
        this.send(room.host, { type: "PEER_JOINED", roomCode: code });
        return;
      }

      if (msg?.type === "SIGNAL") {
        const info = this.membership.get(server);
        if (!info) return;
        const room = this.rooms.get(info.code);
        const other = info.role === "host" ? room?.guest : room?.host;
        if (other) {
          this.send(other, { type: "SIGNAL", roomCode: info.code, payload: msg.payload });
        }
      }
    });

    server.addEventListener("close", () => this.leave(server));
    server.addEventListener("error", () => this.leave(server));

    return new Response(null, { status: 101, webSocket: client });
  }
}
