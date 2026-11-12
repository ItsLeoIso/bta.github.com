import test from "node:test";
import assert from "node:assert/strict";
import { StateDebugPanel } from "../src/ui/StateDebugPanel.js";

function makePanelRoot() {
  const keys = [
    "player.locomotion", "player.action", "player.reaction", "player.action-detail",
    "opponent.locomotion", "opponent.action", "opponent.reaction", "opponent.action-detail"
  ];
  const elements = keys.map(key => ({
    dataset: { debugValue: key },
    textContent: ""
  }));
  return { elements, querySelectorAll: () => elements };
}

test("state inspector displays both fighters' live state channels", () => {
  const root = makePanelRoot();
  const panel = new StateDebugPanel(root);
  const arena = {
    player: {
      state: { locomotion: "jumping", action: "none", reaction: "hitstun" },
      actionData: {}
    },
    opponent: {
      state: { locomotion: "standing", action: "guard", reaction: "none" },
      actionData: {}
    }
  };

  panel.update(arena);

  const values = Object.fromEntries(
    root.elements.map(element => [element.dataset.debugValue, element.textContent])
  );
  assert.equal(values["player.locomotion"], "jumping");
  assert.equal(values["player.reaction"], "hitstun");
  assert.equal(values["opponent.action"], "guard");
  assert.equal(values["opponent.locomotion"], "standing");
});

test("state inspector shows dash type and remaining frames", () => {
  const root = makePanelRoot();
  const panel = new StateDebugPanel(root);
  const arena = {
    player: {
      state: { locomotion: "falling", action: "dash", reaction: "none" },
      actionData: { dashType: "air", remaining: 0.15 }
    },
    opponent: {
      state: { locomotion: "standing", action: "none", reaction: "none" },
      actionData: {}
    }
  };

  panel.update(arena);

  const values = Object.fromEntries(
    root.elements.map(element => [element.dataset.debugValue, element.textContent])
  );
  assert.equal(values["player.action-detail"], "air · 9f");
  assert.equal(values["opponent.action-detail"], "—");
});
