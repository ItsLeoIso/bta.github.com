import test from "node:test";
import assert from "node:assert/strict";
import {
  INPUT_BITS,
  KNOWN_INPUT_MASK,
  encodeInputMask,
  createBitmaskInputFrame,
  BitmaskInputAdapter
} from "../src/input/BitmaskInput.js";
import { KeyboardInput } from "../src/input/KeyboardInput.js";

test("INPUT_BITS matches the canonical protocol v1 16-bit layout", () => {
  assert.deepEqual(INPUT_BITS, {
    left: 0x0001,
    right: 0x0002,
    jump: 0x0004,
    crouch: 0x0008,
    light: 0x0010,
    medium: 0x0020,
    heavy: 0x0040,
    special: 0x0080
  });
  assert.equal(KNOWN_INPUT_MASK, 0x00ff);
});

test("encodeInputMask packs KeyboardInput holds including simultaneous left and right", () => {
  const listeners = new Map();
  const target = {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type)
  };
  const keyboard = new KeyboardInput(target);
  keyboard.attach();

  const press = code => listeners.get("keydown")({ code, preventDefault() {} });
  const release = code => listeners.get("keyup")({ code });

  press("KeyA");
  press("KeyD");
  press("KeyS");
  press("KeyL");

  const mask = encodeInputMask(keyboard);
  assert.equal(
    mask,
    INPUT_BITS.left | INPUT_BITS.right | INPUT_BITS.crouch | INPUT_BITS.special
  );

  const frame = createBitmaskInputFrame(mask, 0);
  assert.equal(frame.isDown("left"), true);
  assert.equal(frame.isDown("right"), true);
  assert.equal(frame.getWorldAxis("horizontal"), 0);
  assert.equal(frame.isDown("crouch"), true);
  assert.equal(frame.wasPressed("special"), true);

  release("KeyA");
  const nextMask = encodeInputMask(keyboard);
  assert.equal(nextMask, INPUT_BITS.right | INPUT_BITS.crouch | INPUT_BITS.special);
  const nextFrame = createBitmaskInputFrame(nextMask, mask);
  assert.equal(nextFrame.getWorldAxis("horizontal"), 1);
  assert.equal(nextFrame.getAxis("horizontal", -1), -1);
  assert.equal(nextFrame.wasPressed("special"), false);
});

test("encodeInputMask falls back to getWorldAxis for axis-only input providers", () => {
  const axisOnlyLeft = { getWorldAxis: () => -1, isDown: () => false };
  const axisOnlyRight = { getWorldAxis: () => 1, isDown: action => action === "crouch" };

  assert.equal(encodeInputMask(axisOnlyLeft), INPUT_BITS.left);
  assert.equal(encodeInputMask(axisOnlyRight), INPUT_BITS.right | INPUT_BITS.crouch);
  assert.equal(encodeInputMask(null), 0);
});

test("BitmaskInputAdapter derives rising edges deterministically and supports rollback restore", () => {
  const adapter = new BitmaskInputAdapter();

  const f1 = adapter.nextFrame(INPUT_BITS.right | INPUT_BITS.light);
  assert.equal(f1.isDown("right"), true);
  assert.equal(f1.wasPressed("right"), true);
  assert.equal(f1.wasPressed("light"), true);

  // Holding the same mask produces no new press edge.
  const f2 = adapter.nextFrame(INPUT_BITS.right | INPUT_BITS.light);
  assert.equal(f2.isDown("light"), true);
  assert.equal(f2.wasPressed("light"), false);
  assert.equal(f2.wasPressed("right"), false);

  // Releasing light, then pressing it again produces a fresh rising edge.
  const f3 = adapter.nextFrame(INPUT_BITS.right);
  assert.equal(f3.isDown("light"), false);
  const savedPreviousMask = adapter.getPreviousMask();

  const f4 = adapter.nextFrame(INPUT_BITS.right | INPUT_BITS.light);
  assert.equal(f4.wasPressed("light"), true);
  assert.equal(f4.wasPressed("right"), false);

  // Rewinding previousMask reproduces f4 identically.
  adapter.setPreviousMask(savedPreviousMask);
  const replayedF4 = adapter.nextFrame(INPUT_BITS.right | INPUT_BITS.light);
  assert.equal(replayedF4.mask, f4.mask);
  assert.equal(replayedF4.pressedMask, f4.pressedMask);
  assert.equal(replayedF4.wasPressed("light"), true);

  adapter.reset();
  assert.equal(adapter.getPreviousMask(), 0);
});

test("createBitmaskInputFrame zeroes reserved bits and rejects invalid masks", () => {
  const frame = createBitmaskInputFrame(0xff00 | INPUT_BITS.jump, 0xff00);
  assert.equal(frame.mask, INPUT_BITS.jump);
  assert.equal(frame.previousMask, 0);
  assert.equal(frame.wasPressed("jump"), true);
  assert.equal(frame.isDown("unknown"), false);
  assert.equal(frame.wasPressed("unknown"), false);
  assert.equal(frame.getWorldAxis("vertical"), 0);

  assert.throws(() => createBitmaskInputFrame(-1), RangeError);
  assert.throws(() => createBitmaskInputFrame(0x10000), RangeError);
  assert.throws(() => createBitmaskInputFrame(1.5), RangeError);
  assert.throws(() => createBitmaskInputFrame(NaN), RangeError);
  assert.throws(() => new BitmaskInputAdapter({ initialMask: -1 }), RangeError);
});
