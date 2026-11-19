import test from "node:test";
import assert from "node:assert/strict";
import { CommandHistory } from "../src/input/CommandHistory.js";
function input(down=[]) { return { isDown: action => down.includes(action) }; }

test("recognises down, down-forward, forward relative to a right-facing fighter",()=>{
  const history=new CommandHistory();
  history.update(input(["crouch"]),1);
  history.update(input(["crouch","right"]),1);
  history.update(input(["right"]),1);
  assert.equal(history.consumeQuarterCircleForward(),true);
  assert.equal(history.consumeQuarterCircleForward(),false);
});

test("recognises quarter-circle forward when the fighter faces left",()=>{
  const history=new CommandHistory();
  history.update(input(["crouch"]),-1);
  history.update(input(["crouch","left"]),-1);
  history.update(input(["left"]),-1);
  assert.equal(history.consumeQuarterCircleForward(),true);
});

test("allows brief neutral gaps between motion directions",()=>{
  const history=new CommandHistory();
  history.update(input(["crouch"]),1);
  history.update(input(),1);
  history.update(input(["crouch","right"]),1);
  history.update(input(),1);
  history.update(input(["right"]),1);
  assert.equal(history.consumeQuarterCircleForward(),true);
});

test("does not recognise an incorrect or stale directional sequence",()=>{
  const history=new CommandHistory({motionWindowFrames:8,historyFrames:12});
  history.update(input(["crouch"]),1);
  history.update(input(["right"]),1);
  assert.equal(history.consumeQuarterCircleForward(),false);
  history.reset();
  history.update(input(["crouch"]),1);
  for(let frame=0;frame<10;frame++) history.update(input(),1);
  history.update(input(["crouch","right"]),1);
  history.update(input(["right"]),1);
  assert.equal(history.consumeQuarterCircleForward(),false);
});

test("a command cannot be consumed twice without entering a new motion",()=>{
  const history=new CommandHistory();
  history.update(input(["crouch"]),1);
  history.update(input(["crouch","right"]),1);
  history.update(input(["right"]),1);
  assert.equal(history.consumeQuarterCircleForward(),true);
  history.update(input(["right"]),1);
  assert.equal(history.consumeQuarterCircleForward(),false);
});
