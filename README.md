# BTA — Belt to Ass

A browser-first 2D 1v1 anime-style fighting game. This repository is the source of truth for the game's code, assets, design decisions, and development plan.

## Current status

**Combat prototype 018 — local playtest candidate.** The Vanilla JavaScript + HTML5 Canvas foundation includes fixed-step simulation, movement, explicit fighter states, timed Light / Medium / Heavy attacks with High / Mid / Low hit levels, separate pushboxes and combat hurtboxes, active-frame hitboxes, damage and hit reactions, directional high/low guard with blockstun, chip damage, guard meter and guard breaks, hit/block frame-advantage reporting, and a complete prototype round loop. Special moves include a forward-only grounded Energy Shot, a diagonal down-forward airborne Energy Shot, and the QCF+L Arc Lance. Light / Medium hit-confirm cancels, grounded Medium launch, jump-cancels, air follow-ups, combo scaling, and a three-hit juggle cap are implemented. Arcade has a deterministic CPU rival; Training has a passive physics-enabled dummy. The menu includes Arcade, Online (not connected), Training, and Option; Escape opens pause / restart / exit controls. Matches use prototype 99-second rounds and first-to-two scoring.

**Readiness note:** the latest verified Node run passed 203/203 tests, and the GitHub Pages build / deployment succeeded. A Chromium browser smoke suite now exercises the title/menu flow, Online notice, Arcade pause / exit, Training reset, and narrow-viewport canvas sizing in CI. This is a local keyboard playtest candidate, not a finished release. Human browser / visual / feel validation is still needed; automated checks do not prove the game feels balanced or fun. Online multiplayer, gamepad / touch input, final art, animation, audio, and balance are not included.

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
- tests/ — Node.js unit / integration tests and Chromium browser smoke tests.
- index.html — browser entry point.

## Run locally
Requires Python 3 or another static HTTP server and Node.js 22 or newer:

    npm test
    python3 -m http.server 8000

Open http://localhost:8000. Do not open index.html directly as a file; native ES modules need an HTTP server.

The Chromium smoke suite is run in CI. To run it locally, install the test-only tooling with `npm install --no-save --package-lock=false @playwright/test`, install Chromium with `npx playwright install chromium`, then run `npx playwright test`.

The game itself has no runtime dependencies or build step.
