import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_ROOM_TTL_MS = 120_000;
const MAX_FRAME_BYTES = 64 * 1024;

function generateRoomCode(existingRooms) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    let code = "";
    const bytes = crypto.randomBytes(5);
    for (let i = 0; i < 5; i += 1) {
      code += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
    }
    if (!existingRooms.has(code)) return code;
  }
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function encodeWsFrame(opcode, payloadBuffer) {
  const length = payloadBuffer.length;
  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payloadBuffer]);
}

function sendJson(socket, payload) {
  if (!socket || socket.destroyed || !socket.writable) return;
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  socket.write(encodeWsFrame(0x1, body));
}

function parseWsFrames(state, onMessage, onClose) {
  let buffer = state.buffer;
  while (buffer.length >= 2) {
    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      if (buffer.length < 4) break;
      payloadLength = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      if (buffer.length < 10) break;
      const bigLen = buffer.readBigUInt64BE(2);
      if (bigLen > BigInt(MAX_FRAME_BYTES)) {
        onClose();
        return;
      }
      payloadLength = Number(bigLen);
      offset = 10;
    }

    if (payloadLength > MAX_FRAME_BYTES) {
      onClose();
      return;
    }

    const maskLength = masked ? 4 : 0;
    const totalLength = offset + maskLength + payloadLength;
    if (buffer.length < totalLength) break;

    const payload = Buffer.allocUnsafe(payloadLength);
    if (masked) {
      const mask = buffer.subarray(offset, offset + 4);
      const dataStart = offset + 4;
      for (let i = 0; i < payloadLength; i += 1) {
        payload[i] = buffer[dataStart + i] ^ mask[i & 3];
      }
    } else {
      buffer.copy(payload, 0, offset, offset + payloadLength);
    }

    buffer = buffer.subarray(totalLength);

    if (opcode === 0x8) {
      // Close frame
      try { state.socket.write(encodeWsFrame(0x8, Buffer.alloc(0))); } catch { /* ignore */ }
      onClose();
      return;
    } else if (opcode === 0x9) {
      // Ping -> Pong
      try { state.socket.write(encodeWsFrame(0xa, payload)); } catch { /* ignore */ }
    } else if (opcode === 0x1) {
      onMessage(payload.toString("utf8"));
    }
  }
  state.buffer = buffer;
}

/**
 * Zero-dependency RFC 6455 WebSocket signaling server for BTA room codes.
 * Swaps SDP offer/answer and ICE candidates only; zero match traffic touches it.
 */
export function createSignalingServer({
  roomTtlMs = DEFAULT_ROOM_TTL_MS
} = {}) {
  const rooms = new Map(); // code -> { host, guest, createdAt }
  const clientRooms = new Map(); // socket -> { code, role }

  const cleanupExpiredRooms = () => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.createdAt > roomTtlMs) {
        if (room.host) {
          sendJson(room.host, { type: "ERROR", reason: "Room expired." });
          clientRooms.delete(room.host);
        }
        if (room.guest) {
          sendJson(room.guest, { type: "ERROR", reason: "Room expired." });
          clientRooms.delete(room.guest);
        }
        rooms.delete(code);
      }
    }
  };

  const cleanupInterval = setInterval(cleanupExpiredRooms, Math.min(30_000, Math.max(1000, roomTtlMs)));
  cleanupInterval.unref?.();

  const leaveCurrentRoom = socket => {
    const membership = clientRooms.get(socket);
    if (!membership) return;
    clientRooms.delete(socket);
    const room = rooms.get(membership.code);
    if (!room) return;
    const other = membership.role === "host" ? room.guest : room.host;
    if (other) {
      sendJson(other, { type: "PEER_LEFT", roomCode: membership.code });
      clientRooms.delete(other);
    }
    rooms.delete(membership.code);
  };

  const handleMessage = (socket, rawText) => {
    let msg;
    try {
      msg = JSON.parse(rawText);
    } catch {
      sendJson(socket, { type: "ERROR", reason: "Invalid JSON signaling payload." });
      return;
    }

    if (msg?.type === "CREATE_ROOM") {
      leaveCurrentRoom(socket);
      const code = generateRoomCode(rooms);
      rooms.set(code, { host: socket, guest: null, createdAt: Date.now() });
      clientRooms.set(socket, { code, role: "host" });
      sendJson(socket, { type: "ROOM_CREATED", roomCode: code });
      return;
    }

    if (msg?.type === "JOIN_ROOM") {
      leaveCurrentRoom(socket);
      const code = String(msg.roomCode ?? "").trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        sendJson(socket, { type: "ERROR", reason: `Room ${code || "(empty)"} was not found.` });
        return;
      }
      if (room.guest) {
        sendJson(socket, { type: "ERROR", reason: `Room ${code} is already full.` });
        return;
      }
      room.guest = socket;
      clientRooms.set(socket, { code, role: "guest" });
      sendJson(socket, { type: "ROOM_JOINED", roomCode: code, role: "guest" });
      sendJson(room.host, { type: "PEER_JOINED", roomCode: code });
      return;
    }

    if (msg?.type === "SIGNAL") {
      const membership = clientRooms.get(socket);
      if (!membership) {
        sendJson(socket, { type: "ERROR", reason: "Not in a signaling room." });
        return;
      }
      const room = rooms.get(membership.code);
      if (!room) return;
      const target = membership.role === "host" ? room.guest : room.host;
      if (!target) return;
      sendJson(target, {
        type: "SIGNAL",
        roomCode: membership.code,
        payload: msg.payload
      });
    }
  };

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(JSON.stringify({ ok: true, activeRooms: rooms.size }));
      return;
    }
    res.writeHead(426, { "Content-Type": "text/plain" });
    res.end("BTA Signaling Server expects WebSocket upgrade requests.");
  });

  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }
    const acceptKey = crypto
      .createHash("sha1")
      .update(key + WS_MAGIC_GUID)
      .digest("base64");

    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
    );

    const wsState = { socket, buffer: Buffer.alloc(0) };
    let closed = false;
    const onDisconnect = () => {
      if (closed) return;
      closed = true;
      leaveCurrentRoom(socket);
      try { socket.destroy(); } catch { /* ignore */ }
    };

    socket.on("data", chunk => {
      wsState.buffer = Buffer.concat([wsState.buffer, chunk]);
      parseWsFrames(wsState, text => handleMessage(socket, text), onDisconnect);
    });
    socket.on("close", onDisconnect);
    socket.on("error", onDisconnect);
  });

  server.on("close", () => {
    clearInterval(cleanupInterval);
    rooms.clear();
    clientRooms.clear();
  });

  return { server, rooms };
}

const isDirectRun = process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const port = Number(process.env.PORT ?? 8787);
  const { server } = createSignalingServer();
  server.listen(port, () => {
    console.log(`BTA WebSocket signaling server listening on ws://localhost:${port}`);
  });
}
