import { GameLoop } from "./engine/GameLoop.js";
import { CanvasRenderer } from "./engine/CanvasRenderer.js";
import { Arena } from "./engine/Arena.js";
import { KeyboardInput } from "./input/KeyboardInput.js";

const canvas = document.querySelector("#game-canvas");
const status = document.querySelector("#engine-status");
if (!canvas || !status) throw new Error("BLT could not find its canvas or status element.");

const input = new KeyboardInput(window);
const arena = new Arena();
const renderer = new CanvasRenderer(canvas);
let paused = false;
const loop = new GameLoop({
  update: (deltaSeconds) => {
    if (input.wasPressed("Escape")) paused = !paused;
    if (!paused) arena.update(deltaSeconds, input);
    input.endFrame();
  },
  render: (alpha) => {
    renderer.render(arena, alpha, paused);
    status.textContent = paused ? "PAUSED · PRESS ESC TO RESUME" : "ENGINE RUNNING · FIXED 60 HZ SIMULATION";
  }
});
input.attach();
renderer.attach();
loop.start();
window.addEventListener("beforeunload", () => {
  loop.stop(); input.detach(); renderer.detach();
}, { once: true });
