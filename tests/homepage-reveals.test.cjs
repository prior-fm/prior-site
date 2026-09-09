const test = require('node:test');
const assert = require('node:assert/strict');
const { mount } = require('../assets/homepage-reveals.js');

function node({ id = '', top = 100, height = 120, className = '' } = {}) {
  const listeners = new Map();
  const el = {
    id, className, dataset: {}, children: [], parentElement: null, layoutReads: 0, listeners,
    getBoundingClientRect() { this.layoutReads += 1; return { top, bottom: top + height, height }; },
    addEventListener(type, fn) { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); },
    contains(target) { return target === el || el.children.some((child) => child.contains(target)); },
    querySelectorAll(selector) { return selector === '.issue-art' ? el.children : []; },
    querySelector(selector) { return selector === '.archive-filters' ? el.filters : null; },
  };
  return el;
}

function harness({ io = true, reduced = false } = {}) {
  const archive = node({ id: 'archive' });
  const arts = [1, 2, 3, 4].map((i) => node({ id: `art-${i}`, className: 'issue-art' }));
  const titles = arts.map((_, i) => Object.assign(node(), { textContent: `Issue ${i + 1}` }));
  const cards = arts.map((art, i) => {
    const card = node({ className: 'issue-card' });
    card.children = [art, titles[i]]; art.parentElement = card; titles[i].parentElement = card;
    return card;
  });
  archive.children = cards;
  archive.querySelectorAll = (selector) => selector === '.issue-art' ? arts : [];
  const filter = node(); archive.filters = filter;
  const paths = node({ id: 'paths' }); paths.dataset.homeReveal = 'paths';
  const statement = node({ id: 'statement' }); statement.dataset.homeReveal = 'statement';
  const statementFrame = node(); statementFrame.children = [statement]; statement.parentElement = statementFrame;
  const nodes = [paths, statement, ...arts];
  const observers = []; const timers = new Map(); let nextTimer = 0;
  const media = { matches: reduced, addEventListener(type, fn) { this.change = fn; } };
  const win = {
    document: {
      getElementById(id) { return id === 'archive' ? archive : nodes.find((el) => el.id === id) || null; },
      querySelectorAll(selector) { return selector === '[data-home-reveal]' ? nodes : []; },
      addEventListener(type, fn) { this.listeners = this.listeners || new Map(); const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); },
    },
    matchMedia() { return media; },
    addEventListener(type, fn) { this.listeners = this.listeners || new Map(); const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); },
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    flush() { [...timers.values()].forEach((fn) => fn()); timers.clear(); },
    location: { hash: '' },
    IntersectionObserver: io ? class {
      constructor(callback, options) { this.callback = callback; this.options = options; this.observed = []; observers.push(this); }
      observe(el) { this.observed.push(el); }
      unobserve(el) { this.observed = this.observed.filter((item) => item !== el); }
      disconnect() { this.disconnected = true; }
    } : undefined,
  };
  mount(win);
  return { win, archive, filter, arts, cards, titles, media, paths, statement, statementFrame, nodes, observer: observers[0] };
}

test('intersection reveals art while leaving readable copy available', () => {
  const h = harness();
  const copy = h.titles[0].textContent;
  h.observer.callback([{ target: h.arts[0].parentElement, isIntersecting: true }]);
  assert.equal(h.arts[0].dataset.revealState, 'entering');
  assert.equal(h.titles[0].textContent, copy);
  assert.equal(h.titles[0].dataset.revealState, undefined);
  assert.equal(h.arts[1].dataset.revealState, 'waiting');
  h.win.flush();
  assert.equal(h.arts[0].dataset.revealState, 'settled');
});

test('reverse intersection does not replay settled art', () => {
  const h = harness();
  h.observer.callback([{ target: h.arts[0].parentElement, isIntersecting: true }]); h.win.flush();
  h.observer.callback([{ target: h.arts[0].parentElement, isIntersecting: false }, { target: h.arts[0].parentElement, isIntersecting: true }]);
  assert.equal(h.arts[0].dataset.revealState, 'settled');
});

test('focus and archive filter interactions settle artwork immediately', () => {
  const h = harness();
  const card = h.cards[1];
  const focused = { closest: (selector) => selector === '.issue-card' ? card : null };
  h.win.document.listeners.get('focusin')[0]({ target: focused });
  assert.equal(h.arts[1].dataset.revealState, 'settled');
  const filterTarget = { closest: (selector) => selector === '[data-topic-filter]' ? filterTarget : null };
  h.filter.listeners.get('click')[0]({ target: filterTarget });
  assert.ok(h.arts.every((art) => art.dataset.revealState === 'settled'));
});

test('missing observer and reduced motion preserve visible settled content', () => {
  for (const options of [{ io: false }, { reduced: true }]) {
    const h = harness(options);
    assert.ok(h.arts.concat([h.paths, h.statement]).every((el) => el.dataset.revealState === 'settled'));
  }
});

test('uses stable observer frames, measures once, and has no scroll handler', () => {
  const h = harness();
  assert.equal(h.observer.options.rootMargin, '0px 0px -6% 0px');
  const readsAfterMount = h.nodes.reduce((sum, el) => sum + (el.parentElement || el).layoutReads, 0);
  assert.ok(h.observer.observed.includes(h.statementFrame));
  assert.ok(!h.observer.observed.includes(h.statement));
  assert.ok(h.cards.every((card) => h.observer.observed.includes(card)));
  h.observer.callback([{ target: h.cards[0], isIntersecting: true }]);
  assert.equal(h.nodes.reduce((sum, el) => sum + (el.parentElement || el).layoutReads, 0), readsAfterMount);
  assert.equal(h.win.listeners?.has('scroll') || false, false);
  h.win.listeners.get('pageshow')[0]({ persisted: true });
  assert.equal(h.observer.disconnected, true);
});

test('reduced motion and direct section links settle pending entrances', () => {
  const h = harness();
  h.win.location.hash = '#archive';
  h.win.listeners.get('hashchange')[0]();
  assert.ok(h.arts.every((art) => art.dataset.revealState === 'settled'));
  assert.equal(h.statement.dataset.revealState, 'waiting');
  h.media.matches = true;
  h.media.change();
  assert.ok(h.nodes.every((el) => el.dataset.revealState === 'settled'));
  assert.equal(h.observer.disconnected, true);
});

console.log('homepage reveals: scoped entrances, persistence, fallbacks and lifecycle pass');
