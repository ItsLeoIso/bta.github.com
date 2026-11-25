# BTA — Belt to Ass

A browser-first 2D 1v1 anime-style fighting game. This repository is the source of truth for the game's code, assets, design decisions, and development plan.

## Current status

**Gameplay prototype 023 — local & online 1v1 rollback playtest candidate.** The Vanilla JavaScript + HTML5 Canvas foundation includes fixed-step 60 Hz simulation, movement, explicit fighter states, timed Light / Medium / Heavy attacks with High / Mid / Low hit levels, separate pushboxes and combat hurtboxes, active-frame hitboxes, damage and hit reactions, directional high/low guard with blockstun, chip damage, guard meter and guard breaks, hit/block frame-advantage reporting, and a complete prototype round loop. Special moves include a forward-only grounded Energy Shot, a diagonal down-forward airborne Energy Shot, and the QCF+L Arc Lance. Light / Medium hit-confirm cancels, grounded Medium launch, jump-cancels, air follow-ups, combo scaling, and a three-hit juggle cap are implemented. Arcade has a deterministic CPU rival; Training has a passive physics-enabled dummy; **Online** provides 1v1 GGPO-style rollback netcode over WebRTC peer-to-peer (`RTCDataChannel`), supporting both zero-backend Direct Invite copy/paste codes (ready on GitHub Pages) and optional Room-Code signaling (`server/signaling-server.js` or `server/cloudflare-worker.js`), with synchronized Online Character Select, live ping/rollback/checksum HUD, non-blocking online menu, and two-player rematch voting. Character stats, normal attacks, and projectile tuning live in data-driven Striker / CPU Rival profiles, with registry-driven character select and the intended START punch-through opening sequence. Confirmed hits, blocks, and guard breaks use deterministic Canvas impact sparks and restrained world-only screen shake.

**Readiness note:** local Node tests pass **254/254** (including seeded 620-frame rollback stress tests and live WebSocket signaling server tests), and Chromium browser smoke + two-peer WebRTC E2E tests run in GitHub Actions CI. Public matchmaking, gamepad / touch input, final pixel-art sprite sheets, animation, full audio, and final balance remain future Phase 7 work.

## Playtest

Start with the [Playtest Guide](docs/PLAYTEST_GUIDE.md) for controls, mode details, a first-pass checklist, known limitations, and the bug-report template.

Hosted build: https://itsleoiso.github.io/bta.github.com/

## Design at a glance
- 2D, side-view, 1v1 fighting; assists may be considered later.
- Anime-fighter movement: fast air control, air combos, and air dashes.
- Moderate gravity: enough airtime for combos without weightless falling.
- Keyboard controls: A/D for screen-relative movement, W to jump, S to crouch, H/J/K/L for attacks.
- Main menu order: Arcade, Online, Training, Option.
- Browser is the first target platform.
- The 960-unit viewport follows both fighters through a 1,920-unit world stage.

See [the game design](docs/GAME_DESIGN.md), [the roadmap](docs/ROADMAP.md), [the technical plan](docs/TECHNICAL_PLAN.md), [the online plan](docs/ONLINE_PLAN.md), and the contributor [cooperation log](Cooperation.md).

## Repository layout
- assets/ — visual, audio, and stage assets.
- docs/ — design decisions and development plan.
- server/ — zero-dependency Node.js WebSocket signaling server (`signaling-server.js`) and Cloudflare Worker room relay (`cloudflare-worker.js`) for optional room codes.
- src/engine/ — timing, arena, and Canvas renderer.
- src/net/ — GGPO-style rollback session, binary packet codec, FNV-1a snapshot checksums, WebRTC P2P transport, signaling client, and online match controller.
- src/effects/ — deterministic cosmetic combat feedback and transient particles.
- src/ai/ — deterministic opponent decision logic.
- src/input/ — keyboard state, 16-bit bitmask input adapter, logical actions, motion-command history, and combat input buffering.
- src/movement/ — movement, dashes, gravity, and pushboxes.
- src/combat/ — attacks, collision, damage, guard, frame data, and round flow.
- src/characters/ — character profiles, shared move data, and animation metadata.
- src/animation/ — fixed-step fighter animation selection and playback.
- src/ui/ — browser presentation, HUD, and menus.
- tests/ — Node.js unit / integration / rollback stress tests and Chromium browser smoke / WebRTC E2E tests.
- index.html — browser entry point.

## Run locally
Requires Python 3 or another static HTTP server and Node.js 22 or newer:

    npm test
    python3 -m http.server 8000

Open http://localhost:8000. Do not open index.html directly as a file; native ES modules need an HTTP server.

### Online 1v1 play
- **Direct Invite (no server needed — works on GitHub Pages):** Open **Online → Direct Invite**, click **Create Direct Invite**, send the `BTA1:...` code to your opponent, have them click **Create Answer**, and paste their answer code back to connect.
- **Room Codes (optional signaling relay):** Run the zero-dependency local signaling server alongside the game:

    node server/signaling-server.js

  Then open **Online → Room Code**, point the signaling URL to `ws://localhost:8787` (or a deployed `server/cloudflare-worker.js` `wss://` endpoint), and share the 5-character room code. Match frames always flow direct WebRTC peer-to-peer.

The Chromium smoke suite is run in CI. To run it locally, install the test-only tooling with `npm install --no-save --package-lock=false @playwright/test`, install Chromium with `npx playwright install chromium`, then run `npx playwright test`.

The game itself has no runtime dependencies or build step.


## Character select

Arcade and Training open a roster screen before the match. Use **A / D** or **Left / Right** to cycle Striker and CPU Rival, **Enter** to confirm, and **Escape** to return. Online mode provides synchronized two-player character select with live ready indicators once connected.


## Opening sequence

The game opens on a dark, silent **START** prompt. Press any ordinary key or click/tap the screen: Striker punches through the lettering, an original synthesized chiptune placeholder theme and impact sound begin, and the fighter settles into a pose on the right as the Arcade / Online / Training / Option menu appears on the left. The title music is generated in-browser and is not the final soundtrack.
