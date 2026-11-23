# BTA — Game Design Specification

This document records the decisions confirmed so far. Anything labelled **Open** is not yet a locked design decision.

## Identity and presentation

- **Name:** BTA — Belt to Ass.
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
- **Round-flow prototype defaults (not final balance rules):** 99 seconds per round; first to two round wins (best of three); a KO ends the round immediately; timeout awards the round to the fighter with more remaining health.
- A simultaneous KO or exact health tie at timeout is a drawn round and awards no point. The next round starts automatically after a short result/ready-up display.
- The match result remains visible until Enter is pressed to start a rematch. Space is also accepted as a confirmation key in the prototype.

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
| Light | H | High attack — can be crouched under |
| Medium | J | Mid attack — hits standing and crouching opponents |
| Heavy | K | Low attack — hits grounded opponents, misses airborne opponents |
| Special | L | Grounded: Energy Shot forward; airborne: Energy Shot diagonal down-forward; Quarter-Circle Forward + L launches Arc Lance |

Movement keys are screen-relative and never reverse when fighters cross: A always means left and D always means right. Fighters automatically turn to face the opponent. Whether a dash is classified as a forward dash or backdash is determined by comparing its screen direction with the fighter's facing direction.

## Stage and camera

- The prototype stage is 1,920 world units wide; the visible game viewport remains 960 × 540.
- The horizontal camera tracks the midpoint between both fighters and scrolls through the stage. Camera movement stops at the stage ends and keeps the controlled player within the visible viewport.
- HUD, timer, round banners, and command feedback are screen-space and do not move with the stage.
- This is a horizontal follow camera only. Dynamic zoom and vertical camera movement are deferred until browser playtesting shows they are needed.

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
- Stage center limits use a 68-unit margin to keep the current 136-unit ground shadow on-stage.
- Air dash holds vertical position for its 0.14-second burst, then gravity resumes; horizontal velocity returns to normal air speed (260 units/second) in the dash direction.
- A same-direction double-tap starts a dash; an intervening opposite-direction tap breaks the sequence, and the pair is consumed when a dash is attempted.

These dimensions and movement details are prototype values to validate in the browser, not final balance.

## Combat and special inputs

- Attack buttons: Light (H / High), Medium (J / Mid), Heavy (K / Low), Special (L).
- Attack height is separate from the move's strength and frame data. High attacks occupy the upper body and can be crouched under; Mid attacks cover the torso and catch standing or crouching opponents; Low attacks strike near the feet, hit grounded opponents, and pass under airborne opponents.
- Two special-input styles coexist:
  1. **Contextual button-only:** L performs the Energy Shot. When grounded it always travels straight forward relative to facing; when airborne it always travels diagonally down-forward relative to facing. Held movement directions never redirect the ordinary Special.
  2. **Motion input:** Quarter-Circle Forward + L performs the advanced Arc Lance projectile.

### Projectile special prototype (playtest rules)

- Pressing L while grounded fires an `Energy Shot` straight forward relative to the fighter's facing, regardless of held movement directions.
- Pressing L while airborne fires the same Energy Shot diagonally down-forward relative to facing (45 degrees down toward the opponent). This trajectory is fixed at launch; held A/D/W/S inputs do not alter it.
- The former eight-way `Vector Burst` free-aim behaviour is retired. Holding back, up, down, or opposing directions with L cannot make the ordinary projectile fire backward, vertically, or at arbitrary angles.
- The initial projectile can be used from the ground or air when the fighter has no active action or reaction. It uses 8 startup frames and 18 recovery frames at 60 Hz.
- Prototype projectile values: 540 arena units/second, 18-unit radius, 2.5-second lifetime, 8% hit damage, 18 frames of hitstun, and 280 units/second knockback. A block deals 0.8% chip damage and 25 guard-meter damage.
- The projectile is a mid and can be guarded with either standing or crouching guard. Once launched, it remains active even if the owner leaves recovery or is interrupted. Prototype values are for playtesting, not final balance.
- **Blocking:** Hold the screen direction opposite the opponent (away from the opponent) to guard. The required direction is resolved from the fighter's current facing, so the guard direction automatically changes when the fighters cross sides. This is deliberately separate from screen-relative movement: A always moves left and D always moves right.
- Quarter-Circle Forward + L is recognised relative to facing using Down → Down-Forward → Forward within a 24-frame window.
- The command launches **Arc Lance**: 14 startup / 26 recovery frames, 390 units/second speed, 26-unit radius, 14% damage, 24 hitstun frames, and 400 knockback. It applies 1.4% chip damage and 38 guard-meter damage on block.
- Arc Lance is slower and more punishable than Energy Shot, but has a larger projectile and greater reward. It shares the one-projectile-per-airtime resource with Energy Shot.
- The eight-frame buffer preserves Arc Lance identity and the facing direction from the motion input, and the move can be cancelled into from a confirmed Light / Medium attack.
- Light, Medium, Heavy, and Special button presses use an eight-fixed-frame input buffer when an action or reaction blocks immediate execution. A newer combat-button press replaces the pending one. Arc Lance identity and facing are captured when the motion input is pressed; ordinary Energy Shot trajectory is resolved from grounded / airborne state when it starts. Movement, guard, jump, and dash are not buffered; pending combat inputs are discarded when a round ends or resets.
- The input system should be data-driven / extensible so different characters can receive different moves later.
- The game should be easy to learn but offer room for technical mastery.
- Fast, flashy combat and air combos are core goals.

## Movement feel and physics

- **Movement style:** Anime-fighter air control — fast movement, air combos, air dashes, and long combo possibilities.
- **Gravity:** Moderate — enough time for air combos, while falling should still feel natural.
- Ground forward dashes and backdashes share a cooldown so players cannot chain them continuously to cross the arena; the prototype starts at 0.45 seconds, subject to playtesting.
- Crouch-walking uses 12.5% of normal grounded walking speed; dash speed and airborne movement are unaffected.
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

- Detailed move lists and per-character identities.
- Exact movement and combat frame data / physics values.
- Throws, meter, resource systems, and final competitive round/timer rules beyond the prototype defaults.
- Online networking architecture and matchmaking approach.
- Audio direction and final sprite specifications.


## Aerial projectile behavior (prototype)

- Energy Shot shares one air-projectile allowance with Arc Lance. Starting either move while airborne consumes the allowance; landing refreshes it. The projectile allowance is independent of the air-dash allowance.
- Starting an aerial projectile cancels horizontal drift and upward momentum. Horizontal movement remains locked for the special, but gravity continues during startup and recovery; the fighter falls naturally instead of hovering.
- The special keeps its existing startup and recovery timer if the fighter lands early. It remains locked on the ground until the original recovery finishes. No extra landing-recovery frames are applied in this prototype.
- A projectile started close to the floor still completes its startup and spawns on frame 8 even if the fighter lands first. The action remains locked until its normal recovery ends.
- The Forward/Up + L jump-then-shoot behavior remains out of scope for this rule change.


## Combo routes, aerial combat, and recovery (prototype)

- **Hit-confirm cancels only:** a normal attack can cancel only after it actually hits. A whiff or a blocked attack stays committed to its complete recovery. Light cancels into Medium, Heavy, or Special on the ground; Medium cancels into Heavy or Special. In the air, Light cancels into Medium or Special, while Medium cancels into Special. Heavy has no normal cancel route.
- **Jump-cancel routes:** a confirmed grounded Light or Medium can be cancelled into a jump. A grounded Medium hit launches the opponent upward with an initial 520 units/second vertical velocity. The launch is applied only when the target is grounded; later aerial hits do not repeatedly reset the juggle height.
- **Air attacks:** Light and Medium may be started while airborne. Heavy remains ground-only. Existing hit levels and hitboxes still apply, so the Low Heavy does not hit an airborne opponent.
- **Combo tracking:** each defender has one active combo record. A follow-up from the same attacker increments the hit count and cumulative actual damage. The link timer is 45 fixed frames and resets on each hit.
- **Damage scaling:** the first hit deals 100% of its move damage; each subsequent hit scales damage down by 10 percentage points, with a 40% floor. Hitstun and move recovery are not scaled in this first prototype.
- **Juggle rule:** a launched opponent may take up to three additional airborne hits from the same attacker. A fourth aerial follow-up is dropped, preventing an infinite air loop. The HUD displays the player's combo count, whether the route is aerial, and cumulative damage.
- These are first-pass gameplay values, not final balance. The launcher height, link window, cancel routes, juggle cap, and damage scaling need browser playtesting and later tuning.


## Placeholder fighter profiles and CPU opponent (prototype)

- **Player — Striker:** 300 arena units/second grounded walk speed; 1.00× outgoing damage.
- **CPU Rival:** 260 arena units/second grounded walk speed; 1.05× outgoing damage. The slower approach is offset by a small damage advantage.
- The browser match enables the CPU by default. Isolated Arena tests leave it disabled unless explicitly requested, keeping combat and movement regression tests deterministic.
- The CPU approaches using screen-relative movement, then rotates through Light, Medium, Heavy, and Energy Shot when within its attack range. After each attack it waits 30 neutral simulation frames before choosing another; attack, hitstun, blockstun, and guard lockout do not consume this breather. It uses the same state, attack, projectile, collision, damage, hitstun, round, and pushbox systems as the player.
- The CPU can guard a nearby active melee attack only after at least eight startup frames have elapsed. This deterministic reaction delay lets a 5-frame Light beat the CPU's reaction, while Medium (8 frames) is borderline and Heavy (12 frames) is reactable. It chooses crouch guard for Low attacks and standing guard otherwise; a cooldown prevents permanent blocking.
- The first CPU is deliberately deterministic rather than random, making playtesting and bug reproduction repeatable. AI timing and properties are prototype values, not character balance.


## Prototype stage — Neon Backstreet

- The first stage is a dark, stylised city backstreet built from Canvas geometry rather than external image assets.
- A distant skyline, lit windows, small BTA signs, stars, and a neon horizon sit behind the fighters. The foreground uses a tiled arena floor and subtle center / edge landmarks.
- Stage art is drawn in world coordinates, so the camera scrolls through the environment together with fighters and projectiles. HUD and match feedback remain fixed to the viewport.
- This is a presentation placeholder. Original pixel-art backgrounds, environmental animation, and music / sound are still future content work.


## Front-end flow, arcade, and training foundations (prototype)

- The game boots to an intro / START screen. Confirm with Enter or click to reach the main menu.
- The main-menu order is Arcade, Online, Training, Option. Keyboard navigation uses W / S or Up / Down, Enter to confirm, and Escape to go back.
- **Arcade** starts the local best-of-three match against the deterministic CPU Rival.
- **Training** starts with a passive dummy: round timer / score flow is frozen, the dummy does not attack, but it still runs normal knockback, gravity, and landing physics. Its health / guard meter automatically recover two seconds after the last registered hit or block. The pause menu offers a reset-position action.
- **Online** currently opens a clear not-connected-yet information screen. No matchmaking or networking is claimed or implemented.
- **Option** toggles combat hurtbox / hitbox overlays and the DOM state / frame-data inspector. Both overlays are off by default; Training mode can still be used without the inspector.
- These are the first mode-selection and training foundations. Character select, training reset controls, input recording, online transport, and expanded arcade progression remain future work.


## Review follow-up decisions — prototype

- **Training dummy physics:** the dummy is passive but not frozen in space. It receives knockback, gravity, and normal landing / ground-state updates. This makes launcher → juggle → grounded follow-up routes testable.
- **Combo end condition:** the 45-frame timer is a maximum safety timeout. A combo ends as soon as the defender's reaction returns to NONE; a recovered airborne fighter is not held under a stale juggle cap.
- **CPU reaction:** the CPU needs eight startup frames before it can reactively guard a visible melee move. This is intentionally deterministic and is still a difficulty-tuning value.
- **Stage separation:** fighters are capped to 824 arena units of horizontal separation (960-unit viewport less 68 units of margin on each side) so both remain visible without camera zoom.
- **Projectile floor contact:** downward-moving projectiles are removed on floor contact after checking whether they hit a fighter during that step.
- **Ground-state compatibility:** state-aware combat treats a missing `onGround` measurement as grounded for legacy fixtures; only explicit `false` is airborne.
- **Crouch vs crouch-guard trade-off:** as currently documented, crouching without guard ducks High attacks, while crouch-guard is Low guard and is vulnerable to High attacks. This is consistent with the current guard-height rules but may feel unintuitive; leave it unchanged until a browser playtest informs whether crouch-guard needs a change.


## Prototype combat impact feedback

- Confirmed hits create a brief expanding impact ring and a deterministic burst of directional sparks. The palette differentiates High / Mid / Low hits; Energy Shot / Arc Lance use a violet special-move accent.
- Blocks create a smaller blue impact response. Guard breaks use a larger, brighter violet burst and stronger shake.
- Screen shake is restrained, cosmetic-only, and limited to the world / fighter layer. HUD, timer, round banners, and menu UI stay stable.
- This first pass uses Canvas geometry and seeded particle motion. It does not change hitstop, frame data, collision, damage, or fighter physics. Final sprite-based VFX, authored animation, audio, and hitstop remain separate future work.


## Character definitions and animation pipeline (prototype)

- Each fighter is created from a named character definition rather than hard-coded Arena constructor stats. The initial registry contains Striker and CPU Rival and preserves the existing prototype values (300 / 1.00× and 260 / 1.05× respectively).
- Character definitions carry their own stats, normal-attack definitions, projectile definitions, animation clips, and optional sprite-sheet metadata. The combat controllers read each fighter's move set, so a character can override frame data or projectile tuning without changing global controller logic.
- Animation is advanced on the fixed simulation step. The clip selector prioritises hit reactions, then current action (normal, special, guard, dash), then locomotion (walk, crouch, jump, fall, idle). Clips specify atlas frame indices, frame duration, and whether they loop.
- The Canvas renderer supports an optional same-origin sprite atlas using uniform frame dimensions, columns, scale, and pivot metadata. If no atlas source is supplied or it has not loaded, the renderer keeps the existing placeholder fighter.
- This milestone is an extensible asset / data foundation, not finished character art. Both current profiles deliberately have no sprite-sheet source yet; original sprite sheets, character select, distinct move lists, portraits, and authored animations remain future work.
