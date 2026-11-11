# BLT — Game Design Specification

This document records the decisions confirmed so far. Anything labelled **Open** is not yet a locked design decision.

## Identity and presentation

- **Name:** BLT — Belt to Ass.
- **Genre:** 2D traditional fighting game with anime-fighter influence; inspirations mentioned include Dragon Ball FighterZ and Melty Blood.
- **Initial platform:** Browser.
- **Visual direction:** Retro pixel art.
- **Character-to-arena scale:** Placeholder fighters render at 3× their original prototype size, targeting the larger on-screen fighter presence of anime fighters such as FighterZ and Melty Blood. Arena dimensions and movement physics remain unchanged; stage edge limits account for the wider bodies.
- **Early development art:** Placeholder sprites are acceptable while custom sprites are being developed.
- **Presentation:** Dark / black-grey visual direction.
- **Intro concept:** Start on a dark, silent screen with pixelated `START`. On any button press, a fighter punches through the START text; fast-paced music begins, the character appears on the right and poses, and menu options appear on the left.

## Match format

- 1v1 only for the initial game.
- Assist mechanics are a possible future addition, not part of the initial implementation.
- No tag-team system is planned for the initial version.

## Controls

| Action | Input | Behaviour |
|---|---|---|
| Forward | D or A | Relative to the direction the fighter is facing / opponent's side |
| Backward | A or D | Relative to the direction the fighter is facing / opponent's side |
| Ground dash | Double-tap forward or backward | Forward dash or backdash, respectively |
| Air dash | Double-tap forward or backward while airborne | Directional air dash |
| Jump | W | Neutral jump when no horizontal direction is held |
| Directional jump | W + A or W + D | Forward or backward jump, relative to facing direction |
| Crouch | S | Crouching |
| Light | H | Light attack |
| Medium | J | Medium attack |
| Heavy | K | Heavy attack |
| Special | L | Special input / attack |

Forward and backward must be relative directions, not permanently tied to a specific key. When the fighter changes sides, their forward/backward interpretation reverses. Directional jumping follows the same rule.

## Combat and special inputs

- Attack buttons: Light (H), Medium (J), Heavy (K), Special (L).
- All three special-input styles are intended to coexist:
  1. **Button-only:** L by itself performs a projectile.
  2. **Direction + button:** a direction combined with L performs a directional special.
  3. **Motion input:** a traditional motion such as quarter-circle forward + L performs an advanced special.
- The input system should be data-driven / extensible so different characters can receive different moves later.
- The game should be easy to learn but offer room for technical mastery.
- Fast, flashy combat and air combos are core goals.

## Movement feel and physics

- **Movement style:** Anime-fighter air control — fast movement, air combos, air dashes, and long combo possibilities.
- **Gravity:** Moderate — enough time for air combos, while falling should still feel natural.
- Ground forward dashes and backdashes share a cooldown so players cannot chain them continuously to cross the arena; the prototype starts at 0.45 seconds, subject to playtesting.
- Crouch-walking uses 50% of normal grounded walking speed; dash speed and airborne movement are unaffected.
- Air control is an intentional core mechanic.

Exact movement speeds, acceleration, jump height, gravity values, dash duration, hitstun, and cancel windows are **Open / to be tuned through playtesting**.

## Main menu

The initial main menu options, in this exact order:

1. Arcade
2. Online
3. Training
4. Option

These are menu destinations to plan for; their complete functionality will be implemented in stages.

## Scope and deferred features

- Initial playable target: two placeholder fighters in a simple arena, movement, attacks, health bars, and a basic round flow.
- Custom pixel-art sprites and animations will replace placeholders later.
- Assists are deferred and may be reconsidered after the 1v1 foundation is solid.
- Online multiplayer is a desired menu mode, but its technical implementation is a later phase.

## Open decisions

- Final programming language / framework / rendering technology.
- Detailed move lists and per-character identities.
- Exact movement and combat frame data / physics values.
- Blocking, throws, meter, resource systems, round count, timer, and win conditions.
- Online networking architecture and matchmaking approach.
- Audio direction and final sprite specifications.
