# BLT — Belt to Ass

A browser-first 2D 1v1 anime-style fighting game. This repository is the source of truth for the game's code, assets, design decisions, and development plan.

## Current status

**Pre-production / project scaffold.** The folder structure and design documentation are being established before gameplay implementation begins. The current game uses placeholder visuals until custom pixel-art sprites are ready.

## Design at a glance

- 2D, side-view, 1v1 fighting; assists may be considered later.
- Anime-fighter movement: fast air control, air combos, and air dashes.
- Moderate gravity: enough airtime for combos without weightless falling.
- Keyboard controls: A/D for side-relative movement, W to jump, S to crouch, H/J/K/L for attacks.
- Main menu order: Arcade, Online, Training, Option.
- Browser is the first target platform.

See [the game design](docs/GAME_DESIGN.md) and [the roadmap](docs/ROADMAP.md).

## Repository layout

```text
assets/          Visual, audio, and stage assets
  sounds/
  music/
  sprites/
  stages/
docs/            Design decisions and project documentation
src/             Game source code, organized by responsibility
  characters/
  combat/
  engine/
  input/
  movement/
  ui/
tests/           Automated tests as systems are implemented
index.html       Browser entry point (game implementation not started)
```

## Development principles

1. Keep confirmed design decisions documented in `docs/GAME_DESIGN.md`.
2. Build and test gameplay systems incrementally.
3. Keep the main branch in a working state.
4. Use placeholder assets until custom art is ready; do not let placeholders dictate final art direction.
5. Treat online multiplayer as a later implementation phase, not a prerequisite for the first playable prototype.

## Running

The game runtime has not been implemented yet. Once the initial browser scaffold is in place, this section will contain the local run instructions.
