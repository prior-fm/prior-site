const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('../assets/tiny-model.js');
const source = fs.readFileSync('assets/studio.js', 'utf8');

function harness({ reduced = false, missingEngine = false, handoff = false } = {}) {
  const ids = new Map();
  const callbacks = new Map();
  let serial = 0;
  function element(id) {
    if (ids.has(id)) return ids.get(id);
    const el = {
      attributes: {}, listeners: {}, style: { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } },
      hidden: id === 'studio-interactive', value: '74', textContent: '',
      classList: { add() {}, remove() {} },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      setAttribute(name, value) { this.attributes[name] = value; },
      fire(name) { this.listeners[name]?.(); },
    };
    ids.set(id, el);
    return el;
  }
  element('studio-points').lastElementChild = element('point');
  const media = { matches: reduced, addEventListener(_, fn) { this.change = fn; } };
  const motion = { matches: reduced, addEventListener(_, fn) { this.change = fn; } };
  const events = {};
  const docEvents = {};
  const stage = element('stage');
  const object = element('object');
  let parent = stage;
  let reads = 0;
  const window = {
    PriorTinyModel: missingEngine ? null : engine, scrollY: 0, innerHeight: 900,
    matchMedia: (query) => query.includes('max-width') || query.includes('max-height') ? motion : media,
    addEventListener(name, fn) { events[name] = fn; },
  };
  stage.offsetHeight = 900;
  stage.getBoundingClientRect = () => { reads++; return { top: 0 }; };
  stage.insertBefore = () => { parent = stage; };
  object.getBoundingClientRect = () => { reads++; return { left: 780, top: 200, width: 350 }; };
  object.nextSibling = element('next');
  const journey = element('journey');
  journey.offsetHeight = 4500;
  journey.getBoundingClientRect = () => { reads++; return { top: -window.scrollY }; };
  element('studio-dock').getBoundingClientRect = () => { reads++; return { top: 4820 - window.scrollY, left: 50, width: 550 }; };
  const document = {
    hidden: false,
    getElementById: element,
    querySelector: (selector) => handoff ? ({ '.journey-object': object, '.stage': stage, '.journey': journey }[selector]) : null,
    documentElement: { classList: { contains: () => true } },
    body: { appendChild() { parent = document.body; } },
    addEventListener(name, fn) { docEvents[name] = fn; },
  };
  const flush = () => {
    let guard = 0;
    while (callbacks.size) {
      assert.ok(guard++ < 200, 'animation must finish');
      const [id, callback] = callbacks.entries().next().value;
      callbacks.delete(id);
      callback();
    }
  };
  vm.runInNewContext(source, {
    window, document, console,
    requestAnimationFrame(fn) { callbacks.set(++serial, fn); return serial; },
    cancelAnimationFrame(id) { callbacks.delete(id); },
  });
  flush();
  return { element, flush, media, motion, events, docEvents, document, window, callbacks, object, stage, parent: () => parent, reads: () => reads };
}

test('homepage experiment trains with the shared engine and reports calculated error', () => {
  const h = harness();
  assert.equal(h.element('studio-interactive').hidden, false);
  h.element('studio-train').fire('click');
  h.flush();
  const training = engine.DEFAULT_TRAINING.map((p, i) => ({ ...p, y: i === 4 ? .74 : p.y }));
  let expected = engine.initial();
  for (let i = 0; i < 120; i++) expected = engine.step(expected, training, .25);
  assert.equal(h.element('studio-line').attributes.d, `M48 ${(266 - 236 * engine.predict(expected, 0)).toFixed(2)}L392 ${(266 - 236 * engine.predict(expected, 1)).toFixed(2)}`);
  assert.ok(h.element('studio-status').textContent.includes((Math.sqrt(engine.loss(expected, training)) * 100).toFixed(1)));
  assert.equal(h.element('studio-train').disabled, false);
});

test('editing interrupts training without silently retraining; reset cancels queued frames', () => {
  const h = harness();
  h.element('studio-train').fire('click');
  const previous = h.element('studio-line').attributes.d;
  h.element('studio-example').value = '15';
  h.element('studio-example').fire('input');
  h.flush();
  assert.equal(h.element('studio-line').attributes.d, previous);
  assert.equal(h.element('point').attributes.cy, '230.60');
  h.element('studio-train').fire('click');
  h.element('studio-reset').fire('click');
  h.flush();
  assert.equal(h.element('studio-example').value, '74');
  assert.equal(h.element('studio-line').attributes.d, 'M48 77.20L392 159.80');
});

test('reduced motion reaches the same answer immediately and responds mid-training', () => {
  const still = harness({ reduced: true });
  still.element('studio-train').fire('click');
  assert.equal(still.callbacks.size, 0);
  const moving = harness();
  moving.element('studio-train').fire('click');
  moving.media.matches = true;
  moving.media.change();
  assert.equal(moving.callbacks.size, 0);
  assert.equal(moving.element('studio-line').attributes.d, still.element('studio-line').attributes.d);
});

test('missing model engine preserves readable fallback and hides inactive controls', () => {
  const h = harness({ missingEngine: true });
  assert.equal(h.element('studio-interactive').hidden, true);
  assert.equal(h.element('studio-fallback').hidden, false);
});

test('tile handoff reverses, clears under reduced motion, and reads no layout during scrolling', () => {
  const h = harness({ handoff: true });
  const reads = h.reads();
  h.window.scrollY = 3900;
  h.events.scroll(); h.flush();
  assert.equal(h.parent(), h.document.body);
  assert.ok(Number(h.object.style['--handoff']) > 0 && Number(h.object.style['--handoff']) < 1);
  assert.ok(!/NaN|Infinity/.test(h.object.style.transform));
  assert.equal(h.reads(), reads);
  h.window.scrollY = 6000;
  h.events.scroll(); h.flush();
  assert.equal(h.object.style.visibility, 'hidden');
  h.window.scrollY = 2000;
  h.events.scroll(); h.flush();
  assert.equal(h.parent(), h.stage);
  assert.equal(h.object.style['--handoff'], undefined);
  assert.equal(h.object.style.transform, undefined);
  h.window.scrollY = 3900;
  h.events.scroll(); h.flush();
  h.motion.matches = true;
  h.motion.change();
  assert.equal(h.parent(), h.stage);
});

test('using the experiment dismisses the travelling object on later scrolls', () => {
  const h = harness({ handoff: true });
  h.window.scrollY = 3900;
  h.events.scroll(); h.flush();
  assert.equal(h.object.style.visibility, 'visible');
  h.element('studio-interactive').fire('pointerdown');
  assert.equal(h.object.style.visibility, 'hidden');
  h.window.scrollY = 4000;
  h.events.scroll(); h.flush();
  assert.equal(h.object.style.visibility, 'hidden');
  h.window.scrollY = 2000;
  h.events.scroll(); h.flush();
  assert.equal(h.parent(), h.stage);
  assert.equal(h.object.style.visibility, undefined);
});
