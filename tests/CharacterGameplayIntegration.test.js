import test from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../src/engine/Arena.js";
import { AttackController, ATTACK_DEFINITIONS } from "../src/combat/AttackController.js";
import { ProjectileController } from "../src/combat/ProjectileController.js";
import { FIGHTER_STATES as STATES } from "../src/state/FighterStateController.js";

function input({ pressed = [] } = {}) {
  return {
    getWorldAxis: () => 0,
    wasPressed: action => pressed.includes(action),
    isDown: () => false
  };
}

test("Arena builds fighters from selectable character definitions without changing their stats", () => {
  const arena = new Arena({ playerCharacterId: "cpu-rival", opponentCharacterId: "striker" });
  assert.equal(arena.player.characterId, "cpu-rival");
  assert.equal(arena.player.moveSpeed, 260);
  assert.equal(arena.player.damageMultiplier, 1.05);
  assert.equal(arena.opponent.characterId, "striker");
  assert.equal(arena.opponent.moveSpeed, 300);
  assert.equal(arena.opponent.damageMultiplier, 1);
  assert.equal(arena.player.animation.clipName, "idle");
  assert.throws(() => new Arena({ playerCharacterId: "missing" }), /Unknown player character/);
});

test("AttackController reads move data from the individual fighter profile", () => {
  const arena = new Arena();
  const fighter = arena.player;
  const customizedLight = {
    ...ATTACK_DEFINITIONS.light,
    name: "Quick Cut",
    startupFrames: 9
  };
  fighter.character = {
    ...fighter.character,
    moveSet: {
      ...fighter.character.moveSet,
      attacks: { ...fighter.character.moveSet.attacks, light: customizedLight }
    }
  };

  new AttackController().update(fighter, input({ pressed: ["light"] }));

  assert.equal(fighter.actionData.moveName, "Quick Cut");
  assert.equal(fighter.actionData.startupFrames, 9);
});

test("ProjectileController reads speed and spawn offsets from the fighter profile", () => {
  const arena = new Arena();
  const fighter = arena.player;
  const energyShot = {
    ...fighter.character.moveSet.projectiles.energyShot,
    speed: 321,
    spawnOffsetX: 92
  };
  fighter.character = {
    ...fighter.character,
    moveSet: {
      ...fighter.character.moveSet,
      projectiles: {
        ...fighter.character.moveSet.projectiles,
        energyShot
      }
    }
  };

  const controller = new ProjectileController();
  assert.equal(controller.updateFighter(fighter, input({ pressed: ["special"] })), true);
  for (let frame = 0; frame < 7; frame += 1) controller.updateFighter(fighter, input());

  assert.equal(controller.projectiles.length, 1);
  assert.equal(controller.projectiles[0].velocityX, 321);
  assert.equal(controller.projectiles[0].x, fighter.x + 92);
});

test("Arena animation follows real action and reaction changes and resets to idle", () => {
  const arena = new Arena({ trainingMode: true });
  arena.player.x = 400;
  arena.opponent.x = 1200;
  arena.update(1 / 60, input({ pressed: ["light"] }));
  assert.equal(arena.player.animation.clipName, "attack-light");

  arena.player.state.reaction = STATES.reaction.HITSTUN;
  arena.update(1 / 60, input());
  assert.equal(arena.player.animation.clipName, "reaction-hitstun");

  assert.equal(arena.resetTraining(), true);
  assert.equal(arena.player.animation.clipName, "idle");
});
