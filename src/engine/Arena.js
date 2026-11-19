import { MovementController } from "../movement/MovementController.js";
import { AttackController } from "../combat/AttackController.js";
import { resolveAttackCollision, canGuardAttack } from "../combat/CombatCollision.js";
import { DAMAGE_PROFILES, DamageController } from "../combat/DamageController.js";
import { BLOCK_PROFILES, GuardController } from "../combat/GuardController.js";
import { resolvePushboxes } from "../movement/Pushbox.js";
import { FIGHTER_STATES, FighterStateController } from "../state/FighterStateController.js";
import { ROUND_PHASES, RoundController } from "../combat/RoundController.js";
import { ProjectileController } from "../combat/ProjectileController.js";

const clamp = (value,min,max)=>Math.min(max,Math.max(min,value));
export const STAGE_MARGIN=68;

function createFighter({x,facing}) {
  return {
    x,y:440,previousX:x,previousY:440,facing,health:1,crouching:false,
    guardMeter:100,guardMeterRecoveryDelayFrames:0,
    moveSpeed:300,vx:0,vy:0,onGround:true,
    state:{
      locomotion:FIGHTER_STATES.locomotion.STANDING,
      action:FIGHTER_STATES.action.NONE,
      reaction:FIGHTER_STATES.reaction.NONE
    },
    actionData:{dashType:null,remaining:0,velocity:0},
    dashType:null,dashRemaining:0,dashVelocity:0,
    airDashAvailable:true,airVectorAvailable:true,airHorizontalVelocity:0,
    groundDashCooldownRemaining:0,lastAttackData:null,
    guardData:null,reactionData:null
  };
}

export class Arena {
  constructor() {
    this.width=960; this.height=540; this.floorY=440;
    this.stageMargin=STAGE_MARGIN;
    this.stateController=new FighterStateController();
    this.player=createFighter({x:300,facing:1});
    this.opponent=createFighter({x:660,facing:-1});
    this.stateController.initialize(this.player);
    this.stateController.initialize(this.opponent);
    this.player.stateController=this.stateController;
    this.opponent.stateController=this.stateController;
    this.movement=new MovementController({stateController:this.stateController});
    this.attacks=new AttackController({stateController:this.stateController});
    this.guard=new GuardController({stateController:this.stateController});
    this.damage=new DamageController();
    this.rounds=new RoundController();
    this.projectileController=new ProjectileController({stateController:this.stateController});
    this.lastCombatEvent=null;
    this.lastHit=null;
  }

  update(deltaSeconds,input) {
    // The round controller owns all non-active transitions. Combat and physics
    // stay frozen during result/ready-up screens and after the match is decided.
    if (this.rounds.phase !== ROUND_PHASES.ACTIVE) {
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
    this.guard.update(player,input);
    this.attacks.update(player,input);
    this.projectileController.updateFighter(player,input);
    this.movement.update(player,input,deltaSeconds,{
      floorY:this.floorY,minX:this.stageMargin,maxX:this.width-this.stageMargin
    });
    player.x=clamp(player.x,this.stageMargin,this.width-this.stageMargin);
    this.opponent.x=clamp(this.opponent.x,this.stageMargin,this.width-this.stageMargin);
    resolvePushboxes(player,this.opponent,{minX:this.stageMargin,maxX:this.width-this.stageMargin});
    player.facing=player.x<=this.opponent.x ? 1 : -1;
    this.opponent.facing=-player.facing;

    // Resolve after movement and pushboxes so both boxes use final frame positions.
    const event=resolveAttackCollision(player,this.opponent);
    if(event) this.resolveCombatEvent(event);

    const projectileEvents=this.projectileController.updateProjectiles(
      deltaSeconds,
      [player,this.opponent],
      {
        minX:-this.stageMargin,
        maxX:this.width+this.stageMargin,
        minY:-this.stageMargin,
        maxY:this.height+this.stageMargin
      }
    );
    for(const projectileEvent of projectileEvents){
      this.resolveCombatEvent(projectileEvent);
    }

    // Check KO/timeout after combat resolution so a hit that empties health
    // ends the round on this fixed simulation step.
    this.rounds.update(deltaSeconds,{
      playerHealth:this.player.health,
      opponentHealth:this.opponent.health
    });
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

    if(event.type==="block"){
      const blockProfile=BLOCK_PROFILES[event.hitLevel] ?? BLOCK_PROFILES.mid;
      event.blockAdvantage=blockProfile.blockstunFrames-attackerRecoveryFrames;
      event.chipDamage=this.damage.applyChipDamage(event)?.damage ?? 0;
      event.resolution=this.guard.applyBlock(event);
    } else {
      const hitProfile=DAMAGE_PROFILES[event.moveId] ?? DAMAGE_PROFILES.medium;
      event.hitAdvantage=hitProfile.hitstunFrames-attackerRecoveryFrames;
      event.resolution=this.damage.applyHit(event);
    }

    attacker.lastAttackData={
      ...(attacker.lastAttackData ?? {}),
      moveId:event.moveId,
      moveName:event.moveName,
      hitAdvantage:event.hitAdvantage ?? null,
      blockAdvantage:event.blockAdvantage ?? null
    };
    if(
      attacker.state.action===FIGHTER_STATES.action.ATTACK ||
      attacker.state.action===FIGHTER_STATES.action.SPECIAL
    ){
      attacker.actionData.hitAdvantage=event.hitAdvantage ?? null;
      attacker.actionData.blockAdvantage=event.blockAdvantage ?? null;
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
    this.resetFighter(this.player,300,1);
    this.resetFighter(this.opponent,660,-1);
    this.movement.lastTap={left:-Infinity,right:-Infinity};
    this.projectileController.clear();
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
    fighter.airVectorAvailable=true;
    fighter.airHorizontalVelocity=0;
    fighter.groundDashCooldownRemaining=0;
    fighter.lastAttackData=null;
    fighter.guardData=null;
    fighter.reactionData=null;
    this.stateController.initialize(fighter);
  }
}
