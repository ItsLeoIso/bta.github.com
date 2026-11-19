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

function advanceUntilProjectileEvent(arena, specialInput = input({ pressed: ["special"] })) {
  arena.update(1 / 60, specialInput);
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


test("air projectile cancels existing momentum and gravity resumes from rest",()=>{
  const arena=new Arena();
  arena.player.x=300;
  arena.player.y=220;
  arena.player.previousX=300;
  arena.player.previousY=220;
  arena.player.onGround=false;
  arena.player.vx=160;
  arena.player.vy=-180;
  arena.player.airHorizontalVelocity=160;
  arena.player.state.locomotion=STATES.locomotion.JUMPING;

  const startX=arena.player.x;
  const startY=arena.player.y;
  arena.update(1/60,input({pressed:["special"]}));

  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  assert.equal(arena.player.x,startX);
  assert.equal(arena.player.y,startY);
  assert.equal(arena.player.vx,0);
  assert.equal(arena.player.vy,0);
  assert.equal(arena.player.airHorizontalVelocity,0);

  for(let frame=0;frame<24;frame+=1){
    arena.update(1/60,input());
    assert.equal(arena.player.x,startX);
    assert.equal(arena.player.y,startY);
    assert.equal(arena.player.vx,0);
    assert.equal(arena.player.vy,0);
    assert.equal(arena.player.airHorizontalVelocity,0);
  }

  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  arena.update(1/60,input());
  assert.equal(arena.player.state.action,STATES.action.NONE);

  assert.equal(arena.player.x,startX);
  assert.ok(arena.player.y>startY);
  assert.equal(arena.player.airHorizontalVelocity,0);
  assert.ok(arena.player.vy>0);
});


test("back plus L releases guard and starts a backward Vector Burst", () => {
  const arena = new Arena();

  arena.update(1 / 60, input({ axis: -1 }));
  assert.equal(arena.player.state.action, STATES.action.GUARD);

  arena.update(1 / 60, input({ axis: -1, pressed: ["special"] }));
  assert.equal(arena.player.state.action, STATES.action.SPECIAL);
  assert.equal(arena.player.actionData.moveId, "directionalSpecial");
  assert.equal(arena.player.guardData, null);

  for (let frame = 0; frame < 7; frame += 1) {
    arena.update(1 / 60, input());
  }
  assert.equal(arena.projectileController.projectiles.length, 1);
  assert.equal(arena.projectileController.projectiles[0].velocityX, -540);
});

test("up plus L fires a Vector Burst vertically and uses its separate damage profile", () => {
  const arena = new Arena();
  arena.opponent.x = arena.player.x;
  arena.opponent.y = 260;
  arena.opponent.previousX = arena.opponent.x;
  arena.opponent.previousY = arena.opponent.y;
  arena.opponent.onGround = false;
  arena.opponent.state.locomotion = STATES.locomotion.FALLING;

  advanceUntilProjectileEvent(
    arena,
    input({ pressed: ["special"], down: ["jump"] })
  );

  assert.equal(arena.lastCombatEvent.moveId, "directionalSpecial");
  assert.equal(arena.lastCombatEvent.moveName, "Vector Burst");
  assert.equal(arena.lastCombatEvent.type, "hit");
  assert.ok(Math.abs(arena.opponent.health - 0.92) < 1e-9);
  assert.equal(arena.opponent.state.reaction, STATES.reaction.HITSTUN);
});


test("air Vector Burst is limited to one until landing, then becomes available again",()=>{
  const arena=new Arena();
  arena.player.y=400;
  arena.player.previousY=400;
  arena.player.onGround=false;
  arena.player.vy=0;
  arena.player.state.locomotion=STATES.locomotion.JUMPING;

  arena.update(1/60,input({axis:-1,pressed:["special"]}));
  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  assert.equal(arena.player.airVectorAvailable,false);

  // Complete the startup/recovery while holding the fighter in place.
  for(let frame=0;frame<25;frame+=1) arena.update(1/60,input());
  assert.equal(arena.player.state.action,STATES.action.NONE);

  arena.update(1/60,input({axis:-1,pressed:["special"]}));
  assert.equal(arena.player.state.action,STATES.action.NONE);
  assert.equal(
    arena.projectileController.projectiles.filter(projectile=>projectile.moveId==="directionalSpecial").length,
    1
  );

  // Gravity resumes from rest after the shot; landing restores the air option.
  for(let frame=0;frame<80 && !arena.player.onGround;frame+=1) {
    arena.update(1/60,input());
  }
  assert.equal(arena.player.onGround,true);
  assert.equal(arena.player.airVectorAvailable,true);

  arena.update(1/60,input({axis:-1,pressed:["special"]}));
  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
});