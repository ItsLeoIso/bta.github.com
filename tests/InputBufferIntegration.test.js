import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function input({axis=0,pressed=[],down=[]}={}) {
  return {
    getWorldAxis:()=>axis,
    wasPressed:action=>pressed.includes(action),
    isDown:action=>down.includes(action)
  };
}

test("buffers an attack during recovery and starts it on the first available frame",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["heavy"]}));
  for(let frame=0;frame<30;frame++) arena.update(1/60,input());
  assert.equal(arena.player.actionData.elapsedFrames,31);

  arena.update(1/60,input({pressed:["light"]}));
  assert.equal(arena.player.state.action,STATES.action.ATTACK);
  assert.equal(arena.inputBuffer.pending.action,"light");

  for(let frame=0;frame<7;frame++) arena.update(1/60,input());
  assert.equal(arena.player.state.action,STATES.action.ATTACK);
  assert.equal(arena.player.actionData.moveId,"light");
  assert.equal(arena.player.actionData.elapsedFrames,1);
  assert.equal(arena.inputBuffer.pending,null);
});

test("an attack input expires when the current recovery outlasts its buffer window",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["heavy"]}));
  arena.update(1/60,input({pressed:["medium"]}));
  for(let frame=0;frame<45;frame++) arena.update(1/60,input());
  assert.equal(arena.player.state.action,STATES.action.NONE);
  assert.equal(arena.player.actionData.moveId,undefined);
  assert.equal(arena.inputBuffer.pending,null);
});

test("buffers Special through attack recovery and resolves the fixed grounded trajectory",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["heavy"]}));
  for(let frame=0;frame<30;frame++) arena.update(1/60,input());
  arena.update(1/60,input({pressed:["special"],down:["left"]}));
  assert.equal(arena.inputBuffer.pending.action,"special");
  for(let frame=0;frame<7;frame++) arena.update(1/60,input());
  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  assert.equal(arena.player.actionData.moveId,"special");
  assert.equal(arena.player.actionData.directionX,1);
  assert.equal(arena.player.actionData.directionY,0);
  assert.equal(arena.inputBuffer.pending,null);
});

test("buffers a Light press during hitstun and starts when the reaction clears",()=>{
  const arena=new Arena();
  arena.player.state.reaction=STATES.reaction.HITSTUN;
  arena.player.reactionData={remainingFrames:2,totalFrames:2,knockbackVelocity:0};

  arena.update(1/60,input({pressed:["light"]}));
  assert.equal(arena.player.state.reaction,STATES.reaction.HITSTUN);
  assert.equal(arena.inputBuffer.pending.action,"light");

  arena.update(1/60,input());
  assert.equal(arena.player.state.reaction,STATES.reaction.NONE);
  assert.equal(arena.player.state.action,STATES.action.ATTACK);
  assert.equal(arena.player.actionData.moveId,"light");
  assert.equal(arena.inputBuffer.pending,null);
});

test("a buffered input is discarded when a round enters its result state",()=>{
  const arena=new Arena();
  arena.update(1/60,input({pressed:["heavy"]}));
  arena.inputBuffer.capture(input({pressed:["light"]}),arena.inputFrame+1);
  arena.opponent.health=0;
  arena.update(1/60,input());
  assert.equal(arena.inputBuffer.pending,null);
});
