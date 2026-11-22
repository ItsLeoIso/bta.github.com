import test from "node:test";
import assert from "node:assert/strict";
import { ComboTracker } from "../src/combat/ComboTracker.js";

const event = (attacker, defender) => ({ type: "hit", attacker, defender });

test("combo count and cumulative damage track follow-ups from the same attacker", () => {
  const tracker = new ComboTracker();
  const attacker = {};
  const defender = { onGround: true };
  tracker.recordHit(event(attacker, defender), 0.1, { wasAirborne: false });
  assert.equal(tracker.getDamageScale(event(attacker, defender)), 0.9);
  const combo = tracker.recordHit(event(attacker, defender), 0.09, { wasAirborne: false });
  assert.equal(combo.hitCount, 2);
  assert.ok(Math.abs(combo.totalDamage - 0.19) < 1e-9);
  assert.equal(tracker.getComboForAttacker(attacker).hitCount, 2);
});

test("combo damage scaling drops by ten points to a forty-percent floor", () => {
  const tracker = new ComboTracker();
  const attacker = {};
  const defender = { onGround: true };
  for (let hit = 0; hit < 10; hit += 1) {
    assert.equal(tracker.getDamageScale(event(attacker, defender)), Math.max(0.4, 1 - hit * 0.1));
    tracker.recordHit(event(attacker, defender), 0.01, { wasAirborne: false });
  }
});

test("a juggle permits three airborne follow-ups and drops the fourth", () => {
  const tracker = new ComboTracker({ maxJuggleHits: 3 });
  const attacker = {};
  const defender = { onGround: true };
  tracker.recordHit(event(attacker, defender), 0.1, { wasAirborne: false });
  defender.onGround = false;
  for (let hit = 0; hit < 3; hit += 1) {
    assert.equal(tracker.canRegisterHit(event(attacker, defender)), true);
    tracker.recordHit(event(attacker, defender), 0.05, { wasAirborne: true });
  }
  assert.equal(tracker.getComboForAttacker(attacker).juggleHits, 3);
  assert.equal(tracker.canRegisterHit(event(attacker, defender)), false);
});

test("combo expires when its fixed-frame link window runs out", () => {
  const tracker = new ComboTracker({ comboWindowFrames: 3 });
  const attacker = {};
  const defender = { onGround: true };
  tracker.recordHit(event(attacker, defender), 0.1, { wasAirborne: false });
  tracker.update();
  tracker.update();
  assert.equal(tracker.getComboForAttacker(attacker).hitCount, 1);
  tracker.update();
  assert.equal(tracker.getComboForAttacker(attacker), null);
});

test("a different attacker begins a fresh combo at full damage scaling", () => {
  const tracker = new ComboTracker();
  const first = {};
  const second = {};
  const defender = { onGround: true };
  tracker.recordHit(event(first, defender), 0.1, { wasAirborne: false });
  assert.equal(tracker.getDamageScale(event(second, defender)), 1);
  tracker.recordHit(event(second, defender), 0.1, { wasAirborne: false });
  assert.equal(tracker.getComboForAttacker(first), null);
  assert.equal(tracker.getComboForAttacker(second).hitCount, 1);
});

test("invalid combo configuration is rejected", () => {
  assert.throws(() => new ComboTracker({ comboWindowFrames: 0 }), RangeError);
  assert.throws(() => new ComboTracker({ maxJuggleHits: 0 }), RangeError);
  assert.throws(() => new ComboTracker({ minimumDamageScale: 0 }), RangeError);
});
