# BLT — Belt to Ass

A browser-first 2D 1v1 anime-style fighting game. This repository is the source of truth for the game's code, assets, design decisions, and development plan.

## Current status
**Combat prototype 004.** The Vanilla JavaScript + HTML5 Canvas foundation includes fixed-step simulation, movement, explicit fighter states, timed Light / Medium / Heavy attacks with High / Mid / Low hit levels, separate pushboxes and combat hurtboxes, active-frame hitboxes, damage and hit reactions, plus directional high/low guard with blockstun. Chip damage, block advantage, opponent attack behaviour, and round flow remain future milestones.

## Design at a glance
- 2D, side-view, 1v1 fighting; assists may be considered later.
- Anime-fighter movement: fast air control, air combos, and air dashes.
- Moderate gravity: enough airtime for combos without weightless falling.
- Keyboard controls: A/D for side-relative movement, W to jump, S to crouch, H/J/K/L for attacks.
- Main menu order: Arcade, Online, Training, Option.
- Browser is the first target platform.

See [the game design](docs/GAME_DESIGN.md), [the roadmap](docs/ROADMAP.md), [the technical plan](docs/TECHNICAL_PLAN.md), and the contributor [cooperation log](Cooperation.md).

## Repository layout
- assets/ — visual, audio, and stage assets.
- docs/ — design decisions and project documentation.
- src/engine/ — timing, arena, and Canvas renderer.
- src/input/ — keyboard state and logical actions.
- src/movement/ — upcoming movement systems.
- src/combat/ — upcoming combat systems.
- src/characters/ — upcoming fighter definitions and move data.
- src/ui/ — browser presentation and future menus/HUD.
- tests/ — Node.js automated tests.
- index.html — browser entry point.

## Run locally
Requires Python 3 or another static HTTP server:

    python3 -m http.server 8000

Open http://localhost:8000.

Run automated tests with Node.js:

    npm test

No dependencies or build step are required.
