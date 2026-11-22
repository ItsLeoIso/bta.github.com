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
- Quarter-Circle Forward is recognised as Down → Down-Forward → Forward + L within 24 frames. It works relative to either facing direction; brief neutral gaps are allowed.
- Recognition is currently a feedback-only prototype. The input is consumed rather than silently firing Energy Shot / Vector Burst, because the advanced move's gameplay properties have not yet been designed.
- Added `src/input/InputBuffer.js`: Light / Medium / Heavy / Special button presses remain pending for eight fixed simulation frames while the current action or reaction prevents execution. A later combat-button press replaces the pending command; same-frame priority follows the existing Light → Medium → Heavy → Special dispatch order.
- Buffered Special snapshots its directional inputs at press time, so a delayed Vector Burst keeps its original aim. The buffer is cleared when a round leaves the active phase or fighters reset. Movement, guard, jump, and dash remain immediate and are not buffered.
- The command recogniser is independent of the existing double-tap dash detector. A buffered command is delivered on the first legal frame, including the exact frame a prior action finishes.

## Next combat milestone

- Define the first advanced motion special (move identity, hit level, timing, projectile / hit properties) before connecting the recognised command to a gameplay action.
- Add cancel windows and combo tracking after the move's frame data and buffer behavior have been playtested.
- Add basic opponent behaviour so the training dummy can exercise the player's guard, then build air combos, cancel windows, and combo tracking.

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
- Pressing a directional special while holding back releases or suppresses guard so back+L can start the move. Motion-input recognition is feedback-only; combat button buffering is implemented; cancel windows and combos remain unimplemented.
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
