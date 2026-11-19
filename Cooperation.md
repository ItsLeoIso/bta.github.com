### 2026-11-19 — ChatGPT — Phase 3 round flow implemented
**Type:** Completed / Handoff
**Commit:** Pending atomic commit.
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
- Automated unit and Arena integration tests were added; repository CI result is pending.
- No manual browser playtest has been performed in this session.
- The timer duration, overlay readability, result pacing, and complete match flow still need browser playtesting.

**Suggested next step:**
- Review the GitHub Actions test run, then play through KO, timeout, draw, next-round reset, and Enter-to-rematch in the browser.
- Keep Phase 5's active opponent behaviour separate from this round-management milestone.

---


