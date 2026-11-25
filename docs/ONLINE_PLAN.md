# BTA — Online Mode Investigation & Implementation Plan

This document completes the Phase 6 roadmap investigation for online 1v1 multiplayer. It records the owner-confirmed networking direction, audits the current engine for rollback readiness, defines the target architecture, canonical snapshot schema, binary wire protocol, and pre-match handshake, and breaks implementation into testable milestones (`O1`–`O5`).

*Updated 2026-11-25 to incorporate independent review findings #1–#9 from `Cooperation.md` (`f562b5e`).*

## 1. Confirmed product decisions (Owner: Leo, 2026-11-25)

- **Netcode model:** GGPO-style **rollback netcode** with a small configurable input delay (e.g., 1–2 frames) and deterministic state snapshots/resimulation.
- **Transport & hosting model:** **WebRTC peer-to-peer (`RTCDataChannel`)** for match traffic so BTA stays browser-first, dependency-light, and hostable on static GitHub Pages.
  - **Zero-backend fallback:** Manual copy-paste invite (SDP offer/answer) works directly on GitHub Pages with no external backend.
  - **Planned room-code UX:** A lightweight signaling service (e.g., Cloudflare Worker / small WebSocket room broker) will later exchange SDP/ICE handshakes using short room codes; match frames still flow peer-to-peer.
- **Scope:** Private 1v1 rooms first; no matchmaking or always-on game backend in the initial implementation; no networking dependencies added before needed.

---

## 2. Current engine audit (rollback & 2P readiness)

The codebase was inspected at `main` (`ea294ac` / `f562b5e`, 228 passing Node tests).

### What is already rollback-friendly
- **Fixed-step simulation:** [`GameLoop`](../src/engine/GameLoop.js) runs at a fixed `1 / 60` s simulation step, cleanly separated from interpolated Canvas rendering.
- **No non-deterministic globals:** Auditing `src/` confirmed zero uses of `Math.random()`, `Date.now()`, or `performance.now()` inside gameplay or AI modules. Even [`CombatEffects`](../src/effects/CombatEffects.js) uses a deterministic LCG PRNG seeded from an integer counter.
- **Stateless combat/state controllers:** `FighterStateController`, `AttackController`, `GuardController`, and `DamageController` hold no mutable match state on their instances; all fighter combat state lives on the fighter objects.
- **Abstracted input contract:** Gameplay systems read logical actions (`isDown`, `wasPressed`, `getWorldAxis`) rather than DOM events directly.
- **Simultaneous trade resolution:** [`Arena.update`](../src/engine/Arena.js) gathers melee collision events for both fighters before applying hit/block reactions.

### Concrete gaps to close before online play
1. **Asymmetric P1 / P2 input pipeline (`src/engine/Arena.js`):**
   - `Arena.update(deltaSeconds, input)` currently accepts only a single player input.
   - Slot 0 (`this.player`) runs `CommandHistory`, `InputBuffer`, QCF Arc Lance detection, and hit-confirm Special cancels; Slot 1 (`this.opponent`) only receives `OpponentAIController` output (or `NEUTRAL_INPUT` in Training) and bypasses `CommandHistory`, `InputBuffer`, and Special cancels.
   - **Required change (O1):** Refactor to `Arena.update(deltaSeconds, p1Input, p2Input)` so both slots run the exact same ordered pipeline (command history, input buffer, guard, special cancels, attacks, projectiles, movement). Arcade AI and Training neutral input become standard input providers for Slot 1 rather than a separate simulation path.
2. **Asymmetric separation clamp & camera bias (`src/engine/Arena.js`):**
   - The `MAX_FIGHTER_SEPARATION` clamp currently pulls only `this.opponent.x` toward `this.player.x`, biasing Slot 0 over Slot 1.
   - `updateCamera()` currently constrains `cameraX` around `this.player`.
   - **Required change (O1):** Resolve excess separation symmetrically (split adjustment equally toward the midpoint, respecting stage margins so neither fighter is biased), and verify midpoint camera clamping keeps both fighters visible for both peers.
3. **Canonical Slot 0 / Slot 1 identity vs. local perspective:**
   - Tie-breaking (`player.x <= opponent.x ? 1 : -1`) and update ordering must be identical on both peers.
   - **Required rule:** Simulation always executes canonically as **Slot 0 (P1 / Host)** and **Slot 1 (P2 / Guest)** on *both* machines. Local perspective affects only local input routing and presentation labels ("YOU" / "RIVAL").
4. **All gameplay-affecting float timers & `-Infinity` sentinels:**
   - `MovementController` stores float `elapsed`, `lastTap = { left: -Infinity, right: -Infinity }`, float `groundDashCooldownRemaining`, and float `actionData.remaining` (dash duration).
   - `ProjectileController` decrements float `projectile.remainingSeconds` (`lifetimeSeconds`).
   - `RoundController` decrements float `timerRemaining` and `phaseRemaining` (while `bannerRemaining` is cosmetic).
   - **Required change (O2):** Convert **all** gameplay-affecting timers across `MovementController`, `ProjectileController`, and `RoundController` to integer 60 Hz frame counters (with `null` instead of `-Infinity` for unset tap history), preserving compatible readouts/getters where existing HUD or tests read seconds.
5. **Non-serializable object references in gameplay state:**
   - `ComboTracker.combos` is a `Map` keyed by fighter object reference (`src/combat/ComboTracker.js`).
   - `ProjectileController.projectiles` stores `owner: fighter` object references (`src/combat/ProjectileController.js`).
   - Fighter objects carry reconstructible/non-data references (`character`, `stateController`, `animator`).
   - **Required change (O2):** Implement explicit `saveState()` / `loadState(snapshot)` methods using stable slot IDs (`0` / `1`) and canonical field ordering (defined in Section 3.2). Reconstruct `character`, `stateController`, and `animator` bindings from stable character IDs rather than serializing live objects.
6. **Rollback side-effect isolation (`src/effects/CombatEffects.js`, `src/animation/FighterAnimator.js`, `src/main.js`):**
   - During rollback resimulation, `Arena` re-runs historical frames to catch up after a mispredicted remote input.
   - **Required change (O2/O4):** Keep `CombatEffects`, HUD feedback timers (`bannerRemaining`, `commandFeedbackRemaining`, `lastHit`), and audio strictly **outside** canonical gameplay snapshots and checksums. Tag resimulation ticks (`{ isResimulating: true }`) so one-shot audio cues never double-trigger on corrected historical frames, and reconcile/emit transient visual effects only from settled or confirmed events. Keep `FighterAnimator` presentation-only or cleanly derivable/restorable without affecting gameplay checksums.
7. **Match-over rematch & online pause handling (`src/combat/RoundController.js`, `src/ui/MenuController.js`):**
   - `RoundController` currently resets the match when P1 presses `Enter` or `Space`. Online rematches require explicit two-player agreement over the control channel.
   - Pressing `Escape` during an online match must **not** freeze the simulation; it opens a non-blocking overlay (`Resume` / `Forfeit & Exit`) while simulation continues.
8. **Cross-browser float determinism hygiene:**
   - Keep `Math.sin` / `Math.cos` / `Math.pow` strictly inside cosmetic presentation (`CombatEffects`), never inside gameplay simulation.
   - Replace `1 / Math.sqrt(2)` / `Math.hypot` in `ProjectileController` with fixed constants (e.g., `const DIAGONAL_UNIT = 0.7071067811865475`) so projectile vectors remain bit-identical across JS engines.

---

## 3. Target online architecture

Keep networking completely isolated under `src/net/` so Arcade, Training, and all existing Node tests remain zero-dependency and unaffected.

```text
KeyboardInput (local) ──┐
                        ├──► RollbackSession (src/net/) ──► Arena (deterministic 2P sim)
WebRtcTransport (peer) ─┘         │                              │
                                  ├─ Ring buffer of snapshots    └─ CanvasRenderer + Audio
                                  ├─ Input prediction / delay       (gated on resimulation)
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
| 8–15 | reserved | Future buttons (must be `0` in protocol v1) |

- **Edge-triggered presses (`wasPressed`)** are derived deterministically from `(currentMask & ~previousMask)` inside `BitmaskInputAdapter`.
- Because `previousMask` per slot is stored in the canonical snapshot, rolling back and replaying any frame produces identical `wasPressed` edges without sending separate press/release events.

### 3.2 Canonical gameplay state snapshot schema (O2 contract)
`Arena.saveState()` and `Arena.loadState(snapshot)` serialize **only** deterministic gameplay state in a fixed canonical field order. Live object references (`character`, `stateController`, `animator`) and cosmetic-only state (`CombatEffects`, `cameraX`/`previousCameraX`, `commandFeedback*`, `lastHit`, `bannerText`/`bannerRemaining`) are **excluded** from canonical snapshots and checksums.

```text
ArenaSnapshot (schemaVersion: 1)
├── inputFrame: uint32                      // Monotonic simulation frame counter
├── inputMasks: [uint16, uint16]            // previousMask per slot [0, 1] for edge derivation
├── fighters: [FighterSnapshot, FighterSnapshot]   // Always Slot 0, then Slot 1
│   ├── slot: 0 | 1
│   ├── characterId: string                 // Immutable CharacterDefinition resolved on load
│   ├── x, y, previousX, previousY: number
│   ├── vx, vy, airHorizontalVelocity: number
│   ├── facing: -1 | 1
│   ├── onGround: boolean
│   ├── health: number
│   ├── guardMeter: number
│   ├── guardMeterRecoveryDelayFrames: uint16
│   ├── airDashAvailable: boolean
│   ├── airProjectileAvailable: boolean
│   ├── groundDashCooldownFrames: uint16
│   ├── state: { locomotion, action, reaction }
│   ├── actionData: null | canonical plain object by action type:
│   │   ├── DASH:    { dashType, remainingFrames, velocity }
│   │   ├── GUARD:   { guardHeight }
│   │   ├── ATTACK:  { moveId, elapsedFrames, phase, phaseFrame, hitConfirmed, hitOutcome }
│   │   │            (static move-table dimensions/cancel lists reconstructed from character moveSet)
│   │   └── SPECIAL: { moveId, elapsedFrames, phase, phaseFrame, projectileSpawned, directionX, directionY }
│   ├── guardData: null | { guardHeight }
│   └── reactionData: null | { remainingFrames, totalFrames, knockbackVelocity, moveId, blocked, guardBreak }
├── movement: [MovementSnapshot, MovementSnapshot] // Slot 0, Slot 1
│   ├── elapsedFrames: uint32
│   └── lastTapFrame: { left: int32 | null, right: int32 | null }
├── commandHistories: [CommandHistorySnapshot, CommandHistorySnapshot]
│   ├── frame: uint32
│   └── entries: Array<{ direction, frame }>
├── inputBuffers: [InputBufferSnapshot, InputBufferSnapshot]
│   └── pending: null | { action, pressedFrame, expiresFrame, specialMove, specialFacing }
├── projectiles:
│   ├── nextProjectileId: uint32
│   └── items: Array<{ id, ownerSlot: 0 | 1, x, y, direction, directionX, directionY,
│                      velocityX, velocityY, radius, remainingFrames, moveId, moveName, hitLevel }>
├── combos: Array<{ defenderSlot: 0 | 1, attackerSlot: 0 | 1, hitCount, totalDamage,
│                   juggleHits, airCombo, remainingFrames }>  // Ordered by defenderSlot (0 then 1)
└── rounds:
    ├── roundNumber: uint16
    ├── score: [uint16, uint16]             // [slot0Score, slot1Score]
    ├── phase: ROUND_PHASES
    ├── phaseRemainingFrames: uint16
    ├── timerRemainingFrames: uint16
    ├── roundWinnerSlot: null | 0 | 1
    ├── matchWinnerSlot: null | 0 | 1
    └── resultReason: null | string
```

- **Checksum calculation:** Serialize the canonical snapshot deterministically (fixed key order, finite numbers only, no `JSON.stringify` of live `Arena` objects) into a canonical byte/token stream and hash with FNV-1a 32-bit.
- **Compatibility fields:** `loadState` calls `stateController.syncCompatibilityFields(fighter)` for both slots after restoring so `crouching`, `dashType`, `dashRemaining`, and `dashVelocity` stay in sync.

### 3.3 Rollback session & frame-pacing rules (GGPO-style)
- **Simulation rate:** Fixed 60 Hz (`frame = 0, 1, 2, ...`).
- **Never skip numbered simulation frames:** Frame numbers are the shared identity for input history, snapshots, acknowledgements, and rollbacks. Every connected peer must execute the exact same sequence `0, 1, 2, ...` with no skipped frame IDs.
- **Input delay:** Configurable `0–4` frames (default `2` frames) applied to local inputs to absorb typical 30–60 ms RTT without visible rollbacks.
- **Max rollback window:** `8` frames (133 ms). Snapshot ring buffer retains the last `12` frames (`maxRollback + margin`). If the local frame reaches `confirmedRemoteFrame + maxRollback`, simulation **stalls cleanly** (does not advance the frame counter) until remote input arrives.
- **Prediction & rollback:** Predict unconfirmed remote frames by repeating the remote peer's last confirmed input bitmask. When real remote input arrives and differs from what was predicted for any frame `f <= currentFrame`, restore the snapshot saved *before* frame `f`, apply the real inputs, and re-simulate sequentially through `currentFrame` with `{ isResimulating: true }`.
- **Wall-clock pacing (frame-advantage sync):** Each input packet reports the sender's latest contiguous confirmed remote frame so each peer can estimate its frame advantage. If a peer is consistently ahead of its opponent by `> 1–2` frames, it slows **wall-clock pacing** (stretches the `GameLoop` accumulator interval slightly, e.g., by ~1–2 ms per render tick, or defers running a fixed step until the next animation frame) rather than skipping a simulation frame number. Rendering continues smoothly while both peers converge on the same frame rate.
- **Desync detection:** Every 30 confirmed frames (0.5 s), exchange the 32-bit FNV-1a canonical state checksum for the latest mutually confirmed frame over the reliable `"control"` channel. On mismatch, surface an explicit desync alert and log the divergent frame number rather than continuing silently.

### 3.4 Transport, packet protocol & pre-match handshake (WebRTC P2P)
- **Two channels per peer connection:**
  1. **`"inputs"` (unreliable, unordered: `{ ordered: false, maxRetransmits: 0 }`):** Carries small, fixed-layout binary input packets only. No SDP, lobby, or chat traffic ever uses this channel.
  2. **`"control"` (reliable, ordered):** Carries pre-match handshake, character selection, match start confirmation, ping/pong, periodic checksums, rematch votes, and disconnect/forfeit notices.

#### Binary `"inputs"` packet layout (little-endian `ArrayBuffer`)
| Offset | Type | Field | Purpose |
|---:|---|---|---|
| 0 | `Uint8` | `protocolVersion` | Currently `1`; packets with mismatched version are dropped. |
| 1 | `Uint8` | `inputCount` | Number of redundant input frames included (`1..16`, typically `8`). |
| 2 | `Uint16` | `sessionId` | Random per-match 16-bit ID agreed in handshake; drops stale packets from prior matches. |
| 4 | `Uint32` | `packetSeq` | Monotonic per-sender packet sequence number (for packet-loss / reorder metrics). |
| 8 | `Uint32` | `latestFrame` | Frame index of the newest input mask in this packet (`0..2^32-1`, >2.2 years at 60 Hz — no wrap during a match). |
| 12 | `Uint32` | `ackFrame` | Sender's latest contiguous confirmed frame from the remote peer (for frame-advantage calculation and trimming history). |
| 16 | `Uint16[inputCount]` | `masks` | Input masks for `latestFrame`, `latestFrame - 1`, ..., `latestFrame - inputCount + 1`. |

Total packet size for `inputCount = 8`: **32 bytes**.

#### Receiver reconstruction rules (`"inputs"` channel)
1. Validate packet length (`16 + inputCount * 2`), `protocolVersion === 1`, and `sessionId === activeSessionId`. Drop invalid packets.
2. Track `highestPacketSeq` for diagnostics, but **do not drop out-of-order packets** solely by `packetSeq` — an older packet may still fill a missing frame gap.
3. For each entry `i` (`0 .. inputCount - 1`), compute `frame = latestFrame - i`:
   - If `frame <= confirmedRemoteFrame`: ignore (already confirmed / duplicate).
   - If `frame > confirmedRemoteFrame + maxReceiveHorizon` (e.g., `maxRollback + 16`): ignore as malformed/out-of-window.
   - Store `remoteInputs.set(frame, masks[i])` idempotently (if an entry already exists for `frame` with a *different* mask, flag a protocol violation / desync).
4. Advance `confirmedRemoteFrame` sequentially while `remoteInputs.has(confirmedRemoteFrame + 1)`.
5. If any newly confirmed frame `f <= currentFrame` differs from the predicted mask previously used at `f`, schedule rollback to the earliest such `f`.
6. If a packet carries a frame older than the oldest retained snapshot (rollback window exceeded during a severe stall), the peer should already have stalled at `confirmedRemoteFrame + maxRollback`; if an unrecoverable window breach ever occurs, emit a fatal sync-error state and return cleanly to the lobby.
7. Update `remoteAckFrame = Math.max(remoteAckFrame, packet.ackFrame)` and prune local input history older than `remoteAckFrame`.

#### Pre-frame-0 `MATCH_CONFIG` handshake (`"control"` channel)
Before frame `0` begins, Host (Slot 0) and Guest (Slot 1) exchange and confirm an explicit JSON control handshake:
- `protocolVersion` (e.g., `1`)
- `simVersion` / `snapshotSchemaVersion` (e.g., `1`)
- `contentVersion` (hash or version tag covering character definitions & move sets)
- `sessionId` (16-bit match identifier)
- `slots`: `{ slot0CharacterId, slot1CharacterId }`
- `matchConfig`: `{ inputDelay, maxRollback, roundsToWin, roundDurationFrames }`

Both peers must verify exact compatibility on `protocolVersion`, `simVersion`, and `contentVersion`, then exchange `MATCH_READY` before entering frame `0`. Incompatible versions are rejected explicitly with a user-facing mismatch message rather than starting a doomed match.

#### Signaling & NAT traversal
- **Abstracted ICE config:** `WebRtcTransport` accepts an injected `iceServers` array (defaulting to public STUN servers such as `stun:stun.l.google.com:19302`) so a TURN relay can be configured later without changing transport or session code.
- **Limitation note:** STUN-only direct P2P will not succeed across every symmetric NAT / corporate / mobile firewall. Surface connection diagnostics honestly in the UI and measure failure rates across real networks before choosing a TURN provider.
- **Signaling phases:**
  1. **Zero-backend fallback (GitHub Pages ready):** Manual copy-paste compressed Base64 SDP offer/answer (non-trickle ICE).
  2. **Lightweight room-code signaling (O5):** Minimal stateless relay (e.g., Cloudflare Worker + Durable Object) swapping SDP/ICE metadata for short room codes (~60 s TTL); zero match traffic passes through the relay.

### 3.5 Online UI & menu flow
`MENU_SCREENS.ONLINE` expands into clean sub-states while preserving the confirmed main menu order (`Arcade`, `Online`, `Training`, `Option`):
1. **Online Lobby:** `Create Room` / `Join Room` (room code when signaling is configured) or `Direct Invite (Copy / Paste)` fallback, plus configurable input delay (`1f` / `2f` / `3f`).
2. **Online Character Select:** Both players pick independently over `"control"`, negotiate `MATCH_CONFIG`, and confirm ready before frame `0`.
3. **In-Match Network HUD:** Subtle corner readout showing RTT (ms), rollback frames, and connection status; non-pausing `Escape` overlay (`Resume` / `Forfeit & Exit`).
4. **Post-Match & Disconnects:** Explicit two-player `Rematch` / `Character Select` / `Exit to Menu` voting; clean timeout/disconnect modal if a peer stops responding for >5 seconds.

---

## 4. Phased implementation roadmap

Each milestone is small, independently testable in Node, and preserves all existing local Arcade/Training behavior. **Do not start WebRTC transport (O3) until O1 and the offline rollback harness in O2 are passing.**

| Milestone | Scope | Verification |
|---|---|---|
| **O1 — Symmetric 2P Arena & Bitmask Input** | Add `BitmaskInputAdapter`; refactor `Arena.update(dt, p1Input, p2Input)` so both slots run identical `CommandHistory`, `InputBuffer`, guard, special-cancel, attack, projectile, and movement steps; wire Arcade AI and Training dummy as Slot 1 input providers; make `MAX_FIGHTER_SEPARATION` clamping symmetric. | Node unit & Arena 2P tests: both slots execute QCF Arc Lance, buffered moves, cancels, combos, projectiles, and symmetric spacing; all existing 228 tests stay green. |
| **O2 — Integer Frame Timers, Canonical Snapshots & Seeded Rollback Harness** | Convert all gameplay timers (`MovementController`, `ProjectileController`, `RoundController`) to integer frames; implement explicit `Arena.saveState()` / `loadState()` + canonical FNV-1a checksum (Section 3.2); gate cosmetic side effects during resimulation; build `RollbackSession` and binary packet codec in `src/net/` with a **seeded, reproducible** in-memory network simulator (latency, jitter, packet loss, duplication, reordering, and `> maxRollback` stalls). | Node stress tests: run two `RollbackSession` peers across multiple seeds for 600+ frames, verifying frame-for-frame canonical state equality at mutually confirmed frames against a zero-latency reference run, repeated-rollback recovery, and safe stall behavior when the rollback window is exceeded. |
| **O3 — WebRTC DataChannel & Serverless Invite Flow** | Add `src/net/WebRtcTransport.js` (pluggable `iceServers`, unreliable `"inputs"` channel + reliable `"control"` channel, `MATCH_CONFIG` handshake, compressed SDP offer/answer). Wire Direct Invite flow into `MenuController` and `main.js`. | Unit tests for handshake validation and transport state machine + **real cross-browser verification** (Chromium ↔ Chromium and Chromium ↔ Firefox) checking live checksum parity. |
| **O4 — Online Character Select, HUD & Rematch/Disconnect Polish** | Synchronized character select over `"control"`, live RTT/rollback HUD, non-pausing `Escape` overlay, two-player rematch voting, and explicit desync/disconnect recovery UI. | Menu/session unit tests + Playwright browser smoke tests for Online lobby UI + human cross-network playtest. |
| **O5 — Lightweight Room-Code Signaling Service** | Deploy a minimal room-code signaling endpoint (separate config/docs, keeping the static game client dependency-free) with automatic fallback to Direct Invite when offline. | End-to-end room-code connection tests across separate networks (home Wi-Fi, mobile hotspot) to also measure real STUN success rates. |

---

## 5. Risks and open decisions

- **NAT traversal without TURN:** Measure real connection failure rates across home networks, mobile hotspots, and strict firewalls during O3–O5 before committing to a TURN provider.
- **Signaling hosting choice:** When Milestone O5 is reached, Leo selects the signaling host (e.g., Cloudflare Workers free tier vs. Fly.io/Render).
- **Matchmaking vs. private rooms:** Private 1v1 rooms first; public quick-match queues and ranked ladders remain deferred until roster, art, and room play are proven solid.
- **Cross-engine determinism:** A Node simulator alone cannot prove cross-engine determinism; real Chromium ↔ Firefox match checksum verification is an explicit O3 acceptance gate.
