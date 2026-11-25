import { GameLoop } from "./engine/GameLoop.js";
import { CanvasRenderer } from "./engine/CanvasRenderer.js";
import { Arena } from "./engine/Arena.js";
import { KeyboardInput } from "./input/KeyboardInput.js";
import { encodeInputMask } from "./input/BitmaskInput.js";
import { StateDebugPanel } from "./ui/StateDebugPanel.js";
import { ROUND_PHASES } from "./combat/RoundController.js";
import { MenuController, MENU_SCREENS } from "./ui/MenuController.js";
import { OnlineMatchController, ONLINE_PHASES } from "./net/OnlineMatchController.js";

const canvas = document.querySelector("#game-canvas");
const status = document.querySelector("#engine-status");
const stateDebugRoot = document.querySelector("#state-debug");
const gamePanel = document.querySelector(".game-panel");
const controlsRoot = document.querySelector(".controls");
const menuRoot = document.querySelector("#front-menu");
const menuContent = document.querySelector("#front-menu-content");
const onlineMatchBar = document.querySelector("#online-match-bar");


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

  const urlParams = new URLSearchParams(window.location.search);
  const defaultLocalSignaling = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "ws://localhost:8787"
    : "";
  let onlineTab = urlParams.get("signal") || urlParams.get("room") ? "room" : "direct";
  let draftSignalingUrl = urlParams.get("signal") ?? window.BTA_ONLINE_CONFIG?.signalingUrl ?? defaultLocalSignaling;
  let draftRoomCode = (urlParams.get("room") ?? "").toUpperCase();
  let draftRemoteOffer = "";
  let draftRemoteAnswer = "";
  let lastOnlinePhaseRendered = null;
  let lastOnlineMatchBarKey = "";

  gamePanel.hidden = true;
  stateDebugRoot.hidden = true;
  controlsRoot.hidden = true;
  if (onlineMatchBar) onlineMatchBar.hidden = true;

  const makeButton = (label, className, onClick, pressed = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    if (pressed) button.setAttribute("aria-pressed", "true");
    button.addEventListener("click", onClick);
    return button;
  };

  const copyToClipboard = async (text, button) => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      const original = button.textContent;
      button.textContent = "COPIED!";
      window.setTimeout(() => { button.textContent = original; }, 1200);
    } catch {
      // Fallback: focus/select handled by user clicking the readonly box.
    }
  };

  const online = new OnlineMatchController({
    signalingUrl: draftSignalingUrl,
    iceServers: window.BTA_ONLINE_CONFIG?.iceServers,
    onMatchStart: (session) => {
      arena = session.arena;
      const opts = menu.getViewModel().options;
      renderer.showHitboxes = opts.showHitboxes;
      stateDebugRoot.hidden = !opts.showInspector;
      gamePanel.hidden = false;
      controlsRoot.hidden = false;
      menuRoot.hidden = true;
      menuRoot.dataset.onlinePause = "false";
      gameStarted = true;
      menu.startOnline();
      renderOnlineMatchBar(online.getViewModel());
      status.textContent = "ONLINE ROLLBACK · P2P LIVE · FIXED 60 HZ";
    },
    onStateChange: (onlineView) => {
      if (onlineView.phase === ONLINE_PHASES.CHARACTER_SELECT && gameStarted && menu.mode === "online") {
        gameStarted = false;
        gamePanel.hidden = true;
        controlsRoot.hidden = true;
        stateDebugRoot.hidden = true;
        if (onlineMatchBar) onlineMatchBar.hidden = true;
        menuRoot.dataset.onlinePause = "false";
        menu.openOnline();
        return;
      }

      if (menu.screen === MENU_SCREENS.ONLINE) {
        // Avoid wiping active typing focus during RTT-only pings when in lobby;
        // always re-render on phase/code/ready/char changes.
        const key = JSON.stringify([
          onlineView.phase,
          onlineView.roomCode,
          onlineView.localOfferCode,
          onlineView.localAnswerCode,
          onlineView.localCharacterId,
          onlineView.remoteCharacterId,
          onlineView.localReady,
          onlineView.remoteReady,
          onlineView.inputDelay,
          onlineView.statusMessage,
          onlineView.errorMessage
        ]);
        if (key !== lastOnlinePhaseRendered) {
          lastOnlinePhaseRendered = key;
          renderMenu(menu.getViewModel());
        }
      } else if (menu.mode === "online" && gameStarted) {
        renderOnlineMatchBar(onlineView);
      }
    }
  });

  const menu = new MenuController({
    onResetTraining: () => arena.resetTraining(),
    onForfeitOnline: () => {
      online.forfeitAndExit();
    },
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
      menuRoot.dataset.onlinePause = "false";
      if (onlineMatchBar) onlineMatchBar.hidden = true;
      gameStarted = true;
      status.textContent = mode === "training"
        ? "TRAINING MODE · DUMMY AUTO-RECOVERS"
        : "ARCADE MODE · CPU RIVAL ACTIVE";
    },
    onChange: handleMenuChange
  });

  function renderOnlineMatchBar(onlineView) {
    if (!onlineMatchBar) return;
    if (menu.mode !== "online" || !gameStarted) {
      onlineMatchBar.hidden = true;
      lastOnlineMatchBarKey = "";
      return;
    }

    const showDisconnected = onlineView.phase === ONLINE_PHASES.DISCONNECTED || onlineView.phase === ONLINE_PHASES.ERROR;
    const showDesync = Boolean(onlineView.stats?.desynced);
    const showMatchOver = Boolean(onlineView.matchOver);

    if (!showDisconnected && !showDesync && !showMatchOver) {
      onlineMatchBar.hidden = true;
      lastOnlineMatchBarKey = "";
      return;
    }

    const key = JSON.stringify([
      showDisconnected,
      showDesync,
      showMatchOver,
      onlineView.localRematchVote,
      onlineView.remoteRematchVote,
      onlineView.statusMessage
    ]);
    if (key === lastOnlineMatchBarKey) return;
    lastOnlineMatchBarKey = key;

    onlineMatchBar.replaceChildren();
    onlineMatchBar.hidden = false;

    const text = document.createElement("span");
    text.className = "online-match-bar__text";

    if (showDisconnected) {
      text.textContent = onlineView.statusMessage.toUpperCase();
      onlineMatchBar.append(
        text,
        makeButton("RETURN TO LOBBY", "menu-primary", () => {
          online.disconnect();
          gameStarted = false;
          gamePanel.hidden = true;
          controlsRoot.hidden = true;
          stateDebugRoot.hidden = true;
          onlineMatchBar.hidden = true;
          menu.openOnline();
        }),
        makeButton("MAIN MENU", "menu-choice", () => {
          online.disconnect();
          menu.exitToMenu();
        })
      );
      return;
    }

    if (showDesync) {
      text.textContent = (onlineView.stats?.desyncInfo?.reason ?? "STATE DESYNC DETECTED").toUpperCase();
      onlineMatchBar.append(
        text,
        makeButton("EXIT TO LOBBY", "menu-primary", () => {
          online.disconnect();
          gameStarted = false;
          gamePanel.hidden = true;
          controlsRoot.hidden = true;
          stateDebugRoot.hidden = true;
          onlineMatchBar.hidden = true;
          menu.openOnline();
        })
      );
      return;
    }

    const votes = Number(onlineView.localRematchVote) + Number(onlineView.remoteRematchVote);
    text.textContent = `REMATCH (${votes}/2)`;
    const rematchBtn = makeButton(
      onlineView.localRematchVote ? "WAITING FOR RIVAL..." : "VOTE REMATCH",
      "menu-primary",
      () => online.voteRematch()
    );
    if (onlineView.localRematchVote) rematchBtn.disabled = true;

    onlineMatchBar.append(
      text,
      rematchBtn,
      makeButton("CHARACTER SELECT", "menu-choice", () => online.requestCharacterSelect()),
      makeButton("EXIT TO MENU", "menu-choice", () => {
        online.forfeitAndExit();
        menu.exitToMenu();
      })
    );
  }

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
    if (view.screen === MENU_SCREENS.MAIN && gameStarted) {
      if (view.mode === "online") online.disconnect();
      gameStarted = false;
      gamePanel.hidden = true;
      controlsRoot.hidden = true;
      stateDebugRoot.hidden = true;
      if (onlineMatchBar) onlineMatchBar.hidden = true;
      status.textContent = "SELECT MODE · ENTER TO CONFIRM";
    }
    if (view.screen === MENU_SCREENS.MAIN && online.phase !== ONLINE_PHASES.LOBBY) {
      online.disconnect();
    }
    const isOnlinePause = view.screen === MENU_SCREENS.PAUSE && view.mode === "online";
    menuRoot.dataset.onlinePause = isOnlinePause ? "true" : "false";
    menuRoot.hidden = view.screen === MENU_SCREENS.PLAYING;
    if (view.screen === MENU_SCREENS.ONLINE) lastOnlinePhaseRendered = null;
    renderMenu(view);
  }

  function renderOnlineScreen() {
    const ov = online.getViewModel();
    const title = document.createElement("h2");
    title.textContent = ov.phase === ONLINE_PHASES.CHARACTER_SELECT || ov.phase === ONLINE_PHASES.HANDSHAKING
      ? "ONLINE · SELECT YOUR FIGHTER"
      : "ONLINE · 1V1 ROLLBACK";

    const statusBox = document.createElement("p");
    statusBox.className = "online-status";
    statusBox.dataset.testid = "online-status";
    statusBox.dataset.error = ov.phase === ONLINE_PHASES.ERROR || ov.phase === ONLINE_PHASES.DISCONNECTED ? "true" : "false";
    statusBox.textContent = ov.statusMessage;

    if (ov.phase === ONLINE_PHASES.CHARACTER_SELECT || ov.phase === ONLINE_PHASES.HANDSHAKING) {
      const subtitle = document.createElement("p");
      subtitle.className = "menu-subtitle";
      const pingInfo = Number.isFinite(ov.rttMs) ? ` · PING ${ov.rttMs}MS` : "";
      subtitle.textContent =
        `P2P CONNECTED (${ov.localSlot === 0 ? "HOST · SLOT 1" : "GUEST · SLOT 2"}) · DELAY ${ov.inputDelay}F${pingInfo}`;

      const localChar = ov.characters.find(c => c.id === ov.localCharacterId) ?? ov.characters[0];
      const remoteChar = ov.characters.find(c => c.id === ov.remoteCharacterId) ?? ov.characters[0];

      const matchup = document.createElement("div");
      matchup.className = "character-select__matchup";

      const makeOnlineCard = (char, roleText, isReady, testId, extraClass) => {
        const card = document.createElement("section");
        card.className = "character-card " + extraClass;
        card.dataset.characterId = char.id;
        card.dataset.testid = testId;
        const role = document.createElement("p");
        role.className = "character-card__role";
        role.textContent = roleText;
        const name = document.createElement("h3");
        name.textContent = char.name;
        const archetype = document.createElement("p");
        archetype.className = "character-card__archetype";
        archetype.textContent = char.archetype;
        const stats = document.createElement("dl");
        stats.className = "character-card__stats";
        [
          ["MOVE SPEED", String(char.stats.moveSpeed)],
          ["DAMAGE", (char.stats.damageMultiplier * 100).toFixed(0) + "%"]
        ].forEach(([label, val]) => {
          const item = document.createElement("div");
          const dt = document.createElement("dt");
          dt.textContent = label;
          const dd = document.createElement("dd");
          dd.textContent = val;
          item.append(dt, dd);
          stats.append(item);
        });
        const readyBadge = document.createElement("span");
        readyBadge.className = "online-ready-badge";
        readyBadge.dataset.ready = isReady ? "true" : "false";
        readyBadge.textContent = isReady ? "READY" : "SELECTING...";
        card.append(role, name, archetype, stats, readyBadge);
        return card;
      };

      const versus = document.createElement("div");
      versus.className = "character-select__versus";
      versus.textContent = "VS";

      matchup.append(
        makeOnlineCard(localChar, ov.localSlot === 0 ? "YOU · PLAYER 01" : "YOU · PLAYER 02", ov.localReady, "online-char-local", "character-card--player"),
        versus,
        makeOnlineCard(remoteChar, ov.localSlot === 0 ? "RIVAL · PLAYER 02" : "RIVAL · PLAYER 01", ov.remoteReady, "online-char-remote", "character-card--opponent")
      );

      const nav = document.createElement("div");
      nav.className = "character-select__navigation";
      nav.append(
        makeButton("← PREVIOUS", "menu-choice character-nav", () => online.cycleCharacter(-1)),
        makeButton("NEXT →", "menu-choice character-nav", () => online.cycleCharacter(1))
      );

      const actions = document.createElement("div");
      actions.className = "character-select__actions";
      const readyBtn = makeButton(
        ov.localReady ? "CANCEL READY" : "READY TO FIGHT",
        "menu-primary character-confirm",
        () => online.toggleReady()
      );
      readyBtn.dataset.testid = "online-ready-btn";
      actions.append(
        makeButton("DISCONNECT", "menu-choice character-back", () => online.disconnect()),
        readyBtn
      );

      menuContent.append(title, subtitle, statusBox, matchup, nav, actions);
      return;
    }

    // --- Lobby screen (Direct Invite & Room Code tabs) ---
    const toolbar = document.createElement("div");
    toolbar.className = "online-toolbar";

    const tabs = document.createElement("div");
    tabs.className = "online-tabs";
    tabs.append(
      makeButton(
        "DIRECT INVITE (NO SERVER)",
        "menu-choice" + (onlineTab === "direct" ? " is-selected" : ""),
        () => { onlineTab = "direct"; renderMenu(menu.getViewModel()); },
        onlineTab === "direct"
      ),
      makeButton(
        "ROOM CODE (SIGNALING)",
        "menu-choice" + (onlineTab === "room" ? " is-selected" : ""),
        () => { onlineTab = "room"; renderMenu(menu.getViewModel()); },
        onlineTab === "room"
      )
    );

    const delayPicker = document.createElement("div");
    delayPicker.className = "online-delay-picker";
    const delayLabel = document.createElement("span");
    delayLabel.textContent = "INPUT DELAY:";
    delayPicker.append(delayLabel);
    [0, 1, 2, 3, 4].forEach(frames => {
      const btn = makeButton(
        `${frames}F`,
        "online-delay-btn" + (ov.inputDelay === frames ? " is-selected" : ""),
        () => online.setInputDelay(frames),
        ov.inputDelay === frames
      );
      delayPicker.append(btn);
    });
    toolbar.append(tabs, delayPicker);

    const grid = document.createElement("div");
    grid.className = "online-grid";

    if (onlineTab === "direct") {
      // Host panel
      const hostPanel = document.createElement("section");
      hostPanel.className = "online-panel";
      const hostTitle = document.createElement("h3");
      hostTitle.textContent = "HOST · CREATE INVITE";
      const hostHelp = document.createElement("p");
      hostHelp.textContent = "Works directly on GitHub Pages with zero backend. Generate an invite code, send it to your opponent, then paste their Answer code.";
      const createInviteBtn = makeButton("CREATE DIRECT INVITE", "menu-primary", () => {
        void online.createDirectInvite();
      });
      createInviteBtn.dataset.testid = "online-create-invite";

      const offerOutput = document.createElement("textarea");
      offerOutput.className = "online-field";
      offerOutput.rows = 3;
      offerOutput.readOnly = true;
      offerOutput.placeholder = "Your BTA1:... invite code will appear here";
      offerOutput.value = ov.localOfferCode;
      offerOutput.dataset.testid = "online-offer-output";

      const copyOfferBtn = makeButton("COPY INVITE", "menu-choice", () => copyToClipboard(ov.localOfferCode, copyOfferBtn));
      copyOfferBtn.disabled = !ov.localOfferCode;

      const answerInput = document.createElement("textarea");
      answerInput.className = "online-field";
      answerInput.rows = 3;
      answerInput.placeholder = "Paste guest BTA1:... Answer code here";
      answerInput.value = draftRemoteAnswer;
      answerInput.dataset.testid = "online-answer-input";
      answerInput.addEventListener("input", () => { draftRemoteAnswer = answerInput.value; });

      const connectBtn = makeButton("CONNECT WITH ANSWER", "menu-primary", () => {
        void online.completeDirectInvite(draftRemoteAnswer);
      });
      connectBtn.dataset.testid = "online-connect-answer";

      const hostActions = document.createElement("div");
      hostActions.className = "online-actions";
      hostActions.append(createInviteBtn, copyOfferBtn);

      hostPanel.append(hostTitle, hostHelp, hostActions, offerOutput, answerInput, connectBtn);

      // Guest panel
      const guestPanel = document.createElement("section");
      guestPanel.className = "online-panel";
      const guestTitle = document.createElement("h3");
      guestTitle.textContent = "JOIN · PASTE HOST INVITE";
      const guestHelp = document.createElement("p");
      guestHelp.textContent = "Paste the Host's invite code, create your Answer code, and send it back. Character Select opens automatically once connected.";

      const offerInput = document.createElement("textarea");
      offerInput.className = "online-field";
      offerInput.rows = 3;
      offerInput.placeholder = "Paste Host BTA1:... invite code here";
      offerInput.value = draftRemoteOffer;
      offerInput.dataset.testid = "online-offer-input";
      offerInput.addEventListener("input", () => { draftRemoteOffer = offerInput.value; });

      const createAnswerBtn = makeButton("CREATE ANSWER", "menu-primary", () => {
        void online.acceptDirectInvite(draftRemoteOffer);
      });
      createAnswerBtn.dataset.testid = "online-create-answer";

      const answerOutput = document.createElement("textarea");
      answerOutput.className = "online-field";
      answerOutput.rows = 3;
      answerOutput.readOnly = true;
      answerOutput.placeholder = "Your BTA1:... Answer code will appear here";
      answerOutput.value = ov.localAnswerCode;
      answerOutput.dataset.testid = "online-answer-output";

      const copyAnswerBtn = makeButton("COPY ANSWER", "menu-choice", () => copyToClipboard(ov.localAnswerCode, copyAnswerBtn));
      copyAnswerBtn.disabled = !ov.localAnswerCode;

      const guestActions = document.createElement("div");
      guestActions.className = "online-actions";
      guestActions.append(createAnswerBtn, copyAnswerBtn);

      guestPanel.append(guestTitle, guestHelp, offerInput, guestActions, answerOutput);
      grid.append(hostPanel, guestPanel);
    } else {
      // Room-Code Signaling panel
      const hostPanel = document.createElement("section");
      hostPanel.className = "online-panel";
      const hostTitle = document.createElement("h3");
      hostTitle.textContent = "HOST · ROOM CODE";
      const hostHelp = document.createElement("p");
      hostHelp.textContent = "Uses a lightweight WebSocket signaling relay (run locally with `node server/signaling-server.js` or deploy `server/cloudflare-worker.js`). Match traffic stays direct WebRTC P2P.";

      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.className = "online-field";
      urlInput.placeholder = "ws://localhost:8787 or wss://your-worker.workers.dev";
      urlInput.value = draftSignalingUrl;
      urlInput.dataset.testid = "online-signaling-url";
      urlInput.addEventListener("input", () => { draftSignalingUrl = urlInput.value; });

      const createRoomBtn = makeButton("CREATE ROOM", "menu-primary", () => {
        void online.createRoom(draftSignalingUrl);
      });
      createRoomBtn.dataset.testid = "online-create-room";

      hostPanel.append(hostTitle, hostHelp, urlInput, createRoomBtn);
      if (ov.roomCode && ov.localSlot === 0) {
        const codeBox = document.createElement("div");
        codeBox.className = "online-room-code";
        codeBox.dataset.testid = "online-room-code";
        codeBox.textContent = ov.roomCode;
        const copyCodeBtn = makeButton("COPY ROOM CODE", "menu-choice", () => copyToClipboard(ov.roomCode, copyCodeBtn));
        hostPanel.append(codeBox, copyCodeBtn);
      }

      const joinPanel = document.createElement("section");
      joinPanel.className = "online-panel";
      const joinTitle = document.createElement("h3");
      joinTitle.textContent = "JOIN · ENTER ROOM CODE";
      const joinHelp = document.createElement("p");
      joinHelp.textContent = "Enter the 5-character code from your host. If the signaling server is unavailable, switch back to Direct Invite.";

      const codeInput = document.createElement("input");
      codeInput.type = "text";
      codeInput.className = "online-field";
      codeInput.maxLength = 10;
      codeInput.placeholder = "ROOM CODE (E.G. 7K2PB)";
      codeInput.value = draftRoomCode;
      codeInput.dataset.testid = "online-join-code-input";
      codeInput.addEventListener("input", () => {
        draftRoomCode = codeInput.value.toUpperCase();
        codeInput.value = draftRoomCode;
      });

      const joinBtn = makeButton("JOIN ROOM", "menu-primary", () => {
        void online.joinRoom(draftRoomCode, draftSignalingUrl);
      });
      joinBtn.dataset.testid = "online-join-room";

      joinPanel.append(joinTitle, joinHelp, codeInput, joinBtn);
      grid.append(hostPanel, joinPanel);
    }

    const natNote = document.createElement("p");
    natNote.className = "menu-hint";
    natNote.textContent = "WEBRTC P2P (GGPO ROLLBACK · STUN DEFAULT) · STRICT FIREWALLS MAY REQUIRE TURN · ESC TO RETURN";

    const footerActions = document.createElement("div");
    footerActions.className = "online-actions";
    const back = makeButton("BACK TO MENU", "menu-choice", () => {
      online.disconnect();
      menu.back();
    });
    footerActions.append(back);
    if (ov.phase !== ONLINE_PHASES.LOBBY) {
      footerActions.append(makeButton("RESET CONNECTION", "menu-choice", () => online.disconnect()));
    }

    menuContent.append(title, statusBox, toolbar, grid, natNote, footerActions);
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
      title.addEventListener("click", () => menu.startIntro());
      const hint = document.createElement("p");
      hint.className = "opening-hint";
      hint.textContent = "PRESS ANY BUTTON";
      menuContent.append(title, hint);
      title.focus({ preventScroll: true });
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
      title.textContent = view.mode === "online" ? "ONLINE MENU" : "PAUSED";
      const subtitle = document.createElement("p");
      subtitle.className = "menu-subtitle";
      subtitle.textContent = view.mode === "online"
        ? "MATCH CONTINUES LIVE IN BACKGROUND"
        : "MATCH SUSPENDED";
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
      renderOnlineScreen();
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

  menuRoot.addEventListener("click", () => {
    if (menu.screen === MENU_SCREENS.TITLE) menu.startIntro();
  });

  const onMenuKeyDown = event => {
    const tag = event.target?.tagName;
    const typingInField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(event.target?.isContentEditable);
    if (typingInField) {
      if (event.key === "Escape") {
        event.target.blur?.();
      }
      return;
    }

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
    getStepIntervalSeconds: () => (
      menu.mode === "online" && online.phase === ONLINE_PHASES.IN_MATCH
        ? online.getRecommendedStepIntervalMs() / 1000
        : 1 / 60
    ),
    update: (deltaSeconds) => {
      if (!gameStarted) {
        input.endFrame();
        return;
      }
      if (menu.mode === "online") {
        if (online.phase === ONLINE_PHASES.IN_MATCH) {
          // Online matches never freeze when Escape opens the overlay; pass neutral
          // input while the overlay is open so navigating Resume/Forfeit does not move your fighter.
          const localMask = menu.screen === MENU_SCREENS.PLAYING ? encodeInputMask(input) : 0;
          online.stepLocalFrame(localMask);
        }
        input.endFrame();
        return;
      }
      if (menu.screen !== MENU_SCREENS.PLAYING) {
        input.endFrame();
        return;
      }
      arena.update(deltaSeconds, input);
      input.endFrame();
    },
    render: (alpha) => {
      if (!gameStarted) return;
      const paused = menu.screen === MENU_SCREENS.PAUSE;
      const onlineView = menu.mode === "online" ? online.getViewModel() : null;
      renderer.render(arena, alpha, paused, onlineView);
      stateDebugPanel.update(arena);
      if (onlineView) {
        renderOnlineMatchBar(onlineView);
      }
      status.dataset.error = onlineView?.stats?.desynced ? "true" : "false";
      if (onlineView) {
        const ping = Number.isFinite(onlineView.rttMs) ? `${onlineView.rttMs}MS` : "--MS";
        const rb = onlineView.stats?.lastRollbackFrames ?? 0;
        status.textContent = onlineView.stats?.desynced
          ? `ONLINE DESYNC · ${onlineView.stats.desyncInfo?.reason ?? "STATE MISMATCH"}`
          : onlineView.phase === ONLINE_PHASES.DISCONNECTED
            ? `ONLINE DISCONNECTED · ${onlineView.statusMessage.toUpperCase()}`
            : `ONLINE ROLLBACK · PING ${ping} · DELAY ${onlineView.inputDelay}F · RB ${rb}F · FIXED 60 HZ`;
      } else {
        status.textContent = paused
          ? "PAUSED · ESC TO RESUME"
          : arena.trainingMode
            ? "TRAINING MODE · DUMMY AUTO-RECOVERS"
            : arena.rounds.phase === ROUND_PHASES.MATCH_OVER
              ? "MATCH COMPLETE · PRESS ENTER TO REMATCH"
              : "ARCADE MODE · CPU RIVAL ACTIVE · FIXED 60 HZ";
      }
    },
    onError: reportEngineError
  });

  input.attach();
  renderer.attach();
  loop.start();
  window.addEventListener("beforeunload", () => {
    online.teardownConnections();
    loop.stop();
    input.detach();
    renderer.detach();
    window.removeEventListener("keydown", onMenuKeyDown);
  }, { once: true });
} catch (error) {
  reportEngineError(error);
  throw error;
}
