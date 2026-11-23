import { FIGHTER_STATES } from "../state/FighterStateController.js";

const REACTION_ANIMATIONS = Object.freeze({
  [FIGHTER_STATES.reaction.HITSTUN]: "reaction-hitstun",
  [FIGHTER_STATES.reaction.BLOCKSTUN]: "reaction-blockstun",
  [FIGHTER_STATES.reaction.GUARD_BREAK]: "reaction-guard-break",
  [FIGHTER_STATES.reaction.KNOCKDOWN]: "reaction-knockdown",
  [FIGHTER_STATES.reaction.WAKEUP]: "reaction-wakeup"
});

export function resolveAnimationName(fighter) {
  const state = fighter.state ?? {};
  const data = fighter.actionData ?? {};
  if (state.reaction && state.reaction !== FIGHTER_STATES.reaction.NONE) {
    return REACTION_ANIMATIONS[state.reaction] ?? "reaction-hitstun";
  }

  if (state.action === FIGHTER_STATES.action.ATTACK) {
    return "attack-" + (data.moveId ?? "light");
  }
  if (state.action === FIGHTER_STATES.action.SPECIAL) {
    return data.moveId === "arcLance" ? "special-arc-lance" : "special-energy-shot";
  }
  if (state.action === FIGHTER_STATES.action.GUARD) {
    const height = fighter.guardData?.guardHeight ?? data.guardHeight ?? "high";
    return height === "low" ? "guard-low" : "guard-high";
  }
  if (state.action === FIGHTER_STATES.action.DASH) {
    if (data.dashType === "air") return "air-dash";
    return data.dashType === "backdash" ? "dash-backdash" : "dash-forward";
  }

  switch (state.locomotion) {
    case FIGHTER_STATES.locomotion.WALKING: return "walk";
    case FIGHTER_STATES.locomotion.CROUCHING: return "crouch";
    case FIGHTER_STATES.locomotion.JUMPING: return "jump";
    case FIGHTER_STATES.locomotion.FALLING: return "fall";
    default: return "idle";
  }
}

/** Fixed-step animation clock with optional sprite-atlas frame indices. */
export class FighterAnimator {
  constructor(animationSet = {}) {
    this.animationSet = animationSet;
    this.clipName = null;
    this.elapsedFrames = 0;
  }

  update(fighter) {
    const requested = resolveAnimationName(fighter);
    const clipName = this.animationSet[requested] ? requested : "idle";
    const clip = this.animationSet[clipName] ?? {
      frames: [0], frameDurationFrames: 1, loop: true
    };

    if (clipName !== this.clipName) {
      this.clipName = clipName;
      this.elapsedFrames = 0;
    } else {
      this.elapsedFrames += 1;
    }

    const frames = Array.isArray(clip.frames) && clip.frames.length ? clip.frames : [0];
    const frameDuration = Number.isInteger(clip.frameDurationFrames) && clip.frameDurationFrames > 0
      ? clip.frameDurationFrames
      : 1;
    const rawFrame = Math.floor(this.elapsedFrames / frameDuration);
    const frameIndex = clip.loop ? rawFrame % frames.length : Math.min(rawFrame, frames.length - 1);
    fighter.animation = {
      clipName,
      elapsedFrames: this.elapsedFrames,
      frameIndex,
      spriteFrame: frames[frameIndex],
      finished: !clip.loop && rawFrame >= frames.length
    };
    return fighter.animation;
  }

  reset() {
    this.clipName = null;
    this.elapsedFrames = 0;
  }
}
