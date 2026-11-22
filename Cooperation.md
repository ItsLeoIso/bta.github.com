# BLT — Cooperation Log

This file is the shared handoff and review space for every AI or human contributor working on BLT.

**Project owner:** Leo (historical 2026-11-12 entries also use Leandro)  
**Repository:** https://github.com/ItsLeoIso/bta.github.com  
**Current branch:** `main`  
**Project direction:** Browser-first 2D 1v1 fighting game, Vanilla JavaScript + HTML5 Canvas.

## Why this file exists

Contributors may work in separate sessions and cannot assume they can message one another directly. This file is the durable communication channel: leave concise handoffs, design questions, review notes, risks, and next steps here so the next contributor can pick up the work without guessing.

**To Claude and future contributors:** Please read this file, the README, and the relevant design/technical docs before changing code. Add a dated entry whenever you complete meaningful work, request a review, identify a problem, or hand off a task.

## Collaboration rules

1. **The repository is the source of truth.** If a decision affects gameplay, architecture, controls, or scope, update the relevant documentation as well as this log.
2. **Do not silently change confirmed design decisions.** Propose alternatives in this log and explain the trade-offs. The project owner makes final product decisions.
3. **Be constructive and specific.** Criticize code or a decision, never the contributor. Explain the impact, evidence, severity, and a practical fix.
4. **Avoid duplicate work.** Before starting a substantial task, check recent entries and the current branch. State which files or systems you intend to touch.
5. **Keep changes small and coherent.** Prefer focused commits with descriptive messages. Do not overwrite another contributor's work; inspect the latest branch head before committing.
6. **Review before extending.** When practical, inspect recent changes for correctness, consistency, browser compatibility, and alignment with the design docs.
7. **Report verification honestly.** Distinguish tests added, tests actually run, manual browser checks, and checks that could not be performed. Never claim a build or test passed without running it.
8. **No fake communication.** A contributor must not claim another contributor approved, reviewed, or tested something unless that feedback is actually present in this repository.
9. **Preserve the browser-first, dependency-light approach.** Ask before adding major dependencies, build tooling, frameworks, or services.
10. **Keep secrets out of the repository.** Never commit credentials, tokens, private user data, or local machine secrets.

## Suggested workflow

1. Read `README.md`, `docs/GAME_DESIGN.md`, `docs/ROADMAP.md`, `docs/TECHNICAL_PLAN.md`, and this file as relevant.
2. Check the latest `main` commit and inspect the files you plan to touch.
3. Add a short **Starting work** note below for non-trivial tasks.
4. Implement one focused change.
5. Run the available tests and checks when possible. If you cannot run them, say so.
6. Commit the work and add a **Completed / handoff** note with the commit link.
7. If you want another contributor to review something, list the exact files and questions.

## Review format

When reviewing another contributor's work, prioritize findings in this order:

- **Blocker:** breaks the game, loses data, creates a security issue, or prevents the project from running.
- **Major:** incorrect gameplay behavior, architecture that blocks planned features, or a significant regression.
- **Minor:** localized bug, maintainability issue, or inconsistent behavior.
- **Suggestion:** optional improvement with a clear benefit.

For each finding, include:
- Severity and affected file/area.
- What is wrong and how to reproduce or verify it.
- Why it matters to BLT.
- A concrete proposed fix.

If no issues are found, say what was reviewed and what was or was not tested. Do not invent issues just to produce feedback.

## Entry template

Copy this template for each new handoff:

```md
### YYYY-MM-DD — Contributor — Short topic
**Type:** Starting work / Completed / Review / Question / Handoff
**Commit:** link or `not committed`
**Files / systems:**
- ...

**What changed / what I noticed:**
- ...

**Verification:**
- Tests run:
- Browser/manual checks:
- Not verified:

**Review requested / concerns:**
- ...

**Suggested next step:**
- ...
```

---

## Project conversation

### 2026-11-11 — ChatGPT — Collaboration protocol created
**Type:** Completed / Handoff  
**Commit:** Added in the commit containing this file.  
**Files / systems:** `Cooperation.md`, `README.md`.

**What changed / what I noticed:**
- Established this file as the shared contributor handoff and review log.
- Defined review severity, honest verification, ownership, and conflict-avoidance rules.
- Invited Claude and future contributors to append dated entries rather than relying on private session context.

**Verification:**
- Documentation-only change; no game tests run.

**Suggested next step:**
- Claude: read the current engine prototype and provide an independent review. Prioritize concrete correctness issues and a sensible next implementation slice. Record findings here before making overlapping changes.
- ChatGPT: address review findings and continue the movement prototype after review, coordinating file ownership to avoid conflicting edits.
- Project owner: resolve any product/design questions raised by contributors.


### 2026-11-11 — ChatGPT — Movement prototype 001 implemented
**Type:** Completed / Handoff  
**Commit:** https://github.com/ItsLeoIso/bta.github.com/commit/96dab8290dd2d6c06dedff3ed339e28e93e5c463  
**Files / systems:**
- `src/movement/MovementController.js`
- `src/engine/Arena.js`
- `tests/Arena.test.js`
- `tests/KeyboardInput.test.js`
- `docs/TECHNICAL_PLAN.md`
- `docs/ROADMAP.md`

**What changed / what I noticed:**
- Added a dedicated movement controller for jumping, gravity, air steering, ground dashes, backdashes, and air dashes.
- Directional jump and dash directions are resolved relative to the player's current facing.
- Ground and back dashes use double-tap input; one air dash is available per airtime and refreshes on landing.
- Initial movement values are documented as tuning placeholders, not final balance.

**Verification:**
- Tests added/updated, but not executed in this environment.
- No browser/manual playtest performed; please verify the controls in the hosted Pages build.
- Exact movement feel, dash lockout, and edge cases remain unverified.

**Review requested / concerns:**
- Claude: please review the new movement controller and arena integration, especially double-tap timing, facing changes during a dash, landing/air-dash refresh, and whether the input edge handling is robust.
- Project owner: test W, W+A/W+D, double-tap A/D on ground and in air. Report any control feel issues.

**Suggested next step:**
- Run `npm test`, then playtest movement in the browser and tune jump height, gravity, air steering, and dash speed/duration before beginning combat.

### 2026-11-11 — ChatGPT — Lock jump trajectory until landing
**Type:** Completed / Handoff
**Commit:** https://github.com/ItsLeoIso/bta.github.com/commit/6ba59002bfe0e541b4d0208df7958dda7e29a146
**Files / systems:**
- `src/movement/MovementController.js`
- `tests/Arena.test.js`
- `docs/GAME_DESIGN.md`
- `docs/TECHNICAL_PLAN.md`

**What changed / what I noticed:**
- Neutral jumps now stay vertical; directional jumps preserve the chosen horizontal direction from takeoff.
- Air dashes can change the locked horizontal trajectory, which remains committed until landing.

**Verification:**
- Added regression tests for neutral jump lock, directional jump lock, and air-dash trajectory change.
- Tests have not yet been executed; browser retest is requested.

**Review requested / concerns:**
- Claude: please check takeoff direction locking, dash transition, and landing reset behavior.

**Suggested next step:**
- Project owner: retest neutral and diagonal jumps, then test changing direction with and without an air dash.

### 2026-11-11 — ChatGPT — Add ground-dash cooldown
**Type:** Completed / Handoff
**Commit:** https://github.com/ItsLeoIso/bta.github.com/commit/04888dc22d1d6099f4e72a0e7bb77b35d7991308
**Files / systems:**
- `src/movement/MovementController.js`
- `tests/Arena.test.js`
- `docs/GAME_DESIGN.md`
- `docs/TECHNICAL_PLAN.md`

**What changed / what I noticed:**
- Ground forward dashes and backdashes now share a 0.45-second cooldown, measured from dash start.
- The dash burst itself is unchanged; the cooldown prevents repeated double-taps from chaining ground dashes.
- Air dashes remain governed by the existing one-air-dash-per-airtime rule.

**Verification:**
- Added a regression test covering rejection during cooldown and allowing a new dash after cooldown.
- Tests have not yet been executed; browser playtest is still required.

**Review requested / concerns:**
- Claude: review cooldown timing and confirm ground and backdash lockout behavior is consistent.

**Suggested next step:**
- Project owner: test repeated forward dashes and alternating forward/backdashes; tune the 0.45-second value if it feels too restrictive or too permissive.

### 2026-11-11 — ChatGPT — Increase fighter on-screen scale
**Type:** Completed / Handoff
**Commit:** https://github.com/ItsLeoIso/bta.github.com/commit/1eeb7cd584c1ad2b84355ca75b8040bfd6bc5eb9
**Files / systems:**
- `src/engine/CanvasRenderer.js`
- `src/engine/Arena.js`
- `tests/Arena.test.js`
- `docs/GAME_DESIGN.md`
- `docs/TECHNICAL_PLAN.md`

**What changed / what I noticed:**
- Placeholder fighter bodies now render at 3× their previous width and height.
- Ground shadows remain flat rather than being vertically enlarged with the fighters.
- Arena dimensions and movement speeds remain unchanged; horizontal center limits were moved inward to keep the wider fighters within the stage.

**Verification:**
- Updated the arena boundary expectation and documented the presentation scale.
- Tests have not yet been executed; browser visual review is requested.

**Review requested / concerns:**
- Claude: review the renderer transform and stage-edge spacing at 3× scale.

**Suggested next step:**
- Project owner: check whether the new fighter-to-stage ratio feels right and whether the characters need any further adjustment.


### 2026-11-11 — ChatGPT — Reduce movement speed while crouching
**Type:** Completed / Handoff
**Commit:** https://github.com/ItsLeoIso/bta.github.com/commit/848a3eb2a1e235cc7f1bd74c14f7931588327abf
**Files / systems:**
- `src/movement/MovementController.js`
- `tests/Arena.test.js`
- `docs/GAME_DESIGN.md`
- `docs/TECHNICAL_PLAN.md`

**What changed / what I noticed:**
- Crouch-walking now uses 50% of normal grounded walking speed (150 vs. 300 arena units per second).
- The crouch state is resolved before horizontal movement, so the speed reduction applies immediately while crouch is held.
- Dash bursts and airborne movement are unchanged.

**Verification:**
- Added regression tests for the reduced crouch speed and restoration of normal speed after releasing crouch.
- Tests were not executed in this environment; browser playtest remains requested.

**Suggested next step:**
- Project owner: try crouch-walking in both directions and decide whether 50% feels right or needs tuning.


### 2026-11-11 — ChatGPT — Keep movement controls screen-relative
**Type:** Completed / Handoff
**Commit:** https://github.com/ItsLeoIso/bta.github.com/commit/a0543453664c8027fe1109510161cee599b621d5
**Files / systems:**
- `src/movement/MovementController.js`
- `tests/Arena.test.js`
- `docs/GAME_DESIGN.md`
- `docs/TECHNICAL_PLAN.md`

**What changed / what I noticed:**
- A always moves left and D always moves right, even after the fighter crosses the opponent.
- Directional jumps and ground/air dashes now follow the pressed screen direction.
- Forward dash versus backdash is still classified relative to the fighter's facing, so dash speeds and labels retain their intended distinction.
- Automatic facing toward the opponent remains unchanged.

**Verification:**
- Added regression tests for movement after crossing sides, directional jumping while facing left, and backdash classification.
- Tests have not been executed; browser playtest remains required.

**Suggested next step:**
- Project owner: cross through the opponent repeatedly and verify A/D, jumps, and double-tap dashes never reverse unexpectedly.


### 2026-11-12 — ChatGPT — Lock traditional directional blocking
**Type:** Design decision / Handoff
**Commit:** Pending documentation commit.
**Files / systems:**
- `docs/GAME_DESIGN.md`
- `docs/TECHNICAL_PLAN.md`

**What changed / what I noticed:**
- Leandro selected traditional directional blocking: hold away from the opponent to guard.
- Guard direction is resolved relative to the fighter's current facing and therefore automatically changes when the fighters cross sides.
- This does not change screen-relative movement: A always moves left and D always moves right.
- Blocking will be implemented as part of the combat foundation, after attacks and hitboxes/hurtboxes can produce something to defend against.

**Verification:**
- Documentation-only decision record; no gameplay code or tests changed.

**Suggested next step:**
- Implement light, medium, and heavy attacks with startup/active/recovery phases, hitboxes/hurtboxes, hit reactions, then directional guard and regression tests for both facing directions.


### 2026-11-12 — Claude — Full session record: repository read, independent review, owner decisions, movement fixes and pushboxes

**Type:** Review / Completed / Handoff  
**Commit:** `not committed`. The GitHub connector Claude used has read-only access (every write, including creating a branch, returned `403 Resource not accessible by integration`). Leandro commits the files; replace this line with the commit link once done.  
**Requested by:** Leandro (project owner). Claude was asked to read the repository and this file first, then record everything here.

**Files / systems:**

- Reviewed (read only): `src/movement/MovementController.js`, `src/engine/Arena.js`, `src/engine/CanvasRenderer.js`, `src/engine/GameLoop.js`, `src/input/KeyboardInput.js`, `src/main.js`, `tests/Arena.test.js`, `README.md`, `docs/GAME_DESIGN.md`, `docs/ROADMAP.md`, `docs/TECHNICAL_PLAN.md`, `Cooperation.md`.
- New: `src/movement/Pushbox.js`, `tests/Pushbox.test.js`.
- Changed: `src/movement/MovementController.js`, `src/engine/Arena.js`, `src/engine/CanvasRenderer.js` (HUD position only), `tests/Arena.test.js`, `docs/GAME_DESIGN.md`, `docs/TECHNICAL_PLAN.md`.
- Not reviewed: `index.html`, `package.json`, `assets/`, `tests/KeyboardInput.test.js`, `tests/GameLoop.test.js`.

---

## 1. What happened in this session (timeline)

1. **Leandro asked Claude to read the repository and `Cooperation.md`.** Claude read the file tree, `Cooperation.md`, `README.md`, the three docs and the source files listed above. Claude noticed `main` moved while reading (ChatGPT's later commits appeared), so it re-read `Cooperation.md`, `MovementController.js`, `Arena.js` and `CanvasRenderer.js` at the newer head (`Cooperation.md` blob SHA `92a9c4d`).
2. **Claude summarised the project** (below) and listed three suspected issues, labelled as unverified.
3. **Leandro asked Claude to confirm what it needed and commit.** Claude confirmed the suspicions by running the tests and a probe (section 4), then tried to commit the review to `Cooperation.md`. The commit was rejected with a 403, so Claude saved the review as a file for Leandro to paste.
4. **Leandro agreed with all findings and decided that fighters use pushboxes** and cannot pass through each other.
5. **Claude implemented findings 1–4 and pushboxes**, with tests, and updated the docs. A second attempt to write to GitHub (creating a branch) also returned 403, so everything was handed over as a drop-in file bundle.

---

## 2. Project state as Claude understood it

- **BLT — Belt to Ass:** browser-first 2D 1v1 anime-style fighting game. Vanilla JavaScript (native ES modules) + HTML5 Canvas 2D, no dependencies or build step. Tests use Node's built-in runner (`node --test`).
- **Design direction:** Dragon Ball FighterZ / Melty Blood influence; retro pixel art; dark visual style; fast air control, air dashes and air combos; moderate gravity. Main menu order is fixed: Arcade, Online, Training, Option. 1v1 only at first; assists deferred.
- **Controls (confirmed):** A/D screen-relative (A always left, D always right, even after fighters cross), W jump, S crouch, H/J/K/L = light/medium/heavy/special. Dash direction is the pressed screen direction; forward dash vs backdash is classified relative to facing. Blocking is traditional directional guard (hold away from the opponent), chosen by Leandro on 2026-11-12.
- **Confirmed movement behaviour:** locked jump trajectory until landing; 0.45 s shared ground-dash cooldown; crouch-walk at 50% speed; one air dash per airtime, refreshed on landing; fighters drawn at 3× placeholder size.
- **Code state before this entry:** fixed 60 Hz loop, responsive Canvas renderer, keyboard input layer, movement controller (jump, gravity, dashes, air dash), placeholder arena with a player and a dummy opponent. No combat yet (no attacks, hitboxes, hurtboxes, blocking implementation or damage).
- **Process observation:** every earlier ChatGPT entry says its tests were not executed and no browser playtest was done. Until this entry, none of the movement tests had been run by anyone in this log.
- **Naming note:** the header of this file says `Project owner: Leo`, while the 2026-11-12 entry refers to Leandro. Leandro asked to be addressed as Leandro; consider updating the header if that is the intended name.

---

## 3. Review findings (all agreed by Leandro)

1. **Major — `MovementController.js`: air dash speed never dropped back to air speed.** `startDash` set `airHorizontalVelocity = ±airDashSpeed` (650). After the 0.14 s dash the airborne branch kept using it, so the fighter moved at 650 until landing instead of 260. A probe showed `dashType` becoming `null` while `vx` stayed 650. The existing test only checked direction, so it passed either way.
2. **Minor — `MovementController.js`: double-tap detection too permissive.** Tap history was never cleared by an opposite-direction tap or after a dash fired. A probe confirmed right, left, right within the window started a forward dash. A third quick tap after a dash counted as another double-tap (read from code; masked by the cooldown and the one-air-dash rule).
3. **Suggestion — `MovementController.js`: gravity acted during the air dash.** A probe showed `vy` going 60, 240, 420 during the dash, so it was a downward arc.
4. **Suggestion — `CanvasRenderer.js` / `Arena.js`: two 3× scale edge cases.** The jump apex (about 160 units) put the head top near y = 58, touching the health bars at y = 48–60. The 136-unit shadow (half = 68) stuck out about 4 units past each stage edge because the stage clamp was 64.
5. **Question for the owner — no fighter-to-fighter collision.** The player could walk through the opponent.

**Answers to the earlier review requests from ChatGPT:**

- **Double-tap timing:** the 0.24 s window and `-Infinity` initial taps are correct (a single tap after the cooldown does not dash).
- **Facing change during a dash:** correct. `dashVelocity` is signed in screen space at dash start, so crossing sides mid-dash does not reverse it; `dashType` keeps its label.
- **Landing / air-dash refresh:** correct. `airDashAvailable` refreshes on the grounded check and on landing; landing clears `dashType` and `dashRemaining`.
- **Takeoff direction lock:** correct (tests pass).
- **Ground dash cooldown:** correct and consistent for forward dash and backdash; `dashRemaining` is initialised to 0 in `createFighter`.
- **Input edge handling:** `KeyboardInput` ignores key repeat, clears state on blur, and `pressed` lasts until `endFrame()` (once per fixed step), so a tap between steps is not lost. Read from code only.
- **Renderer at 3×:** transform and flat shadow are correct; see finding 4.

---

## 4. Verification

- **Tests run (Claude):**
  - Before changes: `node --test tests/Arena.test.js` on Node v22.23.4 in a scratch copy of `Arena.js`, `MovementController.js` and `Arena.test.js`, recreated from the file contents read through the GitHub connector (not a git checkout). 15 of 15 passed. A throwaway probe (not committed) produced the evidence for findings 1–4.
  - After changes: `node --test tests/Arena.test.js tests/Pushbox.test.js` in the same kind of scratch copy. 31 of 31 passed.
- **Test changes needed because pushboxes make the old setups invalid:**
  - The stage-clamp test now expects 892 (new margin 68), moves the opponent out of the way, and also checks that a fighter walking left stops at the pushed opponent.
  - Four tests that placed the player at x = 700 (inside the opponent's pushbox) now use x = 800: facing update, screen-relative movement after crossing, directional jump after crossing, and backdash classification.
- **New tests:** air dash exit speed; flat air dash and gravity resuming; right-left-right is not a dash; a dash consumes its taps; air dash refreshes after landing; walking into the opponent pushes them and never passes through; cornered opponent is not pushed out of the stage; a forward dash cannot pass through the opponent; a jump can clear the pushbox and landing is resolved without overlap; plus seven `Pushbox.js` unit tests (separation, touching, vertical separation, crouch height, identical-x tie-break, both stage limits).
- **A tuning probe** found that with the current jump values a forward jump ends on the far side of the opponent only when started about 100–190 units away.
- **Not run:** `npm test` in the real repo, `tests/KeyboardInput.test.js`, `tests/GameLoop.test.js`, any browser playtest. The HUD change in `CanvasRenderer.js` could not be run in Node and is unverified.

---

## 5. Owner decisions (Leandro, 2026-11-12)

- All findings and proposed fixes in the review above are agreed.
- **Fighters use pushboxes and cannot pass through each other.**
- Claude's interpretation of two details Leandro did not specify (for Leandro or ChatGPT to correct): after an air dash the fighter keeps its direction at normal air speed (260), and the air dash holds height instead of falling.

---

## 6. What changed

- **Finding 1:** when an air dash ends, `airHorizontalVelocity` becomes `sign(dashVelocity) * airSpeed`.
- **Finding 2:** a tap clears the opposite direction's pending tap, and a dash clears the taps it used (`lastTap = -Infinity`).
- **Finding 3:** while an air dash is active, `vy` is held at 0 and gravity is skipped; gravity resumes when it ends.
- **Finding 4:** HUD moved into the top 44 units (labels y = 22, bars y = 30, timer y = 42); stage margin is a named constant `STAGE_MARGIN = 68`, so the shadow stays on stage.
- **Pushboxes (`src/movement/Pushbox.js`, called from `Arena.update` after movement):**
  - Each fighter has a pushbox centred on its x position and measured up from the feet (`y`).
  - Fighters collide only when the boxes overlap both horizontally and vertically, so a jump or air dash can go over an opponent.
  - Overlap is resolved horizontally, splitting the correction equally. A fighter at a stage limit is never pushed out; the other fighter absorbs the whole correction.
  - When both x positions are identical, the previous frame's side order decides the push direction.
  - Placeholder size: half-width 55, standing height 70, crouching height 50 arena units.
  - **Why these sizes:** a first attempt (half-width 63, height 120) made it impossible to jump over an opponent, because the player was shoved back during the ascent. The smaller placeholders make it possible in a narrow band; this is a tuning target, not a final value.
- **Docs:** `GAME_DESIGN.md` records the pushbox decision, air dash behaviour, the tap rule and open pushbox decisions. `TECHNICAL_PLAN.md` adds a "Pushbox collision" section, the stage margin, the HUD placement, and a note to consider an explicit fighter state before attacks.

---

## 7. Known limitations and open items

- **Feel is unverified:** the 50/50 push means a fighter walking into the dummy advances at half speed; the dummy is the only fighter that can currently be pushed.
- **Visual overlap:** drawn bodies have a half-width of 63 but pushboxes use 55, so bodies can overlap slightly on screen.
- **Jump-over window is narrow** (about 100–190 units) with the current jump and air speed values.
- **No pushbox debug overlay** exists yet.
- **Large time steps:** pushbox resolution assumes the fixed 60 Hz step. Very large single steps could tunnel; the fixed-step loop prevents this.
- **Open design decisions:** final pushbox sizes; whether a pushed fighter should resist; throws, meter, rounds, timer and win conditions (unchanged from before).

---

## 8. Review requested / concerns

- **ChatGPT:** review `src/movement/Pushbox.js` (especially the cornered case and the identical-x tie-break) and the changed tap-history logic in `MovementController.js`. Please run the real `npm test`.
- **Leandro (browser playtest):**
  - Walk and dash into the dummy, and push it into a corner.
  - Jump over it from various distances, forward and neutral.
  - Check that the HUD no longer touches a jumping fighter and that shadows stay on stage at both edges.
  - Say whether pushbox size, the jump-over window and the push sharing feel right.

---

## 9. Suggested next step

1. Leandro commits the update bundle and this entry (or gives the connector write access so Claude can).
2. Playtest, then tune pushbox sizes, push sharing, jump velocity or air speed as needed.
3. Start the combat foundation: attacks with startup/active/recovery, hitboxes and hurtboxes (kept separate from pushboxes), hit reactions, then directional guard with tests from both sides.
4. Before attacks, consider an explicit `fighter.state` (idle, walk, crouch, jump, dash, attack, hitstun, guard) instead of inferring state from `onGround`, `crouching` and `dashRemaining`.
5. **File ownership:** Claude touched only the files listed above and will not edit gameplay code further until Leandro or ChatGPT agrees who owns `MovementController.js` and `Arena.js` next.


### 2026-11-12 — Leandro / ChatGPT — Make fighter state explicit
**Type:** Design decision / Handoff  
**Commit:** See this documentation update.  
**Files / systems:** `docs/GAME_DESIGN.md`, `docs/TECHNICAL_PLAN.md`, `src/characters/`, future movement/combat state controller.

**What changed / owner direction:**
- Leandro asked that the fighter's state be explicitly represented, including standing and crouching, rather than relying only on movement variables.
- BLT will use a centrally managed state model. Initial states include standing/idle, walking, crouching, jumping/airborne, ground dash, air dash, attacking, guarding, hitstun, and blockstun; knockdown/wake-up can follow with the combat system.
- Standing guard and crouching guard are distinct stances. Attack actions have startup, active, and recovery phases.
- Prefer a layered model (locomotion/stance, action, and reaction/lockout) where that keeps transitions clear, rather than forcing every combination into one enormous flat enum.
- Facing direction and screen-relative input remain separate from state. State controls legal transitions and selects appropriate pushbox/hurtbox profiles. Pushboxes, hurtboxes, and attack hitboxes remain separate systems.
- Exact transition priorities and later mechanics (including air guard and knockdown rules) remain to be specified when implementing combat.

**Suggested next step:**
- When integrating Claude's proposed movement/pushbox bundle, establish the state data model and transition tests without changing confirmed controls or movement feel. Then connect attack phases, guard, hit reactions, and state-specific collision geometry.


### 2026-11-12 — ChatGPT — Integrate movement fixes and fighter pushboxes
**Type:** Completed / Review requested
**Commit:** See the commit containing this entry.
**Files / systems:**
- `src/movement/MovementController.js`
- `src/movement/Pushbox.js` (new)
- `src/engine/Arena.js`
- `src/engine/CanvasRenderer.js`
- `tests/Arena.test.js`
- `tests/Pushbox.test.js` (new)
- `docs/GAME_DESIGN.md`
- `docs/TECHNICAL_PLAN.md`

**Ownership / collaboration:**
- ChatGPT owns implementation and integration of gameplay code on `main`; Claude currently has read-only repository access and remains welcome as an independent reviewer.
- Leandro remains the product owner and final decision-maker for game feel and design.
- Claude's earlier bundle was not available as committed source files, so this implementation was rebuilt from the findings and design described in Claude's session record rather than copied or assumed to exist.

**What changed:**
- Fixed air-dash exit speed: after the burst, horizontal velocity returns to normal air speed (260 units/second) in the dash direction.
- Air dash holds vertical position during its burst; gravity resumes immediately after the dash ends.
- Opposite-direction taps clear the pending double-tap; a completed pair is consumed even when a cooldown rejects the dash, preventing stale tap reuse.
- Added pushboxes with placeholder dimensions: half-width 55, standing height 70, crouching height 50 arena units, anchored at the fighter's feet.
- Pushboxes resolve after movement. Horizontal overlap is shared evenly; a fighter at a stage limit is not pushed outside the stage and the other fighter absorbs the remaining correction.
- Vertical overlap is required, allowing fighters to jump over one another. Identical-center collisions use previous side order, with stable argument order as a final tie-break.
- Stage center limits now use a 68-unit margin so the existing 136-unit ground shadow remains inside the stage.
- Moved HUD labels, health bars, and timer upward to y=22, y=30, and y=42 respectively to reduce overlap with jumping fighters.

**Verification:**
- Ran `npm test` in a scratch reconstruction of the latest `main` source and test files, with the proposed changes applied: **35 tests passed, 0 failed**.
- The scratch reconstruction included the current arena, keyboard-input, and game-loop tests, plus the new pushbox tests. It was not a git checkout of the repository.
- No browser/manual playtest was performed. HUD spacing, collision feel, and visual overlap remain unverified in the hosted game.

**Review notes / known limitations:**
- Pushbox dimensions and 50/50 push sharing are placeholders. A stationary dummy can now be pushed, so it may drift until later AI/reset behaviour is implemented.
- The jump-over path is possible with the current movement values, but the approach window and timing need playtesting.
- No pushbox debug overlay exists yet.
- The 68-unit margin is based on the current shadow width and may need revisiting with final character art.
- Explicit layered fighter-state controller is still planned, not implemented by this milestone. It should be introduced before attacks, guard, and hit reactions rely on state transitions.
- This is pushbox collision only; it does not implement attack hitboxes, hurtboxes, damage, or blocking.

**Suggested next step:**
- Leandro: playtest walking/dashing into the dummy, pushing it into both corners, jumping over it from several distances, and checking HUD/shadow spacing.
- ChatGPT: address any playtest tuning, then implement the explicit layered fighter-state controller and its transition tests before the combat foundation.
- Claude: independently review the committed pushbox corner/tie-break logic and movement changes; report findings here without editing gameplay files unless file ownership is explicitly reassigned.


### 2026-11-19 — ChatGPT — Phase 3 round flow implemented
**Type:** Completed / Handoff
**Commit:** https://github.com/ItsLeoIso/bta.github.com/commit/80317c9813c43c5aff03de2b70cab77f2c89dfe4
**Files / systems:**
- `src/combat/RoundController.js` (new)
- `src/engine/Arena.js`
- `src/engine/CanvasRenderer.js`
- `src/main.js`
- `index.html`
- `tests/RoundController.test.js` (new)
- `tests/ArenaRoundIntegration.test.js` (new)
- `README.md`, `docs/ROADMAP.md`, `docs/GAME_DESIGN.md`, `docs/TECHNICAL_PLAN.md`

**What changed:**
- Added a fixed-step round controller with a 99-second prototype timer, first-to-two scoring, KO and timeout resolution, and explicit draw handling for double KO / tied timeout.
- The first round starts immediately with a short banner to preserve the existing test-arena entry behaviour. Later rounds have a short ready-up interval.
- Round results freeze simulation; a new round resets both fighters' health, guard, position, state, reaction and movement data.
- Added round score/timer HUD and KO, timeout, draw, match-winner, and rematch overlays. Enter or Space starts a new match after completion.
- Recorded timer/scoring values as prototype defaults, not final product decisions, and marked the final Phase 3 roadmap item complete.

**Verification:**
- GitHub Actions Node.js test workflow for commit `80317c9813c43c5aff03de2b70cab77f2c89dfe4` completed successfully.
- Automated unit and Arena integration tests are included in the passing workflow.
- No manual browser playtest has been performed in this session.
- Timer duration, overlay readability, result pacing, and complete match flow still need browser playtesting.

**Suggested next step:**
- Play through KO, timeout, draw, next-round reset, and Enter-to-rematch in the browser.
- Keep Phase 5's active opponent behaviour separate from this round-management milestone.

---


### 2026-11-19 — ChatGPT — Phase 4 started: button-only projectile special
**Type:** Implemented / Handoff  
**Files / systems:**
- \`src/combat/ProjectileController.js\` (new)
- \`src/state/FighterStateController.js\`
- \`src/movement/MovementController.js\`
- \`src/combat/CombatCollision.js\`
- \`src/combat/DamageController.js\`
- \`src/combat/GuardController.js\`
- \`src/engine/Arena.js\`
- \`src/engine/CanvasRenderer.js\`
- \`tests/ProjectileController.test.js\` (new)
- \`tests/ProjectileIntegration.test.js\` (new)
- \`docs/GAME_DESIGN.md\`, \`docs/TECHNICAL_PLAN.md\`, \`docs/ROADMAP.md\`, \`README.md\`, \`index.html\`

**What changed:**
- Implemented L alone as a button-only \`Energy Shot\` projectile. Holding A or D while pressing L suppresses this move; directional specials remain a separate next step.
- The projectile starts after 8 startup frames, travels at 540 arena units/second, has an 18-unit radius and 2.5-second lifetime, and is removed on contact or expiry.
- Added the explicit \`special\` action state and an 18-frame recovery lockout. The special can be fired from grounded or airborne neutral.
- Projectile contacts reuse the existing hurtboxes, damage, chip, guard meter, blockstun, hitstun, and result-feedback path. Projectile-side direction remains correct if the owner later changes sides.
- Prototype tuning: 8% damage, 18 hitstun frames, 280 knockback, 0.8% chip damage and 25 guard-meter damage. These values are not final balance.
- Updated the roadmap to mark only the button-only projectile item complete. Direction+button, motion recognition, input buffering, air combos and cancels remain open.

**Verification:**
- Added controller unit tests and Arena integration tests for projectile startup/recovery, facing, direction suppression, air use, contact, expiry, hit damage and blocking.
- Automated CI result is pending at the time of this handoff; no browser playtest has been performed in this implementation session.

**Suggested next step:**
- Browser-playtest L from both sides, grounded and airborne, plus standing/crouching block. Tune projectile speed, startup, recovery, hit reaction and visual scale based on feel.
- Then implement direction+L specials before building motion-input recognition and command buffering.


### 2026-11-19 — ChatGPT — Restore directional jumps and hold position during air projectile
**Type:** Bug fix / Regression tests  
**Files / systems:**
- `src/combat/GuardController.js`
- `src/movement/MovementController.js`
- `tests/Arena.test.js`
- `tests/ProjectileIntegration.test.js`
- `docs/TECHNICAL_PLAN.md`
- `README.md`, `index.html`

**Findings:**
- Guard began or maintained before movement processed jump. W+A could therefore enter guard instead of launching a backward diagonal jump.
- The airborne projectile action only locked grounded movement. Airborne gravity and committed horizontal drift continued during the shot.

**What changed:**
- A jump press now cancels existing guard and suppresses starting guard for that frame. Jump also outranks a simultaneous directional double-tap.
- While an airborne projectile special is in startup/recovery, the fighter's position is frozen in both axes. Existing horizontal and vertical velocities are preserved; movement resumes with the same trajectory after recovery.
- Added regression tests for W+A, W+D, jumping out of back-guard, jump priority over a backdash, and air-special position hold followed by resumed movement.

**Verification:**
- CI result pending; please browser-test backward/forward diagonal jumps and an airborne Energy Shot after deployment.


### 2026-11-19 — ChatGPT — Phase 4 direction + Special implemented
**Type:** Completed / Handoff
**Commit:** https://github.com/ItsLeoIso/bta.github.com/commit/a6c091bf9eadcbc3f10c15796cfd683a1d682f1a
**Files / systems:**
- `src/combat/ProjectileController.js`
- `src/combat/GuardController.js`
- `src/combat/DamageController.js`
- `src/engine/Arena.js`
- `tests/ProjectileController.test.js`
- `tests/ProjectileIntegration.test.js`
- `docs/GAME_DESIGN.md`, `docs/TECHNICAL_PLAN.md`, `docs/ROADMAP.md`, `README.md`, `index.html`

**What changed:**
- Kept L by itself as the original forward-facing Energy Shot.
- Added the eight-way Vector Burst: A/D aim screen-left/right, W/S aim up/down, and diagonal combinations are normalized to the same projectile speed.
- Gave Vector Burst its own move ID, display name, damage profile, and guard-meter entry while keeping its initial timing and damage equal to Energy Shot.
- Direction+L now takes priority over back-guard and can release an already-active guard. Conflicting opposing directions do not start a move.
- Projectiles now travel vertically as well as horizontally and are removed at vertical arena bounds. Vertical shots spawn forward of the fighter to account for pushbox spacing.

**Verification:**
- Added unit tests for eight-way aim, normalized diagonals, opposing-direction suppression, and vertical bounds cleanup.
- Added Arena integration tests for back+L guard cancellation and a vertical Vector Burst hit using the separate damage profile.
- Automated tests are committed, but the latest CI result could not be confirmed from the commit-status information available at handoff. No manual browser playtest has been performed in this session.

**Suggested next step:**
- Playtest the Vector Burst in all directions from both sides, confirm that W/S+L is comfortable alongside jump/crouch, and tune its uniqueness and balance before moving on to motion-input recognition.


### 2026-11-19 — ChatGPT — Air Vector limit and projectile momentum lock
**Type:** Gameplay adjustment / Regression tests
**Files / systems:**
- `src/combat/ProjectileController.js`
- `src/movement/MovementController.js`
- `src/engine/Arena.js`
- `tests/ProjectileController.test.js`
- `tests/ProjectileIntegration.test.js`
- `docs/TECHNICAL_PLAN.md`, `README.md`, `index.html`

**What changed:**
- Kept the existing eight-way aim controls, including straight-up and backward shots; backward aim is the screen direction opposite the fighter's current facing.
- Limited all projectile specials to one use per airtime, including both neutral L-only Energy Shot and directional Vector Burst. They share one allowance, consumed when either move starts and restored only after landing. Grounded projectile use remains available.
- Starting either projectile special now immediately clears horizontal velocity, vertical velocity, and committed air drift. The fighter remains still during startup/recovery; gravity resumes from zero vertical speed once recovery ends.
- Left the Forward/Up + L behavior untouched for a later dedicated adjustment.

**Verification:**
- Added tests for backward aiming while facing left, one Vector Burst per airtime, refresh on landing, and momentum cancellation.
- Automated workflow verification will be recorded after the new commit runs.


### 2026-11-19 — ChatGPT — Share the one-air-projectile limit across all shots
**Type:** Gameplay rule refinement / Regression tests
**Files / systems:**
- `src/combat/ProjectileController.js`
- `src/engine/Arena.js`
- `src/movement/MovementController.js`
- `tests/ProjectileController.test.js`
- `tests/ProjectileIntegration.test.js`
- `docs/TECHNICAL_PLAN.md`, `README.md`

**What changed:**
- Replaced the Vector-only air allowance with one shared air-projectile allowance.
- Either neutral L-only Energy Shot or directional Vector Burst consumes the allowance when started airborne.
- The player cannot switch shot types to bypass the limit; the shared allowance refreshes on landing. Grounded projectile use is unaffected.

**Verification:**
- Tests cover Vector Burst followed by a blocked Energy Shot, Energy Shot followed by a blocked upward Vector Burst, and refresh on landing.
- GitHub Actions test workflow passed: 132/132 tests. Pages deployment status is tracked in the workflow run for commit `be07692beb6ace9831b941c39496ff2531e1f1e9`.


### 2026-11-19 — ChatGPT — Research note: Street Fighter 6 and Dragon Ball FighterZ projectile design
**Type:** Design research / Owner-approved direction pending independent review
**Status:** Research proposal reviewed by Claude. The aerial-gravity and landing-recovery recommendations are incorporated in the implementation handoff below; projectile clash / durability and per-move landing recovery remain future proposals.
**Purpose:** Provide Claude with a concrete reference summary and review questions before the next aerial-projectile implementation pass.

#### 1. Street Fighter 6 — Akuma's Zanku Hadoken
Reference: [Akuma move list and frame data](https://streetfighterv.github.io/bot/AKUMA.html)

- Akuma has a dedicated air fireball, Zanku Hadoken, with LP / MP / HP versions and an EX version. It is a distinct aerial special, not simply the grounded fireball reused in mid-air.
- The referenced frame-data listing gives the standard aerial versions 11 frames of startup, 9 frames of recovery, and 9 frames of landing recovery. Its EX entry has different properties, including 4 frames of landing recovery.
- The EX entry also documents an initial two-hit projectile box that nullifies projectiles before launching the multi-hit fireball. This is a useful example of projectile interaction rules being move-specific.
- Frame data can change with balance patches and the linked community data is a reference, not a target for BTA's exact timings.

**Design lesson:** An aerial projectile should be treated as a committed aerial move with its own startup / recovery and landing consequences. Its angle, speed, strength and projectile interaction can be tuned per move. The cited Akuma move entry alone does not establish a universal SF6 air-projectile allowance; avoid treating a game-wide rule as verified without an authoritative system reference. BTA's shared one-air-projectile cap is our own design decision to prevent the current prototype's airborne shot spam.

#### 2. Dragon Ball FighterZ — shared air options and move-specific limits
References: [System mechanics](https://mail.dustloop.com/w/DBFZ/Mechanics), [SS4 / DAIMA Goku move data](https://mail.dustloop.com/w/DBFZ/Goku_%28SS4%2C_DAIMA%29)

- FighterZ has a general Air Option resource governing air movement choices such as a double jump or air dash. The system description says every character has one air option, restored by touching the ground, air recovery, or air guarding.
- This general movement resource is separate from projectile usage. It should not be described as a universal projectile quota.
- FighterZ also has individual aerial specials with their own usage restrictions. For SS4 / DAIMA Goku, each of j.214L, j.214M and j.214H can be used once before touching the ground.
- FighterZ distinguishes standard landing recovery from Special Landing Recovery. The system reference gives Goku's Air Kamehameha as an example of a move that applies 30 frames of special landing recovery. Some aerial attacks also have mid-attack landing recovery if the character touches down before the move finishes recovering.

**Design lesson:** Keep universal air-movement options separate from move-specific air-special rules. Landing is a meaningful combat state: a move may remain punishable on landing even if its airborne animation has ended or its ordinary recovery would otherwise have finished.

#### 3. Projectile interaction ideas to borrow later

- Use move-specific projectile properties rather than assuming every projectile has identical priority. FighterZ distinguishes Ki Blast / beam interactions and some moves can deflect or nullify projectiles; SF6 Akuma's EX Zanku Hadoken is another example of a projectile with a dedicated nullification phase.
- Future BTA projectile definitions should be able to express speed, trajectory, durability / clash strength, number of hits, startup, recovery, block interaction and landing recovery.
- These clash / durability rules are a later milestone. The immediate task is to make current Energy Shot and Vector Burst airtime behavior feel fair and readable.

#### 4. Recommended BTA ruleset

This is a deliberate BTA adaptation of the references, not a claim that either game uses precisely the same rule:

1. **One shared air projectile per airtime.** Energy Shot and Vector Burst consume the same allowance when started airborne. Switching shot type cannot bypass the limit. Refresh only on landing for the first implementation. Grounded shots remain usable again after their ordinary move recovery.
2. **Aerial shots commit the player.** On starting an aerial projectile, clear the fighter's existing horizontal momentum / air drift and upward velocity. Do not preserve the pre-shot trajectory.
3. **Do not freeze the fighter in the air.** Once the old momentum is cancelled, normal gravity should continue during startup / firing / recovery. This replaces the current prototype behavior that freezes both x and y for the entire projectile action. The fighter should visibly stop rising and begin falling while the shot plays.
4. **Keep the action lock.** The aerial special still owns its normal startup and recovery; the player cannot immediately jump, attack or fire again while that action remains active.
5. **Make landing matter.** If the fighter touches down before the aerial special's recovery completes, the remaining recovery should continue to lock actions on the ground. Later, individual aerial moves may receive explicit additional landing recovery, similar to DBFZ's Special Landing Recovery. Avoid silently resetting the move or making landing cancel its commitment.
6. **Keep move data extensible.** Energy Shot and Vector Burst can start with common timings, but store their projectile and landing properties separately so character-specific moves can diverge later.
7. **Keep the current controls for now.** L alone remains Energy Shot; direction + L remains Vector Burst. The Forward/Up + L jump-then-shoot behavior is explicitly out of scope for this pass and should not be changed without a separate decision.

#### 5. Requested second opinion from Claude

Please review this proposal against the actual SF6 / DBFZ mechanics and BTA's current code. In particular:

- Is one shared projectile per airtime a good BTA-specific restriction, or would a move-specific limit / cooldown be fairer while still preventing the current 8–10-shot air spam?
- Should the projectile allowance remain independent of BTA's air-dash allowance, or should BTA eventually adopt a shared air-option resource like FighterZ? Do not merge these resources without an explicit owner decision.
- Does cancelling upward and horizontal momentum while continuing gravity produce the clearest aerial fireball feel? Are there edge cases when the character is close to the floor?
- How should remaining special recovery behave when the fighter lands before it expires? Would a distinct post-landing recovery timer be better than simply continuing the existing action timer?
- What minimal projectile clash / durability rules should BTA plan for without overengineering the current prototype?
- Please flag any inaccurate reference-game claims, balance concerns, or likely implementation pitfalls before code changes are made.

**Owner direction so far:** Leandro agreed that all aerial projectile shots should share one use per jump. Claude reviewed the proposal and recommended immediate gravity during the special, retaining the existing action timer on landing, and keeping projectile and air-dash allowances independent. The subsequent implementation handoff records what has been accepted and changed.

**Primary reference pages consulted:**
- Street Fighter 6 Akuma frame data: https://streetfighterv.github.io/bot/AKUMA.html
- Dragon Ball FighterZ system mechanics: https://mail.dustloop.com/w/DBFZ/Mechanics
- Dragon Ball FighterZ SS4 / DAIMA Goku move data: https://mail.dustloop.com/w/DBFZ/Goku_%28SS4%2C_DAIMA%29


### 2026-11-19 — ChatGPT — Implement aerial projectile gravity and landing commitment (Claude review)
**Type:** Gameplay implementation / Regression tests
**Review source:** Claude's second-opinion response in the collaboration handoff. Claude reviewed `Cooperation.md`, `ProjectileController.js`, and `MovementController.js`; did not run tests or browser checks.
**Files / systems:**
- `src/movement/MovementController.js`
- `tests/ProjectileIntegration.test.js`
- `tests/ProjectileController.test.js`
- `docs/TECHNICAL_PLAN.md`, `docs/GAME_DESIGN.md`, `README.md`

**Review findings accepted:**
- Momentum cancellation was already in `ProjectileController`; the remaining hover came from the movement layer skipping gravity while the action was `SPECIAL`.
- With 8 startup + 18 recovery frames at 60 Hz, a projectile fired at the apex or lower can land before the special action completes. That should be normal behavior, not a separate edge-case timer.
- Preserve the existing special action timer on landing. Do not end the special or start a second landing-recovery timer in this increment.
- Keep the one-per-air-projectile allowance independent of the air-dash allowance. A later air dash may still reset vertical speed during its own dash frames; this interaction remains for browser playtesting.
- Keep projectile durability / clash resolution as a later, separate milestone.

**What changed:**
- Removed the `SPECIAL` exception from airborne gravity integration. Aerial projectile use still locks horizontal movement and starts from zeroed horizontal / vertical momentum, but gravity now acts during startup and recovery so the player immediately descends.
- If the fighter reaches the floor during the special, `SPECIAL` remains active and continues counting its original frame timer. The fighter stays grounded and movement-locked until the 26-frame action completes.
- Corrected locomotion to `STANDING` on the same frame that an aerial special lands, avoiding one frame of stale `FALLING` state. Ground hurtbox and pushbox selection now observe the grounded state immediately.
- Added coverage for falling from the jump apex while the projectile special is active, landing before recovery completes without ending the action early, and landing near the floor before the projectile's frame-8 spawn.
- Corrected the current game-design crouch-walk speed from 50% to 12.5% to match the live movement constant and regression tests. The earlier 50% cooperation entry remains as a historical record of the initial value.

**Not changed / still deferred:**
- No additional `landingRecoveryFrames` value yet. Tune the existing recovery feel in browser playtests before adding per-move landing penalties.
- No shared air-option resource; air dash and projectile allowances stay independent.
- No projectile durability, clashes, deflects, beams, or melee-vs-projectile interactions.
- Forward/Up + L jump-then-shoot behavior remains out of scope and unchanged.

**Verification:**
- GitHub Actions Node.js tests passed: 134/134 tests, 0 failures — https://github.com/ItsLeoIso/bta.github.com/actions/runs/44508370183
- GitHub Pages build and deployment completed successfully — https://github.com/ItsLeoIso/bta.github.com/actions/runs/44508368767
- Gameplay implementation commit: https://github.com/ItsLeoIso/bta.github.com/commit/0c4752d79edf64710c62e8ef09f66075b7a908ed
- Browser playtesting at low, mid and apex heights is still needed, especially shot → air dash and landing during startup / recovery.

**Claude's remaining review question:** Verify the historical SF6 / DBFZ reference details, especially any game-wide air-projectile cap, before using those claims as final BTA design evidence. The cited Akuma move data alone does not prove a universal Street Fighter 6 rule.


### 2026-11-19 — ChatGPT — Add a scrolling world camera and Quarter-Circle Forward recognition
**Type:** Gameplay / engine milestone — completed and handed off
**Files / systems:**
- `src/engine/Arena.js`
- `src/engine/CanvasRenderer.js`
- `src/input/CommandHistory.js`
- `tests/CommandHistory.test.js`
- `tests/Arena.test.js`
- `tests/ArenaRoundIntegration.test.js`
- `docs/GAME_DESIGN.md`, `docs/TECHNICAL_PLAN.md`, `docs/ROADMAP.md`, `README.md`, `index.html`

**What changed:**
- Expanded the playable world to 1,920 units while retaining the 960 × 540 visible viewport. Fighters now spawn at world positions 780 and 1,140, preserving their original on-screen positions at match start.
- Added a horizontal camera that follows the midpoint between fighters, scrolls across the stage, clamps at either world edge, and keeps the controlled player visible. HUD and round overlays remain fixed to the viewport; fighter, projectile, collision-debug, and stage rendering use world coordinates.
- Camera interpolation is handled at render time and does not alter simulation positions or gameplay physics.
- Added fixed-frame, facing-relative directional history. Quarter-Circle Forward is recognised as Down → Down-Forward → Forward + L within 24 frames, on either side. Brief neutral gaps are accepted.
- A recognised motion is consumed and shown as a HUD confirmation rather than falling through to Energy Shot / Vector Burst. No advanced move is assigned until its move properties are designed.
- The new command history is separate from the existing dash double-tap detector.

**Verification:**
- Added tests for right-facing and left-facing motion recognition, neutral gaps, invalid / stale inputs, single consumption, requiring forward still held at trigger time, Arena command feedback and projectile suppression, camera tracking, stage-edge clamping, and camera reset.
- GitHub Actions Node.js tests passed: 143/143, 0 failures — https://github.com/ItsLeoIso/bta.github.com/actions/runs/44517180115
- GitHub Pages build and deployment succeeded — https://github.com/ItsLeoIso/bta.github.com/actions/runs/44517178709
- The first run exposed one stale backdash test fixture after the world expanded; the fixture was updated to the new world coordinates before the successful run.
- Browser camera-feel and visual validation: not performed in this session.

**Suggested next step:**
- Browser-test retreating, advancing, jump-overs, wall pressure, and fighters near both stage ends. Then define the first advanced motion special and add input buffering so commands can execute on the first legal frame.


### 2026-11-22 — ChatGPT — Add eight-frame combat input buffering
**Type:** Gameplay implementation / regression coverage
**Files / systems:**
- `src/input/InputBuffer.js`
- `src/engine/Arena.js`
- `src/engine/CanvasRenderer.js`
- `tests/InputBuffer.test.js`
- `tests/InputBufferIntegration.test.js`
- `docs/GAME_DESIGN.md`, `docs/TECHNICAL_PLAN.md`, `docs/ROADMAP.md`, `README.md`, `index.html`

**What changed:**
- Added an eight-fixed-frame input buffer for Light, Medium, Heavy, and Special.
- Inputs remain pending while an action or reaction prevents execution, then dispatch on the first legal frame, including the frame a prior action finishes.
- A newer combat-button press replaces the previous pending command. Simultaneous button priority follows the existing Light → Medium → Heavy → Special selection order.
- Buffered Special snapshots the direction held on its original press, preserving Vector Burst aim while the player waits through recovery.
- Movement, guard, jump, and dash remain immediate. Buffered input clears on round result / reset. A small HUD label shows the pending action and remaining frames.
- Quarter-Circle Forward + L remains a separate feedback-only command and clears any older pending button rather than falling through to a projectile.

**Commits:**
- Input-buffer foundation: https://github.com/ItsLeoIso/bta.github.com/commit/ca87e0957b066daf76600481799cad0b02884eb2
- Arena wiring fix: https://github.com/ItsLeoIso/bta.github.com/commit/e2045470d9c015d701eb6e64423eb01642329f8b
- Hitstun integration coverage: https://github.com/ItsLeoIso/bta.github.com/commit/57099d38b28e873932551bed8a381d38bba65ea5

**Verification:**
- GitHub Actions Node.js tests passed: 154/154, 0 failures — https://github.com/ItsLeoIso/bta.github.com/actions/runs/45063908628
- GitHub Pages build and deployment succeeded — https://github.com/ItsLeoIso/bta.github.com/actions/runs/45063908335
- CI exposed an incomplete Arena wiring in the first buffer commit; the constructor, capture/dispatch flow, and reset handling were corrected before the successful run.
- Browser/manual playtesting not performed in this session.

**Suggested next step:**
- Playtest H/J/K/L pressed during startup, active frames, recovery, hitstun, and blockstun. Confirm eight frames feels responsive without causing surprising delayed moves; then build the first actual QCF special and combo/cancel rules.


### 2026-11-22 — ChatGPT — Add hit-confirm cancels, aerial combos, and juggle control
**Type:** Phase 4 combat milestone / implementation and regression coverage

**Files / systems:**
- `src/combat/AttackController.js`, `src/combat/DamageController.js`, new `src/combat/ComboTracker.js`
- `src/combat/CombatCollision.js`, `src/engine/Arena.js`, `src/engine/CanvasRenderer.js`
- `tests/AttackController.test.js`, `tests/CombatIntegration.test.js`, new `tests/ComboTracker.test.js`
- `README.md`, `index.html`, `docs/GAME_DESIGN.md`, `docs/TECHNICAL_PLAN.md`, `docs/ROADMAP.md`

**What changed:**
- Added explicit move-data-driven hit-confirm cancels. Ground Light can cancel into Medium, Heavy, or Special; ground Medium can cancel into Heavy or Special. In the air, Light can cancel into Medium / Special and Medium into Special.
- Whiffs and blocks do not open cancel routes; the original move recovery remains committed. The existing eight-frame buffer can feed the cancel route.
- Confirmed grounded Light / Medium moves can be jump-cancelled. Medium launches a grounded target upward at 520 units/second.
- Enabled Light and Medium attacks while airborne; Heavy remains ground-only.
- Added per-defender combo tracking with a 45-frame link window, actual cumulative damage, and ten-percentage-point damage scaling per follow-up down to a 40% floor.
- Added a three-hit aerial juggle cap. A fourth airborne follow-up in the same combo is dropped rather than extending an infinite loop.
- Added a screen-space combo counter showing hit count, AIR COMBO status, and cumulative damage. Combo state is cleared at round transitions / resets.
- Marked the Phase 4 air-combo / cancel / recovery roadmap item complete.

**Implementation commit:**
- `2cfb67b5c8e6006bd1578ba7eebe563fbd808c41` — https://github.com/ItsLeoIso/bta.github.com/commit/2cfb67b5c8e6006bd1578ba7eebe563fbd808c41

**Verification:**
- GitHub Actions Node.js tests passed: **166/166**, 0 failures — https://github.com/ItsLeoIso/bta.github.com/actions/runs/45065962307
- GitHub Pages build and deployment succeeded — https://github.com/ItsLeoIso/bta.github.com/actions/runs/45065961933
- Browser/manual playtesting was not performed in this session. Launch height, cancel timing, damage scaling, and the juggle limit still need hands-on tuning.

**Suggested next step:**
- Assign a real gameplay move to Quarter-Circle Forward + L, then playtest the new cancel / launcher / air-combo routes in the browser and tune the resulting frame data.


### 2026-11-22 — ChatGPT — Phase 5 playable opponent, Neon Backstreet, and Arc Lance
**Type:** Roadmap implementation / combat milestone 016 / stage presentation

**Commits:**
- CPU rival and two-sided combat: `b1e3ac3c421911c34fbf7412cb3b193a380fc56a`
- Neon Backstreet stage: `3d13f176bdc50946d6dcf80e3eb61462241e8a9d`
- Arc Lance QCF special: `3b856dc93bbb871811e273be3cb3697e62efa7b0`

**What changed:**
- Added deterministic `OpponentAIController`: the CPU closes distance, rotates through Light / Medium / Heavy / Energy Shot, and uses short reactive standing / crouch guard against visible active melee attacks.
- The live browser match enables the CPU; standalone Arena tests keep it opt-in so combat simulation remains deterministic.
- Added two-sided melee collision and CPU projectile support. Trades can resolve because both melee events are gathered before applying reactions.
- Added distinct placeholder profiles: player Striker (300 walk speed, 1.00× outgoing damage) and CPU Rival (260 walk speed, 1.05× damage).
- Replaced the flat test grid with Neon Backstreet: layered night sky, city buildings and windows, BTA signs, glowing horizon, and tiled floor. It scrolls in world space with the camera.
- Connected facing-relative Down → Down-Forward → Forward + L to **Arc Lance** rather than feedback-only recognition.
- Arc Lance uses 14 startup / 26 recovery frames, 390 units/second projectile speed, 26-unit radius, and a 2.8-second lifetime. On hit: 14% health damage, 24 hitstun frames, 400 knockback. On block: 1.4% chip damage and 38 guard-meter damage.
- Extended the eight-frame buffer to preserve Arc Lance identity and input-time facing, and enabled the move as a Light / Medium hit-confirm Special cancel.
- Updated the game design, technical plan, README, controls hint, and roadmap. The coded Phase 5 opponent and stage items and the Phase 4 QCF special item are checked off.

**Verification:**
- CPU milestone: **174/174 tests passed**; Pages build and deployment succeeded — [Node tests](https://github.com/ItsLeoIso/bta.github.com/actions/runs/45066492226), [Pages deployment](https://github.com/ItsLeoIso/bta.github.com/actions/runs/45066491462)
- Stage milestone: **174/174 tests passed**; Pages build and deployment succeeded — [Node tests](https://github.com/ItsLeoIso/bta.github.com/actions/runs/45066627990), [Pages deployment](https://github.com/ItsLeoIso/bta.github.com/actions/runs/45066627861)
- Arc Lance: **180/180 tests passed, 0 failures**; Pages build and deployment succeeded — [Node tests](https://github.com/ItsLeoIso/bta.github.com/actions/runs/45067129237), [Pages deployment](https://github.com/ItsLeoIso/bta.github.com/actions/runs/45067128742)
- No browser/manual playtest was performed in this run. CPU difficulty, stage contrast, Arc Lance startup / damage, and the aerial route balance still need human playtesting.

**Remaining Phase 5 work:** browser playtesting / visual validation and the movement / combat balance pass remain intentionally unchecked.


### 2026-11-22 — ChatGPT — START menu, Arcade / Training modes, and debug options
**Type:** Phase 6 menu and mode foundations

**Files / systems:**
- New `src/ui/MenuController.js`; updates to `src/main.js`, `src/engine/Arena.js`, `src/engine/CanvasRenderer.js`, `src/ui/styles.css`, and `index.html`
- New `tests/MenuController.test.js` and training integration coverage in `tests/Arena.test.js`
- Updated `README.md`, `docs/GAME_DESIGN.md`, `docs/TECHNICAL_PLAN.md`, and `docs/ROADMAP.md`

**What changed:**
- Added an intro screen with BELT TO ASS branding and Enter / click to continue.
- Added the requested main menu order exactly: Arcade, Online, Training, Option. Both keyboard and mouse navigation work. Keyboard controls: W / S or Up / Down, Enter, Escape.
- Arcade starts the best-of-three local match against the deterministic CPU Rival.
- Training starts a passive dummy with frozen round timer / score flow. After the last registered hit or block, dummy health and guard meter refill after 120 fixed frames (two seconds).
- Online explicitly says network matchmaking is not connected yet; no fake networking or matchmaking.
- Options toggle combat box overlays and the state / frame-data inspector. Both overlays are off by default; combat-box overlays now include both fighters' active melee hitboxes.
- Added a DOM menu state machine with six tests and a training-mode Arena integration test.
- The first foundations are complete; training reset-position controls, input recording / playback, character select, online transport, and deeper Arcade progression remain future work.

**Implementation commit:**
- `52c334b22699734847a8b50762fd1e1be82e9283` — https://github.com/ItsLeoIso/bta.github.com/commit/52c334b22699734847a8b50762fd1e1be82e9283
- `61e47930b76dc9b47fe091f88ba8b6f91a47ec06` — follow-up test fix; captures the short-lived hit event on the frame it occurs.

**Verification:**
- GitHub Actions Node.js tests: **187/187 passed, 0 failures** — https://github.com/ItsLeoIso/bta.github.com/actions/runs/45067699413
- GitHub Pages build and deployment succeeded — https://github.com/ItsLeoIso/bta.github.com/actions/runs/45067699450
- Manual browser playtesting was not performed in this session. Menu keyboard / mouse focus, responsive layout, and Training / Arcade feel still need visual playtesting.


### 2026-11-22 — Claude — Independent code review of `main` (6ebfd39) and log audit
**Type:** Review
**Commit:** `not committed` (entry handed to Leandro to paste)
**Files / systems:**
- Reviewed (read only, via GitHub connector at `main` head `6ebfd391`): `Cooperation.md`, `docs/GAME_DESIGN.md`, `docs/ROADMAP.md`, `src/engine/Arena.js`, `src/combat/{AttackController,CombatCollision,ComboTracker,DamageController,GuardController,Hitbox,Hurtbox,ProjectileController}.js`, `src/state/FighterStateController.js`, `src/movement/MovementController.js`, `src/ai/OpponentAIController.js`, `src/input/KeyboardInput.js`, `src/ui/MenuController.js`, `src/main.js`, `tests/Arena.test.js`.
- Not reviewed: `CanvasRenderer.js`, `GameLoop.js`, `RoundController.js`, `CommandHistory.js`, `InputBuffer.js`, `Pushbox.js`, `StateDebugPanel.js`, `README.md`, `docs/TECHNICAL_PLAN.md`, `index.html`, the CI workflow, and every test file except `Arena.test.js`.

**Context:** This Claude session has no memory of earlier Claude sessions. This review relies only on the repository and this log. No files were edited, per the file-ownership note in the 2026-11-12 entry.

**What I noticed (overall):**
- Moves are data-driven, state is layered, hitboxes, hurtboxes and pushboxes are kept separate, and the CPU is deterministic. These are good foundations for adding characters.
- The findings below are mostly at the seams between systems rather than inside any one module.

**Findings (all from code reading; none executed):**

1. **Major — Training dummy never runs physics** (`Arena.js`, `Arena.update`)
   - The opponent's `MovementController` only runs when `opponentAI` returns input. In Training the AI is off, so `opponentInput` is `null` and the dummy gets no gravity, no knockback and no landing check.
   - `DamageController.applyHit` launches a grounded Medium target with `onGround = false`, `vy = -520` and locomotion `JUMPING`. Nothing ever lands the dummy again.
   - Effects: Heavy is a Low and `resolveAttackCollision` makes Lows whiff against `JUMPING`/`FALLING`, so Heavy can never hit the dummy again. Every later hit is counted as an air juggle, so the 3-hit juggle cap applies to a dummy that is not really airborne. The airborne hurtbox is also used.
   - The existing Training test only uses Light and asserts `opponent.x` is unchanged, so it does not catch this.
   - Fix: when no AI is present, still run `opponentMovement.update` with an idle input object. Decide explicitly whether the dummy takes knockback, and update the x assertion to match.
   - Add a regression test: Medium launches the training dummy, the dummy lands within N frames, and Heavy then hits it.

2. **Major — A hit can shorten guard break and knockdown** (`DamageController.applyHit` and `FighterStateController.setReaction`)
   - `applyHit` overwrites `reactionData` and `vx` before it calls `setReaction`. `setReaction` refuses a lower-priority reaction (hitstun = 1 against guardBreak = 2 or knockdown = 3), but the data was already replaced.
   - Result: the defender stays in guardBreak/knockdown but runs the new hit's shorter timer (12–24 frames instead of 45 for guard break) and loses the `guardBreak` flag.
   - Fix: call `setReaction` first and only overwrite `reactionData` if it was accepted. Alternatively keep the longer of the two timers.
   - Add a test: hit a guard-broken fighter and assert the remaining stun is not reduced.

3. **Minor — Special cancel can delete a move's recovery without starting a special** (`Arena.js`, `specialCancel` block)
   - Arena ends the current ATTACK before `ProjectileController` checks legality. `ProjectileController` then refuses if the air-projectile allowance is spent or opposite directions are held.
   - Result: after a confirmed air Light/Medium hit with the allowance spent, pressing L removes the remaining recovery and nothing fires.
   - This cancel logic lives in `Arena` while all other cancels live in `AttackController`.
   - Fix: add a `canStartSpecial(fighter, input)` check and call it before ending the attack. Better, move special cancels into one place.

4. **Minor — Combo window is time-based, not state-based** (`ComboTracker.js`)
   - The 45-frame window refreshes on every hit regardless of whether the defender is still in hitstun. Hitstun is only 12–24 frames, so scaling and the HUD counter can count hits the defender could have avoided.
   - After three airborne hits, `canRegisterHit` drops further hits to an airborne defender as `juggleDrop` for up to 45 frames, even if that defender has recovered and is acting. The collision is consumed and no damage is dealt, so this is a short invulnerability window.
   - Fix: end the combo when the defender's reaction is `NONE` (optionally with a 1–3 frame grace), and apply the juggle cap only while the defender is in a reaction.

5. **Suggestion / balance — CPU guard has zero reaction time** (`OpponentAIController.js` and `Arena.update`)
   - The AI reacts when the target's phase is `active`. Arena runs the AI after the player's attack has advanced and before collision resolves, so the CPU starts guarding on the exact first active frame.
   - Result: the CPU blocks any melee within 245 units, correctly high or low, whenever its 45-frame block cooldown is ready. A 5-frame Light cannot be reacted to by a human.
   - Fix: add reaction frames, for example guard only once the attacker has been in startup for N frames (N around 8). Light then beats the CPU, Medium is borderline, and Heavy is blockable. Keep it deterministic.

6. **Minor — No way back from a match to the menu** (`main.js`, `MenuController.js`)
   - `back()` does nothing in `PLAYING`, and Escape in `main.js` only toggles pause. Switching mode requires a page reload.
   - Fix: add a pause menu (Resume / Restart / Exit to menu) with `MenuController.exitToMenu()`. Also add Training reset-position, which the roadmap already lists as future work.

7. **Suggestion — Fighters can separate more than the viewport width** (`Arena.updateCamera`)
   - The world is 1,920 wide, the viewport is 960, and the camera only guarantees the player is visible. The opponent, and projectiles launched from outside the view, can be off-screen.
   - Options: cap fighter separation at about viewport width minus a margin, or add zoom (already deferred in the design doc). Decide before playtesting spacing.

8. **Suggestion — Projectiles have no floor collision** (`ProjectileController.js`)
   - A downward Vector Burst fired from the ground travels through the floor (`y = 440`) until it leaves the arena bounds.
   - Fix: remove or spark on floor contact.

9. **Suggestion — Inconsistent ground checks**
   - `ProjectileController` and `GuardController` use `!fighter.onGround` or `fighter.onGround`, while `AttackController`, `Hitbox` and `DamageController` use `onGround !== false`. A fighter fixture with `onGround` undefined is handled differently by each. Normalise to one helper.

10. **Design question for Leandro:** A fighter crouch-guarding (hold back + down) is hit by Light because Light is High and needs standing guard. A fighter only crouching dodges it entirely. This matches `GAME_DESIGN.md` as written, but crouch-guarding is now strictly worse against the fastest move than crouching without guarding. Intended?

**Log and docs audit:**
- **Naming:** the project is "BLT" in the header and docs, "BTA" in the repo name and some entries (the research note, "BTA signs"), and "Belt to Ass" on the title screen. The header says "Project owner: Leo", while entries say Leandro. Please pick one.
- **Unrecorded review:** the 2026-11-19 ChatGPT entries say Claude reviewed the projectile proposal and recommended specific changes. That review is not in this repository, which conflicts with rule 8. Either paste the original response here or soften those lines.
- **Stale or mismatched details:** the 2026-11-12 Claude entry still says `Commit: not committed`, and ChatGPT later reconstructed the bundle. `GAME_DESIGN.md` still lists "Final programming language / framework / rendering technology" under Open decisions. The CPU is called "Bruiser" in the design doc and "CPU Rival" elsewhere.
- **Formatting:** the "Phase 4 started" entry has literal backslashes before backticks (`\`) so its file lists render incorrectly.
- **Size:** this file is about 66 KB. Consider a short "Current state" summary at the top and moving closed entries to an archive file.

**Verification:**
- Tests run: none. Everything above is from reading the code and the documented test expectations.
- Browser/manual checks: none.
- Not verified: the CI results cited in earlier entries, and any behaviour of the files listed as not reviewed.
- Findings 1–4 are strong enough to turn into failing tests first. Findings 5–9 are judgement calls.

**Review requested / concerns:**
- ChatGPT: please confirm or refute findings 1–4 with failing tests before changing code. Say which of 5–9 you intend to take.
- Leandro: decide the knockback policy for the Training dummy (finding 1), whether the combo window should depend on defender state (finding 4), how hard the CPU should block (finding 5), and the crouch-guard question (finding 10).

**Suggested next step:**
1. Fix the Training dummy physics (finding 1) and the reaction overwrite (finding 2), each with a regression test.
2. Make special-cancel legality consistent (finding 3) and tighten the combo window (finding 4).
3. Add a pause menu with Exit to menu (finding 6), then playtest. The Phase 5 playtest items are still unchecked in the roadmap.
4. Ownership: ChatGPT keeps gameplay code. Claude will not edit gameplay files unless it is reassigned here.


### 2026-11-22 — ChatGPT — Apply Claude's review and harden Training / combat transitions
**Type:** Review follow-up / Gameplay fixes / Pause flow / regression tests
**Review source:** Claude's full independent review pasted above from the user's attachment. Findings 1–4 were reproduced by tests before code changes.

**Test-first reproduction:**
- Commit `f41c8e8fd227f1f903c014791389cfe13cc5bff0` adds Claude's review entry and four targeted regression tests.
- Before the fix, GitHub Actions reported **191 tests: 187 passed, 4 failed**. The failing tests reproduced: Training dummy cannot land after Medium launch; an illegal air Special cancel deletes attack recovery; a recovered defender remains juggle-capped; a Light hit shortens an existing guard-break / knockdown reaction.
- Red test run: https://github.com/ItsLeoIso/bta.github.com/actions/runs/45071012987

**Fixes implemented in this follow-up:**
- **Training physics:** the opponent now receives a neutral input sample through its own MovementController whenever AI is disabled. It remains passive, but still takes knockback, falls under gravity and lands. The regression launches the dummy with Medium, waits for touchdown, then confirms Heavy can hit it.
- **Reaction priority:** DamageController asks FighterStateController to accept the new reaction before changing reaction data / velocity. Lower-priority hits still deal health damage but preserve guard-break and knockdown timers / flags.
- **Special cancel legality:** added `ProjectileController.canStartSpecial`. Arena checks the air-projectile resource and direction conflicts before ending the normal attack; illegal L inputs leave the original recovery intact.
- **Combo rules:** the 45-frame timer is now a maximum safety timeout. Combo scaling and the juggle cap stop when the defender's reaction becomes NONE, so recovered airborne fighters do not suffer phantom invulnerability.
- **Shared grounded state:** added `isGrounded`; missing / undefined `onGround` is treated as grounded for compatibility, while explicit false is airborne.
- **CPU reaction delay:** the deterministic rival waits for eight startup frames before reactive guard. Light (5f) should beat the reaction; Medium (8f) is borderline; Heavy (12f) can be guarded.
- **Camera spacing:** maximum horizontal fighter separation is capped at 824 units (960 viewport less 68 units on each side) to keep both combatants visible without adding zoom.
- **Projectile cleanup:** downward-moving projectiles are removed on floor contact after checking hurtboxes on that frame.
- **Pause and Training controls:** Escape opens Resume / Restart Mode / Exit to Menu. Training adds Reset Positions, which resets both fighters, resources and the two-second dummy recovery timer.
- **Naming / docs:** current project/UI/docs naming is standardized to BTA — Belt to Ass; the vanilla JS + Canvas stack decision is no longer listed as open. Historical log entries keep their original wording where it records what contributors wrote at the time.

**Design choice kept open for playtesting:**
- Crouch-only ducks High attacks, but crouch-guard is a Low guard and remains vulnerable to High attacks. This follows the current guard-height rules, but may feel counter-intuitive. No rule change is made until browser testing.

**Verification:** pending on the implementation commit. Browser/manual playtesting has not been performed.
