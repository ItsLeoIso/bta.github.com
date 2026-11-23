# BTA Playtest Guide

BTA is ready for **local keyboard playtesting** as a gameplay prototype. It is not an online build, a balanced competitive release, or a finished art/audio release.

## Get into a match

### Play the hosted build
Open [BTA on GitHub Pages](https://itsleoiso.github.io/bta.github.com/). The build is deployed from `main`.

### Run it locally
1. Install Node.js 22 or newer and Python 3.
2. Clone the repository.
3. From the repository root, run `npm test`.
4. Start a static server with `python3 -m http.server 8000`.
5. Open [http://localhost:8000](http://localhost:8000).

Do not open `index.html` as a `file://` URL. Native ES modules need an HTTP server.

## Controls

| Input | Action |
|---|---|
| Enter / click | Leave title screen; confirm menu selection |
| W / S or ↑ / ↓ | Navigate menus |
| A / D | Move left / right on screen |
| Double-tap A / D | Ground dash |
| W | Neutral jump |
| W + A / D | Directional jump |
| Double-tap A / D in air | Air dash |
| S | Crouch |
| H | Light — High |
| J | Medium — Mid |
| K | Heavy — Low |
| L | Energy Shot — forward when grounded; diagonal down-forward when airborne |
| Down → Down-Forward → Forward + L | Arc Lance (relative to the direction you face) |
| Hold away from opponent | Stand guard |
| Hold away + S | Crouch guard |
| Escape | Pause / resume |

A and D always mean screen-left and screen-right; they do not reverse when fighters cross. Guard is different: hold away from the opponent. Crouching without guarding ducks High attacks; crouch guard protects against Low attacks but is vulnerable to High attacks.

Light, Medium, Heavy, and Special presses buffer for up to eight fixed frames during eligible recovery / reaction locks. Movement and guard are not buffered.

## Modes

- **Arcade:** local best-of-three match against the deterministic CPU rival. Rounds use a 99-second prototype timer.
- **Training:** passive dummy with knockback, gravity, and landing physics. The timer and score are frozen; health and guard recover two seconds after the last hit / block. Press Escape and choose **Reset Positions** to restore the setup.
- **Option:** toggle combat-box overlays and the state / frame-data inspector.
- **Online:** intentionally displays a not-connected notice. There is no network transport, matchmaking, or remote multiplayer yet.

In Arcade, a match ends when either fighter wins two rounds. Enter rematches after the match result. Escape opens the pause menu; Resume, Restart Mode, and Exit to Menu are available.

## Suggested first test pass

Use Training first, then play at least one Arcade set. Record the browser, operating system, screen size, and whether the issue is repeatable.

- [ ] Title screen and menu buttons work with mouse and keyboard.
- [ ] Arcade starts; both fighters stay visible and the camera scrolls at stage edges.
- [ ] A/D movement, jump, crouch, ground dash, and air dash feel responsive.
- [ ] Light / Medium / Heavy hit levels behave as described.
- [ ] Stand guard, crouch guard, chip damage, guard meter, and guard break work.
- [ ] Grounded Energy Shot always travels forward; airborne Energy Shot always travels diagonal down-forward; QCF+L Arc Lance launches forward.
- [ ] Light / Medium hit confirms, Medium launcher, air follow-ups, and juggle limit behave correctly.
- [ ] Training dummy is passive, can be launched, lands, can be hit by Heavy after landing, and can be reset.
- [ ] Pause / resume, restart, exit-to-menu, round transition, KO, timeout, and rematch work.
- [ ] Options toggle overlays without breaking the match.
- [ ] Hits, blocks, and guard breaks show distinct brief impact effects; world shake stays restrained and the HUD remains steady.
- [ ] No console errors, stuck keys, severe slowdown, or unreadable HUD / menu text.

The CI Chromium smoke suite automatically checks the basic title/menu, Online notice, Arcade pause / exit, Training reset, and narrow viewport flows. It does not validate combat feel, visual quality, or every browser.

This is a human test checklist, not a claim that every browser scenario or gameplay interaction has already been verified.

## Report a bug

Open a [GitHub issue](https://github.com/ItsLeoIso/bta.github.com/issues/new) and include:

- **Mode:** Arcade / Training / menu
- **Browser + version:**
- **OS + device / screen size:**
- **Steps:** exact inputs in order
- **Expected:**
- **Actual:**
- **Frequency:** every time / sometimes / once
- **Console error:** paste the message if one appears
- **Screenshot or short recording:** especially useful for visual / timing issues

Please report one issue per ticket where possible. For balance feedback, include the move, spacing, grounded / airborne state, and whether it hit, was blocked, or whiffed.

## Known limitations

- Placeholder fighter shapes and Canvas stage art; procedural impact sparks / screen shake are prototypes, not final character VFX. No final sprites, animation set, music, or sound effects.
- One playable CPU opponent; AI is deterministic and deliberately simple.
- Online is not implemented.
- Keyboard is the supported input path; no gamepad / touch controls or remapping.
- CPU waits 30 neutral frames after each attack before choosing another; attack / hitstun lockout does not consume that delay. CPU reaction, guard heights, round length, and movement values remain provisional.
- Human browser playtesting is still required for visual quality, feel, balance, and broad browser compatibility. Automated tests do not replace it.
