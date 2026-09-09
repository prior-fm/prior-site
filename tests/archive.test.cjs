const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function setup() {
  const cards = ["ai", "systems", "intuition", "ai"].map((topic) => ({
    dataset: { topic },
    hidden: false,
  }));
  const buttons = ["all", "ai", "systems", "intuition"].map((topic) => ({
    dataset: { topicFilter: topic },
    textContent: topic,
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    addEventListener(name, fn) {
      this[name] = fn;
    },
  }));
  const controls = { hidden: true };
  const status = { hidden: true, textContent: "" };
  const grid = {
    children: [],
    appendChild(card) {
      this.children.push(card);
    },
  };
  const earlier = {
    remove() {
      this.removed = true;
    },
  };
  const archive = {
    querySelector: (selector) =>
      ({
        ".archive-filters": controls,
        ".archive-status": status,
        ".issue-grid": grid,
        ".archive-more": earlier,
      })[selector],
    querySelectorAll: (selector) =>
      selector === ".issue-card" ? cards : buttons,
  };
  vm.runInNewContext(fs.readFileSync("assets/archive.js", "utf8"), {
    document: { querySelector: () => archive },
  });
  return { cards, buttons, controls, status, grid, earlier };
}

test("topic discovery includes older issues and exposes one selected filter", () => {
  const h = setup();
  assert.equal(h.controls.hidden, false);
  assert.equal(h.grid.children.length, 4);
  assert.equal(h.earlier.removed, true);
  h.buttons[1].click();
  assert.deepEqual(
    h.cards.map((card) => card.hidden),
    [false, true, true, false],
  );
  assert.equal(h.status.textContent, "2 issues · ai");
  assert.equal(
    h.buttons.filter((button) => button.attrs["aria-pressed"] === "true")
      .length,
    1,
  );
});

test("changing topics then resetting restores every issue and announces the result", () => {
  const h = setup();
  h.buttons[2].click();
  assert.equal(h.status.textContent, "1 issue · systems");
  h.buttons[0].click();
  assert.ok(h.cards.every((card) => !card.hidden));
  assert.equal(h.status.textContent, "4 issues · all");
});
