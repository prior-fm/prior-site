const assert = require("assert");
const model = require("../assets/tiny-model.js");

const close = (actual, expected, epsilon = 1e-12) =>
  assert(Math.abs(actual - expected) < epsilon, `${actual} ≠ ${expected}`);

assert.deepStrictEqual(model.initial(), {
  slope: -0.35,
  offset: 0.8,
  steps: 0,
});
close(model.predict(model.initial(), 0.5), 0.625);

// One batch update, hand-calculated from x=.5, y=.475: error=.15,
// gradients are dSlope=.15 and dOffset=.30 at rate .25.
const hand = model.step(model.initial(), [{ x: 0.5, y: 0.475 }]);
close(hand.slope, -0.3875);
close(hand.offset, 0.725);
assert.strictEqual(hand.steps, 1);

let trained = model.initial();
for (let i = 0; i < 500; i += 1)
  trained = model.step(trained, model.DEFAULT_TRAINING, 0.5);
close(trained.slope, 0.65, 1e-8);
close(trained.offset, 0.15, 1e-8);
assert(
  model.loss(trained, model.TEST_DATA) < 1e-14,
  "test data should follow the same rule",
);

const before = model.initial();
model.step(before, model.DEFAULT_TRAINING);
assert.deepStrictEqual(before, { slope: -0.35, offset: 0.8, steps: 0 });
assert(Object.isFrozen(model.DEFAULT_TRAINING));
assert(Object.isFrozen(model.DEFAULT_TRAINING[0]));
model.DEFAULT_TRAINING[0].x = 9;
assert.strictEqual(model.DEFAULT_TRAINING[0].x, 0.1);

const custom = model.step(model.initial(), [{ x: 1, y: 0 }], 0.25);
assert.notStrictEqual(custom.slope, hand.slope);
assert.notStrictEqual(custom.offset, hand.offset);

assert.throws(() => model.loss(model.initial(), []), /non-empty/);
assert.throws(() => model.predict(model.initial(), Infinity), /finite/);
assert.throws(
  () => model.step(model.initial(), model.DEFAULT_TRAINING, 0),
  /greater than 0/,
);
assert.throws(() => model.step(model.initial(), [{ x: NaN, y: 1 }]), /finite/);
assert.throws(
  () =>
    model.step({ slope: 1e6 + 1, offset: 0, steps: 0 }, model.DEFAULT_TRAINING),
  /safe bound/,
);
assert.throws(
  () => model.step(model.initial(), [{ x: 1e5, y: -1e5 }], 1e6),
  /diverged|safe bound/,
);

console.log("tiny model: ok");
