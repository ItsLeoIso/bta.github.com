/** Fixed-step simulation loop with interpolated rendering. */
export class GameLoop {
  constructor({ update, render, fixedDelta = 1 / 60, maxFrameDelta = 0.25, onError = console.error }) {
    if (typeof update !== "function" || typeof render !== "function") throw new TypeError("GameLoop requires update and render functions.");
    this.update = update; this.render = render; this.fixedDelta = fixedDelta;
    this.maxFrameDelta = maxFrameDelta; this.onError = onError;
    this.accumulator = 0; this.lastTime = null; this.frameId = null; this.running = false;
    this.frame = this.frame.bind(this);
  }
  start() {
    if (this.running) return;
    this.running = true; this.lastTime = null;
    this.frameId = requestAnimationFrame(this.frame);
  }
  stop() {
    this.running = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null; this.lastTime = null; this.accumulator = 0;
  }
  frame(timestamp) {
    if (!this.running) return;
    try {
      const now = timestamp / 1000;
      if (this.lastTime === null) this.lastTime = now;
      const elapsed = Math.min(Math.max(0, now - this.lastTime), this.maxFrameDelta);
      this.lastTime = now; this.accumulator += elapsed;
      while (this.accumulator >= this.fixedDelta) {
        this.update(this.fixedDelta);
        this.accumulator -= this.fixedDelta;
      }
      this.render(this.accumulator / this.fixedDelta);
      this.frameId = requestAnimationFrame(this.frame);
    } catch (error) {
      this.stop(); this.onError(error);
    }
  }
}
