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
