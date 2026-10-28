import test from "node:test";
import assert from "node:assert/strict";
import { timeAt, follow, panelAt } from "../src/scripts/scroll-motion.mjs";

test("Small wheel movements advance the footage at all three room stops", () => {
  for (const stop of [0.24, 0.54, 0.9]) {
    assert.ok(timeAt(stop + 0.005) > timeAt(stop));
    assert.ok(timeAt(stop - 0.005) < timeAt(stop));
  }
});
test("A wheel notch eases in, never overshoots, and settles within 600 ms", () => {
  const destination = timeAt(0.26);
  let time = timeAt(0.24);
  const first = follow(time, destination, 1 / 60);
  assert.ok(first > time && first < destination);
  for (let i = 0; i < 36; i++) {
    const next = follow(time, destination, 1 / 60);
    assert.ok(next >= time && next <= destination);
    time = next;
  }
  assert.ok(Math.abs(time - destination) < 1 / 30);
});
test("Reversing scroll reverses immediately without continued forward drift", () => {
  let time = follow(10, 15, 1 / 60);
  assert.ok(follow(time, 8, 1 / 60) < time);
});
test("60 Hz and 120 Hz displays follow at the same speed", () => {
  const simulate = (hz) => {
    let time = 5;
    for (let i = 0; i < hz / 2; i++) time = follow(time, 15, 1 / hz);
    return time;
  };
  assert.ok(Math.abs(simulate(60) - simulate(120)) < 0.00001);
});
test("The room navigation arrives on footage belonging to the correct caption", () => {
  assert.equal(panelAt(timeAt(0.24)), 1);
  assert.equal(panelAt(timeAt(0.54)), 2);
  assert.equal(panelAt(timeAt(0.9)), 3);
});
