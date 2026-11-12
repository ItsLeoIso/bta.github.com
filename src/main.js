import { GameLoop } from "./engine/GameLoop.js";
import { CanvasRenderer } from "./engine/CanvasRenderer.js";
import { Arena } from "./engine/Arena.js";
import { KeyboardInput } from "./input/KeyboardInput.js";
import { StateDebugPanel } from "./ui/StateDebugPanel.js";

const canvas = document.querySelector("#game-canvas");
const status = document.querySelector("#engine-status");
const stateDebugRoot = document.querySelector("#state-debug");
if (!canvas || !status || !stateDebugRoot) {
  throw new Error("BLT could not find a required game UI element.");
}

const input = new KeyboardInput(window);
const arena = new Arena();
const renderer = new CanvasRenderer(canvas);
const stateDebugPanel = new StateDebugPanel(stateDebugRoot);
let paused = false;
const loop = new GameLoop({
  update: (deltaSeconds) => {
    if (input.wasPressed("Escape")) paused = !paused;
    if (!paused) arena.update(deltaSeconds, input);
    input.endFrame();
  },
  render: (alpha) => {
    renderer.render(arena, alpha, paused);
    stateDebugPanel.update(arena);
    status.textContent = paused
      ? "PAUSED · PRESS ESC TO RESUME"
      : "ENGINE RUNNING · FIXED 60 HZ SIMULATION";
  }
});
input.attach();
renderer.attach();
loop.start();
window.addEventListener("beforeunload", () => {
  loop.stop();
  input.detach();
  renderer.detach();
}, { once: true });
