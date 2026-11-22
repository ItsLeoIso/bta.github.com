# BLT Development Roadmap

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
- [x] Separate standing, crouching, and airborne hurtboxes plus active-frame attack hitboxes and AABB collision detection.
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
- [x] Direction + Special moves (eight-way Vector Burst).
- [x] Facing-relative 24-frame Quarter-Circle Forward + Special recognition connected to the buffered Arc Lance projectile special.
- [x] Eight-frame combat input buffer for Light / Medium / Heavy / Special, including direction snapshots for buffered Vector Burst.
- [x] Hit-confirm cancels, jump-cancels, air Light / Medium attacks, launcher-based air combos, combo tracking / damage scaling, juggle limits, and recovery rules.

## Phase 5 — First playable match
- [x] Two placeholder fighters with distinct test properties (Striker: 300 walk speed / 1.00 damage; CPU Rival: 260 walk speed / 1.05 damage).
- [x] Complete local 1v1 match loop with active deterministic CPU behaviour, two-sided melee collision, and CPU projectile support.
- [x] Basic scroll-aware neon city-stage placeholder presentation.
- [ ] Browser match playtesting and visual validation.
- [ ] Playtest and fix core movement / combat issues.

## Phase 6 — Menus and modes
- [x] Intro / START screen sequence.
- [x] Main menu in the confirmed order: Arcade, Online, Training, Option.
- [x] Training mode foundations (passive dummy, frozen timer, two-second health / guard recovery).
- [x] Arcade mode foundations (local best-of-three CPU match).
- [x] Options menu (combat box and state-inspector toggles).
- [ ] Online mode investigation and implementation plan.

## Phase 7 — Content and polish
- [ ] Replace placeholders with original pixel-art sprites and animations.
- [ ] Add sound effects and music.
- [ ] Visual effects, hit sparks, screen shake, and impact feedback.
- [ ] Balance, accessibility, performance, and browser compatibility pass.

## Later possibilities
- [ ] Evaluate assist mechanics after the 1v1 game is established.
- [ ] Expand character roster and unique move sets.
