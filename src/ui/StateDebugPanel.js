/**
 * DOM-based live inspector for both fighters and the selected move's frame data.
 */
export class StateDebugPanel {
  constructor(root) {
    if (!root) throw new TypeError("StateDebugPanel requires a root element.");

    this.values = new Map(
      [...root.querySelectorAll("[data-debug-value]")].map(element => [
        element.dataset.debugValue,
        element
      ])
    );
    this.frames = new Map(
      [...root.querySelectorAll("[data-debug-frame]")].map(element => [
        element.dataset.debugFrame,
        element
      ])
    );
    this.frameStatus = root.querySelector?.("[data-debug-frame-status]") ?? null;
    this.frameNote = root.querySelector?.("[data-debug-frame-note]") ?? null;
  }

  update(arena) {
    this.updateFighter("player", arena.player);
    this.updateFighter("opponent", arena.opponent);
    this.updateFrameData(arena.player);
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
    } else if (state.action === "attack") {
      const data = fighter.actionData;
      actionDetail = `${data.moveName} · ${(data.hitLevel ?? "mid").toUpperCase()} · ${data.phase} ${data.phaseFrame}f`;
    } else if (state.action && state.action !== "none") {
      actionDetail = fighter.actionData?.moveName ?? state.action;
    }

    this.setValue(`${prefix}.action-detail`, actionDetail);
  }

  updateFrameData(fighter) {
    const isAttacking = fighter.state?.action === "attack";
    const data = isAttacking ? fighter.actionData : fighter.lastAttackData;
    const entries = {
      startup: data?.startupFrames,
      active: data?.activeFrames,
      recovery: data?.recoveryFrames,
      hit: data?.hitAdvantage,
      block: data?.blockAdvantage
    };

    for (const [key, value] of Object.entries(entries)) {
      this.setFrame(key, value ?? "—");
    }

    if (this.frameStatus) {
      this.frameStatus.textContent = !data
        ? "NO ATTACK SELECTED"
        : `${isAttacking ? "IN PROGRESS" : "LAST MOVE"} · ${data.name} · ${(data.hitLevel ?? "mid").toUpperCase()}`;
    }
    if (this.frameNote) {
      this.frameNote.textContent = data
        ? "High can be crouched under; Low misses airborne opponents. Timing is shown at 60 Hz."
        : "Press H / Light (High), J / Medium (Mid), or K / Heavy (Low).";
    }
  }

  setValue(key, value) {
    const element = this.values.get(key);
    if (element) element.textContent = value ?? "—";
  }

  setFrame(key, value) {
    const element = this.frames.get(key);
    if (element) element.textContent = value;
  }
}
