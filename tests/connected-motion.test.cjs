const test = require('node:test');
const assert = require('node:assert/strict');
const motion = require('../assets/connected-motion.js');

test('progress is bounded at extreme scroll positions and preserves the anchored viewport rule', () => {
  for (const viewport of [568, 820, 1180, 1366]) {
    for (const scroll of [-1e9, -1, 0, 1e3, 1e9]) {
      const value = motion.progress(scroll, 2200, 4400, viewport);
      assert.ok(Number.isFinite(value));
      assert.ok(value >= 0 && value <= 1);
    }
    // The object enters when its section reaches the same viewport anchor in
    // portrait and landscape: scroll + .94*viewport equals section top.
    assert.equal(motion.progress(2200 - viewport * .94, 2200, 4400, viewport), 0);
  }
});

test('scene states stay bounded and use distinct reveal/close phases', () => {
  for (const kind of ['experiment', 'mechanism', 'film']) {
    for (const p of [-1, 0, .25, .5, .75, 1, 2]) {
      const state = motion.state(kind, p);
      for (const key of ['open', 'rotate', 'reveal', 'door', 'opacity']) {
        assert.ok(Number.isFinite(state[key]), `${kind}.${key} must be finite`);
        assert.ok(state[key] >= 0 && state[key] <= 1, `${kind}.${key} must be bounded`);
      }
    }
  }
  const experiment = motion.state('experiment', .65);
  assert.ok(experiment.reveal > 0, 'experiment should reveal the result after unfolding');
  assert.equal(motion.state('mechanism', .65).reveal, 0, 'mechanism should remain the visual explanation');
  const film = motion.state('film', .6);
  assert.equal(film.open, 0, 'film should reveal the real frame without reopening the tile');
  assert.ok(film.door >= .18, 'film should begin as a stable frame preview');
  assert.ok(film.door > 0, 'film should be opening its poster/door');
  assert.equal(motion.state('film', 1).opacity, 0, 'film overlay should close completely at the end');
});

test('the connected specimen keeps one semantic layer per stage', () => {
  const h = harness();
  const specimen = h.nodes[1].querySelector('.specimen');
  const front = specimen.querySelector('.specimen-front');
  const middle = specimen.querySelector('.specimen-middle');
  const back = specimen.querySelector('.specimen-back');
  assert.equal(front.children.filter((child) => child.className === 'samples').length, 1);
  assert.equal(middle.children.filter((child) => child.className === 'network').length, 1);
  assert.equal(back.children.filter((child) => child.className === 'output').length, 1);
});

function harness({ reduced = false, withExperiment = true, withVideo = true } = {}) {
  const ids = new Map();
  const windowEvents = {};
  const documentEvents = {};
  const callbacks = new Map();
  let serial = 0;
  let layoutReads = 0;
  const make = (id) => {
    if (ids.has(id)) return ids.get(id);
    const el = {
      id, dataset: {}, style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
      attributes: {}, listeners: {}, children: [],
      appendChild(child) { this.children.push(child); return child; },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      fire(name) { if (this.listeners[name]) this.listeners[name](); },
      querySelector(selector) {
        if (selector === '.specimen') return this.children.find((c) => c.className === 'specimen');
        if (selector === '.specimen-door') return this.children.find((c) => c.className === 'specimen-door');
        return null;
      },
      classList: { toggle() {} },
      getBoundingClientRect() { layoutReads++; return { top: this._top || 0, height: 360 }; },
    };
    ids.set(id, el);
    return el;
  };
  const clone = () => {
    const node = (className) => ({
      className,
      style: { setProperty(k, v) { this[k] = v; }, cssText: '' },
      children: [],
      appendChild(child) { this.children.push(child); return child; },
      cloneNode() { const copy = node(className); copy.children = this.children.map((child) => child.cloneNode ? child.cloneNode(true) : child); return copy; },
      querySelector(selector) {
        const own = selector.startsWith('.') && className === selector.slice(1);
        if (own) return this;
        const match = (child) => selector === 'svg' ? child.className === 'network' : selector === '.specimen-samples' ? child.className === 'samples' : selector === '.specimen-output' ? child.className === 'output' : false;
        const direct = this.children.find(match);
        if (direct) return direct;
        for (const child of this.children) if (child.querySelector) { const result = child.querySelector(selector); if (result) return result; }
        return null;
      },
    });
    const specimen = node('specimen');
    const front = node('specimen-front');
    const middle = node('specimen-middle');
    const back = node('specimen-back');
    const samples = node('samples');
    const pixels = node('pixels');
    const network = node('network');
    const output = node('output');
    front.appendChild(samples);
    front.appendChild(pixels);
    middle.appendChild(network);
    back.appendChild(output);
    specimen.appendChild(front);
    specimen.appendChild(middle);
    specimen.appendChild(back);
    const door = { className: 'specimen-door', remove() { this.removed = true; } };
    return {
      querySelector(selector) {
        return { '.specimen': specimen, '.specimen-door': door, '.specimen-front': front,
          '.specimen-middle': middle, '.specimen-back': back }[selector] || null;
      }, specimen, front, middle, back, door,
    };
  };
  const template = { content: { cloneNode() { return clone(); } } };
  ids.set('motion-specimen', template);
  const experiment = withExperiment ? make('studio-interactive') : null;
  const video = withVideo ? make('latest-video') : null;
  if (video) { video.paused = true; video.currentTime = 12; }
  const nodes = [];
  for (const kind of ['experiment', 'mechanism', 'film']) {
    const node = make(`scene-${kind}`);
    node.dataset.motionScene = kind;
    node._top = kind === 'experiment' ? 1200 : kind === 'mechanism' ? 2200 : 3200;
    node.getBoundingClientRect = () => { layoutReads++; return { top: node._top - window.scrollY, height: 360 }; };
    node.appendChild = (child) => { node.children.push(child.specimen); return child; };
    nodes.push(node);
  }
  const reducedQuery = { matches: reduced, addEventListener(_, fn) { this.change = fn; } };
  const window = {
    scrollY: 0, innerHeight: 820,
    document: { getElementById(id) { return ids.get(id) || null; }, querySelectorAll() { return nodes; }, querySelector(selector) { return selector === '#latest video' ? video : null; }, documentElement: { classList: { add() {}, toggle() {} } }, hidden: false, addEventListener(name, fn) { documentEvents[name] = fn; } },
    matchMedia() { return reducedQuery; },
    addEventListener(name, fn) { windowEvents[name] = fn; },
    requestAnimationFrame(fn) { const id = ++serial; callbacks.set(id, fn); return id; },
    cancelAnimationFrame(id) { callbacks.delete(id); },
  };
  window.document.addEventListener = (name, fn) => { documentEvents[name] = fn; };
  const flush = () => { for (const [id, fn] of callbacks) { callbacks.delete(id); fn(); } };
  motion.mount(window);
  return { window, nodes, experiment, video, reducedQuery, callbacks, flush, reads: () => layoutReads, events: windowEvents };
}

test('reduced motion cancels pending frames and can resume cleanly', () => {
  const h = harness();
  assert.ok(h.callbacks.size > 0);
  h.reducedQuery.matches = true;
  h.reducedQuery.change();
  assert.equal(h.callbacks.size, 0);
  h.reducedQuery.matches = false;
  h.reducedQuery.change();
  assert.ok(h.callbacks.size > 0);
  h.flush();
});

test('experiment interaction retires its overlay while film playback stays untouched', () => {
  const h = harness();
  const before = h.video.currentTime;
  h.experiment.fire('input');
  assert.equal(h.nodes[0].attributes['data-motion-retired'], '');
  h.video.fire('play');
  assert.equal(h.nodes[2].attributes['data-motion-retired'], '');
  assert.equal(h.video.currentTime, before);
  assert.equal(h.video.paused, true);
});

test('revealing the experiment keeps its chart uncovered when scrolling back', () => {
  const h = harness();
  h.flush();
  assert.equal(h.nodes[0].attributes['data-motion-retired'], undefined);
  h.window.scrollY = 1200;
  h.events.scroll();
  h.flush();
  assert.equal(h.nodes[0].attributes['data-motion-retired'], '');
  h.window.scrollY = 0;
  h.events.scroll();
  h.flush();
  assert.equal(h.nodes[0].attributes['data-motion-retired'], '');
});

test('a visitor selection owns the mechanism even when scrolling or resizing', () => {
  const h = harness();
  h.flush();
  const mechanism = h.nodes[1];
  const specimen = mechanism.querySelector('.specimen');
  const before = specimen.style['--open'];
  mechanism.dataset.mechanismEngaged = 'true';
  h.window.scrollY = 2300;
  h.events.scroll();
  h.flush();
  assert.equal(specimen.style['--open'], before);
  h.events.resize();
  h.flush();
  assert.equal(specimen.style['--open'], before);
  assert.equal(h.nodes[0].attributes['data-motion-retired'], '');
});

test('scroll updates do not perform layout reads', () => {
  const h = harness();
  h.flush();
  const reads = h.reads();
  h.window.scrollY = 1700;
  h.events.scroll();
  h.flush();
  h.window.scrollY = 2900;
  h.events.scroll();
  h.flush();
  assert.equal(h.reads(), reads);
});
