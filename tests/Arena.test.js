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

test("arena moves player and clamps them inside stage bounds",()=>{
  const arena=new Arena(); arena.opponent.x=800;
  arena.update(1,input({axis:1}));
  assert.equal(arena.player.x,600);
  arena.update(2,input({axis:1}));
  assert.equal(arena.player.x,892);
});

test("arena updates facing based on relative fighter positions",()=>{
  const arena=new Arena(); arena.player.x=800;
  arena.update(0,input());
  assert.equal(arena.player.facing,-1);
  assert.equal(arena.opponent.facing,1);
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
  assert.equal(standing.player.x,450);
  assert.equal(crouching.player.x,318.75);
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

test("screen-left and screen-right movement stay consistent after crossing sides",()=>{
  const arena=new Arena();
  arena.player.x=800;
  arena.update(0.1,input({axis:1}));
  assert.equal(arena.player.facing,-1);
  assert.equal(arena.player.x,830);
  arena.update(0.1,input({axis:-1}));
  assert.equal(arena.player.x,800);
});

test("directional jump follows the pressed screen direction after crossing sides",()=>{
  const arena=new Arena();
  arena.player.x=800;
  arena.update(1/60,input({axis:1,pressed:["jump"]}));
  assert.ok(arena.player.x>800);
  assert.equal(arena.player.facing,-1);
});

test("double-tap screen-right becomes a backdash when facing left",()=>{
  const arena=new Arena();
  arena.player.x=800;
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
