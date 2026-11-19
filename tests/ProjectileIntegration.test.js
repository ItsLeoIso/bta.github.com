import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function input({ axis = 0, down = [], pressed = [] } = {}) {
  return {
    getWorldAxis: () => axis,
    getAxis: () => axis,
    wasPressed: action => pressed.includes(action),
    isDown: action =>
      down.includes(action) ||
      (action === "left" && axis < 0) ||
      (action === "right" && axis > 0)
  };
}

function advanceUntilProjectileEvent(arena) {
  arena.update(1 / 60, input({ pressed: ["special"] }));
  for (let frame = 0; frame < 60 && arena.lastCombatEvent === null; frame += 1) {
    arena.update(1 / 60, input());
  }
}

test("L projectile launches, travels, and damages the dummy through Arena", () => {
  const arena = new Arena();
  advanceUntilProjectileEvent(arena);

  assert.ok(Math.abs(arena.opponent.health - 0.92) < 1e-9);
  assert.equal(arena.opponent.state.reaction, STATES.reaction.HITSTUN);
  assert.equal(arena.lastCombatEvent.moveId, "special");
  assert.equal(arena.lastCombatEvent.type, "hit");
  assert.equal(arena.projectileController.projectiles.length, 0);
});

test("projectile is blockable from the side it travels in from and deals chip/guard damage", () => {
  const arena = new Arena();
  arena.opponent.state.action = STATES.action.GUARD;
  arena.opponent.guardData = { guardHeight: "high" };
  arena.opponent.guardMeter = 100;
  advanceUntilProjectileEvent(arena);

  assert.ok(Math.abs(arena.opponent.health - 0.992) < 1e-9);
  assert.equal(arena.opponent.guardMeter, 75);
  assert.equal(arena.opponent.state.reaction, STATES.reaction.BLOCKSTUN);
  assert.equal(arena.lastCombatEvent.type, "block");
  assert.equal(arena.lastCombatEvent.outcome, "block");
});


test("air projectile holds the fighter at the same position through recovery, then resumes movement",()=>{
  const arena=new Arena();
  arena.player.x=300;
  arena.player.y=220;
  arena.player.previousX=300;
  arena.player.previousY=220;
  arena.player.onGround=false;
  arena.player.vy=180;
  arena.player.airHorizontalVelocity=160;
  arena.player.state.locomotion=STATES.locomotion.FALLING;

  const startX=arena.player.x;
  const startY=arena.player.y;
  arena.update(1/60,input({pressed:["special"]}));

  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  assert.equal(arena.player.x,startX);
  assert.equal(arena.player.y,startY);

  for(let frame=0;frame<24;frame+=1){
    arena.update(1/60,input());
    assert.equal(arena.player.x,startX);
    assert.equal(arena.player.y,startY);
  }

  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  arena.update(1/60,input());

  assert.equal(arena.player.state.action,STATES.action.NONE);
  assert.ok(arena.player.x>startX);
  assert.ok(arena.player.y>startY);
});
