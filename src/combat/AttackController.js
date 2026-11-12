import { FIGHTER_STATES, FighterStateController } from "../state/FighterStateController.js";

// Prototype timings are expressed in 60 Hz simulation frames, not seconds.
export const ATTACK_DEFINITIONS = Object.freeze({
  light: Object.freeze({
    id: "light",
    name: "Light",
    startupFrames: 5,
    activeFrames: 3,
    recoveryFrames: 10,
    hitAdvantage: null,
    blockAdvantage: null,
    hitbox: Object.freeze({ offsetX: 28, offsetY: -72, width: 90, height: 52 })
  }),
  medium: Object.freeze({
    id: "medium",
    name: "Medium",
    startupFrames: 8,
    activeFrames: 4,
    recoveryFrames: 15,
    hitAdvantage: null,
    blockAdvantage: null,
    hitbox: Object.freeze({ offsetX: 32, offsetY: -88, width: 112, height: 70 })
  }),
  heavy: Object.freeze({
    id: "heavy",
    name: "Heavy",
    startupFrames: 12,
    activeFrames: 5,
    recoveryFrames: 21,
    hitAdvantage: null,
    blockAdvantage: null,
    hitbox: Object.freeze({ offsetX: 40, offsetY: -104, width: 135, height: 88 })
  })
});

const ATTACK_INPUTS = Object.freeze(["light", "medium", "heavy"]);

/**
 * Starts and advances grounded prototype attacks. Hit detection is deliberately
 * separate: active frames are timed here but do not yet create collision boxes.
 */
export class AttackController {
  constructor({ stateController = new FighterStateController() } = {}) {
    this.stateController = stateController;
  }

  update(fighter, input) {
    this.stateController.initialize(fighter);

    if (fighter.state.action === FIGHTER_STATES.action.ATTACK) {
      this.advance(fighter);
      return;
    }

    if (
      fighter.state.action !== FIGHTER_STATES.action.NONE ||
      fighter.state.reaction !== FIGHTER_STATES.reaction.NONE ||
      !fighter.onGround
    ) {
      return;
    }

    const moveId = ATTACK_INPUTS.find(action => input.wasPressed?.(action));
    if (!moveId || !this.start(fighter, moveId)) return;
    this.advance(fighter);
  }

  start(fighter, moveId) {
    const move = ATTACK_DEFINITIONS[moveId];
    if (!move || !fighter.onGround) return false;

    const started = this.stateController.startAction(
      fighter,
      FIGHTER_STATES.action.ATTACK,
      {
        ...move,
        moveId,
        moveName: move.name,
        elapsedFrames: 0,
        phase: "startup",
        phaseFrame: 0
      }
    );

    if (!started) return false;
    fighter.lastAttackData = { ...move };
    if (fighter.state.locomotion === FIGHTER_STATES.locomotion.WALKING) {
      this.stateController.setLocomotion(
        fighter,
        FIGHTER_STATES.locomotion.STANDING
      );
    }
    return true;
  }

  advance(fighter) {
    const data = fighter.actionData;
    const totalFrames =
      data.startupFrames + data.activeFrames + data.recoveryFrames;

    if (data.elapsedFrames >= totalFrames) {
      this.stateController.endAction(fighter, FIGHTER_STATES.action.ATTACK);
      return;
    }

    data.elapsedFrames += 1;
    if (data.elapsedFrames <= data.startupFrames) {
      data.phase = "startup";
      data.phaseFrame = data.elapsedFrames;
    } else if (data.elapsedFrames <= data.startupFrames + data.activeFrames) {
      data.phase = "active";
      data.phaseFrame = data.elapsedFrames - data.startupFrames;
    } else {
      data.phase = "recovery";
      data.phaseFrame = data.elapsedFrames - data.startupFrames - data.activeFrames;
    }
  }
}
