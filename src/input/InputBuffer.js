const BUFFERED_ACTIONS = Object.freeze(["light", "medium", "heavy", "special"]);
/**
 * Short, fixed-frame queue for combat button presses.
 *
 * Directional aim is not buffered: ordinary Energy Shot trajectories are fixed
 * by grounded / airborne state, while Arc Lance stores its facing snapshot.
 */
export class InputBuffer {
  constructor({ bufferFrames = 8 } = {}) {
    if (!Number.isInteger(bufferFrames) || bufferFrames < 1) {
      throw new RangeError("Input buffer duration must be a positive frame count.");
    }
    this.bufferFrames = bufferFrames;
    this.pending = null;
  }

  capture(input, frame, { excludeActions = [], specialMove = null, specialFacing = null } = {}) {
    if (!Number.isInteger(frame) || frame < 0) {
      throw new RangeError("Input buffer frame must be a non-negative integer.");
    }
    this.expire(frame);
    const excluded = new Set(excludeActions);
    // Same-frame tie priority preserves the existing Light > Medium > Heavy
    // attack selection, followed by Special. A later press replaces the slot.
    const action = BUFFERED_ACTIONS.find(
      candidate => !excluded.has(candidate) && Boolean(input.wasPressed?.(candidate))
    );
    if (!action) return false;

    this.pending = {
      action,
      pressedFrame: frame,
      expiresFrame: frame + this.bufferFrames - 1,
      specialMove: action === "special" ? specialMove : null,
      specialFacing: action === "special" && Number.isFinite(specialFacing)
        ? Math.sign(specialFacing) || 1
        : null
    };
    return true;
  }

  getInput(input, frame) {
    this.expire(frame);
    if (!this.pending) return input;

    const pending = this.pending;
    return {
      isBuffered: true,
      specialMove: pending.specialMove ?? null,
      specialFacing: pending.specialFacing ?? null,
      wasPressed: action =>
        action === pending.action || Boolean(input.wasPressed?.(action)),
      isDown: action => Boolean(input.isDown?.(action))
    };
  }

  consume(action) {
    if (!this.pending || this.pending.action !== action) return false;
    this.pending = null;
    return true;
  }

  remainingFrames(frame) {
    this.expire(frame);
    return this.pending ? this.pending.expiresFrame - frame + 1 : 0;
  }

  expire(frame) {
    if (this.pending && frame > this.pending.expiresFrame) {
      this.pending = null;
    }
  }

  clear() {
    this.pending = null;
  }
}
