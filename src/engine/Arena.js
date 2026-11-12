import { MovementController } from "../movement/MovementController.js";
import { resolvePushboxes } from "../movement/Pushbox.js";

const clamp = (value,min,max)=>Math.min(max,Math.max(min,value));
export const STAGE_MARGIN=68;
function createFighter({x,facing}) {
  return {
    x,y:440,previousX:x,previousY:440,facing,health:1,crouching:false,
    moveSpeed:300,vx:0,vy:0,onGround:true,dashType:null,dashRemaining:0,
    dashVelocity:0,airDashAvailable:true,airHorizontalVelocity:0,
    groundDashCooldownRemaining:0
  };
}
export class Arena {
  constructor() {
    this.width=960; this.height=540; this.floorY=440;
    this.stageMargin=STAGE_MARGIN;
    this.player=createFighter({x:300,facing:1});
    this.opponent=createFighter({x:660,facing:-1});
    this.movement=new MovementController();
  }
  update(deltaSeconds,input) {
    const player=this.player;
    player.previousX=player.x; player.previousY=player.y;
    this.opponent.previousX=this.opponent.x; this.opponent.previousY=this.opponent.y;
    player.facing=player.x<=this.opponent.x ? 1 : -1;
    this.opponent.facing=-player.facing;
    this.movement.update(player,input,deltaSeconds,{
      floorY:this.floorY,minX:this.stageMargin,maxX:this.width-this.stageMargin
    });
    player.x=clamp(player.x,this.stageMargin,this.width-this.stageMargin);
    this.opponent.x=clamp(this.opponent.x,this.stageMargin,this.width-this.stageMargin);
    resolvePushboxes(player,this.opponent,{minX:this.stageMargin,maxX:this.width-this.stageMargin});
    player.facing=player.x<=this.opponent.x ? 1 : -1;
    this.opponent.facing=-player.facing;
  }
}
