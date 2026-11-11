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
  const arena=new Arena();
  arena.update(1,input({axis:1}));
  assert.equal(arena.player.x,600);
  arena.update(2,input({axis:1}));
  assert.equal(arena.player.x,920);
});

test("arena updates facing based on relative fighter positions",()=>{
  const arena=new Arena(); arena.player.x=700;
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
