const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync("assets/cinematic.js", "utf8");

class FakeElement {
  constructor({ href, progress, complete = false, naturalWidth = 0 } = {}) {
    this.style = {
      cssText: "",
      setProperty(name, value) {
        this[name] = value;
      },
    };
    this.dataset = {};
    if (href) this.href = href;
    if (progress !== undefined) this.dataset.progress = String(progress);
    this.complete = complete;
    this.naturalWidth = naturalWidth;
    this.inert = false;
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
  }
  querySelector(selector) {
    if (selector === "img") return this.children[0];
    return null;
  }
  querySelectorAll(selector) {
    if (
      selector === ".scene-image" ||
      selector === ".scene-copy" ||
      selector === ".journey-nav a"
    )
      return this.children;
    return [];
  }
  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }
  dispatch(type, event = {}) {
    const callback = this.listeners.get(type);
    if (callback) callback(event);
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  getAttribute(name) {
    if (name === "href" && this.href) return this.href;
    return this.attributes.get(name) ?? null;
  }
}

function makeHarness({ optical = false } = {}) {
  const layers = (optical ? [] : [0, 1, 2]).map((i) => {
    const layer = new FakeElement();
    const image = new FakeElement({
      complete: i === 0,
      naturalWidth: i === 0 ? 100 : 0,
    });
    if (i > 0) image.dataset.src = `scene-${i}.webp`;
    layer.children = [image];
    return layer;
  });
  const copies = [0, 1, 2, 3].map(() => new FakeElement());
  const anchors = ["machine", "mechanism", "idea"].map((id) => {
    const anchor = new FakeElement();
    anchor.id = id;
    return anchor;
  });
  const nav = [0, 0.255, 0.53, 0.88].map(
    (progress, i) =>
      new FakeElement({
        href: i ? `#${anchors[i - 1].id}` : "#journey",
        progress,
      }),
  );
  const stage = new FakeElement();
  const journey = new FakeElement();
  const wordmark = new FakeElement();
  const aperture = new FakeElement();
  const object = new FakeElement();
  stage.children = [...layers, ...copies, wordmark, aperture, ...nav];
  stage.querySelector = (selector) =>
    selector === ".hero-wordmark"
      ? wordmark
      : selector === ".aperture"
        ? aperture
        : selector === ".journey-object"
          ? object
          : null;
  stage.querySelectorAll = (selector) =>
    selector === ".scene-image"
      ? layers
      : selector === ".scene-copy"
        ? copies
        : selector === ".journey-nav a"
          ? nav
          : [];
  journey.querySelector = (selector) => (selector === ".stage" ? stage : null);
  journey.querySelectorAll = () => [];
  journey.offsetHeight = 5400;
  stage.offsetHeight = 1000;
  journey.getBoundingClientRect = () => ({ top: 100 });

  const listeners = new Map();
  const reduced = {
    matches: false,
    addEventListener: (type, callback) => listeners.set(type, callback),
  };
  const root = {
    classList: {
      values: new Set(),
      toggle(name, on) {
        on ? this.values.add(name) : this.values.delete(name);
      },
    },
  };
  let rafId = 0;
  const rafQueue = [];
  const cancelled = [];
  const window = {
    scrollY: 200,
    document: null,
    matchMedia: () => reduced,
    requestAnimationFrame: (callback) => {
      rafQueue.push(callback);
      return ++rafId;
    },
    cancelAnimationFrame: (id) => cancelled.push(id),
    scrollTo: (options) => {
      window.lastScroll = options;
    },
    addEventListener: (type, callback) =>
      listeners.set(`window:${type}`, callback),
  };
  const document = {
    hidden: false,
    documentElement: root,
    querySelector: (selector) =>
      selector === ".journey"
        ? journey
        : anchors.find((anchor) => `#${anchor.id}` === selector) || null,
    addEventListener: (type, callback) =>
      listeners.set(`document:${type}`, callback),
  };
  window.document = document;
  const context = {
    window,
    document,
    history: {
      replaceState: (...args) => {
        context.historyCall = args;
      },
    },
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
    IntersectionObserver: undefined,
    ResizeObserver: undefined,
    console,
  };
  vm.runInNewContext(source, context);
  const flush = () => {
    while (rafQueue.length) rafQueue.shift()();
  };
  flush();
  return {
    ...context,
    layers,
    copies,
    nav,
    anchors,
    wordmark,
    aperture,
    object,
    reduced,
    listeners,
    cancelled,
    journey,
    stage,
    flush,
  };
}

function scrollTo(harness, scrollY) {
  harness.window.scrollY = scrollY;
  harness.listeners.get("window:scroll")();
  harness.flush();
}

test("extreme scroll positions keep every rendered style finite", () => {
  const h = makeHarness();
  for (const y of [-1e12, 1e12]) {
    scrollTo(h, y);
    for (const element of [...h.layers, ...h.copies, h.wordmark, h.aperture]) {
      assert.doesNotMatch(element.style.opacity || "", /NaN|Infinity/);
      assert.doesNotMatch(element.style.transform || "", /NaN|Infinity/);
    }
  }
});

test("each chapter navigation progress activates its caption and keeps its link usable", () => {
  const h = makeHarness();
  for (let i = 0; i < h.nav.length; i++) {
    scrollTo(h, 300 + Number(h.nav[i].dataset.progress) * 4400);
    assert.equal(h.nav[i].getAttribute("aria-current"), "step");
    assert.equal(h.copies[i].inert, false);
    assert.equal(h.copies[i].getAttribute("aria-hidden"), "false");
    assert.equal(h.copies.filter((copy) => !copy.inert).length, 1);
  }
});

test("reduced-motion changes cancel rendering and clear cinematic state", () => {
  const h = makeHarness();
  h.window.scrollY = 300 + 0.53 * 4400;
  h.listeners.get("window:scroll")();
  h.reduced.matches = true;
  h.listeners.get("change")();
  assert.ok(h.cancelled.length > 0);
  assert.equal(
    h.document.documentElement.classList.values.has("motion-ready"),
    false,
  );
  for (const copy of h.copies) {
    assert.equal(copy.style.cssText, "");
    assert.equal(copy.inert, false);
    assert.equal(copy.getAttribute("aria-hidden"), null);
  }
  assert.equal(
    h.nav.some((link) => link.getAttribute("aria-current")),
    false,
  );
});

test("unloaded scene images never replace the ready previous scene with black", () => {
  const h = makeHarness();
  scrollTo(h, 300 + 4400);
  assert.equal(h.layers[0].style.opacity, "1.0000");
  assert.equal(h.layers[1].style.opacity, "0.0000");
  assert.equal(h.layers[2].style.opacity, "0.0000");
});

test("the optical edition works without cinematic background images and resets its light under reduced motion", () => {
  const h = makeHarness({ optical: true });
  for (const p of [0, .3, .6, 1, .6, 0]) {
    scrollTo(h, 300 + p * 4400);
    assert.equal(h.stage.style["--optical-progress"], p.toFixed(4));
    assert.equal(h.copies.filter(copy => !copy.inert).length, 1);
  }
  scrollTo(h, 300 + .6 * 4400);
  assert.equal(h.object.style["--compute"], "1.0000");
  h.reduced.matches = true;
  h.listeners.get("change")();
  assert.equal(h.stage.style["--optical-progress"], "0");
  assert.ok(h.copies.every(copy => !copy.inert));
});

test("chapter anchors and navigation jumps use the same measured travel", () => {
  const h = makeHarness();
  assert.equal(h.anchors[0].style.top, "1122px");
  assert.equal(h.anchors[1].style.top, "2332px");
  assert.equal(h.anchors[2].style.top, "3872px");
  const event = {
    preventDefault() {
      this.prevented = true;
    },
  };
  h.nav[2].dispatch("click", event);
  assert.equal(event.prevented, true);
  assert.equal(h.window.lastScroll.top, 2632);
  assert.equal(h.window.lastScroll.behavior, "smooth");
});

test("the persistent image becomes data, computation, and prediction in sequence and reverses", () => {
  const h = makeHarness();
  const at = (p) => {
    scrollTo(h, 300 + p * 4400);
    return h.object.style;
  };
  const start = { ...at(0) };
  assert.equal(start["--data"], "0.0000");
  assert.equal(start["--compute"], "0.0000");
  assert.equal(start["--prediction"], "0.0000");
  const input = { ...at(0.3) };
  assert.equal(input["--data"], "1.0000");
  assert.equal(input["--compute"], "0.0000");
  const model = { ...at(0.6) };
  assert.equal(model["--compute"], "1.0000");
  assert.equal(model["--prediction"], "0.0000");
  const result = { ...at(1) };
  assert.equal(result["--prediction"], "1.0000");
  const rewind = at(0);
  for (const name of Object.keys(start).filter((name) =>
    name.startsWith("--"),
  )) {
    assert.equal(rewind[name], start[name], name);
  }
});

test("object transforms and phase values stay finite and bounded across the complete journey", () => {
  const h = makeHarness();
  for (let i = -10; i <= 110; i++) {
    scrollTo(h, 300 + (i / 100) * 4400);
    for (const name of ["--data", "--compute", "--prediction"]) {
      assert.ok(
        Number(h.object.style[name]) >= 0 && Number(h.object.style[name]) <= 1,
        name,
      );
    }
    for (const name of [
      "--object-x",
      "--object-y",
      "--object-z",
      "--object-scale",
    ]) {
      assert.ok(Number.isFinite(parseFloat(h.object.style[name])), name);
    }
  }
});
