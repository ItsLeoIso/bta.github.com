import { getAvailableCharacters } from "../characters/CharacterDefinitions.js";

export const MENU_SCREENS = Object.freeze({
  TITLE: "title",
  INTRO: "intro",
  CHARACTER_SELECT: "character-select",
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
    this.pendingMode = null;
    this.characters = getAvailableCharacters();
    this.characterIndex = 0;
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
      pendingMode: this.pendingMode,
      characters: this.characters.map(character => ({
        id: character.id,
        name: character.name,
        archetype: character.archetype,
        description: character.description,
        stats: { ...character.stats }
      })),
      characterIndex: this.characterIndex,
      selectedCharacter: this.characters[this.characterIndex],
      opponentCharacter: this.characters[(this.characterIndex + 1) % this.characters.length],
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

  startIntro() {
    if (this.screen !== MENU_SCREENS.TITLE) return false;
    this.screen = MENU_SCREENS.INTRO;
    this.notify();
    return true;
  }

  finishIntro() {
    if (this.screen !== MENU_SCREENS.INTRO) return false;
    this.screen = MENU_SCREENS.MAIN;
    this.notify();
    return true;
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
      if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"].includes(key)) return false;
      this.startIntro();
      return true;
    }

    if (this.screen === MENU_SCREENS.INTRO) return true;

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

    if (this.screen === MENU_SCREENS.CHARACTER_SELECT) {
      if (key === "Escape") {
        this.pendingMode = null;
        this.screen = MENU_SCREENS.MAIN;
        this.notify();
        return true;
      }
      if (key === "ArrowLeft" || key.toLowerCase?.() === "a") {
        this.changeCharacter(-1);
        return true;
      }
      if (key === "ArrowRight" || key.toLowerCase?.() === "d") {
        this.changeCharacter(1);
        return true;
      }
      if (key === "Enter" || key === " ") {
        this.confirmCharacter();
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
        this.openCharacterSelect("arcade");
        break;
      case "Online":
        this.screen = MENU_SCREENS.ONLINE;
        this.notify();
        break;
      case "Training":
        this.openCharacterSelect("training");
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

  openCharacterSelect(mode) {
    if (mode !== "arcade" && mode !== "training") return false;
    this.pendingMode = mode;
    this.screen = MENU_SCREENS.CHARACTER_SELECT;
    this.notify();
    return true;
  }

  changeCharacter(direction) {
    if (this.screen !== MENU_SCREENS.CHARACTER_SELECT || !Number.isFinite(direction)) return false;
    const step = Math.sign(direction);
    if (step === 0) return false;
    this.characterIndex = (this.characterIndex + step + this.characters.length) % this.characters.length;
    this.notify();
    return true;
  }

  selectCharacter(index) {
    if (this.screen !== MENU_SCREENS.CHARACTER_SELECT || !Number.isInteger(index) ||
        index < 0 || index >= this.characters.length) return false;
    this.characterIndex = index;
    this.notify();
    return true;
  }

  confirmCharacter() {
    if (this.screen !== MENU_SCREENS.CHARACTER_SELECT || !this.pendingMode) return false;
    const player = this.characters[this.characterIndex];
    const opponent = this.characters[(this.characterIndex + 1) % this.characters.length];
    this.start(this.pendingMode, {
      playerCharacterId: player.id,
      opponentCharacterId: opponent.id
    });
    this.pendingMode = null;
    return true;
  }

  start(mode, characterSelection = null) {
    this.mode = mode;
    this.screen = MENU_SCREENS.PLAYING;
    this.onStart(mode, {
      ...this.options,
      playerCharacterId: characterSelection?.playerCharacterId ?? this.characters[this.characterIndex].id,
      opponentCharacterId: characterSelection?.opponentCharacterId ??
        this.characters[(this.characterIndex + 1) % this.characters.length].id
    });
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
    if (this.screen !== MENU_SCREENS.ONLINE && this.screen !== MENU_SCREENS.OPTIONS &&
        this.screen !== MENU_SCREENS.CHARACTER_SELECT) {
      return false;
    }
    this.pendingMode = null;
    this.screen = MENU_SCREENS.MAIN;
    this.notify();
    return true;
  }
}
