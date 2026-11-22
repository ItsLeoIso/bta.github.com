import { FIGHTER_STATES, FighterStateController } from "../state/FighterStateController.js";

// Prototype timings are expressed in 60 Hz simulation frames, not seconds.
export const ATTACK_DEFINITIONS = Object.freeze({
  light: Object.freeze({
    id: "light", name: "Light", hitLevel: "high",
    startupFrames: 5, activeFrames: 3, recoveryFrames: 10,
    hitAdvantage: null, blockAdvantage: null,
    airAllowed: true, jumpCancelOnHit: true,
    cancelOnHit: Object.freeze(["medium", "heavy", "special"]),
    airCancelOnHit: Object.freeze(["medium", "special"]),
    hitbox: Object.freeze({ offsetX: 24, offsetY: -220, width: 126, height: 72 })
  }),
  medium: Object.freeze({
    id: "medium", name: "Medium", hitLevel: "mid",
    startupFrames: 8, activeFrames: 4, recoveryFrames: 15,
    hitAdvantage: null, blockAdvantage: null,
    airAllowed: true, jumpCancelOnHit: true, launchVelocity: 520,
    cancelOnHit: Object.freeze(["heavy", "special"]),
    airCancelOnHit: Object.freeze(["special"]),
    hitbox: Object.freeze({ offsetX: 30, offsetY: -152, width: 160, height: 80 })
  }),
  heavy: Object.freeze({
    id: "heavy", name: "Heavy", hitLevel: "low",
    startupFrames: 12, activeFrames: 5, recoveryFrames: 21,
    hitAdvantage: null, blockAdvantage: null,
    airAllowed: false, jumpCancelOnHit: false,
    cancelOnHit: Object.freeze([]), airCancelOnHit: Object.freeze([]),
    hitbox: Object.freeze({ offsetX: 36, offsetY: -72, width: 190, height: 72 })
  })
});
const ATTACK_INPUTS = Object.freeze(["light", "medium", "heavy"]);

/** Starts / advances normals and applies only explicit, hit-confirmed cancel routes. */
export class AttackController {
  constructor({ stateController = new FighterStateController() } = {}) {
    this.stateController = stateController;
  }

  update(fighter, input) {
    this.stateController.initialize(fighter);
    if (fighter.state.action === FIGHTER_STATES.action.ATTACK) {
      if (this.tryJumpCancel(fighter, input)) return true;
      if (this.tryNormalCancel(fighter, input)) return true;
      this.advance(fighter);
      return false;
    }
    if (fighter.state.action !== FIGHTER_STATES.action.NONE ||
        fighter.state.reaction !== FIGHTER_STATES.reaction.NONE) return false;
    const moveId = ATTACK_INPUTS.find(action => input.wasPressed?.(action));
    if (!moveId || !this.start(fighter, moveId)) return false;
    this.advance(fighter);
    return true;
  }

  canStart(fighter, moveId) {
    const move = ATTACK_DEFINITIONS[moveId];
    return Boolean(move) && (fighter.onGround !== false || move.airAllowed);
  }

  start(fighter, moveId) {
    const move = ATTACK_DEFINITIONS[moveId];
    if (!move || !this.canStart(fighter, moveId)) return false;
    const started = this.stateController.startAction(fighter, FIGHTER_STATES.action.ATTACK, {
      ...move, moveId, moveName: move.name, elapsedFrames: 0,
      phase: "startup", phaseFrame: 0, hitOutcome: null
    });
    if (!started) return false;
    fighter.lastAttackData = { ...move };
    if (fighter.onGround !== false && fighter.state.locomotion === FIGHTER_STATES.locomotion.WALKING) {
      this.stateController.setLocomotion(fighter, FIGHTER_STATES.locomotion.STANDING);
    }
    return true;
  }

  tryJumpCancel(fighter, input) {
    const data = fighter.actionData;
    if (fighter.onGround === false || data.hitOutcome !== "hit" ||
        !data.jumpCancelOnHit || !input.wasPressed?.("jump")) return false;
    const fromMoveId = data.moveId;
    this.stateController.endAction(fighter, FIGHTER_STATES.action.ATTACK);
    fighter.lastCancelData = { type: "jump", fromMoveId, toMoveId: "jump" };
    return true;
  }

  tryNormalCancel(fighter, input) {
    const data = fighter.actionData;
    if (data.hitOutcome !== "hit") return false;
    const allowed = fighter.onGround === false ? (data.airCancelOnHit ?? []) : (data.cancelOnHit ?? []);
    const moveId = ATTACK_INPUTS.find(action => allowed.includes(action) && input.wasPressed?.(action));
    if (!moveId || !this.canStart(fighter, moveId)) return false;
    const fromMoveId = data.moveId;
    this.stateController.endAction(fighter, FIGHTER_STATES.action.ATTACK);
    if (!this.start(fighter, moveId)) return false;
    fighter.lastCancelData = { type: "hit", fromMoveId, toMoveId: moveId };
    this.advance(fighter);
    return true;
  }

  advance(fighter) {
    const data = fighter.actionData;
    const totalFrames = data.startupFrames + data.activeFrames + data.recoveryFrames;
    if (data.elapsedFrames >= totalFrames) {
      this.stateController.endAction(fighter, FIGHTER_STATES.action.ATTACK);
      return;
    }
    data.elapsedFrames += 1;
    if (data.elapsedFrames <= data.startupFrames) {
      data.phase = "startup"; data.phaseFrame = data.elapsedFrames;
    } else if (data.elapsedFrames <= data.startupFrames + data.activeFrames) {
      data.phase = "active"; data.phaseFrame = data.elapsedFrames - data.startupFrames;
    } else {
      data.phase = "recovery";
      data.phaseFrame = data.elapsedFrames - data.startupFrames - data.activeFrames;
    }
  }
}
