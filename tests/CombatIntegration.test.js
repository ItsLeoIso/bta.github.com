import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
import { getActiveAttackHitbox } from "../src/combat/Hitbox.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function input({ axis = 0, pressed = [], down = [] } = {}) {
  return {
    getWorldAxis: () => axis,
    wasPressed: action => pressed.includes(action),
    isDown: action => down.includes(action)
  };
}

const neutral = input();

test("Arena applies hit damage and records attacker frame advantage on contact", () => {
  const arena = new Arena();
  arena.player.x = 400;
  arena.opponent.x = 510;

  arena.update(1 / 60, input({ pressed: ["light"] }));
  assert.equal(arena.lastCombatEvent, null);
  assert.equal(getActiveAttackHitbox(arena.player), null);

  for (let frame = 0; frame < 4; frame += 1) {
    arena.update(1 / 60, neutral);
    assert.equal(arena.lastCombatEvent, null);
  }

  arena.update(1 / 60, neutral);
  assert.equal(arena.lastCombatEvent?.type, "hit");
  assert.equal(arena.lastCombatEvent?.moveId, "light");
  assert.equal(arena.player.actionData.hitConfirmed, true);
  assert.ok(Math.abs(arena.opponent.health - 0.94) < 1e-9);
  assert.equal(arena.lastCombatEvent.attackerRecoveryFrames, 12);
  assert.equal(arena.lastCombatEvent.hitAdvantage, 0);
  assert.equal(arena.player.lastAttackData.hitAdvantage, 0);
  assert.equal(arena.lastHit.outcome, "hit");
});

test("Arena applies chip damage and records block advantage when an attack is guarded", () => {
  const arena = new Arena();
  arena.player.x = 400;
  arena.opponent.x = 510;
  arena.opponent.state.action = STATES.action.GUARD;
  arena.opponent.guardData = { guardHeight: "high" };

  arena.update(1 / 60, input({ pressed: ["light"] }));
  for (let frame = 0; frame < 4; frame += 1) arena.update(1 / 60, neutral);
  arena.update(1 / 60, neutral);

  assert.equal(arena.lastCombatEvent?.type, "block");
  assert.equal(arena.lastCombatEvent.attackerRecoveryFrames, 12);
  assert.equal(arena.lastCombatEvent.blockAdvantage, -4);
  assert.equal(arena.player.lastAttackData.blockAdvantage, -4);
  assert.ok(Math.abs(arena.opponent.health - 0.994) < 1e-9);
  assert.equal(arena.opponent.guardMeter, 80);
  assert.equal(arena.opponent.state.reaction, STATES.reaction.BLOCKSTUN);
  assert.equal(arena.lastHit.outcome, "block");
});

test("Arena preserves a miss so a later active frame can still connect", () => {
  const arena = new Arena();
  arena.player.x = 300;
  arena.opponent.x = 660;

  arena.update(1 / 60, input({ pressed: ["heavy"] }));
  for (let frame = 0; frame < 12; frame += 1) arena.update(1 / 60, neutral);
  assert.equal(arena.player.actionData.phase, "active");
  assert.notEqual(arena.player.actionData.hitConfirmed, true);
  assert.equal(arena.lastCombatEvent, null);

  arena.opponent.x = 440;
  arena.player.facing = 1;
  arena.update(1 / 60, neutral);
  assert.equal(arena.lastCombatEvent?.type, "hit");
});


test("a confirmed Light can cancel into Medium and preserves the combo sequence", () => {
  const arena = new Arena();
  arena.player.x = 400;
  arena.opponent.x = 510;
  arena.update(1 / 60, input({ pressed: ["light"] }));
  for (let frame = 0; frame < 4; frame += 1) arena.update(1 / 60, neutral);
  arena.update(1 / 60, neutral);
  assert.equal(arena.lastCombatEvent?.type, "hit");

  arena.update(1 / 60, input({ pressed: ["medium"] }));
  assert.equal(arena.player.actionData.moveId, "medium");
  assert.equal(arena.player.actionData.elapsedFrames, 1);
  assert.equal(arena.player.lastCancelData.toMoveId, "medium");
  assert.equal(arena.inputBuffer.pending, null);
});

test("a confirmed Light can cancel into a buffered Energy Shot", () => {
  const arena = new Arena();
  arena.player.x = 400;
  arena.opponent.x = 510;
  arena.update(1 / 60, input({ pressed: ["light"] }));
  for (let frame = 0; frame < 4; frame += 1) arena.update(1 / 60, neutral);
  arena.update(1 / 60, neutral);
  assert.equal(arena.lastCombatEvent?.type, "hit");

  arena.update(1 / 60, input({ pressed: ["special"] }));
  assert.equal(arena.player.state.action, STATES.action.SPECIAL);
  assert.equal(arena.player.actionData.moveId, "special");
  assert.equal(arena.player.lastCancelData.toMoveId, "special");
  assert.equal(arena.inputBuffer.pending, null);
});

test("a grounded Medium launches on hit and supports a jump-cancelled air follow-up", () => {
  const arena = new Arena();
  arena.player.x = 400;
  arena.opponent.x = 510;
  arena.update(1 / 60, input({ pressed: ["medium"] }));
  for (let frame = 0; frame < 8 && !arena.lastCombatEvent; frame += 1) {
    arena.update(1 / 60, neutral);
  }

  assert.equal(arena.lastCombatEvent?.type, "hit");
  assert.equal(arena.opponent.onGround, false);
  assert.ok(arena.opponent.vy < 0);
  assert.equal(arena.opponent.state.locomotion, STATES.locomotion.JUMPING);

  arena.update(1 / 60, input({ pressed: ["jump"] }));
  assert.equal(arena.player.state.action, STATES.action.NONE);
  assert.equal(arena.player.onGround, false);
  arena.update(1 / 60, input({ pressed: ["light"] }));
  assert.equal(arena.player.state.action, STATES.action.ATTACK);
  assert.equal(arena.player.actionData.moveId, "light");

  let airFollowUp = null;
  for (let frame = 0; frame < 12 && !airFollowUp; frame += 1) {
    arena.update(1 / 60, neutral);
    if (arena.lastCombatEvent?.type === "hit" && arena.lastCombatEvent.moveId === "light") {
      airFollowUp = arena.lastCombatEvent;
    }
  }
  assert.ok(airFollowUp, "the airborne Light should connect against the launched target");
  const combo = arena.comboTracker.getComboForAttacker(arena.player);
  assert.equal(combo.hitCount, 2);
  assert.equal(combo.airCombo, true);
  assert.equal(combo.juggleHits, 1);
  assert.ok(arena.opponent.health > 0 && arena.opponent.health < 0.85);
});


test("Arena resolves attacks from the opponent toward the player", () => {
  const arena = new Arena();
  arena.player.x = 400;
  arena.opponent.x = 510;
  assert.equal(arena.attacks.start(arena.opponent, "light"), true);
  for (let frame = 0; frame < 6; frame += 1) arena.attacks.advance(arena.opponent);

  arena.update(1 / 60, neutral);

  assert.equal(arena.lastCombatEvent?.type, "hit");
  assert.equal(arena.lastCombatEvent?.attacker, arena.opponent);
  assert.ok(arena.player.health < 1);
});


test("a hit-confirmed Light can cancel directly into buffered Arc Lance",()=>{
  const arena=new Arena();
  arena.player.x=400;
  arena.opponent.x=510;
  arena.update(1/60,input({pressed:["light"]}));
  for(let frame=0;frame<4;frame+=1) arena.update(1/60,neutral);
  arena.update(1/60,neutral);
  assert.equal(arena.lastCombatEvent?.type,"hit");

  arena.update(1/60,input({down:["crouch"]}));
  arena.update(1/60,input({axis:1,down:["crouch","right"]}));
  arena.update(1/60,input({axis:1,down:["right"],pressed:["special"]}));

  assert.equal(arena.player.state.action,STATES.action.SPECIAL);
  assert.equal(arena.player.actionData.moveId,"arcLance");
  assert.deepEqual(arena.player.lastCancelData,{
    type:"hit",fromMoveId:"light",toMoveId:"special"
  });
  assert.equal(arena.inputBuffer.pending,null);
});


test("illegal Special cancels do not delete the current attack recovery",()=>{
  const scenarios=[
    {
      name:"spent air projectile",
      configure:arena=>{
        arena.player.onGround=false;
        arena.player.y=240;
        arena.player.state.locomotion=STATES.locomotion.FALLING;
        arena.player.airProjectileAvailable=false;
      },
      specialInput:input({pressed:["special"]})
    },
    {
      name:"opposing directional inputs",
      configure:()=>{},
      specialInput:input({pressed:["special"],down:["left","right"]})
    }
  ];

  for(const scenario of scenarios){
    const arena=new Arena();
    arena.player.x=400;
    arena.opponent.x=510;
    scenario.configure(arena);
    assert.equal(arena.attacks.start(arena.player,"light"),true);
    arena.player.actionData.hitOutcome="hit";

    arena.update(1/60,scenario.specialInput);

    assert.equal(
      arena.player.state.action,
      STATES.action.ATTACK,
      scenario.name+" must leave the current attack in recovery"
    );
    assert.equal(arena.player.actionData.moveId,"light");
    assert.equal(arena.projectileController.projectiles.length,0);
  }
});
