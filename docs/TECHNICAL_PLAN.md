# Technical Plan

## Confirmed stack
- **Language:** Vanilla JavaScript using native ES modules.
- **Rendering:** HTML5 Canvas 2D.
- **Dependencies/build tooling:** None for the initial browser prototype.
- **Tests:** Node.js built-in test runner (node --test).

## Architectural goals
- Keep simulation/gameplay logic separate from rendering and UI.
- Use a fixed-step simulation loop (60 updates per second) with render interpolation.
- Represent controls as logical actions rather than hard-coding gameplay to physical keys throughout the engine.
- Keep horizontal movement controls screen-relative (A always left, D always right); resolve forward/backward dash classification and combat directions relative to facing. Blocking uses the opposite direction from the opponent, resolved from the fighter's current facing.
- Track input history and timestamps in the input layer so double-taps and motion commands can be added without coupling them to movement.
- Make character move definitions extensible and data-driven where practical.
- Keep networking concerns separate from local simulation so online play can be explored later without entangling the initial prototype.

## Source layout
- src/engine/ — game loop, timing, arena, and Canvas renderer.
- src/input/ — keyboard state, logical actions, and fixed-frame motion-command history.
- src/movement/ — ground movement, jumping, air control, dashes, gravity.
- src/combat/ — attacks, hitboxes, hurtboxes, hit reactions, guard, and round flow.
- src/characters/ — fighter definitions, stats, move data, character state.
- src/ui/ — browser presentation and later menus/HUD.
- assets/ — sprites, stages, sound, and music.

## Engine milestone 001
Implemented:
- Browser entry point using native ES modules.
- Fixed 60 Hz simulation accumulator with capped frame delta.
- Canvas 2D renderer with responsive sizing and device-pixel-ratio handling.
- Placeholder fighters are drawn at 3× their original body dimensions; arena size and movement speeds remain unchanged, with horizontal stage bounds adjusted to keep the larger bodies on-screen.
- Placeholder arena, player fighter, and training dummy.
- Keyboard state tracking for A/D/W/S and H/J/K/L, plus Escape pause.
- Initial automated tests for the loop, arena, and keyboard input.

## Movement prototype 001
Implemented in the code:
- W jumps; W+A / W+D launch with left / right horizontal momentum relative to the screen, independent of facing.
- Moderate gravity and a grounded floor check.
- Locked air trajectory: neutral jumps stay vertical; directional jumps preserve their takeoff direction until landing. An air dash can change the locked horizontal trajectory.
- Double-tap A/D for a screen-direction ground dash; whether it is a forward dash or backdash depends on facing. Both share a 0.45-second prototype cooldown between ground dash starts.
- Ground movement is reduced to 12.5% of normal walking speed while crouch is held; this modifier does not affect dash bursts or airborne movement. Standing guard permits backward retreat at 25% walking speed; crouch guard permits backward retreat at 12.5%.
- Double-tap A/D in the air for a screen-direction air dash.
- One air dash per airtime, refreshed on landing.
- Screen-relative dash direction, with forward-dash/backdash type classified relative to facing.

Tuning values are initial placeholders, not final balance:
- Ground speed: 300 units/s; air steering speed: 260 units/s.
- Jump velocity: 760 units/s; gravity: 1800 units/s².
- Ground dash: 700 units/s for 0.16 s.
- Backdash: 540 units/s for 0.22 s.
- Air dash: 650 units/s for 0.14 s.
- Double-tap window: 0.24 s.

## Pushbox collision

Implemented in the prototype:

- Added a dedicated `src/movement/Pushbox.js` system for fighter-to-fighter body-space separation.
- Standing and crouching use different vertical pushbox heights; pushboxes are anchored at the fighter's feet and remain separate from future hurtboxes and attack hitboxes.
- Horizontal overlap is shared between fighters where possible. Stage-edge constraints transfer the pinned fighter's share to the other fighter.
- Vertical separation permits jumping over an opponent. Pushboxes resolve after movement on each fixed update.
- Stage center margin is 68 arena units to keep the current 136-unit ground shadow on-stage.
- Air dash holds vertical velocity at zero during the burst, restores normal air speed at dash end, and resumes gravity.
- Opposite-direction taps break a pending double-tap; the two taps are consumed when a dash is attempted.

Initial pushbox values (55 half-width, 70 standing height, 50 crouching height) are tuning placeholders. Validate push sharing, corner behaviour, jump-over distances, and visual overlap in browser playtests.

## Fighter state architecture

Implemented foundation:

- Added `src/state/FighterStateController.js` as the authority for three independent state channels: locomotion, action, and reaction.
- Locomotion currently covers standing, walking, crouching, jumping, and falling, with transitions validated centrally.
- Action currently covers neutral, dash, attack, and guard. Dash timing/type/velocity are action data rather than independent state flags.
- Reaction currently covers neutral, hitstun, blockstun, guard break, knockdown, and wake-up. Reactions interrupt actions and higher-priority reactions cannot be replaced by lower-priority ones.
- Existing physics and pushbox fields remain synchronized as compatibility mirrors while the rest of the engine migrates to explicit state.
- Added a live DOM state inspector for both fighters. It displays locomotion, action, reaction, and action detail while the game runs.
- Added a frame-data area for startup, active, recovery, hit advantage, and block advantage.

## Attack timing prototype

Implemented as the first combat action system:

- Added `src/combat/AttackController.js` with data-driven Light, Medium, and Heavy definitions, triggered by H, J, and K.
- The prototype timings are Light 5 startup / 3 active / 10 recovery frames; Medium 8 / 4 / 15; Heavy 12 / 5 / 21. These are initial tuning values at the fixed 60 Hz simulation rate.
- Attacks start only while grounded and neutral. Startup, active, and recovery are stored as attack action data, and the action ends only after recovery completes.
- Ground movement, jump, dash, and stance changes are locked during the attack. Existing crouching stance is preserved.

## Hitbox and hurtbox collision prototype

Implemented as a separate combat geometry layer:

- Added `src/combat/Hurtbox.js` with standing, crouching, and airborne axis-aligned hurtbox profiles. Hurtboxes represent hittable body space and do not reuse the movement pushboxes.
- Added `src/combat/Hitbox.js` to create a facing-relative attack rectangle only during active frames. Each Light, Medium, and Heavy definition supplies its own prototype box dimensions and reach.
- Added `src/combat/CombatCollision.js` for strict positive-area rectangle overlap and one-hit-per-action confirmation. A miss remains eligible to connect on a later active frame.
- Arena collision resolution runs after movement and pushbox separation, using final positions and current facing. A confirmed collision produces a structured hit event.
- The renderer outlines fighter hurtboxes and the current active attack hitbox for tuning. Pushboxes, hurtboxes, and attack hitboxes remain separate systems.

Current forgiving collision profiles match the rendered fighter silhouette at 3x scale: standing and airborne hurtboxes are 126 × 228; crouching hurtboxes are 126 × 144. Light / High, Medium / Mid, and Heavy / Low attack hitboxes are respectively 126 × 72 at vertical offset -220, 160 × 80 at -152, and 190 × 72 at -72. These are broad gameplay volumes, not limb-accurate boxes, and remain prototype tuning values for playtesting.

## Damage, guard, and frame-advantage pass

Implemented as the next combat pressure milestone. These values are initial prototype tuning and should be playtested before balance is treated as final:

- Confirmed Light / Medium / Heavy hits deal 6% / 10% / 15% health damage. Their hitstun remains 12 / 18 / 30 frames.
- Blocking applies chip damage equal to 10% of the move's normal damage: Light 0.6%, Medium 1%, Heavy 1.5%. Chip damage is clamped so health never drops below zero.
- Fighters begin with a 100-point guard meter. A blocked Light / Medium / Heavy removes 20 / 30 / 45 points.
- Guard meter regeneration is 18 points per second after a 90-frame delay following a block. It does not regenerate while the fighter is guarding or in a reaction.
- Reaching zero guard meter causes a 45-frame guard-break reaction with 1.5× the normal block pushback. The guard meter recovers after that delayed regeneration rule.
- Hit and block advantage are calculated from the attacker's perspective: defender hitstun/blockstun frames minus the attacker's remaining active + recovery frames at the moment of collision. Positive means the attacker recovers first; negative means the defender recovers first.
- The live frame-data inspector shows signed advantage in frames, and the arena HUD displays both fighters' guard meters.
- Regression tests cover chip damage, guard meter drain/recovery, guard break, and hit/block advantage.

## Round flow prototype

Implemented as a deterministic fixed-step match state machine in `src/combat/RoundController.js`:

- The first round begins immediately with a brief "ROUND 1 · FIGHT!" banner, preserving the current playable preview and existing combat entry behaviour.
- The round timer starts at 99 seconds and counts down only while the round is active. KO takes precedence if it happens on the same update as timeout.
- A KO ends a round immediately. At timeout, the fighter with more remaining health wins; a simultaneous KO or tied timeout is a draw and awards no point.
- The prototype match is first to two round wins (best of three). Drawn rounds do not change either score.
- A short result display freezes player movement, attacks, guard, reactions, and the round timer. The next round automatically resets positions, health, guard meter, movement/action/reaction data, then shows a short ready-up display.
- The match result remains on screen until Enter (or Space) is pressed to reset the score and begin a rematch.
- These timer/scoring/display durations are prototype defaults, intentionally isolated in `RoundController` for later owner tuning.

Regression coverage is in `tests/RoundController.test.js` and `tests/ArenaRoundIntegration.test.js`. Browser playtesting is still required for readability, pacing, and match feel.

## World camera and motion-command recognition

Implemented prototype foundation:

- The simulation uses world-space positions across a 1,920-unit stage while the visible game viewport remains 960 × 540.
- The horizontal camera tracks the midpoint between the player and opponent, clamps to the world ends, and constrains its offset so the controlled player stays inside the viewport. HUD and round overlays remain screen-space.
- Camera offset is interpolated during rendering; it does not alter fighter coordinates, movement speeds, collision, hitboxes, projectile trajectories, or stage boundaries.
- Added `src/input/CommandHistory.js`, which samples facing-relative eight-way directions once per fixed simulation frame and keeps a short command history.
- Quarter-Circle Forward is recognised as Down → Down-Forward → Forward + L within 24 frames and launches Arc Lance. The command works relative to either facing direction; brief neutral gaps are allowed.
- Arc Lance uses 14 startup / 26 recovery frames, 390 units/second speed, 26-unit radius, 14% damage, 24 hitstun frames, and 400 knockback. It adds 1.4% chip damage and 38 guard-meter pressure.
- The eight-frame input buffer preserves Arc Lance identity and input-time facing. The move is available as a hit-confirm Special cancel from Light / Medium.
- Added `src/input/InputBuffer.js`: Light / Medium / Heavy / Special button presses remain pending for eight fixed simulation frames while the current action or reaction prevents execution. A later combat-button press replaces the pending command; same-frame priority follows the existing Light → Medium → Heavy → Special dispatch order.
- Buffered Special snapshots its directional inputs at press time, so a delayed Vector Burst keeps its original aim. The buffer is cleared when a round leaves the active phase or fighters reset. Movement, guard, jump, and dash remain immediate and are not buffered.
- The command recogniser is independent of the existing double-tap dash detector. A buffered command is delivered on the first legal frame, including the exact frame a prior action finishes.

## Next combat milestone

- Arc Lance, hit-confirm cancels, combo tracking, and a deterministic CPU rival are now implemented. Browser playtesting and balance tuning remain outstanding.

## Running and testing
- Run locally: python3 -m http.server 8000, then open http://localhost:8000.
- Run tests: npm test (requires Node.js).
- No install/build step is required.


## Phase 4 — Button-only projectile special (prototype)

Implemented in the first Phase 4 increment:

- Added \`src/combat/ProjectileController.js\`. It starts the L-only special when the special key is pressed without left/right held, creates a facing-relative projectile after 8 startup frames, and tracks travel, lifetime, bounds, hurtbox contact, and one-hit removal.
- Added an explicit \`special\` fighter action so the 18-frame recovery locks grounded movement and prevents other actions, while preserving committed airborne horizontal motion. The special may be started from grounded or airborne neutral.
- Projectile contacts reuse the existing standing/crouching/airborne hurtboxes and shared damage, chip-damage, guard-meter, blockstun, and hitstun controllers.
- The launched projectile preserves its original travel direction for guard-side checks and knockback even if its owner later changes position.
- Prototype values: 540 units/second speed, 18-unit radius, 2.5-second lifetime, 8% damage, 18 hitstun frames, 280 knockback, 0.8% chip damage, and 25 guard-meter damage.
- Direction+L is handled as the separate eight-way Vector Burst. A/D, W/S, and diagonal combinations set a screen-relative aim vector; diagonal velocity is normalized. Opposing directions on one axis cancel the special instead of falling back to the button-only projectile.
- Vector Burst shares the Energy Shot's initial 8-frame startup, 18-frame recovery, 540-unit/second speed, 18-unit radius, 2.5-second lifetime, and 8% damage profile, but uses a separate move ID / damage profile for later tuning. Vertical shots spawn from the fighter's forward side to clear pushbox spacing.
- Pressing a directional special while holding back releases or suppresses guard so back+L can start the move. QCF+L now launches the Arc Lance motion special; input buffering, hit-confirm cancels, and combo tracking are implemented.
- Added unit and Arena integration coverage for startup/recovery, facing direction, direction+button suppression, airborne use, action locks, projectile movement/contact/expiry, hit damage, and blocking.


## Movement regression fixes after the first projectile playtest

- Directional jump input takes priority over defensive guard. Pressing W+A or W+D starts that screen-relative jump even when the direction would ordinarily start guard; pressing jump while already guarding releases guard first.
- Jump also takes priority over reading the same directional keydown as the second tap of a backdash.
- During airborne projectile startup and recovery, the fighter's horizontal and vertical positions remain fixed. The existing airborne velocities are preserved and movement/gravity resume unchanged after the special ends.
- Regression tests cover backward and forward diagonal jumps, jumping out of guard, jump priority over a pending backdash, and the airborne projectile position hold/resume behaviour.


## Phase 4 — Direction + Special (eight-way Vector Burst)

Implemented as the second Phase 4 increment:

- L with no direction held continues to fire the original forward-facing Energy Shot.
- A/D + L aim left or right on screen; W/S + L aim up or down; two held directions create a normalized diagonal trajectory. The aim is captured on the input frame.
- The directional move uses a separate `directionalSpecial` move ID and `Vector Burst` display name. It initially reuses Energy Shot timing and damage values so the new direction mechanic can be tested without introducing a second round of balance changes.
- Directional input plus L takes priority over back-guard, including releasing an already-active guard. Conflicting opposing directions suppress the move.
- Projectile updates now move in both axes and remove shots that leave vertical as well as horizontal arena bounds. Vertical shots spawn from the fighter's forward side so pushbox separation does not make them miss an opponent directly ahead.
- Unit and Arena integration tests cover all eight aim directions, normalized diagonal speed, ambiguous inputs, guard cancellation, vertical hits, shared damage, and vertical cleanup.


## Phase 4 — Air Vector limit and shot momentum lock

- Directional aim remains screen-relative: W+L fires upward, and the direction away from the opponent fires behind the fighter. Existing diagonal aim behavior, including Forward/Up + L, is left unchanged in this increment.
- A fighter may start one projectile special of any kind during an airtime, whether it is the neutral L-only Energy Shot or a directional Vector Burst. The shared air-projectile allowance is consumed when the move starts and restored only after landing. Grounded projectile use remains available after the normal special recovery.
- Starting any projectile special (L-only Energy Shot or directional Vector Burst) immediately zeros horizontal velocity, vertical velocity, and committed air drift. During an aerial special, horizontal movement remains locked but normal gravity continues through startup and recovery, so the fighter begins falling immediately rather than hovering.
- If the fighter lands before the special recovery ends, the action remains `SPECIAL` and keeps the fighter locked on the ground until the original 8-startup + 18-recovery frame sequence ends. Landing updates locomotion to `STANDING` on the touchdown frame and refreshes the shared air-projectile allowance. No additional special landing-recovery timer is implemented yet.
- The air-projectile allowance remains independent of the air-dash allowance. Any future shared air-option resource requires a separate design decision.
- Automated regression coverage checks backward aim from both facing orientations, one Vector Burst per airtime, landing refresh, and full momentum cancellation for projectile specials.


## Combat milestone 013 — hit confirms, air routes, and combo state

Implemented:
- Added move-data-driven hit-confirm cancel routes. Light and Medium can route into the documented normal / Special follow-ups; blocks and whiffs retain their full recovery.
- Added grounded jump-cancels for confirmed Light / Medium attacks. Medium applies a 520 units/second grounded launch to its target.
- Enabled airborne Light / Medium attacks while keeping Heavy grounded-only. Air-specific cancel routes prevent an accidental infinite normal loop.
- Added a fixed-frame ComboTracker with a 45-frame link window, same-attacker tracking, 10-percentage-point damage scaling down to a 40% floor, and a three-hit aerial juggle cap.
- Added a screen-space combo counter with hit count, AIR COMBO label, and cumulative damage.
- Regression coverage includes cancel eligibility, whiff / block rejection, aerial move eligibility, combo scaling, link timeout, juggle cap, launcher, jump cancel, an airborne follow-up, and projectile Special cancel.
- Values remain prototype tuning data pending browser playtesting.


## First playable match milestone 014 — CPU rival

Implemented:
- Added a deterministic fixed-step `OpponentAIController` that emits the same logical input shape as keyboard input.
- The live browser entry enables the CPU; isolated Arena tests remain opt-in / deterministic.
- Added a second MovementController instance so the CPU has independent dash tap history and physics timing.
- Enabled two-sided melee collision and shared projectile simulation for both fighters. Simultaneous active melee events are collected before applying reactions so trades can resolve.
- Added distinct placeholder fighter properties: player Striker walks at 300 units/second with 1.00× damage; CPU Rival walks at 260 units/second with 1.05× damage.
- CPU approaches, cycles through Light / Medium / Heavy / Energy Shot, and briefly reacts with standing or crouching guard to active melee swings.
- Added tests for deterministic approach / attacks, crouch-block selection, both-sided melee damage, profile modifiers, and live Arena integration.
- Browser balance and visual playtesting are still required before marking the full first-playable milestone complete.


## Stage presentation milestone 015 — Neon Backstreet placeholder

Implemented:
- Replaced the flat grid backdrop with a layered night-sky and city skyline using Canvas gradients, deterministic building silhouettes, lit windows, small BTA signage, and a tiled foreground floor.
- The environment is drawn in world space and scrolls with the existing camera; combatants remain layered above the stage and HUD stays screen-space.
- No external image assets or new runtime dependencies were introduced.
- Browser visual inspection is still required to tune contrast, composition, and performance on target devices.


## Combat milestone 016 — Arc Lance motion special

Implemented:
- Connected the 24-frame facing-relative Quarter-Circle Forward + L recogniser to a real special move instead of feedback-only confirmation.
- Added per-move projectile tuning so Arc Lance uses 14 startup / 26 recovery frames, 390 units/second speed, 26-unit radius, and a 2.8-second lifetime while Energy Shot and Vector Burst retain their existing values.
- Added the Arc Lance hit profile: 14% health damage, 24 hitstun frames, 400 knockback, 1.4% chip damage, and 38 guard-meter damage.
- Extended the eight-frame input buffer to retain the special move identity and facing direction at command time. This supports both recovery buffering and confirmed Light / Medium Special cancels without changing Energy Shot / Vector Burst behavior.
- Added a distinct projectile colour and HUD feedback label for Arc Lance.
- Automated tests cover QCF activation, move-specific frame data and projectile properties, input-time facing, hit-confirm cancel, damage, chip / guard pressure, and actual projectile travel into a hurtbox.


## Menu and modes milestone 017 — START flow and practice foundations

Implemented:
- Added a pure `MenuController` state machine with title, main, online, options, and playing screens. Keyboard navigation is W / S or Up / Down, Enter to confirm, and Escape to return.
- Added the main menu in the required order: Arcade, Online, Training, Option. Mouse buttons and keyboard selection both work.
- Arcade starts the CPU-controlled best-of-three match; Online clearly explains that networking is not connected rather than pretending to offer matchmaking.
- Training starts without CPU AI, freezes the round timer, and restores the dummy's health / guard meter two seconds after its last hit or block so repeated practice is possible.
- Added options for combat hurtbox / active-hitbox overlays and the DOM state / frame-data inspector. Debug overlays now start hidden, and both player and CPU active melee hitboxes can be inspected.
- Added menu state-machine and training-mode integration tests. Training reset-position is now available from the pause menu; input recording / playback and character select remain future work.


## 2026-11-23 playtest adjustment — CPU pacing and Special trajectories

- CPU attack pacing now uses a 30-frame neutral-time breather after each attack. The delay pauses while the CPU is committed to an action or reaction, so it cannot expire invisibly during recovery and trigger another immediate attack. The CPU remains deterministic and keeps its startup-reactive guard.
- Ordinary Special no longer has free eight-way directional aim. Grounded L always fires forward relative to facing; airborne L always fires diagonally down-forward relative to facing. Held directions cannot turn the Energy Shot backward or vertically.
- QCF+L remains the separate facing-relative Arc Lance motion special. It keeps its existing startup, recovery, projectile tuning, buffering, and hit-confirm cancel route.
- Regression tests cover grounded shots from both facing directions, ignored aim inputs, airborne diagonal shots from both facing directions, the CPU's neutral-time cooldown, and Arena-level input dispatch.


## Presentation milestone 019 — Procedural combat impact feedback

Implemented:
- Added a deterministic CombatEffects presentation system for confirmed melee and projectile hits, blocks, and guard breaks.
- Impacts create a short expanding ring and a small palette-matched burst of streak particles. Blocks use a restrained cool-blue response; hits vary by attack height / strength; Arc Lance and guard break receive stronger violet accents.
- Screen shake is render-only and applies to the scrolling world layer, leaving health / guard HUD, timer, round UI, and menus stable.
- Particle motion and shake use deterministic simulation time and seeded impact sequences. Effects do not modify fighter positions, damage, collision, frame advantage, or attack state.
- Resetting a match clears transient particles and shake. The effect list is capped to avoid unbounded growth.
- Automated tests cover deterministic hit effects, block / guard-break intensity, projectile contact positioning, expiration, reset, and ignored non-contact events.

The Canvas-generated effects are a first presentation pass, not final character-specific VFX or a replacement for authored sprite animation, sound, or hitstop.


## Character foundation milestone 020 — Profiles, move sets, and animation clock

Implemented:
- Added \`src/characters/CharacterDefinitions.js\` with a registry for Striker and CPU Rival. Arena accepts character IDs while retaining the same defaults, positions, movement speeds, and damage multipliers.
- Moved shared prototype normal / projectile data into \`src/characters/MoveSets.js\`. AttackController reads the move set attached to each fighter; ProjectileController likewise reads per-character Energy Shot / Arc Lance tuning, including projectile spawn offsets. Existing exports remain available from their previous controller modules for compatibility.
- Added \`src/animation/FighterAnimator.js\`. It maps reaction, action, and locomotion states to fixed-step animation clips and tracks atlas frame, frame index, elapsed simulation frames, looping, and completion.
- Added animation metadata to the character definitions and a lazy-loaded, optional uniform-grid sprite-atlas path in CanvasRenderer. With the current null sprite sources, the existing geometric placeholder renderer remains the live fallback.
- Regression coverage includes profile registration / immutability / balance preservation, animation selection and timing, custom per-character attack and projectile overrides, Arena animation transitions, and invalid character IDs.

Not included: final art, custom sprite sheets, character select, portraits, bespoke roster move sets, or an asset authoring pipeline. The new pipeline makes those additions possible without coupling them to combat controller internals.


## Phase 6 — Online mode architecture plan (not yet implemented)

Recorded in `docs/ONLINE_PLAN.md` based on an engine determinism audit and owner decisions (2026-11-25):

- **Netcode:** GGPO-style rollback netcode over 60 Hz deterministic simulation with a 16-bit per-frame input bitmask, configurable input delay, state snapshot ring buffer, and periodic FNV-1a checksum desync detection.
- **Transport:** WebRTC peer-to-peer (`RTCDataChannel`: unreliable/unordered redundant input packets + reliable control channel), supporting a zero-backend copy-paste invite fallback on GitHub Pages and a lightweight room-code signaling service later.
- **Engine prerequisites identified before transport work:** symmetric P1/P2 input/history/buffer/cancel pipeline in `Arena.update`, symmetric separation clamping, slot-indexed serializable snapshots (`saveState()` / `loadState()`), frame-counter timers in `MovementController` / `RoundController`, and resimulation-safe VFX/audio gating.
- **Boundary:** All future networking code stays isolated under `src/net/` so local Arcade, Training, and Node tests remain zero-dependency. No networking code was implemented in this planning pass.

