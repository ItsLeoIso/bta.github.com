import test from "node:test";
import assert from "node:assert/strict";
import { createSignalingServer } from "../server/signaling-server.js";
import { SignalingClient } from "../src/net/SignalingClient.js";

test("zero-dependency Node WebSocket signaling server creates rooms, joins peers, forwards SDP/ICE, and handles disconnects", async () => {
  const { server } = createSignalingServer({ roomTtlMs: 30_000 });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const wsUrl = `ws://127.0.0.1:${port}`;

  try {
    // Verify HTTP /health endpoint
    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(healthResponse.status, 200);
    const healthJson = await healthResponse.json();
    assert.equal(healthJson.ok, true);

    let hostRoomCode = null;
    let hostSawPeerJoined = false;
    const hostSignals = [];
    let hostSawPeerLeft = false;

    const host = new SignalingClient({
      url: wsUrl,
      onRoomCreated: code => { hostRoomCode = code; },
      onPeerJoined: () => { hostSawPeerJoined = true; },
      onSignal: payload => hostSignals.push(payload),
      onPeerLeft: () => { hostSawPeerLeft = true; }
    });

    await host.connect();
    host.createRoom();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(typeof hostRoomCode === "string" && hostRoomCode.length === 5);

    let guestJoinedCode = null;
    const guestSignals = [];
    const guest = new SignalingClient({
      url: wsUrl,
      onRoomJoined: code => { guestJoinedCode = code; },
      onSignal: payload => guestSignals.push(payload)
    });

    await guest.connect();
    guest.joinRoom(hostRoomCode);
    await new Promise(resolve => setTimeout(resolve, 30));

    assert.equal(guestJoinedCode, hostRoomCode);
    assert.equal(hostSawPeerJoined, true);

    // Bidirectional SDP & ICE forwarding
    host.sendSignal({ kind: "sdp", description: { type: "offer", sdp: "v=0-offer" } });
    guest.sendSignal({ kind: "sdp", description: { type: "answer", sdp: "v=0-answer" } });
    guest.sendSignal({ kind: "ice", candidate: { candidate: "cand-1" } });
    await new Promise(resolve => setTimeout(resolve, 30));

    assert.deepEqual(guestSignals, [{ kind: "sdp", description: { type: "offer", sdp: "v=0-offer" } }]);
    assert.deepEqual(hostSignals, [
      { kind: "sdp", description: { type: "answer", sdp: "v=0-answer" } },
      { kind: "ice", candidate: { candidate: "cand-1" } }
    ]);

    // A third client attempting to join the full room gets an explicit ERROR
    const thirdErrors = [];
    const third = new SignalingClient({
      url: wsUrl,
      onError: err => thirdErrors.push(err.message)
    });
    await third.connect();
    third.joinRoom(hostRoomCode);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(thirdErrors.some(msg => /already full/i.test(msg)));
    third.close();

    // Disconnecting guest notifies host with PEER_LEFT
    guest.close();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(hostSawPeerLeft, true);

    host.close();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
