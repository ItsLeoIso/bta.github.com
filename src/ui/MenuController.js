export const MENU_SCREENS = Object.freeze({
  TITLE: "title",
  MAIN: "main",
  ONLINE: "online",
  OPTIONS: "options",
  PLAYING: "playing",
  PAUSE: "pause"
});

export const MAIN_MENU_ITEMS = Object.freeze(["Arcade", "Online", "Training", "Option"]);

export const MENU_OPTIONS = Object.freeze([
  Object.freeze({ id: "showHitboxes", label: "Combat hitboxes" }),
  Object.freeze({ id: "showInspector", label: "State / frame inspector" })
]);

/** Pure menu state machine; DOM rendering stays in the browser entry layer. */
export class MenuController {
  constructor({
    onChange = () => {},
    onStart = () => {},
    onResetTraining = () => {}
  } = {}) {
    if (
      typeof onChange !== "function" ||
      typeof onStart !== "function" ||
      typeof onResetTraining !== "function"
    ) {
      throw new TypeError("Menu callbacks must be functions.");
    }
    this.onChange = onChange;
    this.onStart = onStart;
    this.onResetTraining = onResetTraining;
    this.screen = MENU_SCREENS.TITLE;
    this.selectedIndex = 0;
    this.optionIndex = 0;
    this.pauseSelectedIndex = 0;
    this.mode = null;
    this.options = { showHitboxes: false, showInspector: false };
  }

  getPauseItems() {
    return this.mode === "training"
      ? ["Resume", "Reset Positions", "Restart Mode", "Exit to Menu"]
      : ["Resume", "Restart Mode", "Exit to Menu"];
  }

  getViewModel() {
    return {
      screen: this.screen,
      selectedIndex: this.selectedIndex,
      optionIndex: this.optionIndex,
      pauseSelectedIndex: this.pauseSelectedIndex,
      pauseItems: this.getPauseItems(),
      mode: this.mode,
      options: { ...this.options },
      items: [...MAIN_MENU_ITEMS],
      optionItems: MENU_OPTIONS.map(option => ({
        ...option,
        enabled: this.options[option.id]
      }))
    };
  }

  notify() {
    this.onChange(this.getViewModel());
  }

  handleKey(key) {
    if (this.screen === MENU_SCREENS.PLAYING) return false;

    if (this.screen === MENU_SCREENS.PAUSE) {
      if (key === "Escape") {
        this.resume();
        return true;
      }
      const items = this.getPauseItems();
      if (key === "ArrowUp" || key.toLowerCase?.() === "w") {
        this.pauseSelectedIndex = (this.pauseSelectedIndex + items.length - 1) % items.length;
        this.notify();
        return true;
      }
      if (key === "ArrowDown" || key.toLowerCase?.() === "s") {
        this.pauseSelectedIndex = (this.pauseSelectedIndex + 1) % items.length;
        this.notify();
        return true;
      }
      if (key === "Enter" || key === " ") {
        this.selectPauseItem(this.pauseSelectedIndex);
        return true;
      }
      return false;
    }

    if (this.screen === MENU_SCREENS.TITLE) {
      if (key === "Enter" || key === " ") {
        this.screen = MENU_SCREENS.MAIN;
        this.notify();
        return true;
      }
      return false;
    }

    if (this.screen === MENU_SCREENS.MAIN) {
      if (key === "ArrowUp" || key.toLowerCase?.() === "w") {
        this.selectedIndex = (this.selectedIndex + MAIN_MENU_ITEMS.length - 1) % MAIN_MENU_ITEMS.length;
        this.notify();
        return true;
      }
      if (key === "ArrowDown" || key.toLowerCase?.() === "s") {
        this.selectedIndex = (this.selectedIndex + 1) % MAIN_MENU_ITEMS.length;
        this.notify();
        return true;
      }
      if (key === "Enter" || key === " ") {
        this.activateSelected();
        return true;
      }
      if (key === "Escape") {
        this.screen = MENU_SCREENS.TITLE;
        this.notify();
        return true;
      }
      return false;
    }

    if (this.screen === MENU_SCREENS.ONLINE) {
      if (key === "Escape" || key === "Enter") {
        this.back();
        return true;
      }
      return false;
    }

    if (this.screen === MENU_SCREENS.OPTIONS) {
      if (key === "Escape") {
        this.back();
        return true;
      }
      if (key === "ArrowUp" || key.toLowerCase?.() === "w") {
        this.optionIndex = (this.optionIndex + MENU_OPTIONS.length - 1) % MENU_OPTIONS.length;
        this.notify();
        return true;
      }
      if (key === "ArrowDown" || key.toLowerCase?.() === "s") {
        this.optionIndex = (this.optionIndex + 1) % MENU_OPTIONS.length;
        this.notify();
        return true;
      }
      if (key === "Enter" || key === " ") {
        this.toggleOption(MENU_OPTIONS[this.optionIndex].id);
        return true;
      }
    }
    return false;
  }

  selectItem(index) {
    if (this.screen !== MENU_SCREENS.MAIN || !Number.isInteger(index) ||
        index < 0 || index >= MAIN_MENU_ITEMS.length) return false;
    this.selectedIndex = index;
    this.activateSelected();
    return true;
  }

  selectOption(index) {
    if (this.screen !== MENU_SCREENS.OPTIONS || !Number.isInteger(index) ||
        index < 0 || index >= MENU_OPTIONS.length) return false;
    this.optionIndex = index;
    this.toggleOption(MENU_OPTIONS[index].id);
    return true;
  }

  selectPauseItem(index) {
    const items = this.getPauseItems();
    if (this.screen !== MENU_SCREENS.PAUSE || !Number.isInteger(index) ||
        index < 0 || index >= items.length) return false;
    this.pauseSelectedIndex = index;
    switch (items[index]) {
      case "Resume":
        this.resume();
        break;
      case "Reset Positions":
        this.onResetTraining();
        this.resume();
        break;
      case "Restart Mode":
        this.start(this.mode);
        break;
      case "Exit to Menu":
        this.exitToMenu();
        break;
      default:
        return false;
    }
    return true;
  }

  activateSelected() {
    switch (MAIN_MENU_ITEMS[this.selectedIndex]) {
      case "Arcade":
        this.start("arcade");
        break;
      case "Online":
        this.screen = MENU_SCREENS.ONLINE;
        this.notify();
        break;
      case "Training":
        this.start("training");
        break;
      case "Option":
        this.screen = MENU_SCREENS.OPTIONS;
        this.optionIndex = 0;
        this.notify();
        break;
      default:
        return false;
    }
    return true;
  }

  start(mode) {
    this.mode = mode;
    this.screen = MENU_SCREENS.PLAYING;
    this.onStart(mode, { ...this.options });
    this.notify();
  }

  pause() {
    if (this.screen !== MENU_SCREENS.PLAYING) return false;
    this.pauseSelectedIndex = 0;
    this.screen = MENU_SCREENS.PAUSE;
    this.notify();
    return true;
  }

  resume() {
    if (this.screen !== MENU_SCREENS.PAUSE) return false;
    this.screen = MENU_SCREENS.PLAYING;
    this.notify();
    return true;
  }

  exitToMenu() {
    if (this.screen !== MENU_SCREENS.PAUSE && this.screen !== MENU_SCREENS.PLAYING) {
      return false;
    }
    this.screen = MENU_SCREENS.MAIN;
    this.selectedIndex = 0;
    this.notify();
    return true;
  }

  toggleOption(id) {
    if (!MENU_OPTIONS.some(option => option.id === id)) return false;
    this.options[id] = !this.options[id];
    this.notify();
    return true;
  }

  back() {
    if (this.screen !== MENU_SCREENS.ONLINE && this.screen !== MENU_SCREENS.OPTIONS) {
      return false;
    }
    this.pendingMode = null;
    this.screen = MENU_SCREENS.MAIN;
    this.notify();
    return true;
  }
}
