/**
 * Fixed-frame directional history for fighting-game motion commands.
 * Directions are stored relative to the fighter's facing at sample time.
 */
export class CommandHistory {
  constructor({ motionWindowFrames = 24, historyFrames = 36 } = {}) {
    if (!Number.isInteger(motionWindowFrames) || motionWindowFrames < 1) {
      throw new RangeError("motionWindowFrames must be a positive integer.");
    }
    if (!Number.isInteger(historyFrames) || historyFrames < motionWindowFrames) {
      throw new RangeError("historyFrames must be at least motionWindowFrames.");
    }
    this.motionWindowFrames = motionWindowFrames;
    this.historyFrames = historyFrames;
    this.frame = 0;
    this.entries = [];
  }

  update(input, facing = 1) {
    this.frame += 1;
    const left = Boolean(input.isDown?.("left"));
    const right = Boolean(input.isDown?.("right"));
    const up = Boolean(input.isDown?.("jump"));
    const down = Boolean(input.isDown?.("crouch"));
    const horizontal = (Number(right) - Number(left)) * (facing < 0 ? -1 : 1);
    const vertical = Number(down) - Number(up);
    let direction = "neutral";
    if (vertical > 0) {
      direction = horizontal > 0 ? "downForward" : horizontal < 0 ? "downBack" : "down";
    } else if (vertical < 0) {
      direction = horizontal > 0 ? "upForward" : horizontal < 0 ? "upBack" : "up";
    } else if (horizontal > 0) {
      direction = "forward";
    } else if (horizontal < 0) {
      direction = "back";
    }
    const previous = this.entries[this.entries.length - 1];
    if (!previous || previous.direction !== direction) {
      this.entries.push({ direction, frame: this.frame });
    }
    this.entries = this.entries.filter(entry => this.frame - entry.frame <= this.historyFrames);
    return direction;
  }

  consumeQuarterCircleForward() {
    if (this.entries[this.entries.length - 1]?.direction !== "forward") return false;
    const directional = this.entries.filter(entry => entry.direction !== "neutral");
    if (directional.length < 3) return false;
    const sequence = directional.slice(-3);
    const matches =
      sequence[0].direction === "down" &&
      sequence[1].direction === "downForward" &&
      sequence[2].direction === "forward" &&
      this.frame - sequence[0].frame <= this.motionWindowFrames;
    if (!matches) return false;
    this.entries = [];
    return true;
  }

  reset() {
    this.frame = 0;
    this.entries = [];
  }
}
