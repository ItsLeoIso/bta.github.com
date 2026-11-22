import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";

function input({axis=0,pressed=[],down=[]}={}) {
  return {
    getWorldAxis:()=>axis,
    wasPressed:action=>pressed.includes(action),
    isDown:action=>down.includes(action)
  };
}

test("movement uses the extended world bounds rather than viewport bounds",()=>{
  const arena=new Arena();
  const bounds={floorY:arena.floorY,minX:arena.stageMargin,maxX:arena.worldWidth-arena.stageMargin};
  arena.movement.update(arena.player,input({axis:1}),1,bounds);
  assert.equal(arena.player.x,1080);
  arena.movement.update(arena.player,input({axis:1}),10,bounds);
  assert.equal(arena.player.x,arena.worldWidth-arena.stageMargin);
});

test("arena updates facing based on relative fighter positions",()=>{
  const arena=new Arena(); arena.player.x=1200;
  arena.update(0,input());
  assert.equal(arena.player.facing,-1);
  assert.equal(arena.opponent.facing,1);
});

test("W+A starts a backward diagonal jump instead of entering guard",()=>{
  const arena=new Arena();
  const startX=arena.player.x;
  arena.update(1/60,input({axis:-1,pressed:["jump","left"]}));
  assert.ok(arena.player.y<arena.floorY);
  assert.ok(arena.player.x<startX);
  assert.ok(arena.player.airHorizontalVelocity<0);
  assert.equal(arena.player.state.action,"none");
});

test("jumping out of an existing back-guard starts the backward jump",()=>{
  const arena=new Arena();
  arena.update(1/60,input({axis:-1,pressed:["left"]}));
  assert.equal(arena.player.state.action,"guard");
  const startX=arena.player.x;
  arena.update(1/60,input({axis:-1,pressed:["jump"]}));
  assert.ok(arena.player.y<arena.floorY);
  assert.ok(arena.player.x<startX);
  assert.equal(arena.player.state.action,"none");
});

test("W+D starts a forward diagonal jump",()=>{
  const arena=new Arena();
  const startX=arena.player.x;
  arena.update(1/60,input({axis:1,pressed:["jump","right"]}));
  assert.ok(arena.player.y<arena.floorY);
  assert.ok(arena.player.x>startX);
  assert.ok(arena.player.airHorizontalVelocity>0);
});

test("jump input wins over a pending backdash double-tap",()=>{
  const arena=new Arena();
  arena.movement.lastTap.left=arena.movement.elapsed;
  const startX=arena.player.x;
  arena.update(1/60,input({axis:-1,pressed:["jump","left"]}));
  assert.ok(arena.player.y<arena.floorY);
  assert.ok(arena.player.x<startX);
  assert.equal(arena.player.dashType,null);
});

test("W jumps and gravity returns the fighter to the floor",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["jump"]}));
  assert.ok(arena.player.y<arena.floorY);
  assert.ok(arena.player.vy<0);
  for(let i=0;i<120;i++) arena.update(1/60,input());
  assert.equal(arena.player.y,arena.floorY);
  assert.equal(arena.player.onGround,true);
});

test("double-tapping forward starts a ground dash",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["right"]}));
  arena.update(0.08,input());
  arena.update(1/60,input({pressed:["right"]}));
  assert.equal(arena.player.dashType,"forward");
  assert.ok(arena.player.vx>arena.movement.groundSpeed);
});

test("double-tapping backward starts a backdash",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["left"]}));
  arena.update(0.08,input());
  arena.update(1/60,input({pressed:["left"]}));
  assert.equal(arena.player.dashType,"backdash");
  assert.ok(arena.player.vx<0);
});

test("double-tapping forward in the air starts one air dash",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["jump"]}));
  arena.update(1/60,input({pressed:["right"]}));
  arena.update(0.08,input());
  arena.update(1/60,input({pressed:["right"]}));
  assert.equal(arena.player.dashType,"air");
  assert.equal(arena.player.airDashAvailable,false);
});

test("neutral jump stays vertical despite horizontal air input",()=>{
  const arena=new Arena(), startX=arena.player.x;
  arena.update(1/60,input({pressed:["jump"]}));
  for(let i=0;i<12;i++) arena.update(1/60,input({axis:1}));
  assert.equal(arena.player.x,startX);
  assert.ok(arena.player.y<arena.floorY);
});

test("directional jump keeps its takeoff direction despite opposite air input",()=>{
  const arena=new Arena();
  arena.update(1/60,input({axis:1,pressed:["jump"]}));
  const afterTakeoff=arena.player.x;
  arena.update(1/60,input({axis:-1}));
  assert.ok(arena.player.x>afterTakeoff);
  const before=arena.player.x;
  for(let i=0;i<12;i++) arena.update(1/60,input({axis:-1}));
  assert.ok(arena.player.x>before);
});

test("air dash changes the locked trajectory without restoring air steering",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["jump"]}));
  arena.update(1/60,input({pressed:["right"]}));
  arena.update(0.08,input());
  arena.update(1/60,input({pressed:["right"]}));
  const afterDash=arena.player.x;
  for(let i=0;i<12;i++) arena.update(1/60,input({axis:-1}));
  assert.ok(arena.player.x>afterDash);
});

test("ground dashes share a cooldown and cannot be chained across the arena",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["right"]}));
  arena.update(0.08,input());
  arena.update(1/60,input({pressed:["right"]}));
  assert.equal(arena.player.dashType,"forward");

  // A fresh double-tap during the lockout must not start another dash.
  arena.update(0.08,input());
  arena.update(0.08,input({pressed:["right"]}));
  arena.update(0.08,input());
  arena.update(0.08,input({pressed:["right"]}));
  assert.equal(arena.player.dashType,null);

  // Once the cooldown has elapsed, another fresh double-tap is allowed.
  arena.update(0.5,input());
  arena.update(1/60,input({pressed:["right"]}));
  arena.update(0.08,input());
  arena.update(1/60,input({pressed:["right"]}));
  assert.equal(arena.player.dashType,"forward");
});
test("crouching reduces grounded walking speed to 12.5%",()=>{
  const standing=new Arena();
  const crouching=new Arena();
  standing.update(0.5,input({axis:1}));
  crouching.update(0.5,input({axis:1,down:["crouch"]}));
  assert.equal(standing.player.x,930);
  assert.equal(crouching.player.x,798.75);
  assert.equal(crouching.player.crouching,true);
  assert.equal(crouching.player.vx,37.5);
});

test("crouch movement returns to normal speed when the crouch key is released",()=>{
  const arena=new Arena();
  arena.update(0.2,input({axis:1,down:["crouch"]}));
  assert.equal(arena.player.vx,37.5);
  arena.update(0.2,input({axis:1}));
  assert.equal(arena.player.vx,300);
  assert.equal(arena.player.crouching,false);
});

test("screen-relative movement remains independent of facing direction",()=>{
  const arena=new Arena();
  arena.player.x=800;
  arena.player.facing=-1;
  const bounds={floorY:arena.floorY,minX:arena.stageMargin,maxX:arena.worldWidth-arena.stageMargin};

  // Exercise the movement layer directly: Arena intentionally interprets
  // holding away as guard, which is a separate action from walking.
  arena.movement.update(arena.player,input({axis:1}),0.1,bounds);
  assert.equal(arena.player.facing,-1);
  assert.equal(arena.player.x,830);

  arena.movement.update(arena.player,input({axis:-1}),0.1,bounds);
  assert.equal(arena.player.x,800);
});

test("directional jump follows the pressed screen direction after crossing sides",()=>{
  const arena=new Arena();
  arena.player.x=1500;
  arena.update(1/60,input({axis:1,pressed:["jump"]}));
  assert.ok(arena.player.x>1500);
  assert.equal(arena.player.facing,-1);
});

test("double-tap screen-right becomes a backdash when facing left",()=>{
  const arena=new Arena();
  arena.player.x=1500;
  arena.update(1/60,input({pressed:["right"]}));
  arena.update(0.08,input());
  arena.update(1/60,input({pressed:["right"]}));
  assert.equal(arena.player.dashType,"backdash");
  assert.ok(arena.player.vx>0);
});


test("air dash returns to normal air speed and gravity resumes",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["jump"]}));
  arena.update(1/60,input({pressed:["right"]}));
  arena.update(0.08,input());
  arena.update(1/60,input({pressed:["right"]}));
  for(let i=0;i<10;i++)arena.update(1/60,input());
  assert.equal(arena.player.dashType,null);
  assert.equal(arena.player.vx,arena.movement.airSpeed);
  assert.ok(arena.player.vy>0);
});
test("air dash holds vertical position while active",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["jump"]}));
  arena.update(1/60,input({pressed:["right"]}));
  arena.update(0.08,input());
  arena.update(1/60,input({pressed:["right"]}));
  const dashY=arena.player.y;
  arena.update(0.05,input());
  assert.equal(arena.player.y,dashY);
  assert.equal(arena.player.vy,0);
});
test("opposite-direction tap breaks a double-tap sequence",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["right"]}));
  arena.update(0.05,input({pressed:["left"]}));
  arena.update(0.05,input({pressed:["right"]}));
  assert.equal(arena.player.dashType,null);
});
test("a dash consumes its tap history",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["right"]}));
  arena.update(0.08,input());
  arena.update(1/60,input({pressed:["right"]}));
  assert.equal(arena.player.dashType,"forward");
  const remaining=arena.player.dashRemaining;
  arena.update(0.05,input({pressed:["right"]}));
  assert.ok(arena.player.dashRemaining<remaining);
});
test("walking into the dummy pushes it without passing through",()=>{
  const arena=new Arena();arena.player.x=500;arena.opponent.x=620;
  arena.update(0.1,input({axis:1}));
  assert.ok(arena.player.x<arena.opponent.x);
  assert.ok(arena.opponent.x>620);
  assert.equal(arena.opponent.x-arena.player.x,110);
});
test("a forward dash cannot pass through the opponent",()=>{
  const arena=new Arena();arena.player.x=400;arena.opponent.x=520;
  arena.movement.startDash(arena.player,1);
  arena.update(0.1,input());
  assert.ok(arena.player.x<arena.opponent.x);
  assert.ok(arena.opponent.x-arena.player.x>=110);
});
test("a fighter can jump over an opponent and landing resolves overlap",()=>{
  const arena=new Arena();arena.player.x=400;arena.opponent.x=500;
  arena.update(0.1,input({pressed:["jump"],axis:1}));
  let crossed=false;
  for(let i=0;i<120;i++){
    arena.update(1/60,input());
    if(!arena.player.onGround&&arena.player.x>arena.opponent.x)crossed=true;
  }
  assert.equal(crossed,true);
  assert.equal(arena.player.onGround,true);
  assert.ok(Math.abs(arena.opponent.x-arena.player.x)>=110);
});


test("camera follows the fighters and scrolls through the extended stage",()=>{
  const arena=new Arena();
  assert.equal(arena.cameraX,480);
  arena.player.x=1200;
  arena.opponent.x=1560;
  arena.update(0,input());
  assert.equal(arena.cameraX,900);
  assert.equal(arena.player.x-arena.cameraX,300);
  assert.equal(arena.opponent.x-arena.cameraX,660);
});

test("camera clamps at stage ends and keeps the controlled fighter visible",()=>{
  const arena=new Arena();
  arena.player.x=arena.stageMargin;
  arena.opponent.x=1000;
  arena.update(0,input());
  assert.equal(arena.cameraX,0);
  assert.ok(arena.player.x-arena.cameraX>=0);
  arena.player.x=arena.worldWidth-arena.stageMargin;
  arena.opponent.x=arena.player.x-180;
  arena.update(0,input());
  assert.equal(arena.cameraX,arena.worldWidth-arena.width);
  assert.ok(arena.player.x-arena.cameraX<=arena.width);
});

test("quarter-circle forward plus Special starts the real Arc Lance motion special",()=>{
  const arena=new Arena();
  arena.player.x=400;
  arena.opponent.x=1200;
  arena.update(1/60,input({down:["crouch"]}));
  arena.update(1/60,input({axis:1,down:["crouch","right"]}));
  arena.update(1/60,input({axis:1,down:["right"],pressed:["special"]}));
  assert.equal(arena.player.state.action,"special");
  assert.equal(arena.player.actionData.moveId,"arcLance");
  assert.equal(arena.player.actionData.moveName,"Arc Lance");
  assert.equal(arena.player.actionData.startupFrames,14);
  assert.equal(arena.projectileController.projectiles.length,0);
  assert.equal(arena.commandFeedbackText,"ARC LANCE");
  assert.ok(arena.commandFeedbackRemaining>0);

  for(let frame=0;frame<13;frame+=1) arena.update(1/60,input());
  assert.equal(arena.projectileController.projectiles.length,1);
  assert.equal(arena.projectileController.projectiles[0].moveId,"arcLance");
  assert.equal(arena.projectileController.projectiles[0].velocityX,390);
  assert.equal(arena.projectileController.projectiles[0].radius,26);
});


test("training mode freezes the timer and auto-recovers its passive dummy",()=>{
  const arena=new Arena({trainingMode:true});
  arena.player.x=400;
  arena.opponent.x=510;
  const originalX=arena.opponent.x;

  let landedHit=false;
  arena.update(1/60,input({pressed:["light"]}));
  landedHit ||= arena.lastCombatEvent?.type==="hit";
  for(let frame=0;frame<6 && !landedHit;frame+=1){
    arena.update(1/60,input());
    landedHit ||= arena.lastCombatEvent?.type==="hit";
  }

  assert.equal(landedHit,true);
  assert.ok(arena.opponent.health<1);
  assert.equal(arena.rounds.timerRemaining,99);
  assert.equal(arena.rounds.phase,"active");
  assert.equal(arena.opponentAI,null);

  for(let frame=0;frame<121;frame+=1) arena.update(1/60,input());
  assert.equal(arena.opponent.health,1);
  assert.equal(arena.opponent.guardMeter,100);
  assert.notEqual(arena.opponent.x,originalX,"the passive dummy should take normal hit knockback");
  assert.equal(arena.rounds.phase,"active");
  assert.equal(arena.rounds.timerRemaining,99);
});


test("training dummy runs physics, lands after a Medium launcher, and can be hit by Heavy",()=>{
  const arena=new Arena({trainingMode:true});
  arena.player.x=400;
  arena.opponent.x=510;

  let launcherHit=null;
  for(let frame=0;frame<12 && !launcherHit;frame+=1){
    arena.update(1/60,input(frame===0?{pressed:["medium"]}:{}));
    if(arena.lastCombatEvent?.type==="hit" && arena.lastCombatEvent.moveId==="medium"){
      launcherHit=arena.lastCombatEvent;
    }
  }
  assert.ok(launcherHit,"Medium should launch the training dummy");
  assert.equal(arena.opponent.onGround,false);

  let landed=false;
  for(let frame=0;frame<80 && !landed;frame+=1){
    arena.update(1/60,input());
    landed=arena.opponent.onGround;
  }
  assert.equal(landed,true,"the training dummy should fall and land");
  assert.equal(arena.opponent.y,arena.floorY);

  let heavyHit=null;
  arena.update(1/60,input({pressed:["heavy"]}));
  if(arena.lastCombatEvent?.moveId==="heavy") heavyHit=arena.lastCombatEvent;
  for(let frame=0;frame<22 && !heavyHit;frame+=1){
    arena.update(1/60,input());
    if(arena.lastCombatEvent?.type==="hit" && arena.lastCombatEvent.moveId==="heavy"){
      heavyHit=arena.lastCombatEvent;
    }
  }
  assert.ok(heavyHit,"grounded training dummy should be hittable by Heavy after landing");
});


test("fighter separation is capped so both combatants remain in the viewport",()=>{
  const arena=new Arena();
  arena.player.x=100;
  arena.opponent.x=1800;

  arena.update(0,input());

  assert.equal(arena.opponent.x-arena.player.x,arena.width-2*arena.stageMargin);
  assert.equal(arena.player.x-arena.cameraX,arena.stageMargin);
  assert.equal(arena.opponent.x-arena.cameraX,arena.width-arena.stageMargin);
});

test("Training reset restores both fighter positions and clears the dummy recovery timer",()=>{
  const arena=new Arena({trainingMode:true});
  arena.player.x=350;
  arena.opponent.x=620;
  arena.opponent.health=0.4;
  arena.opponent.guardMeter=12;
  arena.trainingDummyResetFrames=30;

  assert.equal(arena.resetTraining(),true);
  assert.equal(arena.player.x,780);
  assert.equal(arena.opponent.x,1140);
  assert.equal(arena.opponent.health,1);
  assert.equal(arena.opponent.guardMeter,100);
  assert.equal(arena.trainingDummyResetFrames,0);
  assert.equal(arena.rounds.phase,"active");
});
