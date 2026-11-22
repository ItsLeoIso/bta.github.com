# BTA — Belt to Ass

A browser-first 2D 1v1 anime-style fighting game. This repository is the source of truth for the game's code, assets, design decisions, and development plan.

## Current status

**Combat prototype 018 — local playtest candidate.** The Vanilla JavaScript + HTML5 Canvas foundation includes fixed-step simulation, movement, explicit fighter states, timed Light / Medium / Heavy attacks with High / Mid / Low hit levels, separate pushboxes and combat hurtboxes, active-frame hitboxes, damage and hit reactions, directional high/low guard with blockstun, chip damage, guard meter and guard breaks, hit/block frame-advantage reporting, and a complete prototype round loop. Special moves include Energy Shot, eight-way Vector Burst, and the QCF+L Arc Lance. Light / Medium hit-confirm cancels, grounded Medium launch, jump-cancels, air follow-ups, combo scaling, and a three-hit juggle cap are implemented. Arcade has a deterministic CPU rival; Training has a passive physics-enabled dummy. The menu includes Arcade, Online (not connected), Training, and Option; Escape opens pause / restart / exit controls. Matches use prototype 99-second rounds and first-to-two scoring.

**Readiness note:** the latest verified automated run passed 200/200 tests and the GitHub Pages deployment succeeded. This is a local keyboard playtest candidate, not a finished release. A human browser playtest and visual / feel validation are still outstanding; automated tests do not prove the live browser experience. Online multiplayer, gamepad / touch input, final art, animation, audio, and balance are not included.

## Playtest

Start with the [Playtest Guide](docs/PLAYTEST_GUIDE.md) for controls, mode details, a first-pass checklist, known limitations, and the bug-report template.

Hosted build: https://itsleoiso.github.io/bta.github.com/

## Design at a glance
- 2D, side-view, 1v1 fighting; assists may be considered later.
- Anime-fighter movement: fast air control, air combos, and air dashes.
- Moderate gravity: enough airtime for combos without weightless falling.
- Keyboard controls: A/D for screen-relative movement, W to jump, S to crouch, H/J/K/L for attacks.
- Main menu order: Arcade, Online, Training, Option.
- Browser is the first target platform.
- The 960-unit viewport follows both fighters through a 1,920-unit world stage.

See [the game design](docs/GAME_DESIGN.md), [the roadmap](docs/ROADMAP.md), [the technical plan](docs/TECHNICAL_PLAN.md), and the contributor [cooperation log](Cooperation.md).

## Repository layout
- assets/ — visual, audio, and stage assets.
- docs/ — design decisions and development plan.
- src/engine/ — timing, arena, and Canvas renderer.
- src/ai/ — deterministic opponent decision logic.
- src/input/ — keyboard state, logical actions, motion-command history, and combat input buffering.
- src/movement/ — movement, dashes, gravity, and pushboxes.
- src/combat/ — attacks, collision, damage, guard, frame data, and round flow.
- src/characters/ — future fighter definitions and move data.
- src/ui/ — browser presentation, HUD, and future menus.
- tests/ — Node.js automated tests, including source / asset integrity checks.
- index.html — browser entry point.

## Run locally
Requires Python 3 or another static HTTP server and Node.js 22 or newer:

    npm test
    python3 -m http.server 8000

Open http://localhost:8000. Do not open index.html directly as a file; native ES modules need an HTTP server.

No dependencies or build step are required.
