const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
function createFighter({x,facing}) { return {x,y:440,previousX:x,previousY:440,facing,health:1,crouching:false,moveSpeed:300}; }
export class Arena {
  constructor() { this.width=960; this.height=540; this.floorY=440; this.player=createFighter({x:300,facing:1}); this.opponent=createFighter({x:660,facing:-1}); }
  update(deltaSeconds,input) {
    const player=this.player;
    player.previousX=player.x; player.previousY=player.y;
    this.opponent.previousX=this.opponent.x; this.opponent.previousY=this.opponent.y;
    const worldDirection=input.getWorldAxis ? input.getWorldAxis("horizontal") : input.getAxis("horizontal",player.facing)*player.facing;
    player.x=clamp(player.x+worldDirection*player.moveSpeed*deltaSeconds,40,this.width-40);
    player.crouching=input.isDown("crouch");
    player.facing=player.x<=this.opponent.x ? 1 : -1;
    this.opponent.facing=-player.facing;
  }
}
