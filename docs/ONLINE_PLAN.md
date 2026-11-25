# BTA — Online Mode Investigation & Implementation Plan

This document completes the Phase 6 roadmap investigation for online 1v1 multiplayer. It records the owner-confirmed networking direction, audits the current engine for rollback readiness, defines the target architecture and wire protocol, and breaks implementation into testable milestones without modifying gameplay code yet.

## 1. Confirmed product decisions (Owner: Leo, 2026-11-25)

- **Netcode model:** GGPO-style **rollback netcode** with a small configurable input delay (e.g., 1–2 frames) and deterministic state snapshots/resimulation.
- **Transport & hosting model:** **WebRTC peer-to-peer (`RTCDataChannel`)** for match traffic so BTA stays browser-first, dependency-light, and hostable on static GitHub Pages.
  - **Zero-backend fallback:** Manual copy-paste invite (SDP offer/answer) works directly on GitHub Pages with no external backend.
  - **Planned room-code UX:** A lightweight signaling service (e.g., Cloudflare Worker / small WebSocket room broker) will later exchange SDP/ICE handshakes using short room codes; match frames still flow peer-to-peer.
- **Scope for this milestone:** Planning and architecture only. No networking code, dependencies, or external services are added in this pass.

---

## 2. Current engine audit (rollback & 2P readiness)

The codebase was inspected at `main` (`ea294ac`, 228 passing Node tests).

### What is already rollback-friendly
- **Fixed-step simulation:** [`GameLoop`](../src/engine/GameLoop.js) runs at a fixed `1 / 60` s simulation step, cleanly separated from interpolated Canvas rendering.
- **No non-deterministic globals:** Auditing `src/` confirmed zero uses of `Math.random()`, `Date.now()`, or `performance.now()` inside gameplay or AI modules. Even [`CombatEffects`](../src/effects/CombatEffects.js) uses a deterministic LCG PRNG seeded from an integer counter.
- **Stateless combat/state controllers:** `FighterStateController`, `AttackController`, `GuardController`, and `DamageController` hold no mutable match state on their instances; all fighter combat state lives on the fighter objects.
- **Abstracted input contract:** Gameplay systems read logical actions (`isDown`, `wasPressed`, `getWorldAxis`) rather than DOM events directly.
- **Simultaneous trade resolution:** [`Arena.update`](../src/engine/Arena.js) gathers melee collision events for both fighters before applying hit/block reactions.

### Concrete gaps to close before online play
1. **Asymmetric P1 / P2 input pipeline (`src/engine/Arena.js`):**
   - `Arena.update(deltaSeconds, input)` currently accepts only a single player input.
   - `this.player` has `CommandHistory`, `InputBuffer`, QCF Arc Lance detection, and hit-confirm Special cancels; `this.opponent` only receives `OpponentAIController` output (or `NEUTRAL_INPUT` in Training) and skips `CommandHistory`, `InputBuffer`, and Special cancels.
   - **Required change:** Refactor `Arena.update(deltaSeconds, player1Input, player2Input)` so both fighters run the exact same input, history, buffer, cancel, attack, guard, projectile, and movement pipeline when controlled by a human or network peer.
2. **Asymmetric separation clamp & camera bias (`src/engine/Arena.js`):**
   - The `MAX_FIGHTER_SEPARATION` clamp currently pulls only `this.opponent.x` toward `this.player.x`, biasing Slot 0 over Slot 1.
   - `updateCamera()` currently clamps to keep `this.player` inside the viewport.
   - **Required change:** Resolve excess separation symmetrically (split adjustment equally, respecting stage margins so neither fighter is biased), and verify that midpoint camera clamping keeps both fighters visible for both peers.
3. **Slot-based simulation identity vs. local perspective:**
   - Tie-breaking (`player.x <= opponent.x ? 1 : -1`) and update ordering must be identical on both peers.
   - **Required rule:** Simulation always runs canonically as **Slot 0 (P1 / Host)** and **Slot 1 (P2 / Guest)** on *both* machines. Only HUD labels ("YOU" / "RIVAL") and local input routing care which slot is local.
4. **Non-serializable object references and `-Infinity` in state:**
   - `ComboTracker.combos` is a `Map` keyed by fighter object reference (`src/combat/ComboTracker.js`).
   - `ProjectileController.projectiles` stores `owner: fighter` object references (`src/combat/ProjectileController.js`).
   - `MovementController` stores `elapsed` (float seconds) and `lastTap = { left: -Infinity, right: -Infinity }` (`src/movement/MovementController.js`). `-Infinity` does not round-trip cleanly through `JSON.stringify`, and repeated float addition/subtraction can accumulate tiny drift over long matches.
   - Fighter objects carry non-data references (`character`, `stateController`, `animator`).
   - **Required change:** Introduce explicit `saveState()` / `loadState(snapshot)` methods across `Arena` and stateful sub-controllers, keying combo/projectile ownership by fighter slot (`0` or `1`) and converting `MovementController` / `RoundController` timers to integer simulation frames (or explicit finite/null sentinel values).
5. **Cosmetic VFX & audio during rollback resimulation (`src/effects/CombatEffects.js`, `src/main.js`):**
   - During a rollback, `Arena` re-simulates multiple frames to catch up after a mispredicted remote input.
   - **Required change:** Tag resimulation steps (e.g., `{ isResimulating: true }`) so transient one-shot audio cues do not double-trigger, and either snapshot `CombatEffects` or emit visual/audio events only once frames settle.
6. **Match-over rematch & pause handling (`src/combat/RoundController.js`, `src/ui/MenuController.js`):**
   - `RoundController` currently resets the match when P1 presses `Enter` or `Space`. Online rematches require explicit two-player consent via a control message.
   - Pressing `Escape` during an online match must **not** freeze the simulation; it should open a non-blocking overlay (e.g., Resume / Forfeit & Exit) while the match continues.
7. **Cross-browser float determinism hygiene:**
   - Keep `Math.sin` / `Math.cos` / `Math.pow` strictly inside cosmetic presentation (`CombatEffects`), never inside gameplay simulation.
   - Replace `1 / Math.sqrt(2)` / `Math.hypot` in `ProjectileController` with fixed constants where possible (e.g., `const DIAGONAL_UNIT = 0.7071067811865475`) so projectile direction math stays identical across JS engines.

---

## 3. Target online architecture

Keep networking completely isolated under a new `src/net/` directory so Arcade, Training, and all existing Node tests remain zero-dependency and unaffected.

```text
KeyboardInput (local) ──┐
                        ├──► RollbackSession (src/net/) ──► Arena (deterministic 2P sim)
WebRtcTransport (peer) ─┘         │                              │
                                  ├─ Ring buffer of snapshots    └─ CanvasRenderer + Audio
                                  ├─ Input prediction / delay
                                  └─ Periodic state checksums
```

### 3.1 Compact frame input format
Each player's per-frame input packs into a single 16-bit unsigned integer (`Uint16`):

| Bit | Mask | Action |
|---:|---:|---|
| 0 | `0x0001` | `left` (`KeyA`) |
| 1 | `0x0002` | `right` (`KeyD`) |
| 2 | `0x0004` | `jump` (`KeyW`) |
| 3 | `0x0008` | `crouch` (`KeyS`) |
| 4 | `0x0010` | `light` (`KeyH`) |
| 5 | `0x0020` | `medium` (`KeyJ`) |
| 6 | `0x0040` | `heavy` (`KeyK`) |
| 7 | `0x0080` | `special` (`KeyL`) |
| 8–15 | reserved | Future buttons (e.g., macro, taunt, rematch confirm) |

- **Edge-triggered presses (`wasPressed`)** are derived deterministically from `(currentMask & ~previousMask)` inside a lightweight `BitmaskInputAdapter`. This avoids transmitting separate press/release events and guarantees identical edge detection across rollbacks (as long as `previousMask` is stored in the state snapshot!).

### 3.2 Rollback session rules (GGPO-style)
- **Simulation rate:** Fixed 60 Hz (`frame = 0, 1, 2, ...`).
- **Input delay:** Configurable `0–4` frames (default `2` frames) applied to local inputs to absorb typical 30–60 ms RTT without visible rollbacks.
- **Max rollback window:** `8` frames (133 ms). Snapshot ring buffer retains the last `12` frames (`maxRollback + margin`). If remote input lags beyond `maxRollback`, the local simulation stalls briefly until packets arrive, preventing runaway divergence.
- **Prediction strategy:** Repeat the remote peer's last confirmed input bitmask for unconfirmed frames. When real remote input arrives and differs from the prediction, restore the snapshot for the earliest mispredicted frame and re-simulate forward to the current frame.
- **Clock drift / frame-advantage sync:** Each input packet carries the sender's latest confirmed remote frame so peers can measure their frame advantage. If one peer runs consistently ahead by >1–2 frames, it slightly stretches a render frame (or skips one fixed tick) to stay evenly balanced instead of forcing one-sided rollbacks.
- **Desync detection:** Every 30 frames (0.5 s), hash the serialized canonical snapshot (FNV-1a 32-bit) for the latest mutually confirmed frame and exchange checksums. On mismatch, surface an explicit desync banner/log rather than letting two divergent matches continue silently.

### 3.3 Transport & signaling (WebRTC P2P)
- **Match channel:** WebRTC `RTCDataChannel` configured as `{ ordered: false, maxRetransmits: 0 }` (UDP-like, no head-of-line blocking).
- **Packet redundancy:** Because the channel is unreliable, every input packet includes the latest frame number plus the last `N` (e.g., 8) input bitmasks in a compact binary `ArrayBuffer` (~24 bytes per packet). Losing 1–7 consecutive packets recovers automatically on the next packet without retransmission delay.
- **Control channel:** A second reliable, ordered `RTCDataChannel` (`"control"`) for character selection, match start handshake, ping/pong, checksum reports, rematch votes, and graceful disconnect.
- **Signaling phases:**
  1. **Zero-backend fallback (GitHub Pages ready):** Host generates a compressed Base64 SDP offer (including gathered ICE candidates via non-trickle ICE) and copies it; Guest pastes offer, generates compressed SDP answer, sends it back; Host pastes answer and connects.
  2. **Lightweight room-code signaling (later):** A minimal serverless relay (e.g., Cloudflare Worker + Durable Object, ~100 lines) holds ephemeral 4–6 character room codes for ~60 seconds solely to swap SDP offer/answer and trickle ICE candidates. Zero game traffic touches the server.
- **NAT traversal:** Use public STUN servers (`stun:stun.l.google.com:19302`, etc.) initially. Symmetric corporate/cellular NATs may occasionally fail direct P2P without a TURN relay; document this honestly in the Online UI and evaluate optional metered TURN only if real player tests show high connection failure rates.

### 3.4 Online UI & menu flow
When Online is implemented, `MENU_SCREENS.ONLINE` expands into clean sub-states while preserving the confirmed main menu order (`Arcade`, `Online`, `Training`, `Option`):
1. **Online Lobby:** Choose `Create Room` / `Join Room` (via room code when signaling is configured) or `Direct Invite (Copy / Paste)` fallback, plus configurable input delay (`1f` / `2f` / `3f`).
2. **Online Character Select:** Both players pick independently over the `"control"` channel and confirm ready; match begins on a synchronized frame 0.
3. **In-Match Network HUD:** Subtle top corner indicator showing RTT (ms), current rollback frames, and connection health; non-pausing `Escape` menu (`Resume` / `Forfeit & Exit`).
4. **Post-Match & Disconnects:** Explicit two-player `Rematch` / `Character Select` / `Exit to Menu` voting; clean timeout/disconnect modal if a peer drops for >5 seconds.

---

## 4. Phased implementation roadmap

Each milestone is small, independently testable in Node, and preserves all existing local Arcade/Training behavior:

| Milestone | Scope | Verification |
|---|---|---|
| **O1 — Symmetric 2P Arena & Bitmask Input** | Add `BitmaskInputAdapter`; give P2 its own `CommandHistory`, `InputBuffer`, and special-cancel path in `Arena.update(dt, p1Input, p2Input)`; make separation clamp symmetric; keep `opponentAI` working through the same P2 slot. | Node unit & Arena 2P tests (both fighters execute QCF Arc Lance, cancels, combos, and symmetric spacing). |
| **O2 — Deterministic Snapshots & Offline Rollback Harness** | Convert `MovementController` / `RoundController` timers to frame-safe serializable values; implement `Arena.saveState()` / `loadState()` + FNV-1a state checksum; build `RollbackSession` in `src/net/` with a pure in-memory simulated network (latency, jitter, packet drop). | Node stress test: run two `RollbackSession` instances for 600+ frames with random simulated lag/drops and assert identical final state checksums vs. a zero-latency reference run. |
| **O3 — WebRTC DataChannel & Serverless Invite Flow** | Add `src/net/WebRtcTransport.js` (unreliable input channel + reliable control channel + compressed SDP offer/answer). Wire a Direct Invite flow into `MenuController` and `main.js`. | Unit tests for packet encode/decode and state machine + manual two-tab / two-device browser match test. |
| **O4 — Online Character Select, HUD & Rematch/Disconnect Polish** | Synchronized character select handshake, live RTT/rollback HUD, non-pausing `Escape` overlay, two-player rematch voting, and desync/disconnect error states. | Menu/session unit tests + Playwright browser smoke tests for Online lobby UI + human cross-network playtest. |
| **O5 — Lightweight Room-Code Signaling Service** | Deploy a minimal room-code signaling endpoint (separate config/docs, keeping the static game client dependency-free) with automatic fallback to Direct Invite if offline. | End-to-end room-code connection test across two separate networks. |

---

## 5. Risks and open decisions

- **NAT traversal without TURN:** Some mobile hotspots and strict firewalls block direct STUN-only WebRTC. If testing shows frequent ICE failures, we will need an owner decision on whether to pay for/configure a TURN relay or keep Online focused on friend-vs-friend desktop networks.
- **Signaling hosting choice:** When Milestone O5 is reached, Leo will pick the host for the tiny room-code broker (e.g., Cloudflare Workers free tier vs. Fly.io/Render).
- **Matchmaking vs. private rooms:** This plan targets private 1v1 rooms first; public quick-match queues and ranked ladders are deferred until the roster, art, and room play are proven solid.
- **Cross-engine determinism:** Must be validated by running a live match between Chromium and Firefox once O3 is playable, using the built-in checksum verification.
