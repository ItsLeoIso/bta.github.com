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
    menuRoot.dataset.screen = view.screen;

    if (view.screen === MENU_SCREENS.TITLE) {
      const eyebrow = document.createElement("p");
      eyebrow.className = "menu-eyebrow";
      eyebrow.textContent = "A TWO-DIMENSIONAL FIGHTING GAME";
      const title = document.createElement("h1");
      title.textContent = "BELT TO ASS";
      const subtitle = document.createElement("p");
      subtitle.className = "menu-subtitle";
      subtitle.textContent = "NEON BACKSTREET · LOCAL COMBAT PROTOTYPE";
      const startButton = makeButton("PRESS ENTER TO START", "menu-primary", () => menu.handleKey("Enter"));
      menuContent.append(eyebrow, title, subtitle, startButton);
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
