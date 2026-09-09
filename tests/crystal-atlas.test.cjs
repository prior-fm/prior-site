const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function setup(fail = false) {
  const frames = new Map(), events = {}, calls = [];
  let reads = 0, id = 0;
  const element = () => {
    const classes = new Set();
    return { dataset: {}, children: [], handlers: {}, offsetHeight: 400,
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
      appendChild(child) { child.parentElement = this; this.children.push(child); },
      addEventListener(name, fn) { this.handlers[name] = fn; },
      getBoundingClientRect() { reads++; return { top: (this.top || 0) - context.scrollY }; },
    };
  };
  const hero = element(), learning = element(), journey = element(), stage = element(), explorer = element();
  hero.parentElement = element(); learning.parentElement = element();
  const lens = { dataset: { fallbackSrc: 'media/optical/clear-lens.png' }, getAttribute() { return this.src; } };
  hero.parentElement.querySelector = () => lens;
  learning.parentElement.top = 5000; journey.offsetHeight = 3200; stage.offsetHeight = 800;
  const canvas = element(), instruction = {}, buttons = [element(), element(), element()];
  hero.querySelector = () => canvas;
  explorer.querySelector = () => instruction;
  explorer.querySelectorAll = () => buttons;
  const reduced = { matches: false, addEventListener(_, fn) { this.change = fn; } };
  const compact = { matches: false, addEventListener(_, fn) { this.change = fn; } };
  const body = element();
  const context = { document: {
    body, hidden: false,
    querySelector: s => ({ '.atlas-hero': hero, '.atlas-learning': learning, '.journey': journey, '.stage': stage })[s],
    getElementById: () => explorer,
    addEventListener: (name, fn) => { events[name] = fn; },
  }, matchMedia: s => s.includes('reduced') ? reduced : compact,
    innerHeight: 800, scrollY: 0,
    addEventListener: (name, fn) => { events[name] = fn; },
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: n => frames.delete(n), console: { warn() {} },
    createCrystalScene(mount, options) {
      calls.push(['create', mount, options]);
      if (fail) throw Error('No WebGL');
      return { resize: m => calls.push(['resize', m]), setActive: active => calls.push(['active', active]), setProgress: p => calls.push(['progress', p]),
        setSelection: s => calls.push(['selection', s]), destroy: () => calls.push(['destroy']) };
    },
  };
  context.window = context;
  const source = fs.readFileSync('assets/crystal-atlas.js', 'utf8')
    .replace(/const \{ createCrystalScene \} = await import\('\.\/design-crystals\.js(?:\?[^']*)?'\);/, '');
  await vm.runInNewContext(`(async () => { ${source} })()`, context);
  const flush = () => { for (const [key, fn] of [...frames]) { frames.delete(key); fn(); } };
  flush();
  return { context, calls, events, flush, hero, learning, explorer, canvas, buttons, reduced, body, lens, reads: () => reads, frames };
}

test('one approved scene moves between chapters and reuses the existing learning selection', async () => {
  const s = await setup();
  assert.equal(s.calls.filter(c => c[0] === 'create').length, 1);
  assert.equal(s.calls[0][2].atlasOnly, true);
  const before = s.reads();
  s.context.scrollY = 4800; s.events.scroll(); s.flush();
  assert.equal(s.canvas.parentElement, s.learning);
  s.explorer.dataset.mechanismSelected = 'prediction';
  s.buttons[2].handlers.click(); s.flush();
  assert.equal(s.calls.filter(c => c[0] === 'selection').at(-1)[1], 2);
  s.context.scrollY = 100; s.events.scroll(); s.flush();
  assert.equal(s.canvas.parentElement, s.hero);
  assert.equal(s.reads(), before, 'scroll and selection must not trigger layout reads');
  assert.equal(s.frames.size, 0, 'no idle animation loop');
});

test('reduced motion keeps a static crystal pose and hidden pages do not update', async () => {
  const s = await setup();
  s.reduced.matches = true; s.reduced.change();
  s.context.scrollY = 4800; s.events.scroll(); s.flush();
  assert.equal(s.calls.filter(c => c[0] === 'progress').at(-1)[1], .45);
  const count = s.calls.filter(c => c[0] === 'progress').length;
  s.context.document.hidden = true; s.events.scroll(); s.flush();
  assert.equal(s.calls.filter(c => c[0] === 'progress').length, count);
  assert.equal(s.calls.at(-1)[1], false, 'hidden tabs suspend the renderer');
});

test('WebGL failure and context loss restore the readable legacy illustration', async () => {
  const failed = await setup(true);
  assert.equal(failed.body.classList.contains('atlas-active'), false);
  assert.equal(failed.lens.src, failed.lens.dataset.fallbackSrc);
  const s = await setup();
  assert.equal(s.lens.src, undefined, 'successful WebGL must not download the legacy lens');
  s.canvas.handlers.webglcontextlost({ preventDefault() {} });
  assert.equal(s.body.classList.contains('atlas-active'), false);
  assert.equal(s.hero.parentElement.classList.contains('atlas-ready'), false);
  assert.equal(s.learning.parentElement.classList.contains('atlas-ready'), false);
  assert.equal(s.calls.filter(c => c[0] === 'destroy').length, 1);
  assert.equal(s.lens.src, s.lens.dataset.fallbackSrc);
});

test('offscreen illustrations suspend rendering and defer resize until visible', async () => {
  const s = await setup();
  s.context.scrollY = 7000; s.events.scroll(); s.flush();
  const resizes = s.calls.filter(c => c[0] === 'resize').length;
  s.events.resize(); s.flush();
  assert.equal(s.calls.filter(c => c[0] === 'resize').length, resizes);
  assert.equal(s.calls.filter(c => c[0] === 'active').at(-1)[1], false);
  s.context.scrollY = 0; s.events.scroll(); s.flush();
  assert.equal(s.calls.filter(c => c[0] === 'active').at(-1)[1], true);
  assert.equal(s.calls.filter(c => c[0] === 'resize').length, resizes + 1);
});

test('touch and constrained devices get bounded graphics settings without changing desktop defaults', async () => {
  const { crystalRenderBudget } = await import('../assets/design-crystals.js');
  const desktop = crystalRenderBudget();
  const phone = crystalRenderBudget({ coarsePointer: true });
  const lowPower = crystalRenderBudget({ hardwareConcurrency: 4 });
  assert.equal(desktop.pixelRatio, 1.5);
  assert.ok(phone.pixelRatio < desktop.pixelRatio);
  assert.ok(phone.shadowSize < desktop.shadowSize);
  assert.equal(phone.powerPreference, 'default');
  assert.equal(lowPower.pixelRatio, 1);
  assert.equal(crystalRenderBudget({ saveData: true }).pixelRatio, 1);
  assert.equal(crystalRenderBudget({ hardwareConcurrency: undefined }).pixelRatio, desktop.pixelRatio);
});
