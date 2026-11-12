/**
 * The authoritative fighter state model.
 *
 * Locomotion describes the fighter's physical stance, action describes the
 * move currently being performed, and reaction is reserved for hit/block
 * reactions. Keeping these channels separate lets a dash coexist with an
 * airborne locomotion state without deriving either state from physics flags.
 */
export const FIGHTER_STATES = Object.freeze({
  locomotion: Object.freeze({
    STANDING: "standing",
    WALKING: "walking",
    CROUCHING: "crouching",
    JUMPING: "jumping",
    FALLING: "falling"
  }),
  action: Object.freeze({
    NONE: "none",
    DASH: "dash",
    ATTACK: "attack",
    GUARD: "guard"
  }),
  reaction: Object.freeze({
    NONE: "none",
    HITSTUN: "hitstun",
    BLOCKSTUN: "blockstun",
    KNOCKDOWN: "knockdown",
    WAKEUP: "wakeup"
  })
});

const LOCOMOTION_TRANSITIONS = {
  standing: ["walking", "crouching", "jumping", "falling"],
  walking: ["standing", "crouching", "jumping", "falling"],
  crouching: ["standing", "walking", "jumping", "falling"],
  jumping: ["falling", "standing", "walking", "crouching"],
  falling: ["standing", "walking", "crouching"]
};

const REACTION_PRIORITY = {
  none: 0,
  blockstun: 1,
  hitstun: 1,
  wakeup: 2,
  knockdown: 3
};

const EMPTY_ACTION_DATA = () => ({
  dashType: null,
  remaining: 0,
  velocity: 0
});

export class FighterStateController {
  initialize(fighter) {
    fighter.state ??= {
      locomotion: FIGHTER_STATES.locomotion.STANDING,
      action: FIGHTER_STATES.action.NONE,
      reaction: FIGHTER_STATES.reaction.NONE
    };
    fighter.actionData ??= EMPTY_ACTION_DATA();

    for (const [channel, values] of Object.entries(FIGHTER_STATES)) {
      if (!Object.values(values).includes(fighter.state[channel])) {
        throw new RangeError(`Unknown fighter ${channel} state: ${fighter.state[channel]}`);
      }
    }

    this.syncCompatibilityFields(fighter);
    return fighter.state;
  }

  setLocomotion(fighter, nextState) {
    this.initialize(fighter);
    const validStates = Object.values(FIGHTER_STATES.locomotion);
    if (!validStates.includes(nextState)) {
      throw new RangeError(`Unknown locomotion state: ${nextState}`);
    }

    const currentState = fighter.state.locomotion;
    if (currentState === nextState) return true;
    if (!LOCOMOTION_TRANSITIONS[currentState].includes(nextState)) return false;

    fighter.state.locomotion = nextState;
    this.syncCompatibilityFields(fighter);
    return true;
  }

  startAction(fighter, action, data = {}) {
    this.initialize(fighter);
    if (!Object.values(FIGHTER_STATES.action).includes(action) ||
        action === FIGHTER_STATES.action.NONE) {
      throw new RangeError(`Unknown startable action state: ${action}`);
    }
    if (fighter.state.reaction !== FIGHTER_STATES.reaction.NONE ||
        fighter.state.action !== FIGHTER_STATES.action.NONE) {
      return false;
    }

    fighter.state.action = action;
    fighter.actionData = { ...EMPTY_ACTION_DATA(), ...data };
    this.syncCompatibilityFields(fighter);
    return true;
  }

  endAction(fighter, expectedAction = null) {
    this.initialize(fighter);
    if (fighter.state.action === FIGHTER_STATES.action.NONE) return false;
    if (expectedAction && fighter.state.action !== expectedAction) return false;

    fighter.state.action = FIGHTER_STATES.action.NONE;
    fighter.actionData = EMPTY_ACTION_DATA();
    this.syncCompatibilityFields(fighter);
    return true;
  }

  setReaction(fighter, nextReaction) {
    this.initialize(fighter);
    if (!Object.values(FIGHTER_STATES.reaction).includes(nextReaction)) {
      throw new RangeError(`Unknown reaction state: ${nextReaction}`);
    }

    const currentReaction = fighter.state.reaction;
    if (REACTION_PRIORITY[nextReaction] < REACTION_PRIORITY[currentReaction]) {
      return false;
    }

    fighter.state.reaction = nextReaction;
    if (nextReaction !== FIGHTER_STATES.reaction.NONE) {
      fighter.state.action = FIGHTER_STATES.action.NONE;
      fighter.actionData = EMPTY_ACTION_DATA();
    }
    this.syncCompatibilityFields(fighter);
    return true;
  }

  clearReaction(fighter) {
    return this.setReaction(fighter, FIGHTER_STATES.reaction.NONE);
  }

  syncCompatibilityFields(fighter) {
    // These mirrors keep the current physics, renderer, and pushbox interfaces
    // stable while state-aware systems migrate to fighter.state.
    fighter.crouching =
      fighter.state.locomotion === FIGHTER_STATES.locomotion.CROUCHING;

    const isDash = fighter.state.action === FIGHTER_STATES.action.DASH;
    fighter.dashType = isDash ? fighter.actionData.dashType : null;
    fighter.dashRemaining = isDash ? fighter.actionData.remaining : 0;
    fighter.dashVelocity = isDash ? fighter.actionData.velocity : 0;
  }
}
