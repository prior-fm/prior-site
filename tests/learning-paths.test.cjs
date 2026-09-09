const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("assets/learning-paths.js", "utf8");

function run(url) {
  const classes = new Set();
  const listeners = {};
  const total = { textContent: "" };
  const sections = [1, 2, 3, 4].map((part) => ({
    attrs: { "data-part": String(part) },
    classList: {
      toggle(name, value) {
        this[name] = value;
      },
      remove() {},
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    getAttribute(name) {
      return this.attrs[name];
    },
  }));
  const buttons = [30, 90, 150, 240].map((hours) => ({
    attrs: { "data-hours": String(hours) },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    getAttribute(name) {
      return this.attrs[name];
    },
    addEventListener(name, handler) {
      this.handler = handler;
    },
  }));
  const links = ["basics", "deeper", "all"].map((path) => ({
    attrs: { "data-path-link": path },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    getAttribute(name) {
      return this.attrs[name];
    },
  }));
  const elements = {
    ".hrs": buttons,
    ".block": sections,
    "[data-path-link]": links,
  };
  const context = {
    URLSearchParams,
    location: {
      search: new URL(url).search,
      hash: new URL(url).hash,
      pathname: new URL(url).pathname,
    },
    history: {
      replaceState(state, title, next) {
        context.location.search = new URL(`https://prior.test${next}`).search;
        context.location.hash = new URL(`https://prior.test${next}`).hash;
      },
    },
    window: {
      addEventListener(type, handler) {
        listeners[type] = handler;
      },
    },
    document: {
      documentElement: {
        classList: {
          add(name) {
            classes.add(name);
          },
          remove(...names) {
            names.forEach((name) => classes.delete(name));
          },
        },
      },
      querySelectorAll(selector) {
        return elements[selector] || [];
      },
      getElementById() {
        return total;
      },
    },
  };
  vm.runInNewContext(source, context);
  return {
    classes,
    sections,
    links,
    buttons,
    location: context.location,
    total,
    listeners,
  };
}

let result = run(
  "https://prior-fm.github.io/prior-site/roadmap.html?path=basics#part-1",
);
assert(result.classes.has("path-basics"));
assert.deepStrictEqual(
  result.sections.map((s) => s.classList.off),
  [false, true, true, true],
);
assert.strictEqual(result.links[0].attrs["aria-current"], "page");

result = run(
  "https://prior-fm.github.io/prior-site/roadmap.html?path=deeper#part-3",
);
assert(result.classes.has("path-deeper"));
assert.deepStrictEqual(
  result.sections.map((s) => s.classList.off),
  [true, true, false, false],
);
assert.strictEqual(result.links[1].attrs["aria-current"], "page");
assert(result.total.textContent.includes("8 ideas, 8 free sources"));

result = run("https://prior-fm.github.io/prior-site/roadmap.html#90");
assert(result.classes.has("path-all"));
assert.deepStrictEqual(
  result.sections.map((s) => s.classList.off),
  [false, false, true, true],
);

result = run(
  "https://prior-fm.github.io/prior-site/roadmap.html?path=deeper#30",
);
assert(result.classes.has("path-all"));
assert.deepStrictEqual(
  result.sections.map((s) => s.classList.off),
  [false, true, true, true],
);

result = run(
  "https://prior-fm.github.io/prior-site/roadmap.html?path=%E0%A4%A#240",
);
assert(result.classes.has("path-all"));

result = run(
  "https://prior-fm.github.io/prior-site/roadmap.html?path=basics#240",
);
result.buttons[3].handler();
assert(result.classes.has("path-all"));
assert.strictEqual(result.location.search, "");

result = run("https://prior.test/roadmap.html?path=toString");
assert(result.classes.has("path-all"));
result = run("https://prior.test/roadmap.html?path=basics#part-1");
assert(result.total.textContent.startsWith("Foundations path: part 1"));
assert(
  result.buttons.every((button) => button.attrs["aria-pressed"] === "false"),
);
result.buttons[2].handler();
assert(!result.classes.has("path-basics"));
assert.deepStrictEqual(
  result.sections.map((s) => s.classList.off),
  [false, false, false, true],
);
result.location.hash = "#90";
result.listeners.hashchange();
assert.deepStrictEqual(
  result.sections.map((s) => s.classList.off),
  [false, false, true, true],
);
result.location.search = "?path=deeper";
result.location.hash = "#part-3";
result.listeners.popstate();
assert(result.classes.has("path-deeper"));
assert(!result.classes.has("path-all"));
assert.deepStrictEqual(
  result.sections.map((s) => s.classList.off),
  [true, true, false, false],
);
assert(result.total.textContent.startsWith("Deeper path: parts 3 to 4"));
console.log(
  "learning paths: route selection, hours, malformed input, totals and history pass",
);
