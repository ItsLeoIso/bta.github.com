import { MovementController } from "../movement/MovementController.js";
import { AttackController } from "../combat/AttackController.js";
import { resolveAttackCollision, canGuardAttack } from "../combat/CombatCollision.js";
import { DAMAGE_PROFILES, DamageController } from "../combat/DamageController.js";
import { BLOCK_PROFILES, GuardController } from "../combat/GuardController.js";
import { resolvePushboxes } from "../movement/Pushbox.js";
import { FIGHTER_STATES, FighterStateController, isGrounded } from "../state/FighterStateController.js";
import { ROUND_PHASES, RoundController } from "../combat/RoundController.js";
import { ProjectileController, PROJECTILE_DEFAULTS, MOTION_SPECIAL_DEFAULTS } from "../combat/ProjectileController.js";
import { CommandHistory } from "../input/CommandHistory.js";
import { InputBuffer } from "../input/InputBuffer.js";
import { ComboTracker } from "../combat/ComboTracker.js";
import { OpponentAIController } from "../ai/OpponentAIController.js";
import { CombatEffects } from "../effects/CombatEffects.js";
import { getCharacterDefinition } from "../characters/CharacterDefinitions.js";
import { FighterAnimator } from "../animation/FighterAnimator.js";

const clamp = (value,min,max)=>Math.min(max,Math.max(min,value));
export const STAGE_MARGIN=68;
export const MAX_FIGHTER_SEPARATION=960-2*STAGE_MARGIN;
export const SNAPSHOT_SCHEMA_VERSION=1;

const SIM_HZ=60;

const NEUTRAL_INPUT=Object.freeze({
  getWorldAxis:()=>0,
  wasPressed:()=>false,
  isDown:()=>false
});

export function resolveFighterSeparation(first, second, {
  minX = STAGE_MARGIN,
  maxX = 1920 - STAGE_MARGIN,
  maxSeparation = MAX_FIGHTER_SEPARATION
} = {}) {
  first.x = clamp(first.x, minX, maxX);
  second.x = clamp(second.x, minX, maxX);
  const separation = second.x - first.x;
  const excess = Math.abs(separation) - maxSeparation;
  if (excess <= 0) return;

  const direction = Math.sign(separation);
  const firstDelta = first.x - (first.previousX ?? first.x);
  const secondDelta = second.x - (second.previousX ?? second.x);
  const firstOutward = Math.max(0, -direction * firstDelta);
  const secondOutward = Math.max(0, direction * secondDelta);
  const totalOutward = firstOutward + secondOutward;

  let firstPull;
  let secondPull;
  if (totalOutward > 0) {
    // Each fighter absorbs excess in proportion to how far they moved apart
    // this frame, so walking into the camera edge never drags a stationary opponent.
    firstPull = excess * (firstOutward / totalOutward);
    secondPull = excess * (secondOutward / totalOutward);
  } else {
    firstPull = excess / 2;
    secondPull = excess / 2;
  }

  first.x = clamp(first.x + direction * firstPull, minX, maxX);
  second.x = clamp(second.x - direction * secondPull, minX, maxX);

  const remainingExcess = Math.abs(second.x - first.x) - maxSeparation;
  if (remainingExcess > 0) {
    if (first.x === minX || first.x === maxX) {
      second.x = clamp(second.x - direction * remainingExcess, minX, maxX);
    } else {
      first.x = clamp(first.x + direction * remainingExcess, minX, maxX);
    }
  }
}

function serializeFighterActionData(fighter) {
  const action = fighter.state?.action;
  const data = fighter.actionData;
  if (!data || action === FIGHTER_STATES.action.NONE) return null;

  if (action === FIGHTER_STATES.action.DASH) {
    return {
      dashType: data.dashType ?? null,
      remainingFrames: Number.isInteger(data.remainingFrames)
        ? data.remainingFrames
        : Math.max(0, Math.round((data.remaining ?? 0) * SIM_HZ)),
      velocity: data.velocity ?? 0
    };
  }
  if (action === FIGHTER_STATES.action.GUARD) {
    return {
      guardHeight: data.guardHeight ?? fighter.guardData?.guardHeight ?? "high"
    };
  }
  if (action === FIGHTER_STATES.action.ATTACK) {
    return {
      moveId: data.moveId ?? null,
      elapsedFrames: data.elapsedFrames ?? 0,
      phase: data.phase ?? "startup",
      phaseFrame: data.phaseFrame ?? 0,
      hitConfirmed: Boolean(data.hitConfirmed),
      hitOutcome: data.hitOutcome ?? null,
      hitAdvantage: data.hitAdvantage ?? null,
      blockAdvantage: data.blockAdvantage ?? null
    };
  }
  if (action === FIGHTER_STATES.action.SPECIAL) {
    return {
      moveId: data.moveId ?? "special",
      elapsedFrames: data.elapsedFrames ?? 0,
      phase: data.phase ?? "startup",
      phaseFrame: data.phaseFrame ?? 0,
      projectileSpawned: Boolean(data.projectileSpawned),
      directionX: data.directionX ?? fighter.facing ?? 1,
      directionY: data.directionY ?? 0,
      hitAdvantage: data.hitAdvantage ?? null,
      blockAdvantage: data.blockAdvantage ?? null
    };
  }
  return null;
}

function restoreFighterActionData(fighter, action, data) {
  if (!data || action === FIGHTER_STATES.action.NONE) {
    return {};
  }
  if (action === FIGHTER_STATES.action.DASH) {
    const remainingFrames = data.remainingFrames ?? 0;
    return {
      dashType: data.dashType ?? null,
      remainingFrames,
      remaining: remainingFrames / SIM_HZ,
      velocity: data.velocity ?? 0
    };
  }
  if (action === FIGHTER_STATES.action.GUARD) {
    return { guardHeight: data.guardHeight ?? "high" };
  }
  if (action === FIGHTER_STATES.action.ATTACK) {
    const move = fighter.character?.moveSet?.attacks?.[data.moveId] ?? {};
    return {
      ...move,
      moveId: data.moveId,
      moveName: move.name ?? data.moveId,
      elapsedFrames: data.elapsedFrames,
      phase: data.phase,
      phaseFrame: data.phaseFrame,
      hitConfirmed: Boolean(data.hitConfirmed),
      hitOutcome: data.hitOutcome ?? null,
      hitAdvantage: data.hitAdvantage ?? null,
      blockAdvantage: data.blockAdvantage ?? null
    };
  }
  if (action === FIGHTER_STATES.action.SPECIAL) {
    const projectiles = fighter.character?.moveSet?.projectiles;
    const isArcLance = data.moveId === "arcLance";
    const move = isArcLance
      ? (projectiles?.arcLance ?? MOTION_SPECIAL_DEFAULTS)
      : (projectiles?.energyShot ?? PROJECTILE_DEFAULTS);
    return {
      moveId: data.moveId,
      moveName: move.moveName ?? (isArcLance ? MOTION_SPECIAL_DEFAULTS.moveName : PROJECTILE_DEFAULTS.moveName),
      hitLevel: move.hitLevel ?? PROJECTILE_DEFAULTS.hitLevel,
      startupFrames: move.startupFrames ?? PROJECTILE_DEFAULTS.startupFrames,
      recoveryFrames: move.recoveryFrames ?? PROJECTILE_DEFAULTS.recoveryFrames,
      projectileSpeed: move.speed ?? PROJECTILE_DEFAULTS.speed,
      projectileRadius: move.radius ?? PROJECTILE_DEFAULTS.radius,
      projectileLifetimeSeconds: move.lifetimeSeconds ?? PROJECTILE_DEFAULTS.lifetimeSeconds,
      projectileSpawnOffsetX: move.spawnOffsetX ?? PROJECTILE_DEFAULTS.spawnOffsetX,
      projectileSpawnOffsetY: move.spawnOffsetY ?? PROJECTILE_DEFAULTS.spawnOffsetY,
      elapsedFrames: data.elapsedFrames,
      phase: data.phase,
      phaseFrame: data.phaseFrame,
      projectileSpawned: Boolean(data.projectileSpawned),
      directionX: data.directionX,
      directionY: data.directionY,
      hitAdvantage: data.hitAdvantage ?? null,
      blockAdvantage: data.blockAdvantage ?? null
    };
  }
  return {};
}

function createFighter({ slot, x, facing, character }) {
  const fighter = {
    slot,
    x, y: 440, previousX: x, previousY: 440, facing,
    characterId: character.id,
    character,
    displayName: character.displayName,
    health: 1,
    crouching: false,
    guardMeter: 100,
    guardMeterRecoveryDelayFrames: 0,
    moveSpeed: character.stats.moveSpeed,
    damageMultiplier: character.stats.damageMultiplier,
    vx: 0, vy: 0, onGround: true,
    state: {
      locomotion: FIGHTER_STATES.locomotion.STANDING,
      action: FIGHTER_STATES.action.NONE,
      reaction: FIGHTER_STATES.reaction.NONE
    },
    actionData: { dashType: null, remainingFrames: 0, remaining: 0, velocity: 0 },
    dashType: null, dashRemaining: 0, dashVelocity: 0,
    airDashAvailable: true, airProjectileAvailable: true, airHorizontalVelocity: 0,
    groundDashCooldownFrames: 0,
    groundDashCooldownRemaining: 0, lastAttackData: null,
    guardData: null, reactionData: null
  };
  fighter.animator = new FighterAnimator(character.animations);
  fighter.animator.update(fighter);
  return fighter;
}

export class Arena {
  constructor({
    opponentAIEnabled=false,
    trainingMode=false,
    playerCharacterId="striker",
    opponentCharacterId="cpu-rival"
  }={}) {
    this.width=960; this.height=540; this.floorY=440;
    this.stageMargin=STAGE_MARGIN;
    this.trainingMode=Boolean(trainingMode);
    this.trainingDummyResetFrames=0;
    this.stateController=new FighterStateController();
    this.worldWidth=1920;
    const playerCharacter=getCharacterDefinition(playerCharacterId);
    const opponentCharacter=getCharacterDefinition(opponentCharacterId);
    if(!playerCharacter) throw new RangeError("Unknown player character: "+playerCharacterId);
    if(!opponentCharacter) throw new RangeError("Unknown opponent character: "+opponentCharacterId);
    this.player=createFighter({slot:0,x:780,facing:1,character:playerCharacter});
    this.opponent=createFighter({slot:1,x:1140,facing:-1,character:opponentCharacter});
    this.fighters=[this.player,this.opponent];
    this.stateController.initialize(this.player);
    this.stateController.initialize(this.opponent);
    this.player.stateController=this.stateController;
    this.opponent.stateController=this.stateController;
    this.movement=new MovementController({stateController:this.stateController});
    this.opponentMovement=new MovementController({stateController:this.stateController});
    this.opponentAI=opponentAIEnabled ? new OpponentAIController() : null;
    this.attacks=new AttackController({stateController:this.stateController});
    this.guard=new GuardController({stateController:this.stateController});
    this.damage=new DamageController();
    this.rounds=new RoundController();
    this.projectileController=new ProjectileController({stateController:this.stateController});
    this.commandHistory=new CommandHistory();
    this.opponentCommandHistory=new CommandHistory();
    this.inputBuffer=new InputBuffer({bufferFrames:8});
    this.opponentInputBuffer=new InputBuffer({bufferFrames:8});
    this.comboTracker=new ComboTracker({comboWindowFrames:45,maxJuggleHits:3});
    this.inputFrame=0;
    this.trainingDummyResetFrames=0;
    this.commandFeedbackText="";
    this.commandFeedbackRemaining=0;
    this.cameraX=(this.player.x+this.opponent.x)/2-this.width/2;
    this.previousCameraX=this.cameraX;
    this.lastCombatEvent=null;
    this.lastHit=null;
    this.combatEffects=new CombatEffects();
  }

  processFighterStep({
    fighter,
    input,
    movement,
    commandHistory,
    inputBuffer,
    deltaSeconds,
    isResimulating = false
  }) {
    const resolvedInput = input ?? NEUTRAL_INPUT;
    commandHistory.update(resolvedInput, fighter.facing);
    const quarterCircleSpecial =
      Boolean(resolvedInput.wasPressed?.("special")) &&
      commandHistory.consumeQuarterCircleForward();
    if (quarterCircleSpecial) {
      inputBuffer.capture(resolvedInput, this.inputFrame, {
        specialMove: "arcLance",
        specialFacing: fighter.facing
      });
      if (!isResimulating) {
        this.commandFeedbackText = "ARC LANCE";
        this.commandFeedbackRemaining = 0.9;
      }
    } else {
      inputBuffer.capture(resolvedInput, this.inputFrame);
    }
    const bufferedInput = inputBuffer.getInput(resolvedInput, this.inputFrame);
    this.guard.update(fighter, resolvedInput);

    // Light / Medium can cancel into either projectile special after a
    // confirmed hit. QCF input keeps its Arc Lance move identity while buffered.
    const cancelData = fighter.actionData;
    const cancelTargets = isGrounded(fighter)
      ? (cancelData.cancelOnHit ?? [])
      : (cancelData.airCancelOnHit ?? []);
    const specialCancel =
      fighter.state.action === FIGHTER_STATES.action.ATTACK &&
      cancelData.hitOutcome === "hit" &&
      cancelTargets.includes("special") &&
      this.projectileController.canStartSpecial(
        fighter,
        bufferedInput,
        { allowAttackCancel: true }
      );
    if (specialCancel) {
      const fromMoveId = cancelData.moveId;
      this.stateController.endAction(fighter, FIGHTER_STATES.action.ATTACK);
      fighter.lastCancelData = { type: "hit", fromMoveId, toMoveId: "special" };
    }

    const actionDataBefore = fighter.actionData;
    this.attacks.update(fighter, bufferedInput);
    this.projectileController.updateFighter(fighter, bufferedInput);

    // One final dispatch after advancing the current move lets a buffered
    // command start on the exact frame the previous action/recovery ends.
    if (
      inputBuffer.pending &&
      fighter.state.action === FIGHTER_STATES.action.NONE &&
      fighter.state.reaction === FIGHTER_STATES.reaction.NONE
    ) {
      this.attacks.update(fighter, bufferedInput);
      this.projectileController.updateFighter(fighter, bufferedInput);
    }

    const pendingAction = inputBuffer.pending?.action;
    const startedBufferedMove =
      pendingAction &&
      fighter.actionData !== actionDataBefore &&
      fighter.actionData.elapsedFrames === 1 &&
      ((pendingAction === "special" &&
        fighter.state.action === FIGHTER_STATES.action.SPECIAL) ||
       (pendingAction !== "special" &&
        fighter.state.action === FIGHTER_STATES.action.ATTACK &&
        fighter.actionData.moveId === pendingAction));
    if (startedBufferedMove) inputBuffer.consume(pendingAction);

    movement.update(fighter, resolvedInput, deltaSeconds, {
      floorY: this.floorY,
      minX: this.stageMargin,
      maxX: this.worldWidth - this.stageMargin
    });
  }

  update(deltaSeconds, input, player2Input = null, {
    isResimulating = false,
    allowLocalRematchConfirm = true
  } = {}) {
    const slot0Input = input ?? NEUTRAL_INPUT;
    if (!isResimulating) {
      this.combatEffects.update(deltaSeconds);
    }
    this.previousCameraX=this.cameraX;
    // The round controller owns all non-active transitions. Combat and physics
    // stay frozen during result/ready-up screens and after the match is decided.
    if (this.rounds.phase !== ROUND_PHASES.ACTIVE) {
      this.inputBuffer.clear();
      this.opponentInputBuffer.clear();
      this.comboTracker.reset();
      const transition=this.rounds.update(deltaSeconds,{
        playerHealth:this.player.health,
        opponentHealth:this.opponent.health,
        confirmPressed: allowLocalRematchConfirm && Boolean(
          slot0Input.wasPressed?.("Enter") ||
          slot0Input.wasPressed?.("Space") ||
          player2Input?.wasPressed?.("Enter") ||
          player2Input?.wasPressed?.("Space")
        )
      });
      if (transition?.type==="nextRound" || transition?.type==="matchReset") {
        this.resetFighters({ preserveEffects: isResimulating });
      }
      this.updateAnimations();
      return;
    }

    this.lastCombatEvent=null;
    if (!isResimulating) {
      this.commandFeedbackRemaining=Math.max(0,this.commandFeedbackRemaining-deltaSeconds);
      if (this.commandFeedbackRemaining===0) this.commandFeedbackText="";
      if (this.lastHit) {
        this.lastHit.remaining-=deltaSeconds;
        if (this.lastHit.remaining<=0) this.lastHit=null;
      }
    }
    const player=this.player;
    this.damage.update(player);
    this.damage.update(this.opponent);
    this.comboTracker.update();
    player.previousX=player.x; player.previousY=player.y;
    this.opponent.previousX=this.opponent.x; this.opponent.previousY=this.opponent.y;
    player.facing=player.x<=this.opponent.x ? 1 : -1;
    this.opponent.facing=-player.facing;
    this.inputFrame+=1;

    this.processFighterStep({
      fighter: player,
      input: slot0Input,
      movement: this.movement,
      commandHistory: this.commandHistory,
      inputBuffer: this.inputBuffer,
      deltaSeconds,
      isResimulating
    });

    const slot1Input =
      player2Input ?? (this.opponentAI ? this.opponentAI.update(this.opponent, player) : null);
    if (slot1Input) {
      this.processFighterStep({
        fighter: this.opponent,
        input: slot1Input,
        movement: this.opponentMovement,
        commandHistory: this.opponentCommandHistory,
        inputBuffer: this.opponentInputBuffer,
        deltaSeconds,
        isResimulating
      });
    } else {
      // Passive dummy (Training / isolated single-player fixtures): no input-driven
      // actions or guard release, while knockback, gravity, and landing still run.
      this.opponentMovement.update(
        this.opponent,
        NEUTRAL_INPUT,
        deltaSeconds,
        {floorY:this.floorY,minX:this.stageMargin,maxX:this.worldWidth-this.stageMargin}
      );
    }

    resolveFighterSeparation(player,this.opponent,{
      minX:this.stageMargin,
      maxX:this.worldWidth-this.stageMargin,
      maxSeparation:MAX_FIGHTER_SEPARATION
    });
    resolvePushboxes(player,this.opponent,{minX:this.stageMargin,maxX:this.worldWidth-this.stageMargin});
    player.facing=player.x<=this.opponent.x ? 1 : -1;
    this.opponent.facing=-player.facing;

    // Resolve after movement and pushboxes so both boxes use final frame positions.
    const combatEvents=[
      resolveAttackCollision(player,this.opponent),
      resolveAttackCollision(this.opponent,player)
    ].filter(Boolean);
    for(const event of combatEvents) this.resolveCombatEvent(event, { isResimulating });

    const projectileEvents=this.projectileController.updateProjectiles(
      deltaSeconds,
      [player,this.opponent],
      {
        minX:-this.stageMargin,
        maxX:this.worldWidth+this.stageMargin,
        minY:-this.stageMargin,
        maxY:this.height+this.stageMargin,
        floorY:this.floorY
      }
    );
    for(const projectileEvent of projectileEvents){
      this.resolveCombatEvent(projectileEvent, { isResimulating });
    }

    // Check KO/timeout after combat resolution so a hit that empties health
    // ends the round on this fixed simulation step.
    this.updateCamera();
    if(this.trainingMode){
      if(this.trainingDummyResetFrames>0){
        this.trainingDummyResetFrames-=1;
        if(this.trainingDummyResetFrames===0){
          this.opponent.health=1;
          this.opponent.guardMeter=100;
          this.opponent.guardMeterRecoveryDelayFrames=0;
        }
      }
      this.rounds.timerRemaining=this.rounds.durationSeconds;
    } else {
      this.rounds.update(deltaSeconds,{
        playerHealth:this.player.health,
        opponentHealth:this.opponent.health
      });
    }
    if (this.rounds.phase !== ROUND_PHASES.ACTIVE) {
      this.inputBuffer.clear();
      this.opponentInputBuffer.clear();
    }
    this.updateAnimations();
  }

  updateAnimations() {
    this.player.animator.update(this.player);
    this.opponent.animator.update(this.opponent);
  }

  updateCamera() {
    const maxCameraX=Math.max(0,this.worldWidth-this.width);
    const midpoint=(this.player.x+this.opponent.x)/2;
    this.cameraX=clamp(midpoint-this.width/2,0,maxCameraX);
  }

  resolveCombatEvent(event, { isResimulating = false } = {}) {
    if(event.type==="contact"){
      event.type=canGuardAttack(
        event.attacker,
        event.defender,
        event.hitLevel,
        event.projectileDirection ?? null
      ) ? "block" : "hit";
    }

    const attacker=event.attacker;
    const defender=event.defender;
    const attackerRecoveryFrames=event.attackerRecoveryFrames ?? 0;
    const wasAirborne=defender.onGround===false;

    if(event.type==="hit" && !this.comboTracker.canRegisterHit(event)){
      // The collision is consumed, but a fourth aerial follow-up is dropped.
      event.type="juggleDrop";
    }

    if(event.type==="block"){
      const blockProfile=BLOCK_PROFILES[event.hitLevel] ?? BLOCK_PROFILES.mid;
      event.blockAdvantage=blockProfile.blockstunFrames-attackerRecoveryFrames;
      event.chipDamage=this.damage.applyChipDamage(event)?.damage ?? 0;
      event.resolution=this.guard.applyBlock(event);
    } else if(event.type==="hit"){
      const hitProfile=DAMAGE_PROFILES[event.moveId] ?? DAMAGE_PROFILES.medium;
      event.hitAdvantage=hitProfile.hitstunFrames-attackerRecoveryFrames;
      const damageScale=this.comboTracker.getDamageScale(event);
      event.resolution=this.damage.applyHit(event,{damageScale});
      event.combo=this.comboTracker.recordHit(
        event,
        event.resolution?.damage ?? 0,
        {wasAirborne}
      );
    }

    attacker.lastAttackData={
      ...(attacker.lastAttackData ?? {}),
      moveId:event.moveId,
      moveName:event.moveName,
      hitAdvantage:event.hitAdvantage ?? null,
      blockAdvantage:event.blockAdvantage ?? null,
      hitOutcome:event.type
    };
    if(
      attacker.state.action===FIGHTER_STATES.action.ATTACK ||
      attacker.state.action===FIGHTER_STATES.action.SPECIAL
    ){
      attacker.actionData.hitAdvantage=event.hitAdvantage ?? null;
      attacker.actionData.blockAdvantage=event.blockAdvantage ?? null;
      attacker.actionData.hitOutcome=event.type;
    }

    event.outcome=event.resolution?.outcome ?? event.type;
    if (!isResimulating) {
      this.combatEffects.trigger(event);
      this.lastHit={
        moveName:event.moveName,
        hitLevel:event.hitLevel,
        outcome:event.outcome,
        x:defender.x,
        y:defender.y-112,
        remaining:0.48
      };
    }
    this.lastCombatEvent=event;
    if(this.trainingMode && defender===this.opponent &&
      (event.type==="hit" || event.type==="block")){
      this.trainingDummyResetFrames=120;
    }
  }

  saveState({ inputMasks = [0, 0] } = {}) {
    return {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      inputFrame: this.inputFrame,
      inputMasks: [inputMasks[0] & 0x00ff, inputMasks[1] & 0x00ff],
      fighters: this.fighters.map(fighter => ({
        slot: fighter.slot,
        characterId: fighter.characterId,
        x: fighter.x,
        y: fighter.y,
        previousX: fighter.previousX,
        previousY: fighter.previousY,
        vx: fighter.vx,
        vy: fighter.vy,
        airHorizontalVelocity: fighter.airHorizontalVelocity,
        facing: fighter.facing,
        onGround: Boolean(fighter.onGround),
        health: fighter.health,
        guardMeter: fighter.guardMeter,
        guardMeterRecoveryDelayFrames: fighter.guardMeterRecoveryDelayFrames ?? 0,
        airDashAvailable: Boolean(fighter.airDashAvailable),
        airProjectileAvailable: Boolean(fighter.airProjectileAvailable),
        groundDashCooldownFrames: Number.isInteger(fighter.groundDashCooldownFrames)
          ? fighter.groundDashCooldownFrames
          : Math.max(0, Math.round((fighter.groundDashCooldownRemaining ?? 0) * SIM_HZ)),
        state: {
          locomotion: fighter.state.locomotion,
          action: fighter.state.action,
          reaction: fighter.state.reaction
        },
        actionData: serializeFighterActionData(fighter),
        guardData: fighter.guardData ? { guardHeight: fighter.guardData.guardHeight } : null,
        reactionData: fighter.reactionData
          ? {
              remainingFrames: fighter.reactionData.remainingFrames,
              totalFrames: fighter.reactionData.totalFrames,
              knockbackVelocity: fighter.reactionData.knockbackVelocity,
              damage: fighter.reactionData.damage ?? 0,
              moveId: fighter.reactionData.moveId ?? null,
              blocked: Boolean(fighter.reactionData.blocked),
              guardBreak: Boolean(fighter.reactionData.guardBreak)
            }
          : null
      })),
      movement: [
        this.movement.saveState(),
        this.opponentMovement.saveState()
      ],
      commandHistories: [
        this.commandHistory.saveState(),
        this.opponentCommandHistory.saveState()
      ],
      inputBuffers: [
        this.inputBuffer.saveState(),
        this.opponentInputBuffer.saveState()
      ],
      projectiles: this.projectileController.saveState(),
      combos: this.comboTracker.saveState(this.fighters),
      rounds: this.rounds.saveState()
    };
  }

  loadState(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
      throw new RangeError(
        "Unsupported Arena snapshot schema version: " + snapshot?.schemaVersion
      );
    }

    this.inputFrame = snapshot.inputFrame;
    for (let slot = 0; slot < 2; slot += 1) {
      const target = this.fighters[slot];
      const source = snapshot.fighters[slot];
      if (!target || !source) continue;

      if (source.characterId && source.characterId !== target.characterId) {
        const definition = getCharacterDefinition(source.characterId);
        if (!definition) throw new RangeError("Unknown snapshot character: " + source.characterId);
        target.characterId = definition.id;
        target.character = definition;
        target.displayName = definition.displayName;
        target.moveSpeed = definition.stats.moveSpeed;
        target.damageMultiplier = definition.stats.damageMultiplier;
        target.animator = new FighterAnimator(definition.animations);
      }

      target.slot = slot;
      target.x = source.x;
      target.y = source.y;
      target.previousX = source.previousX;
      target.previousY = source.previousY;
      target.vx = source.vx;
      target.vy = source.vy;
      target.airHorizontalVelocity = source.airHorizontalVelocity;
      target.facing = source.facing;
      target.onGround = Boolean(source.onGround);
      target.health = source.health;
      target.guardMeter = source.guardMeter;
      target.guardMeterRecoveryDelayFrames = source.guardMeterRecoveryDelayFrames;
      target.airDashAvailable = Boolean(source.airDashAvailable);
      target.airProjectileAvailable = Boolean(source.airProjectileAvailable);
      target.groundDashCooldownFrames = source.groundDashCooldownFrames;
      target.groundDashCooldownRemaining = source.groundDashCooldownFrames / SIM_HZ;
      target.state = {
        locomotion: source.state.locomotion,
        action: source.state.action,
        reaction: source.state.reaction
      };
      target.actionData = restoreFighterActionData(target, source.state.action, source.actionData);
      target.guardData = source.guardData ? { guardHeight: source.guardData.guardHeight } : null;
      target.reactionData = source.reactionData
        ? {
            remainingFrames: source.reactionData.remainingFrames,
            totalFrames: source.reactionData.totalFrames,
            knockbackVelocity: source.reactionData.knockbackVelocity,
            damage: source.reactionData.damage ?? 0,
            moveId: source.reactionData.moveId ?? null,
            blocked: Boolean(source.reactionData.blocked),
            guardBreak: Boolean(source.reactionData.guardBreak)
          }
        : null;
      this.stateController.syncCompatibilityFields(target);
    }

    this.movement.loadState(snapshot.movement[0]);
    this.opponentMovement.loadState(snapshot.movement[1]);
    this.commandHistory.loadState(snapshot.commandHistories[0]);
    this.opponentCommandHistory.loadState(snapshot.commandHistories[1]);
    this.inputBuffer.loadState(snapshot.inputBuffers[0]);
    this.opponentInputBuffer.loadState(snapshot.inputBuffers[1]);
    this.projectileController.loadState(snapshot.projectiles, this.fighters);
    this.comboTracker.loadState(snapshot.combos, this.fighters);
    this.rounds.loadState(snapshot.rounds);
    this.updateCamera();
    this.previousCameraX = this.cameraX;
    this.updateAnimations();
  }

  resetTraining() {
    if(!this.trainingMode) return false;
    this.resetFighters();
    this.rounds.timerRemaining=this.rounds.durationSeconds;
    return true;
  }

  resetFighters({ preserveEffects = false } = {}) {
    this.resetFighter(this.player,780,1);
    this.resetFighter(this.opponent,1140,-1);
    this.movement.reset();
    this.opponentMovement.reset();
    this.opponentAI?.reset();
    this.projectileController.clear();
    this.commandHistory.reset();
    this.opponentCommandHistory.reset();
    this.inputBuffer.clear();
    this.opponentInputBuffer.clear();
    this.comboTracker.reset();
    this.inputFrame=0;
    this.trainingDummyResetFrames=0;
    this.commandFeedbackText="";
    this.commandFeedbackRemaining=0;
    this.cameraX=(this.player.x+this.opponent.x)/2-this.width/2;
    this.previousCameraX=this.cameraX;
    this.lastCombatEvent=null;
    if (!preserveEffects) {
      this.lastHit=null;
      this.combatEffects.reset();
    }
  }

  resetFighter(fighter,x,facing) {
    fighter.x=x;
    fighter.y=this.floorY;
    fighter.previousX=x;
    fighter.previousY=this.floorY;
    fighter.facing=facing;
    fighter.health=1;
    fighter.crouching=false;
    fighter.guardMeter=100;
    fighter.guardMeterRecoveryDelayFrames=0;
    fighter.vx=0;
    fighter.vy=0;
    fighter.onGround=true;
    fighter.state={
      locomotion:FIGHTER_STATES.locomotion.STANDING,
      action:FIGHTER_STATES.action.NONE,
      reaction:FIGHTER_STATES.reaction.NONE
    };
    fighter.actionData={dashType:null,remainingFrames:0,remaining:0,velocity:0};
    fighter.dashType=null;
    fighter.dashRemaining=0;
    fighter.dashVelocity=0;
    fighter.airDashAvailable=true;
    fighter.airProjectileAvailable=true;
    fighter.airHorizontalVelocity=0;
    fighter.groundDashCooldownFrames=0;
    fighter.groundDashCooldownRemaining=0;
    fighter.lastAttackData=null;
    fighter.lastCancelData=null;
    fighter.guardData=null;
    fighter.reactionData=null;
    this.stateController.initialize(fighter);
    fighter.animator?.reset();
    fighter.animator?.update(fighter);
  }
}
