export const INPUT_BITS = Object.freeze({
  left: 0x0001,
  right: 0x0002,
  jump: 0x0004,
  crouch: 0x0008,
  light: 0x0010,
  medium: 0x0020,
  heavy: 0x0040,
  special: 0x0080
});

export const KNOWN_INPUT_MASK = 0x00ff;

const ACTION_ENTRIES = Object.freeze(Object.entries(INPUT_BITS));

function validateInputMask(mask, label = "Input mask") {
  if (!Number.isInteger(mask) || mask < 0 || mask > 0xffff) {
    throw new RangeError(`${label} must be an integer between 0 and 0xffff.`);
  }
  return mask & KNOWN_INPUT_MASK;
}

/**
 * Packs a logical input provider (KeyboardInput, AI, or test double) into the
 * canonical 16-bit frame input mask. Reserved upper bits are always zeroed.
 */
export function encodeInputMask(input) {
  if (!input || typeof input !== "object") return 0;

  let mask = 0;
  for (const [action, bit] of ACTION_ENTRIES) {
    if (Boolean(input.isDown?.(action))) {
      mask |= bit;
    }
  }

  // Fallback for axis-only providers (e.g. OpponentAIController / test mocks)
  // that report horizontal hold via getWorldAxis without populating left/right in isDown.
  if ((mask & (INPUT_BITS.left | INPUT_BITS.right)) === 0 && typeof input.getWorldAxis === "function") {
    const axis = input.getWorldAxis("horizontal");
    if (axis < 0) mask |= INPUT_BITS.left;
    else if (axis > 0) mask |= INPUT_BITS.right;
  }

  return mask & KNOWN_INPUT_MASK;
}

/**
 * Creates a stateless per-frame logical input view from the current and previous
 * 16-bit input masks. Edge-triggered presses are derived deterministically as
 * (currentMask & ~previousMask) so rollback replays produce identical edges.
 */
export function createBitmaskInputFrame(mask, previousMask = 0) {
  const held = validateInputMask(mask, "Current input mask");
  const previous = validateInputMask(previousMask, "Previous input mask");
  const pressed = (held & ~previous) & KNOWN_INPUT_MASK;

  const isDown = action => {
    const bit = INPUT_BITS[action];
    return bit !== undefined && (held & bit) !== 0;
  };
  const wasPressed = action => {
    const bit = INPUT_BITS[action];
    return bit !== undefined && (pressed & bit) !== 0;
  };
  const getWorldAxis = (axis = "horizontal") => {
    if (axis !== "horizontal") return 0;
    const right = (held & INPUT_BITS.right) !== 0 ? 1 : 0;
    const left = (held & INPUT_BITS.left) !== 0 ? 1 : 0;
    return right - left;
  };
  const getAxis = (axis = "horizontal", facing = 1) => getWorldAxis(axis) * facing;

  return Object.freeze({
    mask: held,
    previousMask: previous,
    pressedMask: pressed,
    isDown,
    wasPressed,
    getWorldAxis,
    getAxis
  });
}

/**
 * Tracks previousMask across fixed simulation frames so each frame's bitmask
 * yields deterministic held and edge-triggered input views for Arena slots.
 */
export class BitmaskInputAdapter {
  constructor({ initialMask = 0 } = {}) {
    this.previousMask = validateInputMask(initialMask, "Initial input mask");
  }

  nextFrame(mask) {
    const frame = createBitmaskInputFrame(mask, this.previousMask);
    this.previousMask = frame.mask;
    return frame;
  }

  nextFrameFromInput(input) {
    return this.nextFrame(encodeInputMask(input));
  }

  getPreviousMask() {
    return this.previousMask;
  }

  setPreviousMask(mask) {
    this.previousMask = validateInputMask(mask, "Previous input mask");
  }

  reset() {
    this.previousMask = 0;
  }
}
