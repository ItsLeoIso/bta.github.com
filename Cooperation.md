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
**Commit:** to be recorded after commit creation
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
