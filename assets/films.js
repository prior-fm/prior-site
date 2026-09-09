/* Keep native video controls and prevent overlapping film audio. */
(() => {
  "use strict";
  const films = [...document.querySelectorAll(".film-part video")];
  if (!films.length) return;
  const pauseOthers = (active) => {
    films.forEach((film) => {
      if (film !== active && !film.paused) film.pause();
    });
  };
  films.forEach((film) =>
    film.addEventListener("play", () => pauseOthers(film)),
  );
  document.querySelectorAll('a[href^="#film-"]').forEach((link) => {
    link.addEventListener("click", () => pauseOthers(null));
  });
})();
