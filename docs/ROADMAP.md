# BTA Development Roadmap

## Phase 0 — Project foundation
- [x] Establish repository structure.
- [x] Record confirmed game design decisions.
- [x] Choose and document the browser technology stack.
- [x] Add the minimal application scaffold and local run instructions.
- [x] Add a basic automated test setup.

## Phase 1 — Game runtime and input
- [x] Create the game loop and browser rendering surface.
- [x] Implement keyboard input tracking, including simultaneous keys and edge-triggered presses.
- [x] Implement side-relative forward / backward resolution and facing direction.
- [x] Add a basic arena and viewport handling.

## Phase 2 — Movement prototype
- [x] Ground movement and turning.
- [x] Neutral, forward, and backward jumps.
- [x] Crouching.
- [x] Forward dash and backdash via directional double-tap.
- [x] Air control and directional air dashes.
- [x] Initial moderate-gravity tuning values; further tuning requires playtesting.

## Phase 3 — Combat foundation
- [x] Explicit fighter state model (locomotion, action, and reaction) with validated transitions.
- [x] Frame-based attack phases: startup, active, and recovery (prototype Light / Medium / Heavy timings).
- [x] Hit and block advantage calculation after collision and guard resolution.
- [x] Separate standing, crouching, and airborne hurtboxes plus active-frame hitboxes and AABB collision detection.
- [x] Light, Medium, and Heavy prototype attacks with one-hit confirmation per action.
- [x] High, Mid, and Low attack levels with crouch and airborne interactions.
- [x] First-pass damage, hitstun, knockback, and heavy-hit knockdown reaction.
- [x] Directional blocking: hold away for high/mid, hold away + crouch for mid/low; rear attacks and wrong guard heights remain vulnerable.
- [x] Blockstun and reduced block pushback.
- [x] Chip damage on block, guard meter, delayed guard recovery, and guard-break reaction.
- [x] Health and guard bars reflect current fighter values.
- [x] Round timer, round flow, automatic fighter reset, and win / round result UI.

## Phase 4 — Special moves and combos
- [x] Special button alone: projectile (initial button-only prototype).
- [x] Contextual Energy Shot trajectory: forward when grounded and diagonal down-forward when airborne.
- [x] Facing-relative 24-frame Quarter-Circle Forward + Special recognition connected to the buffered Arc Lance projectile special.
- [x] Eight-frame combat input buffer for Light / Medium / Heavy / Special, preserving Arc Lance identity and facing for buffered motion commands.
- [x] Hit-confirm cancels, jump-cancels, air Light / Medium attacks, launcher-based air combos, combo tracking / damage scaling, juggle limits, and recovery rules.

## Phase 5 — First playable match
- [x] Two placeholder fighters with distinct test properties (Striker: 300 walk speed / 1.00 damage; CPU Rival: 260 walk speed / 1.05 damage).
- [x] Complete local 1v1 match loop with active deterministic CPU behaviour, two-sided melee collision, and CPU projectile support.
- [x] Basic scroll-aware neon city-stage placeholder presentation.
- [x] Publish a tester-facing guide with controls, mode scope, checklist, and issue-report template.
- [x] Add automated JavaScript syntax, relative-import, and browser-entry asset checks.
- [x] Add a Chromium browser smoke suite for menu, Online notice, Arcade pause / exit, Training reset, and narrow-viewport canvas.
- [x] Human browser match playtesting and visual validation (owner sign-off on Phase 5, 2026-11-25).
- [x] Playtest and fix core movement / combat issues (owner sign-off on Phase 5, 2026-11-25; ongoing balance tuning continues in Phase 7).

## Phase 6 — Menus and modes
- [x] Intro / START screen sequence.
- [x] Main menu in the confirmed order: Arcade, Online, Training, Option.
- [x] Training mode foundations (passive physics-enabled dummy, frozen timer, two-second health / guard recovery, reset positions).
- [x] Arcade mode foundations (local best-of-three CPU match).
- [x] Options menu (combat box and state-inspector toggles).
- [x] Pause menu (Resume, Restart Mode, Exit to Menu; Training adds Reset Positions).
- [x] Online mode investigation, architecture plan, and 1v1 WebRTC rollback implementation (milestones O1–O5 in `docs/ONLINE_PLAN.md`: Direct Invite P2P on GitHub Pages, optional room-code signaling server/worker, Online Character Select, live network HUD, rematch voting, and forfeit/disconnect handling).

## Phase 7 — Content and polish
- [x] Add data-driven character profiles for Striker and CPU Rival, including per-character stats, move sets, and animation metadata.
- [x] Add a fixed-step animation clip controller and optional sprite-atlas Canvas rendering path.
- [x] Add registry-driven character select for Arcade / Training, including matchup preview, profile stats, keyboard and pointer controls, and selected IDs passed into Arena.
- [ ] Replace placeholders with original pixel-art sprite sheets and authored animation frames.
- [ ] Add sound effects and music.
- [x] First procedural combat-feedback pass: hit / block / guard-break sparks, expanding impact rings, and restrained screen shake.
- [ ] Expand character- and stage-specific visual effects, impact animation, and authored VFX.
- [ ] Balance, accessibility, performance, and browser compatibility pass.

## Later possibilities
- [ ] Evaluate assist mechanics after the 1v1 game is established.
- [ ] Expand character roster and unique move sets.
