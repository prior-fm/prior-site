const test = require('node:test');
const assert = require('node:assert/strict');

const { mount } = require('../assets/mechanism-explorer.js');

function makeElement(attrs = {}) {
  return {
    dataset: {},
    attributes: { ...attrs },
    hidden: false,
    textContent: 'static explanation',
    listeners: new Map(),
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    addEventListener(name, fn) {
      const list = this.listeners.get(name) || [];
      list.push(fn);
      this.listeners.set(name, list);
    },
    click(name = 'click') {
      (this.listeners.get(name) || []).forEach((fn) => fn());
    },
  };
}

function harness({ missingDiagram = false, incomplete = false } = {}) {
  const root = makeElement();
  root.dataset = {};
  const controls = makeElement();
  controls.hidden = true;
  const instruction = makeElement();
  instruction.hidden = true;
  const buttons = ['examples', 'relationships', 'prediction'].map((step) => {
    const button = makeElement();
    button.dataset.mechanismStep = step;
    return button;
  });
  const details = ['examples', 'relationships', 'prediction']
    .filter((step) => !incomplete || step !== 'prediction')
    .map((step) => {
      const detail = makeElement();
      detail.dataset.mechanismDetail = step;
      detail.hidden = false;
      return detail;
    });
  const stage = missingDiagram ? null : makeElement();
  if (stage) {
    stage.dataset = {};
    stage.plates = ['.specimen-front', '.specimen-middle', '.specimen-back']
      .map(() => makeElement());
    stage.querySelector = (selector) => {
      const index = ['.specimen-front', '.specimen-middle', '.specimen-back'].indexOf(selector);
      return index < 0 ? null : stage.plates[index];
    };
    stage.querySelector('.specimen');
    stage.hasSpecimen = true;
  }
  root.querySelectorAll = (selector) => {
    if (selector === '[data-mechanism-step]') return buttons;
    if (selector === '[data-mechanism-detail]') return details;
    return [];
  };
  root.querySelector = (selector) => ({
    '.mechanism-controls': controls,
    '.mechanism-mount': stage,
    '.mechanism-instruction': instruction,
  }[selector] || null);
  const originalStageQuery = stage && stage.querySelector;
  if (stage) stage.querySelector = (selector) => {
    if (selector === '.specimen') return stage.hasSpecimen ? makeElement() : null;
    return originalStageQuery(selector);
  };
  const document = { getElementById(id) { return id === 'mechanism-explorer' ? root : null; } };
  return { document, root, controls, instruction, buttons, details, stage };
}

test('mount exposes one readable active layer and hides the other panels', () => {
  const h = harness();
  mount(h.document);
  assert.equal(h.root.dataset.explorerReady, 'true');
  assert.equal(h.root.dataset.mechanismSelected, 'examples');
  assert.deepEqual(h.buttons.map((button) => button.getAttribute('aria-pressed')), ['true', 'false', 'false']);
  assert.deepEqual(h.details.map((detail) => detail.hidden), [false, true, true]);
  assert.equal(h.controls.hidden, false);
  assert.equal(h.instruction.hidden, false);
  assert.match(h.instruction.textContent, /Tap a layer/);
  assert.equal(h.stage.dataset.mechanismEngaged, undefined);
});

test('choosing a button and tapping its matching plate produce the same selected state', () => {
  const h = harness();
  mount(h.document);
  h.buttons[1].click();
  assert.equal(h.root.dataset.mechanismSelected, 'relationships');
  assert.deepEqual(h.details.map((detail) => detail.hidden), [true, false, true]);
  assert.equal(h.stage.dataset.mechanismEngaged, 'true');
  h.stage.plates[2].click();
  assert.equal(h.root.dataset.mechanismSelected, 'prediction');
  assert.deepEqual(h.buttons.map((button) => button.getAttribute('aria-pressed')), ['false', 'false', 'true']);
  assert.deepEqual(h.details.map((detail) => detail.hidden), [true, true, false]);
});

test('repeated mount is idempotent and does not duplicate button or plate listeners', () => {
  const h = harness();
  mount(h.document);
  mount(h.document);
  assert.equal(h.buttons[2].listeners.get('click').length, 1);
  assert.equal(h.stage.plates[0].listeners.get('click').length, 1);
  h.buttons[2].click();
  assert.equal(h.root.dataset.mechanismSelected, 'prediction');
});

test('a missing illustration keeps the textual controls usable', () => {
  const h = harness({ missingDiagram: true });
  mount(h.document);
  assert.equal(h.root.dataset.explorerReady, 'true');
  assert.match(h.instruction.textContent, /Choose a stage/);
  h.buttons[2].click();
  assert.equal(h.root.dataset.mechanismSelected, 'prediction');
  assert.equal(h.stage, null);
});

test('incomplete markup preserves static content and remains unmounted', () => {
  const h = harness({ incomplete: true });
  const before = h.details[0].textContent;
  mount(h.document);
  assert.equal(h.root.dataset.explorerReady, undefined);
  assert.equal(h.controls.hidden, true);
  assert.equal(h.details[0].textContent, before);
  assert.equal(h.buttons[0].listeners.has('click'), false);
});

console.log('mechanism explorer: accessible selection, plate parity, fallback and idempotent mount pass');
