# BLT Development Roadmap

The roadmap is ordered to establish a reliable playable core before expanding into modes and polish. Items are plans, not claims that the features already exist.

## Phase 0 — Project foundation

- [x] Establish repository structure.
- [x] Record confirmed game design decisions.
- [ ] Choose and document the browser technology stack.
- [ ] Add the minimal application scaffold and local run instructions.
- [ ] Add a basic automated test setup.

## Phase 1 — Game runtime and input

- [ ] Create the game loop and browser rendering surface.
- [ ] Implement keyboard input tracking, including simultaneous keys and double-tap timing.
- [ ] Implement side-relative forward / backward resolution and facing direction.
- [ ] Add a basic arena and camera / viewport handling.

## Phase 2 — Movement prototype

- [ ] Ground movement and turning.
- [ ] Neutral, forward, and backward jumps.
- [ ] Crouching.
- [ ] Forward dash and backdash via directional double-tap.
- [ ] Air control and directional air dashes.
- [ ] Tune movement and moderate gravity through playtesting.

## Phase 3 — Combat foundation

- [ ] Character state model and attack state timing.
- [ ] Hitboxes, hurtboxes, and collision detection.
- [ ] Light, Medium, and Heavy attacks.
- [ ] Hit reactions, hitstun, blockstun, knockback, and damage.
- [ ] Health bars and round flow.

## Phase 4 — Special moves and combos

- [ ] Special button alone: projectile.
- [ ] Direction + Special moves.
- [ ] Motion-input recognition (e.g. quarter-circle forward + Special).
- [ ] Input buffer and command history.
- [ ] Air combos, cancels, combo tracking, and recovery rules.

## Phase 5 — First playable match

- [ ] Two placeholder fighters with distinct test properties.
- [ ] Complete local 1v1 match loop.
- [ ] Basic stage presentation, UI, health, timer, and win / round result.
- [ ] Playtest and fix core movement / combat issues.

## Phase 6 — Menus and modes

- [ ] Intro / START screen sequence.
- [ ] Main menu in the confirmed order: Arcade, Online, Training, Option.
- [ ] Training mode foundations.
- [ ] Arcade mode foundations.
- [ ] Options menu.
- [ ] Online mode investigation and implementation plan.

## Phase 7 — Content and polish

- [ ] Replace placeholders with original pixel-art sprites and animations.
- [ ] Add sound effects and music.
- [ ] Visual effects, hit sparks, screen shake, and impact feedback.
- [ ] Balance, accessibility, performance, and browser compatibility pass.

## Later possibilities

- [ ] Evaluate assist mechanics after the 1v1 game is established.
- [ ] Expand character roster and unique move sets.
