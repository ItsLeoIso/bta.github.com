import test from "node:test";
import assert from "node:assert/strict";
import { KeyboardInput } from "../src/input/KeyboardInput.js";
function target() {
  const listeners={};
  return {addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:(name)=>delete listeners[name],emit:(name,event)=>listeners[name]?.(event)};
}
test("keyboard input exposes world and facing-relative horizontal directions",()=>{
  const t=target(),input=new KeyboardInput(t); input.attach();
  t.emit("keydown",{code:"KeyA",preventDefault(){}});
  assert.equal(input.getWorldAxis("horizontal"),-1);
  assert.equal(input.getAxis("horizontal",1),-1);
  assert.equal(input.getAxis("horizontal",-1),1);
  assert.equal(input.isDown("left"),true);
  t.emit("keyup",{code:"KeyA"});
  assert.equal(input.getWorldAxis("horizontal"),0);
  input.detach();
});
test("pressed actions are edge-triggered and cleared at end of frame",()=>{
  const t=target(),input=new KeyboardInput(t); input.attach();
  t.emit("keydown",{code:"KeyH",preventDefault(){}});
  assert.equal(input.wasPressed("light"),true);
  input.endFrame();
  assert.equal(input.wasPressed("light"),false);
  input.detach();
});
test("jump key is exposed as a one-frame pressed action",()=>{
  const t=target(),input=new KeyboardInput(t); input.attach();
  t.emit("keydown",{code:"KeyW",preventDefault(){}});
  assert.equal(input.wasPressed("jump"),true);
  input.endFrame();
  assert.equal(input.wasPressed("jump"),false);
  input.detach();
});
