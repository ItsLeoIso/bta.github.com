import test from "node:test";
import assert from "node:assert/strict";
import { GameLoop } from "../src/engine/GameLoop.js";
test("GameLoop requires update and render callbacks",()=>assert.throws(()=>new GameLoop({}),/requires update and render/));
test("GameLoop caps long frames and performs fixed updates",()=>{
  const updates=[],renders=[];
  const loop=new GameLoop({update:dt=>updates.push(dt),render:alpha=>renders.push(alpha)});
  const oldRAF=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
  let callback;
  globalThis.requestAnimationFrame=fn=>{callback=fn;return 1;}; globalThis.cancelAnimationFrame=()=>{};
  try {
    loop.start(); callback(0); callback(1000);
    assert.equal(updates.length,15); assert.ok(updates.every(dt=>dt===1/60)); assert.equal(renders.length,2);
  } finally { loop.stop(); globalThis.requestAnimationFrame=oldRAF; globalThis.cancelAnimationFrame=oldCancel; }
});
