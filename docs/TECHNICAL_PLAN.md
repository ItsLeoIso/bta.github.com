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

Implemented foundation:

- Added `src/state/FighterStateController.js` as the authority for three independent state channels: locomotion, action, and reaction.
- Locomotion currently covers standing, walking, crouching, jumping, and falling, with transitions validated centrally.
- Action currently covers neutral, dash, attack, and guard. Dash timing/type/velocity are action data rather than independent state flags.
- Reaction currently covers neutral, hitstun, blockstun, knockdown, and wake-up. Reactions interrupt actions, and higher-priority reactions cannot be replaced by lower-priority ones.
- Existing physics and pushbox fields remain synchronized as compatibility mirrors while the rest of the engine migrates to explicit state.
- Added a live DOM state inspector for both fighters. It displays locomotion, action, reaction, and action detail while the game runs.
- Added a frame-data area for startup, active, recovery, hit advantage, and block advantage. These values are intentionally placeholders until attack definitions and frame timing are implemented.
- Added unit tests for legal/illegal transitions, action locking, reaction interruption/priority, compatibility mirrors, and integration with walking, crouching, jumping, falling, landing, and dash completion.

Next state/combat work should keep facing direction, screen-relative input, timers, and attack phase as distinct data. Pushboxes, hurtboxes, and attack hitboxes remain separate systems, with collision profiles selected from the fighter's current stance/locomotion.

## Attack timing prototype

Implemented as the first combat action system:

- Added `src/combat/AttackController.js` with data-driven Light, Medium, and Heavy definitions, triggered by H, J, and K.
- The prototype timings are Light 5 startup / 3 active / 10 recovery frames; Medium 8 / 4 / 15; Heavy 12 / 5 / 21. These are initial tuning values at the fixed 60 Hz simulation rate.
- Attacks start only while grounded and neutral. Startup, active, and recovery are stored as attack action data, and the action ends only after recovery completes.
- Ground movement, jump, dash, and stance changes are locked during the attack. Existing crouching stance is preserved.
- The active phase has a temporary visual slash cue. It is not a hitbox and cannot hit the opponent yet.
- The state inspector displays the current phase and move frame data. Hit and block advantage remain unset until collision and guard resolution can determine real outcomes.

## Hitbox and hurtbox collision prototype

Implemented as a separate combat geometry layer:

- Added `src/combat/Hurtbox.js` with standing, crouching, and airborne axis-aligned hurtbox profiles. Hurtboxes represent hittable body space and do not reuse the movement pushboxes.
- Added `src/combat/Hitbox.js` to create a facing-relative attack rectangle only during active frames. Each Light, Medium, and Heavy definition supplies its own prototype box dimensions and reach.
- Added `src/combat/CombatCollision.js` for strict positive-area rectangle overlap and one-hit-per-action confirmation. A miss remains eligible to connect on a later active frame.
- Arena collision resolution runs after movement and pushbox separation, using final positions and current facing. A confirmed collision produces a structured hit event and brief on-screen hit label.
- The renderer outlines fighter hurtboxes and the current active attack hitbox for tuning. The collision boxes are gameplay geometry; the art slash remains presentation only.
- This milestone intentionally does not subtract health or apply hitstun/knockback. Those belong to the damage and reaction pass. Pushboxes remain independent and continue to resolve body separation.

Current forgiving collision profiles match the rendered fighter silhouette at 3x scale: standing and airborne hurtboxes are 126 × 228; crouching hurtboxes are 126 × 144. Standard Light, Medium, and Heavy attack hitboxes are 126 × 80, 160 × 80, and 190 × 80. They keep their forward reach but cover only the upper-body band, ending above the crouching hurtbox so crouching can evade standard attacks; future low attacks will use a separate lower hitbox profile. These are broad gameplay volumes, not limb-accurate boxes, and remain prototype tuning values for playtesting.

## Planned combat foundation
- Add directional blocking and resolve guard direction relative to the opponent, including when fighters cross sides.
- Add damage, hitstun, blockstun, knockback, and advantage calculations after hit/block outcomes are defined.
- Add directional blocking: holding away from the opponent guards automatically based on current facing; this must remain correct when fighters cross sides.
- Keep movement input screen-relative while interpreting guard direction relative to the opponent. Add regression tests for guarding from both sides before adding blockstun, chip damage, or guard-break rules.

## Running and testing
- Run locally: python3 -m http.server 8000, then open http://localhost:8000.
- Run tests: npm test (requires Node.js).
- No install/build step is required.
