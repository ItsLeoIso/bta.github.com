import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
test("arena moves player and clamps them inside stage bounds",()=>{
  const arena=new Arena(),input={getAxis:()=>1,isDown:()=>false};
  arena.update(1,input); assert.equal(arena.player.x,600);
  arena.update(2,input); assert.equal(arena.player.x,920);
});
test("arena updates facing based on relative fighter positions",()=>{
  const arena=new Arena(); arena.player.x=700;
  arena.update(0,{getAxis:()=>0,isDown:()=>false});
  assert.equal(arena.player.facing,-1); assert.equal(arena.opponent.facing,1);
});
