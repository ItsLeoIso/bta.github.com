# Technical Plan

## Confirmed stack
- **Language:** Vanilla JavaScript using native ES modules.
- **Rendering:** HTML5 Canvas 2D.
- **Dependencies/build tooling:** None for the initial browser prototype.
- **Tests:** Node.js built-in test runner (node --test).

This stack is chosen to maximize control over custom fighting-game mechanics and avoid framework constraints during the prototype.

## Architectural goals
- Keep simulation/gameplay logic separate from rendering and UI.
- Use a fixed-step simulation loop (60 updates per second initially) with render interpolation.
- Represent controls as logical actions rather than hard-coding gameplay to physical keys throughout the engine.
- Resolve forward/backward relative to each fighter's facing direction.
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
- Placeholder arena, player fighter, and training dummy.
- Keyboard state tracking for A/D/W/S and H/J/K/L, plus Escape pause.
- Horizontal movement preview with facing-relative direction handling.
- Initial automated tests for the loop and arena.

Not implemented yet:
- Jumping, gravity, crouch movement, dashes, and air control.
- Attack behavior, hitboxes/hurtboxes, hitstun, blocking, or damage.
- Input buffering, double-taps, and motion-command recognition.
- Character animation and custom pixel-art assets.
- Online multiplayer.

## Running and testing
- Run locally: python3 -m http.server 8000, then open http://localhost:8000.
- Run tests: npm test (requires Node.js).
- No install/build step is required.
