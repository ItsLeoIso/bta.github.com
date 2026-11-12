/**
 * Small DOM-based live inspector for fighter state and upcoming combat frame data.
 * Kept outside the Canvas renderer so the values stay selectable and accessible.
 */
export class StateDebugPanel {
  constructor(root) {
    if (!root) {
      throw new TypeError("StateDebugPanel requires a root element.");
    }

    this.values = new Map(
      [...root.querySelectorAll("[data-debug-value]")].map(element => [
        element.dataset.debugValue,
        element
      ])
    );
  }

  update(arena) {
    this.updateFighter("player", arena.player);
    this.updateFighter("opponent", arena.opponent);
  }

  updateFighter(prefix, fighter) {
    const state = fighter.state ?? {};
    this.setValue(`${prefix}.locomotion`, state.locomotion);
    this.setValue(`${prefix}.action`, state.action);
    this.setValue(`${prefix}.reaction`, state.reaction);

    let actionDetail = "—";
    if (state.action === "dash") {
      const dashType = fighter.actionData?.dashType ?? "dash";
      const remainingFrames = Math.max(
        0,
        Math.ceil((fighter.actionData?.remaining ?? 0) * 60)
      );
      actionDetail = `${dashType} · ${remainingFrames}f`;
    } else if (state.action && state.action !== "none") {
      actionDetail = fighter.actionData?.moveName ?? state.action;
    }

    this.setValue(`${prefix}.action-detail`, actionDetail);
  }

  setValue(key, value) {
    const element = this.values.get(key);
    if (element) element.textContent = value ?? "—";
  }
}
