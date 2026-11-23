import { GameLoop } from "./engine/GameLoop.js";
import { CanvasRenderer } from "./engine/CanvasRenderer.js";
import { Arena } from "./engine/Arena.js";
import { KeyboardInput } from "./input/KeyboardInput.js";
import { StateDebugPanel } from "./ui/StateDebugPanel.js";
import { ROUND_PHASES } from "./combat/RoundController.js";
import { MenuController, MENU_SCREENS } from "./ui/MenuController.js";

const canvas = document.querySelector("#game-canvas");
const status = document.querySelector("#engine-status");
const stateDebugRoot = document.querySelector("#state-debug");
const gamePanel = document.querySelector(".game-panel");
const controlsRoot = document.querySelector(".controls");
const menuRoot = document.querySelector("#front-menu");
const menuContent = document.querySelector("#front-menu-content");


function createFighterArt(className) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 240 360");
  svg.setAttribute("class", className);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Striker placeholder fighter pose");
  svg.setAttribute("focusable", "false");
  const add = (tag, attributes) => {
    const element = document.createElementNS(svgNS, tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    svg.append(element);
    return element;
  };
  add("path", { d: "M78 75 L70 40 L94 53 L111 23 L133 52 L163 38 L151 83 L139 101 L91 101 Z", fill: "#21172c", stroke: "#d59af0", "stroke-width": 5 });
  add("rect", { x: 91, y: 70, width: 53, height: 61, fill: "#d6b4cf", stroke: "#f7e4ff", "stroke-width": 4 });
  add("rect", { x: 102, y: 91, width: 8, height: 5, fill: "#21172c" });
  add("rect", { x: 126, y: 91, width: 8, height: 5, fill: "#21172c" });
  add("path", { d: "M82 135 L151 128 L177 207 L150 231 L74 220 L57 174 Z", fill: "#4d315f", stroke: "#c58bdc", "stroke-width": 5 });
  add("path", { d: "M77 146 L42 174 L18 154 L8 167 L39 205 L95 183", fill: "#9b72b0", stroke: "#e2b6f1", "stroke-width": 5, "stroke-linejoin": "miter" });
  add("path", { d: "M150 145 L177 159 L199 139 L213 151 L186 191 L151 181", fill: "#8a628f", stroke: "#d7a4e5", "stroke-width": 5 });
  add("path", { d: "M83 218 L150 225 L151 259 L130 278 L93 269 L66 251 Z", fill: "#272033", stroke: "#b77dcc", "stroke-width": 5 });
  add("path", { d: "M91 263 L130 271 L116 325 L83 337 L70 325 Z", fill: "#4a345b", stroke: "#c38bd7", "stroke-width": 5 });
  add("path", { d: "M130 270 L157 256 L177 310 L165 337 L135 329 L119 299 Z", fill: "#392b49", stroke: "#c38bd7", "stroke-width": 5 });
  add("path", { d: "M70 324 L111 326 L113 344 L58 344 Z M140 326 L170 330 L185 346 L135 346 Z", fill: "#17131f", stroke: "#d6a0e9", "stroke-width": 4 });
  add("path", { d: "M6 166 L17 149 L34 148 L45 158 L38 177 L19 182 Z", fill: "#e3c5df", stroke: "#fff0ff", "stroke-width": 4 });
  return svg;
}

let introTimer = null;
let titleAudioContext = null;
let titleMusicStarted = false;

function startTitleMusic() {
  if (titleMusicStarted) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    titleAudioContext ??= new AudioContextClass();
    const context = titleAudioContext;
    void context.resume();
    const sampleRate = context.sampleRate;
    const duration = 4;
    const buffer = context.createBuffer(1, sampleRate * duration, sampleRate);
    const channel = buffer.getChannelData(0);
    const melody = [659.25, 783.99, 987.77, 783.99, 587.33, 698.46, 880, 698.46, 523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 1046.5, 783.99, 987.77, 1174.66, 987.77];
    const bass = [82.41, 82.41, 110, 110, 73.42, 73.42, 98, 98];
    for (let index = 0; index < channel.length; index += 1) {
      const time = index / sampleRate;
      const step = Math.floor(time / 0.2);
      const noteTime = time % 0.2;
      const melodyFrequency = melody[step % melody.length];
      const bassFrequency = bass[Math.floor(time / 0.5) % bass.length];
      const envelope = Math.min(1, noteTime * 45) * Math.max(0, 1 - noteTime / 0.2);
      const lead = Math.sign(Math.sin(2 * Math.PI * melodyFrequency * time)) * 0.12 * envelope;
      const low = Math.sin(2 * Math.PI * bassFrequency * time) * 0.15;
      const kickPhase = time % 0.4;
      const kick = Math.sin(2 * Math.PI * (55 - 35 * kickPhase) * kickPhase) *
        Math.exp(-kickPhase * 18) * 0.2;
      channel[index] = lead + low + kick;
    }
    const source = context.createBufferSource();
    const volume = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    volume.gain.value = 0.24;
    source.connect(volume);
    volume.connect(context.destination);
    source.start();
    titleMusicStarted = true;
  } catch (error) {
    console.warn("BTA title music unavailable:", error);
  }
}

function playPunchImpact() {
  if (!titleAudioContext) return;
  try {
    const context = titleAudioContext;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(125, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(32, context.currentTime + 0.16);
    volume.gain.setValueAtTime(0.22, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.19);
  } catch {
    // Audio is an enhancement; the opening transition must always work.
  }
}

function reportEngineError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("BTA engine error:", error);
  if (status) {
    status.dataset.error = "true";
    status.textContent = "ENGINE ERROR · " + message.slice(0, 180);
  }
}

window.addEventListener("error", (event) => {
  reportEngineError(event.error ?? event.message ?? "Unknown browser error");
});
window.addEventListener("unhandledrejection", (event) => {
  reportEngineError(event.reason ?? "Unhandled startup error");
});

if (!canvas || !status || !stateDebugRoot || !gamePanel || !controlsRoot || !menuRoot || !menuContent) {
  reportEngineError(new Error("BTA could not find a required game UI element."));
  throw new Error("BTA could not find a required game UI element.");
}

try {
  const input = new KeyboardInput(window);
  const renderer = new CanvasRenderer(canvas);
  const stateDebugPanel = new StateDebugPanel(stateDebugRoot);
  let arena = new Arena();
  let gameStarted = false;

  gamePanel.hidden = true;
  stateDebugRoot.hidden = true;
  controlsRoot.hidden = true;

  const makeButton = (label, className, onClick, pressed = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    if (pressed) button.setAttribute("aria-pressed", "true");
    button.addEventListener("click", onClick);
    return button;
  };

  const menu = new MenuController({
    onResetTraining: () => arena.resetTraining(),
    onStart: (mode, options) => {
      arena = new Arena({
        opponentAIEnabled: mode === "arcade",
        trainingMode: mode === "training",
        playerCharacterId: options.playerCharacterId,
        opponentCharacterId: options.opponentCharacterId
      });
      renderer.showHitboxes = options.showHitboxes;
      stateDebugRoot.hidden = !options.showInspector;
      gamePanel.hidden = false;
      controlsRoot.hidden = false;
      menuRoot.hidden = true;
      gameStarted = true;
      status.textContent = mode === "training"
        ? "TRAINING MODE · DUMMY AUTO-RECOVERS"
        : "ARCADE MODE · CPU RIVAL ACTIVE";
    },
    onChange: handleMenuChange
  });

  function handleMenuChange(view) {
    if (view.screen === MENU_SCREENS.INTRO) {
      startTitleMusic();
      playPunchImpact();
      if (introTimer !== null) window.clearTimeout(introTimer);
      introTimer = window.setTimeout(() => {
        introTimer = null;
        menu.finishIntro();
      }, 1850);
    }
    if(view.screen===MENU_SCREENS.MAIN && gameStarted){
      gameStarted=false;
      gamePanel.hidden=true;
      controlsRoot.hidden=true;
      stateDebugRoot.hidden=true;
      status.textContent="SELECT MODE · ENTER TO CONFIRM";
    }
    menuRoot.hidden=view.screen===MENU_SCREENS.PLAYING;
    renderMenu(view);
  }

  function renderMenu(view = menu.getViewModel()) {
    menuContent.replaceChildren();
    menuRoot.querySelectorAll(".menu-fighter-art, .opening-fighter-art").forEach(element => element.remove());
    menuRoot.dataset.screen = view.screen;

    if (view.screen === MENU_SCREENS.TITLE) {
      const title = document.createElement("button");
      title.type = "button";
      title.className = "opening-start";
      title.textContent = "START";
      title.setAttribute("aria-label", "Start BTA");
      const hint = document.createElement("p");
      hint.className = "opening-hint";
      hint.textContent = "PRESS ANY BUTTON";
      menuContent.append(title, hint);
      return;
    }

    if (view.screen === MENU_SCREENS.INTRO) {
      const scene = document.createElement("div");
      scene.className = "opening-scene";
      const word = document.createElement("div");
      word.className = "opening-word";
      word.textContent = "START";
      const impact = document.createElement("div");
      impact.className = "opening-impact";
      impact.setAttribute("aria-hidden", "true");
      scene.append(word, impact, createFighterArt("opening-fighter-art"));
      menuContent.append(scene);
      return;
    }

    if (view.screen === MENU_SCREENS.MAIN) {
      const title = document.createElement("h2");
      title.textContent = "MAIN MENU";
      const subtitle = document.createElement("p");
      subtitle.className = "menu-subtitle";
      subtitle.textContent = "SELECT YOUR MODE";
      const list = document.createElement("div");
      list.className = "menu-list";
      view.items.forEach((item, index) => {
        const button = makeButton(
          (index === view.selectedIndex ? "▶  " : "   ") + item.toUpperCase(),
          "menu-choice" + (index === view.selectedIndex ? " is-selected" : ""),
          () => menu.selectItem(index),
          index === view.selectedIndex
        );
        list.append(button);
      });
      const hint = document.createElement("p");
      hint.className = "menu-hint";
      hint.textContent = "W / S OR ↑ / ↓ TO SELECT · ENTER TO CONFIRM";
      menuContent.append(title, subtitle, list, hint);
      menuRoot.append(createFighterArt("menu-fighter-art"));
      return;
    }

    if (view.screen === MENU_SCREENS.CHARACTER_SELECT) {
      const title = document.createElement("h2");
      title.textContent = "SELECT YOUR FIGHTER";
      const subtitle = document.createElement("p");
      subtitle.className = "menu-subtitle";
      subtitle.textContent = (view.pendingMode === "training" ? "TRAINING MODE" : "ARCADE MODE") + " · CHOOSE YOUR MATCHUP";

      const matchup = document.createElement("div");
      matchup.className = "character-select__matchup";

      const playerCard = document.createElement("section");
      playerCard.className = "character-card character-card--player";
      playerCard.dataset.characterId = view.selectedCharacter.id;
      playerCard.dataset.testid = "character-select-player";
      const playerRole = document.createElement("p");
      playerRole.className = "character-card__role";
      playerRole.textContent = "PLAYER 01";
      const playerName = document.createElement("h3");
      playerName.textContent = view.selectedCharacter.name;
      const playerArchetype = document.createElement("p");
      playerArchetype.className = "character-card__archetype";
      playerArchetype.textContent = view.selectedCharacter.archetype;
      const playerDescription = document.createElement("p");
      playerDescription.className = "character-card__description";
      playerDescription.textContent = view.selectedCharacter.description;
      const playerStats = document.createElement("dl");
      playerStats.className = "character-card__stats";
      [
        ["MOVE SPEED", String(view.selectedCharacter.stats.moveSpeed)],
        ["DAMAGE", (view.selectedCharacter.stats.damageMultiplier * 100).toFixed(0) + "%"]
      ].forEach(([label, value]) => {
        const item = document.createElement("div");
        const term = document.createElement("dt");
        term.textContent = label;
        const detail = document.createElement("dd");
        detail.textContent = value;
        item.append(term, detail);
        playerStats.append(item);
      });
      playerCard.append(playerRole, playerName, playerArchetype, playerDescription, playerStats);

      const versus = document.createElement("div");
      versus.className = "character-select__versus";
      versus.textContent = "VS";

      const opponentCard = document.createElement("section");
      opponentCard.className = "character-card character-card--opponent";
      opponentCard.dataset.characterId = view.opponentCharacter.id;
      const opponentRole = document.createElement("p");
      opponentRole.className = "character-card__role";
      opponentRole.textContent = view.pendingMode === "training" ? "TRAINING DUMMY" : "CPU RIVAL";
      const opponentName = document.createElement("h3");
      opponentName.textContent = view.opponentCharacter.name;
      const opponentArchetype = document.createElement("p");
      opponentArchetype.className = "character-card__archetype";
      opponentArchetype.textContent = view.opponentCharacter.archetype;
      const opponentStats = document.createElement("dl");
      opponentStats.className = "character-card__stats";
      [
        ["MOVE SPEED", String(view.opponentCharacter.stats.moveSpeed)],
        ["DAMAGE", (view.opponentCharacter.stats.damageMultiplier * 100).toFixed(0) + "%"]
      ].forEach(([label, value]) => {
        const item = document.createElement("div");
        const term = document.createElement("dt");
        term.textContent = label;
        const detail = document.createElement("dd");
        detail.textContent = value;
        item.append(term, detail);
        opponentStats.append(item);
      });
      opponentCard.append(opponentRole, opponentName, opponentArchetype, opponentStats);
      matchup.append(playerCard, versus, opponentCard);

      const navigation = document.createElement("div");
      navigation.className = "character-select__navigation";
      navigation.append(
        makeButton("← PREVIOUS", "menu-choice character-nav", () => menu.changeCharacter(-1)),
        makeButton("NEXT →", "menu-choice character-nav", () => menu.changeCharacter(1))
      );
      const actions = document.createElement("div");
      actions.className = "character-select__actions";
      actions.append(
        makeButton("BACK", "menu-choice character-back", () => menu.back()),
        makeButton("CONFIRM FIGHTER", "menu-primary character-confirm", () => menu.confirmCharacter())
      );
      const hint = document.createElement("p");
      hint.className = "menu-hint";
      hint.textContent = "A / D OR ← / → TO CHANGE · ENTER TO CONFIRM · ESC TO BACK";
      menuContent.append(title, subtitle, matchup, navigation, actions, hint);
      return;
    }

    if (view.screen === MENU_SCREENS.PAUSE) {
      const title = document.createElement("h2");
      title.textContent = "PAUSED";
      const subtitle = document.createElement("p");
      subtitle.className = "menu-subtitle";
      subtitle.textContent = "MATCH SUSPENDED";
      const list = document.createElement("div");
      list.className = "menu-list";
      view.pauseItems.forEach((item,index) => {
        const selected=index===view.pauseSelectedIndex;
        list.append(makeButton(
          (selected ? "▶  " : "   ") + item.toUpperCase(),
          "menu-choice" + (selected ? " is-selected" : ""),
          () => menu.selectPauseItem(index),
          selected
        ));
      });
      const hint = document.createElement("p");
      hint.className = "menu-hint";
      hint.textContent = "W / S OR ↑ / ↓ TO SELECT · ENTER · ESC TO RESUME";
      menuContent.append(title,subtitle,list,hint);
      return;
    }

    if (view.screen === MENU_SCREENS.ONLINE) {
      const title = document.createElement("h2");
      title.textContent = "ONLINE";
      const message = document.createElement("p");
      message.className = "menu-message";
      message.textContent = "NETWORK MATCHMAKING IS NOT CONNECTED YET. LOCAL ARCADE AND TRAINING ARE READY.";
      const hint = document.createElement("p");
      hint.className = "menu-hint";
      hint.textContent = "PRESS ENTER OR ESC TO RETURN";
      const back = makeButton("BACK", "menu-primary", () => menu.back());
      menuContent.append(title, message, hint, back);
      return;
    }

    if (view.screen === MENU_SCREENS.OPTIONS) {
      const title = document.createElement("h2");
      title.textContent = "OPTIONS";
      const subtitle = document.createElement("p");
      subtitle.className = "menu-subtitle";
      subtitle.textContent = "PRESENTATION AND DEBUG";
      const list = document.createElement("div");
      list.className = "menu-list";
      view.optionItems.forEach((option, index) => {
        const selected = index === view.optionIndex;
        const value = option.enabled ? "ON" : "OFF";
        list.append(makeButton(
          (selected ? "▶  " : "   ") + option.label.toUpperCase() + " · " + value,
          "menu-choice" + (selected ? " is-selected" : ""),
          () => menu.selectOption(index),
          option.enabled
        ));
      });
      const hint = document.createElement("p");
      hint.className = "menu-hint";
      hint.textContent = "ENTER TO TOGGLE · ESC TO RETURN";
      const back = makeButton("BACK", "menu-primary menu-back", () => menu.back());
      menuContent.append(title, subtitle, list, hint, back);
    }
  }

  menuRoot.addEventListener("pointerdown", () => {
    if (menu.screen === MENU_SCREENS.TITLE) menu.startIntro();
  });

  const onMenuKeyDown = event => {
    if (menu.screen === MENU_SCREENS.PLAYING) {
      if(event.key==="Escape"){
        menu.pause();
        event.preventDefault();
      }
      return;
    }
    if (menu.handleKey(event.key)) event.preventDefault();
  };

  window.addEventListener("keydown", onMenuKeyDown);
  renderMenu();

  const loop = new GameLoop({
    update: (deltaSeconds) => {
      if (!gameStarted || menu.screen!==MENU_SCREENS.PLAYING) {
        input.endFrame();
        return;
      }
      arena.update(deltaSeconds, input);
      input.endFrame();
    },
    render: (alpha) => {
      if (!gameStarted) return;
      const paused=menu.screen===MENU_SCREENS.PAUSE;
      renderer.render(arena, alpha, paused);
      stateDebugPanel.update(arena);
      status.dataset.error = "false";
      status.textContent = paused
        ? "PAUSED · ESC TO RESUME"
        : arena.trainingMode
          ? "TRAINING MODE · DUMMY AUTO-RECOVERS"
          : arena.rounds.phase === ROUND_PHASES.MATCH_OVER
            ? "MATCH COMPLETE · PRESS ENTER TO REMATCH"
            : "ARCADE MODE · CPU RIVAL ACTIVE · FIXED 60 HZ";
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
    window.removeEventListener("keydown", onMenuKeyDown);
  }, { once: true });
} catch (error) {
  reportEngineError(error);
  throw error;
}
