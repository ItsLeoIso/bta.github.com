# Technical Plan

## Current status

The game is intended to run in a browser. The exact implementation stack has **not yet been confirmed**. JavaScript with an HTML Canvas renderer has been suggested as a lightweight starting point, but it remains a proposal until agreed.

## Architectural goals

- Keep simulation/gameplay logic separate from rendering and UI.
- Use a consistent update loop for movement, state timing, collision, and combat.
- Represent controls as logical actions (forward, backward, jump, crouch, light, medium, heavy, special) rather than hard-coding gameplay to physical keys throughout the engine.
- Resolve forward/backward relative to each fighter's facing direction.
- Track input history and timestamps so double-taps and motion commands can be recognized reliably.
- Make character move definitions extensible and data-driven where practical.
- Keep networking concerns separate from local simulation so online play can be explored later without entangling the initial prototype.

## Proposed source layout

- `src/engine/` — game loop, timing, scene / match lifecycle.
- `src/input/` — keyboard state, logical actions, double-tap and motion-input recognition.
- `src/movement/` — ground movement, jumping, air control, dashes, gravity.
- `src/combat/` — attacks, hitboxes, hurtboxes, hit reactions, combo state.
- `src/characters/` — fighter definitions, stats, move data, character state.
- `src/ui/` — menus, HUD, health bars, training interface.
- `assets/` — sprites, stages, sound, and music.

## Technical decisions to make

1. Confirm plain JavaScript + Canvas or choose a game framework.
2. Decide module format and build tooling (if any).
3. Choose how collision shapes and frame-based move data are authored.
4. Define deterministic timing requirements before online multiplayer work.
5. Select test tooling once the runtime stack is chosen.
