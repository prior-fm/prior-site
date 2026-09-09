const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const engine = require("../assets/tiny-model.js");

class Element {
  constructor() {
    this.attrs = {};
    this.dataset = {};
    this.children = [];
    this.listeners = {};
    this.hidden = false;
    this.disabled = false;
  }
  set value(value) {
    this._value = String(value);
  }
  get value() {
    return this._value || "";
  }
  set textContent(value) {
    this._text = String(value);
  }
  get textContent() {
    return this._text || "";
  }
  setAttribute(key, value) {
    this.attrs[key] = String(value);
    if (key === "data-step") this.dataset.step = value;
  }
  getAttribute(key) {
    return this.attrs[key] ?? null;
  }
  removeAttribute(key) {
    delete this.attrs[key];
  }
  addEventListener(type, callback) {
    this.listeners[type] = callback;
  }
  fire(type, event = {}) {
    this.listeners[type]?.(event);
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  replaceChildren(...children) {
    this.children = children;
  }
  setPointerCapture() {}
  getScreenCTM() {
    return { inverse: () => ({}) };
  }
  createSVGPoint() {
    return {
      x: 0,
      y: 0,
      matrixTransform() {
        return { x: this.x, y: this.y };
      },
    };
  }
}

function setup({ reduced = false, missingEngine = false } = {}) {
  const html = fs.readFileSync("lesson.html", "utf8");
  const elements = new Map();
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const element = new Element();
    element.hidden = /\bhidden\b/.test(match[0]);
    elements.set(match[1], element);
  }
  const steps = ["teach", "train", "test"].map((step) => {
    const element = new Element();
    element.dataset.step = step;
    return element;
  });
  const extras = [
    ...html.matchAll(/<[^>]+\bdata-interactive-only\b[^>]*>/g),
  ].map(() => {
    const element = new Element();
    element.hidden = true;
    return element;
  });
  const queue = new Map();
  let clock = 0,
    frame = 0;
  const media = {
    matches: reduced,
    addEventListener(type, callback) {
      this.change = callback;
    },
  };
  const document = {
    hidden: false,
    listeners: {},
    getElementById: (id) => elements.get(id) || null,
    querySelectorAll: (query) =>
      query === "[data-step]"
        ? steps
        : query === "[data-interactive-only]"
          ? extras
          : [],
    createElement: () => new Element(),
    createElementNS: () => new Element(),
    addEventListener(type, callback) {
      this.listeners[type] = callback;
    },
  };
  const calls = [];
  const api = {
    ...engine,
    step(model, points, rate) {
      const next = engine.step(model, points, rate);
      calls.push({
        model: next,
        points: points.map((point) => ({ ...point })),
        rate,
      });
      return next;
    },
  };
  elements.get("learning-rate").value = ".25";
  const window = {
    PriorTinyModel: missingEngine ? null : api,
    matchMedia: () => media,
    addEventListener() {},
  };
  vm.runInNewContext(fs.readFileSync("assets/lesson.js", "utf8"), {
    window,
    document,
    requestAnimationFrame(callback) {
      queue.set(++frame, callback);
      return frame;
    },
    cancelAnimationFrame(id) {
      queue.delete(id);
    },
  });
  const tick = () => {
    const entry = queue.entries().next().value;
    if (entry) {
      queue.delete(entry[0]);
      entry[1]((clock += 50));
    }
  };
  const finish = () => {
    let limit = 1000;
    while (queue.size && limit--) tick();
    assert.ok(limit > 0, "animation must terminate");
  };
  return {
    el: (id) => elements.get(id),
    steps,
    extras,
    calls,
    document,
    media,
    queue,
    tick,
    finish,
  };
}

test("guided train/test flow exposes computed held-out results without training on them", () => {
  const h = setup();
  assert.equal(h.el("lesson-app").hidden, false);
  assert.equal(h.el("lesson-fallback").hidden, true);
  assert.equal(h.extras.length, 2);
  assert.ok(h.extras.every((extra) => !extra.hidden));
  assert.equal(h.el("test-results").hidden, true);
  h.el("train-button").fire("click");
  assert.equal(h.el("pause-button").hidden, false);
  h.finish();
  assert.equal(h.el("step-count").textContent, "240");
  assert.equal(h.el("training-error").textContent, "<0.001");
  h.el("test-button").fire("click");
  assert.equal(h.el("test-rows").children.length, engine.TEST_DATA.length);
  assert.equal(h.el("test-results").hidden, false);
  assert.ok(
    h.calls.every((call) =>
      call.points.every(
        (point) => !engine.TEST_DATA.some((held) => held.x === point.x),
      ),
    ),
  );
});

test("pause, single-step and editing examples reset the correct state", () => {
  const h = setup();
  h.el("train-button").fire("click");
  h.tick();
  h.el("pause-button").fire("click");
  assert.equal(h.queue.size, 0);
  const before = Number(h.el("step-count").textContent);
  h.el("step-button").fire("click");
  assert.equal(Number(h.el("step-count").textContent), before + 1);
  h.el("test-button").fire("click");
  h.steps[0].fire("click");
  const input = h.el("example-fields").children[0].children[1];
  input.value = "4.2";
  input.fire("change");
  assert.equal(h.el("step-count").textContent, "0");
  assert.equal(h.el("test-results").hidden, true);
  h.el("step-button").fire("click");
  assert.ok(Math.abs(h.calls.at(-1).points[0].y - 0.42) < 1e-12);
});

test("reduced motion calculates the same result without scheduling animation", () => {
  const h = setup({ reduced: true });
  h.el("train-button").fire("click");
  assert.equal(h.queue.size, 0);
  assert.equal(h.el("step-count").textContent, "240");
  assert.equal(h.el("training-error").textContent, "<0.001");
});

test("large step sizes stop safely and the original setup can be restored", () => {
  const h = setup({ reduced: true });
  h.el("learning-rate").value = "1.2";
  h.el("train-button").fire("click");
  assert.match(h.el("lesson-status").textContent, /updates became too large/);
  assert.equal(h.el("train-button").disabled, false);
  h.el("restore-button").fire("click");
  assert.equal(h.el("learning-rate").value, "0.25");
  h.el("train-button").fire("click");
  assert.equal(h.el("training-error").textContent, "<0.001");
});

test("test-first, invalid edits, misleading data and tab changes are recoverable", () => {
  const h = setup();
  h.el("test-button").fire("click");
  assert.match(h.el("lesson-status").textContent, /untrained/);
  assert.equal(h.calls.length, 0);
  const input = h.el("example-fields").children[0].children[1];
  input.value = "";
  input.fire("change");
  assert.equal(input.value, "2.15");
  h.el("misleading-button").fire("click");
  assert.equal(h.el("example-fields").children.at(-1).children[1].value, "1.5");
  h.el("train-button").fire("click");
  h.document.hidden = true;
  h.document.listeners.visibilitychange();
  assert.equal(h.queue.size, 0);
  assert.match(h.el("lesson-status").textContent, /paused/);
});

test("failed engine loading keeps the readable fallback and hides inert controls", () => {
  const h = setup({ missingEngine: true });
  assert.equal(h.el("lesson-app").hidden, true);
  assert.equal(h.el("lesson-fallback").hidden, false);
  assert.equal(h.extras.length, 2);
  assert.ok(h.extras.every((extra) => extra.hidden));
});

test("dragging a plot example updates the same answer used by training", () => {
  const h = setup();
  const plot = h.el("model-plot");
  const point = h.el("plot-training").children[0];
  plot.fire("pointerdown", {
    target: point,
    pointerId: 1,
    preventDefault() {},
  });
  plot.fire("pointermove", { clientX: 116, clientY: 200 });
  plot.fire("pointerup");
  assert.equal(h.el("example-fields").children[0].children[1].value, "5");
  h.el("step-button").fire("click");
  assert.equal(h.calls.at(-1).points[0].y, 0.5);
  plot.fire("pointermove", { clientX: 116, clientY: 48 });
  assert.equal(h.el("example-fields").children[0].children[1].value, "5");
});
