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
| Move left | A | Always moves toward the left side of the screen |
| Move right | D | Always moves toward the right side of the screen |
| Ground dash | Double-tap A or D | Dashes in the pressed screen direction; classified as forward dash or backdash based on facing |
| Air dash | Double-tap A or D while airborne | Air-dashes in the pressed screen direction |
| Jump | W | Neutral jump when no horizontal direction is held |
| Directional jump | W + A or W + D | Jumps left or right on screen, regardless of facing |
| Crouch | S | Crouching |
| Light | H | Light attack |
| Medium | J | Medium attack |
| Heavy | K | Heavy attack |
| Special | L | Special input / attack |

Movement keys are screen-relative and never reverse when fighters cross: A always means left and D always means right. Fighters automatically turn to face the opponent. Whether a dash is classified as a forward dash or backdash is determined by comparing its screen direction with the fighter's facing direction.

## Fighter states and stance

Fighters use explicit, centrally managed gameplay states. State must not be inferred indirectly from unrelated booleans such as `onGround`, `crouching`, or `dashRemaining`. The state system is the source of truth for what a fighter is doing and which transitions are legal.

Initial state vocabulary (some states may be introduced as their systems are implemented):

- **Standing / idle:** grounded, not moving or performing another action.
- **Walking:** grounded movement to the left or right.
- **Crouching:** low grounded stance; crouch-walking remains crouching.
- **Jumping / airborne:** takeoff and ordinary airborne movement.
- **Dashing:** ground dash; forward dash versus backdash remains a classification relative to facing.
- **Air-dashing:** the distinct airborne dash action.
- **Attacking:** an attack action with startup, active, and recovery phases.
- **Guarding:** a defensive action; standing guard and crouching guard are distinct stances.
- **Hitstun / blockstun:** temporary reactions that restrict normal control.
- **Knockdown / wake-up:** later combat states for grounded knockdown and recovery.

Implementation should separate the fighter's **locomotion/stance**, **current action**, and **reaction/lockout** where that avoids an unmanageable single flat enum. For example, facing direction and screen-relative input are not states; attack phase is data within an attack action. The state controller must define valid transitions and priority (for example, hitstun interrupts walking or an attack, while an attack's recovery prevents starting another ordinary attack).

State affects gameplay geometry and rules: standing and crouching use different pushbox and hurtbox profiles; airborne states use airborne geometry; attack hitboxes exist only during the relevant active frames. Pushboxes, hurtboxes, and attack hitboxes are separate concepts and must not be conflated.

Exact state names, transition rules, air-guard availability, and knockdown rules can be finalized alongside the relevant combat mechanics.

## Pushbox collision

- Fighters cannot walk or dash through one another while their pushboxes overlap both horizontally and vertically.
- Pushboxes are body-space separation volumes, not attack hitboxes or hurtboxes. Those systems remain separate.
- Initial placeholder dimensions are 55 arena units half-width, 70 units tall while standing, and 50 units tall while crouching. The box is anchored to the fighter's feet.
- Overlap is shared between both fighters where possible. A fighter pinned against a stage edge is not moved beyond it; the other fighter absorbs the remaining separation.
- Airborne fighters can pass over an opponent once their vertical pushbox ranges no longer overlap. The initial dimensions and jump-over window require playtesting.
- Stage center limits use a 68-unit margin to keep the current wide ground shadow inside the stage.
- Air dash holds vertical position for its 0.14-second burst, then gravity resumes; horizontal velocity returns to normal air speed (260 units/second) in the dash direction.
- A same-direction double-tap starts a dash; an intervening opposite-direction tap breaks the sequence, and the pair is consumed when a dash is attempted.

These dimensions and movement details are prototype values to validate in the browser, not final balance.

## Combat and special inputs

- Attack buttons: Light (H), Medium (J), Heavy (K), Special (L).
- All three special-input styles are intended to coexist:
  1. **Button-only:** L by itself performs a projectile.
  2. **Direction + button:** a direction combined with L performs a directional special.
  3. **Motion input:** a traditional motion such as quarter-circle forward + L performs an advanced special.
- **Blocking:** Hold the screen direction opposite the opponent (away from the opponent) to guard. The required direction is resolved from the fighter's current facing, so the guard direction automatically changes when the fighters cross sides. This is deliberately separate from screen-relative movement: A always moves left and D always moves right.
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
- Throws, meter, resource systems, round count, timer, and win conditions.
- Online networking architecture and matchmaking approach.
- Audio direction and final sprite specifications.
