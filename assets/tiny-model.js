(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PriorTinyModel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LIMIT = 1e6;
  var TRAINING = [
    { x: 0.1, y: 0.15 + 0.65 * 0.1 },
    { x: 0.3, y: 0.15 + 0.65 * 0.3 },
    { x: 0.5, y: 0.15 + 0.65 * 0.5 },
    { x: 0.7, y: 0.15 + 0.65 * 0.7 },
    { x: 0.9, y: 0.15 + 0.65 * 0.9 },
  ];
  var TEST_DATA = [
    { x: 0.2, y: 0.15 + 0.65 * 0.2 },
    { x: 0.4, y: 0.15 + 0.65 * 0.4 },
    { x: 0.6, y: 0.15 + 0.65 * 0.6 },
    { x: 0.8, y: 0.15 + 0.65 * 0.8 },
  ];
  function freezePoints(points) {
    return Object.freeze(
      points.map(function (point) {
        return Object.freeze({ x: point.x, y: point.y });
      }),
    );
  }
  var DEFAULT_TRAINING = freezePoints(TRAINING);
  var DEFAULT_TEST_DATA = freezePoints(TEST_DATA);

  function finite(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(label + " must be finite");
  }
  function modelValid(model) {
    if (!model || typeof model !== "object")
      throw new TypeError("model must be an object");
    finite(model.slope, "model.slope");
    finite(model.offset, "model.offset");
    finite(model.steps, "model.steps");
    if (model.steps < 0 || Math.floor(model.steps) !== model.steps)
      throw new RangeError("model.steps must be a non-negative integer");
    if (Math.abs(model.slope) > LIMIT || Math.abs(model.offset) > LIMIT)
      throw new RangeError("model coefficients exceed safe bound 1e6");
  }
  function pointsValid(points) {
    if (!Array.isArray(points) || points.length === 0)
      throw new RangeError("points must be a non-empty array");
    points.forEach(function (point, index) {
      if (!point || typeof point !== "object")
        throw new TypeError("point " + index + " must be an object");
      finite(point.x, "point " + index + ".x");
      finite(point.y, "point " + index + ".y");
    });
  }
  function initial() {
    return { slope: -0.35, offset: 0.8, steps: 0 };
  }
  function predict(model, x) {
    modelValid(model);
    finite(x, "x");
    return model.slope * x + model.offset;
  }
  function loss(model, points) {
    modelValid(model);
    pointsValid(points);
    var total = points.reduce(function (sum, point) {
      var error = predict(model, point.x) - point.y;
      return sum + error * error;
    }, 0);
    if (!Number.isFinite(total) || total / points.length > LIMIT)
      throw new RangeError("loss exceeds safe bound 1e6");
    return total / points.length;
  }
  function step(model, trainingPoints, rate) {
    modelValid(model);
    pointsValid(trainingPoints);
    if (rate === undefined) rate = 0.25;
    finite(rate, "rate");
    if (rate <= 0) throw new RangeError("rate must be greater than 0");
    var slopeGradient = 0;
    var offsetGradient = 0;
    trainingPoints.forEach(function (point) {
      var error = model.slope * point.x + model.offset - point.y;
      slopeGradient += error * point.x;
      offsetGradient += error;
    });
    slopeGradient *= 2 / trainingPoints.length;
    offsetGradient *= 2 / trainingPoints.length;
    var next = {
      slope: model.slope - rate * slopeGradient,
      offset: model.offset - rate * offsetGradient,
      steps: model.steps + 1,
    };
    finite(next.slope, "next slope");
    finite(next.offset, "next offset");
    if (Math.abs(next.slope) > LIMIT || Math.abs(next.offset) > LIMIT)
      throw new RangeError("model coefficients diverged beyond safe bound 1e6");
    if (loss(next, trainingPoints) > LIMIT)
      throw new RangeError("model loss diverged beyond safe bound 1e6");
    return next;
  }
  return {
    DEFAULT_TRAINING: DEFAULT_TRAINING,
    TEST_DATA: DEFAULT_TEST_DATA,
    initial: initial,
    predict: predict,
    loss: loss,
    step: step,
  };
});
