import test from "node:test";
import assert from "node:assert/strict";
import { InputBuffer } from "../src/input/InputBuffer.js";

function input({pressed=[],down=[]}={}) {
  return {
    wasPressed: action => pressed.includes(action),
    isDown: action => down.includes(action)
  };
}

test("captures combat button presses and keeps them pending until consumed or expired",()=>{
  const buffer=new InputBuffer({bufferFrames:4});
  assert.equal(buffer.capture(input({pressed:["heavy"]}),10),true);
  assert.equal(buffer.pending.action,"heavy");
  assert.equal(buffer.remainingFrames(10),4);
  assert.equal(buffer.getInput(input(),12).wasPressed("heavy"),true);
  assert.equal(buffer.remainingFrames(12),2);
  assert.equal(buffer.consume("heavy"),true);
  assert.equal(buffer.pending,null);
});

test("expires an unconsumed command after exactly the configured number of frames",()=>{
  const buffer=new InputBuffer({bufferFrames:3});
  buffer.capture(input({pressed:["light"]}),5);
  assert.equal(buffer.getInput(input(),7).wasPressed("light"),true);
  assert.equal(buffer.getInput(input(),8).wasPressed("light"),false);
  assert.equal(buffer.remainingFrames(8),0);
});

test("a newer combat button press replaces the older buffered command without aim snapshots",()=>{
  const buffer=new InputBuffer();
  buffer.capture(input({pressed:["medium"],down:["left"]}),2);
  buffer.capture(input({pressed:["special"],down:["right","jump"]}),4);
  assert.equal(buffer.pending.action,"special");
  const buffered=buffer.getInput(input(),4);
  assert.equal(buffered.wasPressed("special"),true);
  assert.equal(buffered.isDown("right"),false);
  assert.equal(buffered.isDown("jump"),false);
  assert.equal(buffered.isDown("left"),false);
});

test("buffered Special reads current directions but does not preserve old aim",()=>{
  const buffer=new InputBuffer();
  buffer.capture(input({pressed:["special"],down:["left","crouch"]}),1);
  const buffered=buffer.getInput(input({down:["right"]}),2);
  assert.equal(buffered.isDown("left"),false);
  assert.equal(buffered.isDown("crouch"),false);
  assert.equal(buffered.isDown("right"),true);
});

test("motion commands can exclude Special from ordinary button buffering",()=>{
  const buffer=new InputBuffer();
  buffer.capture(input({pressed:["special"]}),1,{excludeActions:["special"]});
  assert.equal(buffer.pending,null);
});

test("buffer clear discards pending inputs",()=>{
  const buffer=new InputBuffer();
  buffer.capture(input({pressed:["light"]}),1);
  buffer.clear();
  assert.equal(buffer.getInput(input(),2).wasPressed("light"),false);
});


test("buffered Arc Lance preserves its move identity and input-time facing",()=>{
  const buffer=new InputBuffer();
  buffer.capture(input({pressed:["special"],down:["left"]}),7,{
    specialMove:"arcLance",
    specialFacing:-1
  });
  const buffered=buffer.getInput(input({down:["right"]}),9);
  assert.equal(buffered.specialMove,"arcLance");
  assert.equal(buffered.specialFacing,-1);
  assert.equal(buffered.wasPressed("special"),true);
  assert.equal(buffered.isDown("left"),false);
  assert.equal(buffered.isDown("right"),true);
});
