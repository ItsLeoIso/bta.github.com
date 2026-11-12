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
- src/input/ — keyboard state and logical actions; input history/motion recognition to follow.
- src/movement/ — ground movement, jumping, air control, dashes, gravity.
- src/combat/ — attacks, hitboxes, hurtboxes, hit reactions, combo state.
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
- Ground movement is reduced to 50% of normal walking speed while crouch is held; this modifier does not affect dash bursts or airborne movement.
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
- Horizontal overlap is split between fighters where possible. Stage-edge constraints transfer the pinned fighter's share to the other fighter.
- Vertical separation permits jumping over an opponent. Pushboxes resolve after movement on each fixed update.
- Stage center margin is 68 arena units to keep the current 136-unit ground shadow on-stage.
- Air dash holds vertical velocity at zero during its burst, restores normal air speed at dash end, and resumes gravity.
- Opposite-direction taps break a pending double-tap; the two taps are consumed when a dash is attempted.

Initial pushbox values (55 half-width, 70 standing height, 50 crouching height) are tuning placeholders. Validate push sharing, corner behaviour, jump-over distances, and visual overlap in browser playtests.

## Fighter state architecture

Planned foundation before expanding combat:

- Add an explicit fighter state controller rather than deriving gameplay state from scattered flags.
- Represent grounded/airborne locomotion and stance (standing, walking, crouching, jumping) separately from action states (dash, air dash, attack) and temporary reactions/lockouts (hitstun, blockstun, knockdown, wake-up) where appropriate.
- Give each state/action explicit entry, update, and exit/transition rules. Centralize transition validation and define interruption priority.
- Keep facing direction, screen-relative input, timers, and attack phase as distinct data; do not duplicate them as state flags.
- Select pushbox and hurtbox profiles from the fighter's current stance/locomotion. Keep pushboxes, hurtboxes, and attack hitboxes as separate systems.
- Add transition tests for grounded/airborne changes, crouch and walk, dash completion, landing, attack phases, guard, and hit reactions as those systems arrive.

## Planned combat foundation
- Implement light, medium, and heavy attacks with explicit startup, active, and recovery phases.
- Add attack hitboxes and fighter hurtboxes, then resolve hit detection and hit reactions.
- Add directional blocking: holding away from the opponent guards automatically based on current facing; this must remain correct when fighters cross sides.
- Keep movement input screen-relative while interpreting guard direction relative to the opponent. Add regression tests for guarding from both sides before adding blockstun, chip damage, or guard-break rules.

## Running and testing
- Run locally: python3 -m http.server 8000, then open http://localhost:8000.
- Run tests: npm test (requires Node.js).
- No install/build step is required.
