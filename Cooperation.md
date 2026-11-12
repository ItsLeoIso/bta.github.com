# BLT — Cooperation Log

This file is the shared handoff and review space for every AI or human contributor working on BLT.

**Project owner:** Leo  
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
