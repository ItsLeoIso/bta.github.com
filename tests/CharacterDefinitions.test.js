import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARACTER_REGISTRY,
  CPU_RIVAL,
  STRIKER,
  getAvailableCharacters,
  getCharacterDefinition
} from "../src/characters/CharacterDefinitions.js";

test("the registry exposes the existing Striker and CPU Rival profiles", () => {
  assert.equal(getCharacterDefinition("striker"), STRIKER);
  assert.equal(getCharacterDefinition("cpu-rival"), CPU_RIVAL);
  assert.deepEqual(getAvailableCharacters().map(character => character.id), ["striker", "cpu-rival"]);
  assert.deepEqual(Object.keys(CHARACTER_REGISTRY), ["striker", "cpu-rival"]);
});

test("character stats preserve the established prototype matchup", () => {
  assert.deepEqual(STRIKER.stats, { moveSpeed: 300, damageMultiplier: 1 });
  assert.deepEqual(CPU_RIVAL.stats, { moveSpeed: 260, damageMultiplier: 1.05 });
});

test("both profiles expose the shared, frozen prototype move set and animation metadata", () => {
  for (const character of getAvailableCharacters()) {
    assert.ok(Object.isFrozen(character));
    assert.ok(Object.isFrozen(character.stats));
    assert.equal(character.moveSet.attacks.light.startupFrames, 5);
    assert.equal(character.moveSet.attacks.medium.launchVelocity, 520);
    assert.equal(character.moveSet.projectiles.arcLance.moveId, "arcLance");
    assert.ok(character.animations["attack-medium"].frames.length > 0);
    assert.equal(character.spriteSheet.src, null);
  }
});

test("unknown character ids are not silently replaced with another fighter", () => {
  assert.equal(getCharacterDefinition("not-a-character"), null);
});
