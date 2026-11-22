import test from "node:test";
import assert from "node:assert/strict";
import { ProjectileController } from "../src/combat/ProjectileController.js";
import { FighterStateController, FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function makeFighter({
  x = 100,
  y = 440,
  facing = 1,
  onGround = true,
  action = STATES.action.NONE,
  reaction = STATES.reaction.NONE
} = {}) {
  const fighter = {
    x, y, previousX: x, previousY: y, facing, onGround, health: 1,
    vx: 0, vy: 0, airHorizontalVelocity: 0, guardMeter: 100,
    state: {
      locomotion: onGround ? STATES.locomotion.STANDING : STATES.locomotion.JUMPING,
      action,
      reaction
    },
    actionData: {},
    lastAttackData: null
  };
  fighter.stateController = new FighterStateController();
  fighter.stateController.initialize(fighter);
  return fighter;
}

function input({ pressed = [], down = [] } = {}) {
  return {
    wasPressed: action => pressed.includes(action),
    isDown: action => down.includes(action)
  };
}

test("L alone starts a special action and spawns an energy shot after startup", () => {
  const controller = new ProjectileController();
  const fighter = makeFighter();

  controller.updateFighter(fighter, input({ pressed: ["special"] }));
  assert.equal(fighter.state.action, STATES.action.SPECIAL);
  assert.equal(fighter.actionData.phase, "startup");
  assert.equal(controller.projectiles.length, 0);

  for (let frame = 0; frame < 7; frame += 1) {
    controller.updateFighter(fighter, input());
  }

  assert.equal(controller.projectiles.length, 1);
  assert.equal(controller.projectiles[0].x, fighter.x + 76);
  assert.equal(controller.projectiles[0].y, fighter.y - 150);
  assert.equal(controller.projectiles[0].direction, 1);
  assert.equal(fighter.actionData.phase, "recovery");
});

test("projectile direction follows the fighter's facing when fired", () => {
  const controller = new ProjectileController();
  const fighter = makeFighter({ x: 400, facing: -1 });

  controller.updateFighter(fighter, input({ pressed: ["special"] }));
  for (let frame = 0; frame < 7; frame += 1) controller.updateFighter(fighter, input());

  assert.equal(controller.projectiles[0].direction, -1);
  assert.equal(controller.projectiles[0].velocityX, -540);
  assert.equal(controller.projectiles[0].x, 324);
});

test("direction plus L starts a distinct Vector Burst aimed in the held direction", () => {
  const controller = new ProjectileController();
  const fighter = makeFighter();

  const started = controller.updateFighter(
    fighter,
    input({ pressed: ["special"], down: ["left"] })
  );

  assert.equal(started, true);
  assert.equal(fighter.state.action, STATES.action.SPECIAL);
  assert.equal(fighter.actionData.moveId, "directionalSpecial");
  assert.equal(fighter.actionData.moveName, "Vector Burst");

  for (let frame = 0; frame < 7; frame += 1) {
    controller.updateFighter(fighter, input());
  }

  assert.equal(controller.projectiles.length, 1);
  assert.equal(controller.projectiles[0].velocityX, -540);
  assert.equal(controller.projectiles[0].velocityY, 0);
  assert.equal(controller.projectiles[0].moveId, "directionalSpecial");
});

test("special remains locked through startup and recovery, then returns to neutral", () => {
  const controller = new ProjectileController();
  const fighter = makeFighter();

  controller.updateFighter(fighter, input({ pressed: ["special"] }));
  for (let frame = 0; frame < 24; frame += 1) {
    controller.updateFighter(fighter, input());
    assert.equal(fighter.state.action, STATES.action.SPECIAL);
  }
  assert.equal(controller.projectiles.length, 1);

  controller.updateFighter(fighter, input());
  assert.equal(fighter.state.action, STATES.action.NONE);
});

test("special can be used in the air when no action or reaction is active", () => {
  const controller = new ProjectileController();
  const fighter = makeFighter({ onGround: false, y: 300 });

  controller.updateFighter(fighter, input({ pressed: ["special"] }));

  assert.equal(fighter.state.action, STATES.action.SPECIAL);
  assert.equal(fighter.state.locomotion, STATES.locomotion.JUMPING);
});

test("special cannot start during another action or a hit reaction", () => {
  const controller = new ProjectileController();
  const attacking = makeFighter({ action: STATES.action.ATTACK });
  controller.updateFighter(attacking, input({ pressed: ["special"] }));
  assert.equal(attacking.state.action, STATES.action.ATTACK);

  const stunned = makeFighter({ reaction: STATES.reaction.HITSTUN });
  controller.updateFighter(stunned, input({ pressed: ["special"] }));
  assert.equal(stunned.state.action, STATES.action.NONE);
  assert.equal(stunned.state.reaction, STATES.reaction.HITSTUN);
  assert.equal(controller.projectiles.length, 0);
});

test("projectile travels and creates a single contact event with the opposing hurtbox", () => {
  const controller = new ProjectileController();
  const attacker = makeFighter({ x: 100 });
  const defender = makeFighter({ x: 260 });

  controller.spawnProjectile(attacker);
  const events = controller.updateProjectiles(1 / 60, [attacker, defender]);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "contact");
  assert.equal(events[0].attacker, attacker);
  assert.equal(events[0].defender, defender);
  assert.equal(events[0].projectileDirection, 1);
  assert.equal(events[0].knockbackDirection, 1);
  assert.equal(controller.projectiles.length, 0);
  assert.equal(controller.updateProjectiles(1 / 60, [attacker, defender]).length, 0);
});

test("projectiles expire or leave the arena without producing a contact", () => {
  const controller = new ProjectileController({ lifetimeSeconds: 0.1 });
  const attacker = makeFighter({ x: 100 });
  controller.spawnProjectile(attacker);

  const events = controller.updateProjectiles(0.11, [attacker], { minX: 0, maxX: 960 });

  assert.equal(events.length, 0);
  assert.equal(controller.projectiles.length, 0);
});

test("clear removes active projectiles between rounds", () => {
  const controller = new ProjectileController();
  controller.spawnProjectile(makeFighter());
  controller.clear();
  assert.equal(controller.projectiles.length, 0);
});


test("Vector Burst supports all eight screen-relative directions at a normalized speed", () => {
  const diagonalSpeed = 540 / Math.sqrt(2);
  const cases = [
    { down: ["right"], x: 540, y: 0 },
    { down: ["left"], x: -540, y: 0 },
    { down: ["jump"], x: 0, y: -540 },
    { down: ["crouch"], x: 0, y: 540 },
    { down: ["right", "jump"], x: diagonalSpeed, y: -diagonalSpeed },
    { down: ["left", "jump"], x: -diagonalSpeed, y: -diagonalSpeed },
    { down: ["right", "crouch"], x: diagonalSpeed, y: diagonalSpeed },
    { down: ["left", "crouch"], x: -diagonalSpeed, y: diagonalSpeed }
  ];

  for (const scenario of cases) {
    const controller = new ProjectileController();
    const fighter = makeFighter({ facing: -1 });
    controller.updateFighter(
      fighter,
      input({ pressed: ["special"], down: scenario.down })
    );
    for (let frame = 0; frame < 7; frame += 1) {
      controller.updateFighter(fighter, input());
    }

    const projectile = controller.projectiles[0];
    assert.ok(projectile, "directional projectile should spawn");
    assert.ok(Math.abs(projectile.velocityX - scenario.x) < 1e-9);
    assert.ok(Math.abs(projectile.velocityY - scenario.y) < 1e-9);
    assert.ok(Math.abs(Math.hypot(projectile.velocityX, projectile.velocityY) - 540) < 1e-9);
  }
});

test("opposing directional inputs do not fall back to the button-only shot", () => {
  const controller = new ProjectileController();
  const fighter = makeFighter();

  const started = controller.updateFighter(
    fighter,
    input({ pressed: ["special"], down: ["left", "right"] })
  );

  assert.equal(started, false);
  assert.equal(fighter.state.action, STATES.action.NONE);
  assert.equal(controller.projectiles.length, 0);
});

test("directional projectiles are removed after leaving the vertical arena bounds", () => {
  const controller = new ProjectileController();
  const attacker = makeFighter({ y: 100 });
  const projectile = controller.spawnProjectile(attacker, {
    directionX: 0,
    directionY: -1,
    moveId: "directionalSpecial",
    moveName: "Vector Burst"
  });
  projectile.y = 5;

  const events = controller.updateProjectiles(
    0.05,
    [attacker],
    { minX: 0, maxX: 960, minY: 0, maxY: 540 }
  );

  assert.equal(events.length, 0);
  assert.equal(controller.projectiles.length, 0);
});


test("backward Vector Burst points behind a fighter facing left",()=>{
  const controller=new ProjectileController();
  const fighter=makeFighter({facing:-1});

  controller.updateFighter(
    fighter,
    input({pressed:["special"],down:["right"]})
  );
  for(let frame=0;frame<7;frame+=1) {
    controller.updateFighter(fighter,input());
  }

  assert.equal(controller.projectiles[0].velocityX,540);
  assert.equal(controller.projectiles[0].velocityY,0);
});

test("any projectile special can be used once per airtime",()=>{
  const controller=new ProjectileController();
  const fighter=makeFighter({onGround:false,y:300});

  assert.equal(
    controller.updateFighter(fighter,input({pressed:["special"],down:["left"]})),
    true
  );
  assert.equal(fighter.airProjectileAvailable,false);

  for(let frame=0;frame<26;frame+=1) {
    controller.updateFighter(fighter,input());
  }

  assert.equal(fighter.state.action,STATES.action.NONE);
  // The lock applies to L-only shots as well as another Vector Burst.
  assert.equal(
    controller.updateFighter(fighter,input({pressed:["special"]})),
    false
  );
  assert.equal(controller.projectiles.length,1);
});

test("an airborne Energy Shot also consumes the shared projectile allowance",()=>{
  const controller=new ProjectileController();
  const fighter=makeFighter({onGround:false,y:300});

  assert.equal(
    controller.updateFighter(fighter,input({pressed:["special"]})),
    true
  );
  assert.equal(fighter.airProjectileAvailable,false);

  for(let frame=0;frame<26;frame+=1) {
    controller.updateFighter(fighter,input());
  }

  assert.equal(fighter.state.action,STATES.action.NONE);
  assert.equal(
    controller.updateFighter(fighter,input({pressed:["special"],down:["up"]})),
    false
  );
  assert.equal(controller.projectiles.length,1);
});

test("starting an aerial projectile clears existing horizontal and upward momentum",()=>{
  const controller=new ProjectileController();
  const fighter=makeFighter({onGround:false,y:300});
  fighter.vx=160;
  fighter.vy=-180;
  fighter.airHorizontalVelocity=160;

  assert.equal(
    controller.updateFighter(fighter,input({pressed:["special"]})),
    true
  );

  assert.equal(fighter.vx,0);
  assert.equal(fighter.vy,0);
  assert.equal(fighter.airHorizontalVelocity,0);
  assert.equal(fighter.airProjectileAvailable,false);
});

test("Arc Lance uses its slower projectile, larger hit area, and longer frame data",()=>{
  const controller=new ProjectileController();
  const fighter=makeFighter({x:400,facing:1});
  const started=controller.updateFighter(fighter,{
    ...input({pressed:["special"]}),
    specialMove:"arcLance",
    specialFacing:-1
  });

  assert.equal(started,true);
  assert.equal(fighter.actionData.moveId,"arcLance");
  assert.equal(fighter.actionData.moveName,"Arc Lance");
  assert.equal(fighter.actionData.startupFrames,14);
  assert.equal(fighter.actionData.recoveryFrames,26);

  for(let frame=0;frame<13;frame+=1) controller.updateFighter(fighter,input());
  assert.equal(controller.projectiles.length,1);
  assert.equal(controller.projectiles[0].velocityX,-390);
  assert.equal(controller.projectiles[0].radius,26);
  assert.equal(controller.projectiles[0].remainingSeconds,2.8);
});
