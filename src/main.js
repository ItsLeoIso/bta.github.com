import { GameLoop } from "./engine/GameLoop.js";
import { CanvasRenderer } from "./engine/CanvasRenderer.js";
import { Arena } from "./engine/Arena.js";
import { KeyboardInput } from "./input/KeyboardInput.js";
import { StateDebugPanel } from "./ui/StateDebugPanel.js";

const canvas = document.querySelector("#game-canvas");
const status = document.querySelector("#engine-status");
const stateDebugRoot = document.querySelector("#state-debug");

function reportEngineError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("BLT engine error:", error);
  if (status) {
    status.dataset.error = "true";
    status.textContent = `ENGINE ERROR · ${message.slice(0, 180)}`;
  }
}

window.addEventListener("error", (event) => {
  reportEngineError(event.error ?? event.message ?? "Unknown browser error");
});
window.addEventListener("unhandledrejection", (event) => {
  reportEngineError(event.reason ?? "Unhandled startup error");
});

if (!canvas || !status || !stateDebugRoot) {
  reportEngineError(new Error("BLT could not find a required game UI element."));
  throw new Error("BLT could not find a required game UI element.");
}

try {
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
      status.dataset.error = "false";
      status.textContent = paused
        ? "PAUSED · PRESS ESC TO RESUME"
        : "ENGINE RUNNING · FIXED 60 HZ SIMULATION";
    },
    onError: reportEngineError
  });

  input.attach();
  renderer.attach();
  loop.start();
  window.addEventListener("beforeunload", () => {
    loop.stop();
    input.detach();
    renderer.detach();
  }, { once: true });
} catch (error) {
  reportEngineError(error);
  throw error;
}
