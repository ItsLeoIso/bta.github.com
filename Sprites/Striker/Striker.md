# Striker — Character & Sprite Asset Brief

> **Status:** Art brief / awaiting Gemini-generated source assets  
> **Game:** BTA — Belt to Ass  
> **Character ID:** `striker`  
> **Facing convention:** gameplay sprites face RIGHT by default  
> **Background:** transparent PNG; no baked-in stage, floor, glow, labels, or watermark

## Character identity

Striker is BTA's first playable fighter. He should read instantly as a fast, confident, close-range anime brawler: lean and athletic rather than bulky, with a sharp silhouette and expressive attacks.

### Visual design

- Tousled, spiky silver-white hair; keep the silhouette recognizable in every frame.
- Charcoal / near-black sleeveless combat jacket with restrained violet trim.
- Dark fitted trousers, a violet sash or short waist accent, fingerless gloves, and practical combat boots.
- Violet and magenta energy accents are reserved for special-move effects; do not let effects obscure the body silhouette.
- Anime-inspired face and proportions translated into crisp, deliberate pixel clusters.
- Keep clothing layers, hair shape, palette, and body proportions consistent across all views and animations.

### Palette guide

Use these as target colour families, not rigid single-colour fills:

| Feature | Palette direction |
| --- | --- |
| Hair | Silver, cool light grey, small white highlights |
| Jacket / trousers | Charcoal, near-black, cool dark-grey highlights |
| Trim / sash | Muted violet with brighter purple accents |
| Energy | Violet, magenta, a small amount of pale lavender |
| Skin | Natural mid-tone with readable light and shadow |

## Pixel-art direction

- High-resolution pixel art with clean clusters and deliberate outlines (not blurred or vector-smooth).
- Strong fighting-game readability at the game's normal canvas scale.
- Side-on 2D fighting-game view; show enough of the face and torso to read the pose.
- Consistent character scale, head size, limb lengths, and foot baseline across every animation.
- Keep all limbs and effects inside each frame's safe bounds. Allow extra horizontal padding for long attacks.
- Transparent PNG with true alpha. Do not use a checkerboard pattern as fake transparency.
- Do not put multiple poses on a single background or provide a presentation/mockup instead of source sheets.

## Asset production order

Generate and approve a **character reference sheet first**. Do not generate all animation sheets until the reference design is accepted.

### 1. Character reference sheet

Required views / poses:
- Full-body neutral side view facing RIGHT (the canonical gameplay view).
- Full-body front and back views for design consistency.
- Neutral fighting stance facing RIGHT.
- Close-up head / face detail and a compact palette swatch.

The reference sheet is for approval and is not itself a runtime sprite atlas.

### 2. Runtime animation sheets

Create each animation as a separate transparent PNG. Every frame in a sheet must have identical dimensions and be laid out on a regular grid with no labels or spacing ambiguity.

| Asset key | Required content | Initial target |
| --- | --- | ---: |
| `idle` | breathing / subtle stance loop | 6 frames |
| `walk` | complete forward walk cycle | 8 frames |
| `crouch` | enter, hold, and return to standing | 4 frames |
| `jump` | take-off, rise, apex, fall, landing | 6 frames |
| `dash` | forward dash and recovery | 5 frames |
| `back-dash` | retreat dash and recovery | 5 frames |
| `light` | fast punch | 4 frames |
| `medium` | stronger strike | 6 frames |
| `heavy` | powerful committed attack | 7 frames |
| `energy-shot` | grounded forward throw / firing pose | 5 frames |
| `arc-lance` | QCF special casting / thrust pose | 7 frames |
| `guard` | standing guard loop | 3 frames |
| `crouch-guard` | low guard loop | 3 frames |
| `hit-light` | brief light-hit reaction | 3 frames |
| `hit-heavy` | stronger hit reaction | 4 frames |
| `knockdown` | fall and grounded recovery poses | 6 frames |
| `victory` | short post-round victory pose / loop | 6 frames |

Frame counts are initial art targets. The runtime animation clips may be retimed or adjusted after reviewing the actual sheets.

## Technical delivery contract

For every runtime sheet, include a small metadata note containing:

- Exact PNG filename.
- Frame width and height in pixels.
- Columns and rows.
- Frame count and reading order (left-to-right, top-to-bottom).
- Suggested frames per second or per-frame duration.
- Whether the clip loops.
- Any frames that should be held longer (for example, attack contact / anticipation).

Naming convention:

- `striker-reference.png` — approval reference only.
- `striker-idle.png`
- `striker-walk.png`
- `striker-crouch.png`
- `striker-jump.png`
- `striker-dash.png`
- `striker-back-dash.png`
- `striker-light.png`
- `striker-medium.png`
- `striker-heavy.png`
- `striker-energy-shot.png`
- `striker-arc-lance.png`
- `striker-guard.png`
- `striker-crouch-guard.png`
- `striker-hit-light.png`
- `striker-hit-heavy.png`
- `striker-knockdown.png`
- `striker-victory.png`

The reference image must never be configured as a runtime animation atlas.

## Gameplay-facing constraints

- Base character art faces RIGHT. The game renderer is responsible for mirroring when the fighter faces LEFT; do not generate separate left-facing copies unless requested.
- Keep the feet aligned to a consistent bottom baseline, especially for idle, walk, crouch, jump landing, and attacks.
- Attack poses must communicate anticipation, contact, and recovery. Do not bake hit sparks, damage numbers, or screen effects into the character sheets; those are handled by the game.
- Energy Shot is a grounded, forward-only firing pose. Arc Lance is a distinct special-move pose.
- Avoid cropping fists, hair, sash, or boots. Heavy and special attacks may need wider frame cells than idle.
- Keep the character's centre / pivot position consistent where practical; record any intentional pivot offsets in metadata.

## Gemini generation prompt

Create the **Striker character reference sheet only** for BTA, following the design and pixel-art direction above. Show front, back, canonical side view facing RIGHT, and a neutral fighting stance. Keep the same exact hair, clothing, body proportions, and palette in every view. Use crisp pixel clusters, transparent background, and no text, watermark, stage, floor, or decorative frame. This is a character-design approval sheet, not a sprite atlas. Do not create the animation sheets yet.

After approval, generate one animation sheet at a time, using the accepted reference as the strict character identity reference. Never redesign the character between sheets.

## Integration status

- [ ] Reference sheet generated and approved.
- [ ] Runtime animation sheets generated.
- [ ] PNG dimensions / alpha / grid verified.
- [ ] Assets retrieved from the designated sprite-pickup repository.
- [ ] Atlas metadata connected to the existing `striker` character definition.
- [ ] Animation timing and baseline visually checked in-game.
- [ ] Browser regression coverage added for sprite loading and fallback rendering.

**Important:** Until source PNGs are present and verified, keep Striker's current in-game placeholder renderer active. Do not point the runtime atlas at guessed filenames or unverified assets.
