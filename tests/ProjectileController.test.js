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

test("direction plus L does not fall back to the button-only projectile", () => {
  const controller = new ProjectileController();
  const fighter = makeFighter();

  const started = controller.updateFighter(
    fighter,
    input({ pressed: ["special"], down: ["right"] })
  );

  assert.equal(started, false);
  assert.equal(fighter.state.action, STATES.action.NONE);
  assert.equal(controller.projectiles.length, 0);
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
