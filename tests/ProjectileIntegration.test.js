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


test("air projectile cancels launch momentum but gravity continues through the move",()=>{
  const arena=new Arena();
  arena.player.x=400;
  arena.player.y=280; // At the jump apex.
  arena.player.previousX=400;
  arena.player.previousY=280;
  arena.player.onGround=false;
  arena.player.vx=160;
  arena.player.vy=0;
  arena.player.airHorizontalVelocity=160;
  arena.player.state.locomotion=STATES.locomotion.JUMPING;

  const startX=arena.player.x;
  const startY=arena.player.y;
  arena.update(1/60,input({pressed:["special"]}));

  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  assert.equal(arena.player.x,startX);
  assert.ok(arena.player.y>startY);
  assert.equal(arena.player.vx,0);
  assert.ok(arena.player.vy>0);
  assert.equal(arena.player.airHorizontalVelocity,0);

  let previousY=arena.player.y;
  for(let frame=0;frame<23;frame+=1){
    arena.update(1/60,input());
    assert.equal(arena.player.x,startX);
    assert.ok(arena.player.y>previousY);
    assert.equal(arena.player.vx,0);
    assert.ok(arena.player.vy>=0);
    assert.equal(arena.player.airHorizontalVelocity,0);
    previousY=arena.player.y;
  }

  // The fighter lands on frame 25, but the original 26-frame special action
  // remains active for its final recovery frame.
  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  arena.update(1/60,input());
  assert.equal(arena.player.onGround,true);
  assert.equal(arena.player.y,arena.floorY);
  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  assert.equal(arena.player.state.locomotion,STATES.locomotion.STANDING);
  assert.equal(arena.player.vx,0);
  assert.equal(arena.player.vy,0);
  assert.equal(arena.player.airProjectileAvailable,true);

  arena.update(1/60,input());
  assert.equal(arena.player.state.action,STATES.action.NONE);
  assert.equal(arena.player.x,startX);
});


test("back plus L releases guard but the grounded projectile still fires forward", () => {
  const arena = new Arena();
  arena.update(1 / 60, input({ axis: -1 }));
  assert.equal(arena.player.state.action, STATES.action.GUARD);
  arena.update(1 / 60, input({ axis: -1, pressed: ["special"] }));
  assert.equal(arena.player.state.action, STATES.action.SPECIAL);
  assert.equal(arena.player.actionData.moveId, "special");
  assert.equal(arena.player.guardData, null);
  for (let frame = 0; frame < 7; frame += 1) arena.update(1 / 60, input());
  assert.equal(arena.projectileController.projectiles.length, 1);
  assert.equal(arena.projectileController.projectiles[0].velocityX, 540);
  assert.equal(arena.projectileController.projectiles[0].velocityY, 0);
});

test("airborne L ignores aim inputs and fires down-forward", () => {
  const arena = new Arena();
  arena.player.x = 500;
  arena.player.y = 260;
  arena.player.previousX = 500;
  arena.player.previousY = 260;
  arena.player.onGround = false;
  arena.player.state.locomotion = STATES.locomotion.FALLING;
  arena.update(1 / 60, input({ pressed: ["special"], down: ["jump", "left"] }));
  for (let frame = 0; frame < 7; frame += 1) arena.update(1 / 60, input());
  const projectile = arena.projectileController.projectiles[0];
  assert.ok(projectile);
  assert.equal(projectile.moveId, "special");
  assert.ok(Math.abs(projectile.velocityX - 540 / Math.sqrt(2)) < 1e-9);
  assert.ok(Math.abs(projectile.velocityY - 540 / Math.sqrt(2)) < 1e-9);
});


test("any air projectile is limited to one until landing, then becomes available again",()=>{
  const arena=new Arena();
  arena.player.y=220;
  arena.player.previousY=220;
  arena.player.onGround=false;
  arena.player.vy=0;
  arena.player.state.locomotion=STATES.locomotion.JUMPING;

  arena.update(1/60,input({axis:-1,pressed:["special"]}));
  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  assert.equal(arena.player.airProjectileAvailable,false);

  // Gravity runs during startup/recovery, but the player remains airborne
  // when the original 26-frame special action finishes.
  for(let frame=0;frame<25;frame+=1) arena.update(1/60,input());
  assert.equal(arena.player.state.action,STATES.action.NONE);
  assert.equal(arena.player.onGround,false);
  assert.equal(arena.player.airProjectileAvailable,false);

  // A neutral L-only Energy Shot is also blocked by the same air-use limit.
  arena.update(1/60,input({pressed:["special"]}));
  assert.equal(arena.player.state.action,STATES.action.NONE);
  assert.equal(arena.projectileController.projectiles.length,1);

  // Landing restores the shared air-projectile allowance.
  for(let frame=0;frame<80 && !arena.player.onGround;frame+=1) {
    arena.update(1/60,input());
  }
  assert.equal(arena.player.onGround,true);
  assert.equal(arena.player.airProjectileAvailable,true);

  // Landing refreshes the allowance for either projectile type.
  arena.update(1/60,input({pressed:["special"]}));
  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  assert.equal(arena.player.actionData.moveId,"special");
});

test("a projectile started near the floor still spawns on startup frame eight",()=>{
  const arena=new Arena();
  arena.player.y=435;
  arena.player.previousY=435;
  arena.player.onGround=false;
  arena.player.vy=0;
  arena.player.state.locomotion=STATES.locomotion.FALLING;

  arena.update(1/60,input({pressed:["special"]}));
  assert.equal(arena.player.state.action,STATES.action.SPECIAL);

  for(let frame=0;frame<6;frame+=1) {
    arena.update(1/60,input());
  }

  assert.equal(arena.player.onGround,true);
  assert.equal(arena.player.y,arena.floorY);
  assert.equal(arena.projectileController.projectiles.length,0);
  assert.equal(arena.player.state.action,STATES.action.SPECIAL);

  arena.update(1/60,input());
  assert.equal(arena.projectileController.projectiles.length,1);
  assert.equal(arena.projectileController.projectiles[0].moveId,"special");
  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  assert.equal(arena.player.actionData.elapsedFrames,8);
});

test("Arc Lance deals its stronger hit after the motion input and travel time",()=>{
  const arena=new Arena();
  arena.player.x=400;
  arena.opponent.x=760;
  arena.update(1/60,input({down:["crouch"]}));
  arena.update(1/60,input({axis:1,down:["crouch","right"]}));
  arena.update(1/60,input({axis:1,down:["right"],pressed:["special"]}));

  let arcHit=null;
  for(let frame=0;frame<100 && !arcHit;frame+=1){
    arena.update(1/60,input());
    if(arena.lastCombatEvent?.moveId==="arcLance" && arena.lastCombatEvent.type==="hit"){
      arcHit=arena.lastCombatEvent;
    }
  }

  assert.ok(arcHit,"Arc Lance should travel into the opposing hurtbox");
  assert.equal(arcHit.moveName,"Arc Lance");
  assert.ok(Math.abs(arena.opponent.health-0.86)<1e-9);
});
