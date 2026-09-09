const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
function setup() {
  const films = Array.from({ length: 4 }, () => ({
    paused: true,
    pauses: 0,
    pause() {
      this.paused = true;
      this.pauses++;
    },
    addEventListener(type, listener) {
      this[type] = listener;
    },
  }));
  const link = {
    addEventListener(type, listener) {
      this[type] = listener;
    },
  };
  vm.runInNewContext(fs.readFileSync("assets/films.js", "utf8"), {
    document: {
      querySelectorAll: (selector) =>
        selector === ".film-part video" ? films : [link],
    },
  });
  return { films, link };
}
test("playing another film stops the previous audio without pausing the selected film", () => {
  const { films } = setup();
  films[0].paused = false;
  films[2].paused = false;
  films[2].play();
  assert.equal(films[0].paused, true);
  assert.equal(films[2].paused, false);
  assert.equal(films[1].pauses, 0);
});
test("chapter navigation pauses playback and never starts another video", () => {
  const { films, link } = setup();
  films[1].paused = false;
  link.click();
  assert.ok(films.every((film) => film.paused));
  assert.equal(films[1].pauses, 1);
});
