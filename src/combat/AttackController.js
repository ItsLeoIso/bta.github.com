import { FIGHTER_STATES, FighterStateController, isGrounded } from "../state/FighterStateController.js";
import { ATTACK_DEFINITIONS } from "../characters/MoveSets.js";
export { ATTACK_DEFINITIONS } from "../characters/MoveSets.js";
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

  getMoveDefinitions(fighter) {
    return fighter.character?.moveSet?.attacks ?? ATTACK_DEFINITIONS;
  }

  canStart(fighter, moveId) {
    const move = this.getMoveDefinitions(fighter)[moveId];
    return Boolean(move) && (isGrounded(fighter) || move.airAllowed);
  }

  start(fighter, moveId) {
    const move = this.getMoveDefinitions(fighter)[moveId];
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
    if (!isGrounded(fighter) || data.hitOutcome !== "hit" ||
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
