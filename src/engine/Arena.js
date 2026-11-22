import { MovementController } from "../movement/MovementController.js";
import { AttackController } from "../combat/AttackController.js";
import { resolveAttackCollision, canGuardAttack } from "../combat/CombatCollision.js";
import { DAMAGE_PROFILES, DamageController } from "../combat/DamageController.js";
import { BLOCK_PROFILES, GuardController } from "../combat/GuardController.js";
import { resolvePushboxes } from "../movement/Pushbox.js";
import { FIGHTER_STATES, FighterStateController } from "../state/FighterStateController.js";
import { ROUND_PHASES, RoundController } from "../combat/RoundController.js";
import { ProjectileController } from "../combat/ProjectileController.js";
import { CommandHistory } from "../input/CommandHistory.js";
import { InputBuffer } from "../input/InputBuffer.js";
import { ComboTracker } from "../combat/ComboTracker.js";
import { OpponentAIController } from "../ai/OpponentAIController.js";

const clamp = (value,min,max)=>Math.min(max,Math.max(min,value));
export const STAGE_MARGIN=68;

function createFighter({x,facing,displayName,moveSpeed,damageMultiplier}) {
  return {
    x,y:440,previousX:x,previousY:440,facing,displayName,health:1,crouching:false,
    guardMeter:100,guardMeterRecoveryDelayFrames:0,
    moveSpeed,damageMultiplier,vx:0,vy:0,onGround:true,
    state:{
      locomotion:FIGHTER_STATES.locomotion.STANDING,
      action:FIGHTER_STATES.action.NONE,
      reaction:FIGHTER_STATES.reaction.NONE
    },
    actionData:{dashType:null,remaining:0,velocity:0},
    dashType:null,dashRemaining:0,dashVelocity:0,
    airDashAvailable:true,airProjectileAvailable:true,airHorizontalVelocity:0,
    groundDashCooldownRemaining:0,lastAttackData:null,
    guardData:null,reactionData:null
  };
}

export class Arena {
  constructor({opponentAIEnabled=false}={}) {
    this.width=960; this.height=540; this.floorY=440;
    this.stageMargin=STAGE_MARGIN;
    this.stateController=new FighterStateController();
    this.worldWidth=1920;
    this.player=createFighter({x:780,facing:1,displayName:"PLAYER 01",moveSpeed:300,damageMultiplier:1});
    this.opponent=createFighter({x:1140,facing:-1,displayName:"CPU RIVAL",moveSpeed:260,damageMultiplier:1.05});
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
    this.inputBuffer=new InputBuffer({bufferFrames:8});
    this.comboTracker=new ComboTracker({comboWindowFrames:45,maxJuggleHits:3});
    this.inputFrame=0;
    this.commandFeedbackText="";
    this.commandFeedbackRemaining=0;
    this.cameraX=(this.player.x+this.opponent.x)/2-this.width/2;
    this.previousCameraX=this.cameraX;
    this.lastCombatEvent=null;
    this.lastHit=null;
  }

  update(deltaSeconds,input) {
    this.previousCameraX=this.cameraX;
    // The round controller owns all non-active transitions. Combat and physics
    // stay frozen during result/ready-up screens and after the match is decided.
    if (this.rounds.phase !== ROUND_PHASES.ACTIVE) {
      this.inputBuffer.clear();
      this.comboTracker.reset();
      const transition=this.rounds.update(deltaSeconds,{
        playerHealth:this.player.health,
        opponentHealth:this.opponent.health,
        confirmPressed:Boolean(input.wasPressed?.("Enter") || input.wasPressed?.("Space"))
      });
      if (transition?.type==="nextRound" || transition?.type==="matchReset") {
        this.resetFighters();
      }
      return;
    }

    this.lastCombatEvent=null;
    this.comboTracker.update();
    this.commandFeedbackRemaining=Math.max(0,this.commandFeedbackRemaining-deltaSeconds);
    if (this.commandFeedbackRemaining===0) this.commandFeedbackText="";
    if (this.lastHit) {
      this.lastHit.remaining-=deltaSeconds;
      if (this.lastHit.remaining<=0) this.lastHit=null;
    }
    const player=this.player;
    this.damage.update(player);
    this.damage.update(this.opponent);
    player.previousX=player.x; player.previousY=player.y;
    this.opponent.previousX=this.opponent.x; this.opponent.previousY=this.opponent.y;
    player.facing=player.x<=this.opponent.x ? 1 : -1;
    this.opponent.facing=-player.facing;
    this.inputFrame+=1;
    this.commandHistory.update(input,player.facing);
    const quarterCircleSpecial =
      Boolean(input.wasPressed?.("special")) &&
      this.commandHistory.consumeQuarterCircleForward();
    if (quarterCircleSpecial) {
      this.inputBuffer.capture(input,this.inputFrame,{
        specialMove:"arcLance",
        specialFacing:player.facing
      });
      this.commandFeedbackText="ARC LANCE";
      this.commandFeedbackRemaining=0.9;
    } else {
      this.inputBuffer.capture(input,this.inputFrame);
    }
    const bufferedInput=this.inputBuffer.getInput(input,this.inputFrame);
    this.guard.update(player,input);

    // Light / Medium can cancel into either projectile special after a
    // confirmed hit. QCF input keeps its Arc Lance move identity while buffered.
    const cancelData=player.actionData;
    const cancelTargets=player.onGround
      ? (cancelData.cancelOnHit ?? [])
      : (cancelData.airCancelOnHit ?? []);
    const specialCancel =
      player.state.action===FIGHTER_STATES.action.ATTACK &&
      cancelData.hitOutcome==="hit" &&
      cancelTargets.includes("special") &&
      bufferedInput.wasPressed?.("special");
    if (specialCancel) {
      const fromMoveId=cancelData.moveId;
      this.stateController.endAction(player,FIGHTER_STATES.action.ATTACK);
      player.lastCancelData={type:"hit",fromMoveId,toMoveId:"special"};
    }

    const actionDataBefore=player.actionData;
    this.attacks.update(player,bufferedInput);
    this.projectileController.updateFighter(player,bufferedInput);

    // One final dispatch after advancing the current move lets a buffered
    // command start on the exact frame the previous action/recovery ends.
    if (this.inputBuffer.pending &&
        player.state.action===FIGHTER_STATES.action.NONE &&
        player.state.reaction===FIGHTER_STATES.reaction.NONE) {
      this.attacks.update(player,bufferedInput);
      this.projectileController.updateFighter(player,bufferedInput);
    }

    const pendingAction=this.inputBuffer.pending?.action;
    const startedBufferedMove =
      pendingAction &&
      player.actionData!==actionDataBefore &&
      player.actionData.elapsedFrames===1 &&
      ((pendingAction==="special" &&
        player.state.action===FIGHTER_STATES.action.SPECIAL) ||
       (pendingAction!=="special" &&
        player.state.action===FIGHTER_STATES.action.ATTACK &&
        player.actionData.moveId===pendingAction));
    if (startedBufferedMove) this.inputBuffer.consume(pendingAction);
    this.movement.update(player,input,deltaSeconds,{
      floorY:this.floorY,minX:this.stageMargin,maxX:this.worldWidth-this.stageMargin
    });

    const opponentInput=this.opponentAI?.update(this.opponent,player) ?? null;
    if(opponentInput){
      this.guard.update(this.opponent,opponentInput);
      this.attacks.update(this.opponent,opponentInput);
      this.projectileController.updateFighter(this.opponent,opponentInput);
      this.opponentMovement.update(this.opponent,opponentInput,deltaSeconds,{
        floorY:this.floorY,minX:this.stageMargin,maxX:this.worldWidth-this.stageMargin
      });
    }
    player.x=clamp(player.x,this.stageMargin,this.worldWidth-this.stageMargin);
    this.opponent.x=clamp(this.opponent.x,this.stageMargin,this.worldWidth-this.stageMargin);
    resolvePushboxes(player,this.opponent,{minX:this.stageMargin,maxX:this.worldWidth-this.stageMargin});
    player.facing=player.x<=this.opponent.x ? 1 : -1;
    this.opponent.facing=-player.facing;

    // Resolve after movement and pushboxes so both boxes use final frame positions.
    const combatEvents=[
      resolveAttackCollision(player,this.opponent),
      resolveAttackCollision(this.opponent,player)
    ].filter(Boolean);
    for(const event of combatEvents) this.resolveCombatEvent(event);

    const projectileEvents=this.projectileController.updateProjectiles(
      deltaSeconds,
      [player,this.opponent],
      {
        minX:-this.stageMargin,
        maxX:this.worldWidth+this.stageMargin,
        minY:-this.stageMargin,
        maxY:this.height+this.stageMargin
      }
    );
    for(const projectileEvent of projectileEvents){
      this.resolveCombatEvent(projectileEvent);
    }

    // Check KO/timeout after combat resolution so a hit that empties health
    // ends the round on this fixed simulation step.
    this.updateCamera();
    this.rounds.update(deltaSeconds,{
      playerHealth:this.player.health,
      opponentHealth:this.opponent.health
    });
    if (this.rounds.phase !== ROUND_PHASES.ACTIVE) this.inputBuffer.clear();
  }

  updateCamera() {
    const maxCameraX=Math.max(0,this.worldWidth-this.width);
    const midpoint=(this.player.x+this.opponent.x)/2;
    const minForPlayer=Math.max(0,this.player.x-(this.width-this.stageMargin));
    const maxForPlayer=Math.min(maxCameraX,this.player.x-this.stageMargin);
    const lower=Math.min(minForPlayer,maxForPlayer);
    const upper=Math.max(minForPlayer,maxForPlayer);
    this.cameraX=clamp(midpoint-this.width/2,lower,upper);
    this.cameraX=clamp(this.cameraX,0,maxCameraX);
  }

  resolveCombatEvent(event) {
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
    this.lastCombatEvent=event;
    this.lastHit={
      moveName:event.moveName,
      hitLevel:event.hitLevel,
      outcome:event.outcome,
      x:defender.x,
      y:defender.y-112,
      remaining:0.48
    };
  }

  resetFighters() {
    this.resetFighter(this.player,780,1);
    this.resetFighter(this.opponent,1140,-1);
    this.movement.lastTap={left:-Infinity,right:-Infinity};
    this.opponentMovement.lastTap={left:-Infinity,right:-Infinity};
    this.opponentAI?.reset();
    this.projectileController.clear();
    this.commandHistory.reset();
    this.inputBuffer.clear();
    this.comboTracker.reset();
    this.inputFrame=0;
    this.commandFeedbackText="";
    this.commandFeedbackRemaining=0;
    this.cameraX=(this.player.x+this.opponent.x)/2-this.width/2;
    this.previousCameraX=this.cameraX;
    this.lastCombatEvent=null;
    this.lastHit=null;
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
    fighter.actionData={dashType:null,remaining:0,velocity:0};
    fighter.dashType=null;
    fighter.dashRemaining=0;
    fighter.dashVelocity=0;
    fighter.airDashAvailable=true;
    fighter.airProjectileAvailable=true;
    fighter.airHorizontalVelocity=0;
    fighter.groundDashCooldownRemaining=0;
    fighter.lastAttackData=null;
    fighter.lastCancelData=null;
    fighter.guardData=null;
    fighter.reactionData=null;
    this.stateController.initialize(fighter);
  }
}
