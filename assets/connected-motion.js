/* Matched tile, exploded mechanism and portrait-film transformations.
   Geometry is measured only on layout changes; scroll updates visual styles. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.PriorConnectedMotion = api; api.mount(root); }
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";
  const clamp = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
  const ease = (n) => { n = clamp(n); return n * n * (3 - 2 * n); };
  const between = (p, a, b) => ease((p - a) / (b - a));
  function state(kind, progress) {
    const p = clamp(progress);
    if (kind === "experiment") return { open: between(p, .05, .48), rotate: between(p, .1, .65), reveal: between(p, .42, .82), door: 0, opacity: 1 };
    if (kind === "film") return { open: 0, rotate: between(p, .04, .72), reveal: 0, door: .18 + .82 * between(p, .04, .72), opacity: 1 - between(p, .76, .9) };
    return { open: between(p, .08, .75), rotate: between(p, .15, .8) * .6, reveal: 0, door: 0, opacity: 1 };
  }
  function progress(scroll, top, height, viewport) {
    return clamp((scroll + viewport * .94 - top) / Math.max(1, Math.min(height * .85, viewport * .6) + viewport * .3));
  }
  function mount(win) {
    const doc = win.document;
    const template = doc.getElementById("motion-specimen");
    if (!template) return;
    const nodes = [...doc.querySelectorAll("[data-motion-scene]")];
    if (!nodes.length) return;
    const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    const records = nodes.map((el) => {
      const kind = el.dataset.motionScene;
      const clone = template.content.cloneNode(true);
      if (kind !== "film") clone.querySelector(".specimen-door").remove();
      // The template's layers already follow examples → connections → output.
      // Each stage has a role: working surface, mechanism, then real film frame.
      el.appendChild(clone);
      return { el, kind, specimen: el.querySelector(".specimen"), top: 0, height: 0, retired: false, lastProgress: null };
    });
    let viewport = win.innerHeight;
    let frame = 0;
    let enabled = !reduced.matches;
    const render = () => {
      frame = 0;
      if (!enabled || doc.hidden) return;
      records.forEach((r) => {
        if (r.retired || r.el.dataset.mechanismEngaged === "true") return;
        const p = progress(win.scrollY, r.top, r.height, viewport);
        if (p === r.lastProgress) return;
        r.lastProgress = p;
        // Once the chart is revealed, rereading never covers it again.
        if (r.kind === "experiment" && p >= .82) {
          r.retired = true;
          r.el.setAttribute("data-motion-retired", "");
          return;
        }
        const s = state(r.kind, p);
        for (const key of ["open", "rotate", "reveal", "door"]) r.specimen.style.setProperty(`--${key}`, s[key].toFixed(4));
        r.el.style.setProperty("--scene-opacity", s.opacity.toFixed(4));
        // A visible final chart stays visible; only decorative surfaces reverse.
        r.el.style.visibility = r.kind === "experiment" && p >= .82 || r.kind === "film" && p >= .9 ? "hidden" : "visible";
      });
    };
    const schedule = () => { if (enabled && !frame && !doc.hidden) frame = win.requestAnimationFrame(render); };
    const measure = () => {
      viewport = win.innerHeight;
      records.forEach((r) => {
        if (r.retired) return;
        const box = r.el.getBoundingClientRect();
        r.top = box.top + win.scrollY;
        r.height = box.height;
      });
      schedule();
    };
    const retire = (kind) => {
      records.filter((r) => r.kind === kind).forEach((r) => { r.retired = true; r.el.setAttribute("data-motion-retired", ""); });
    };
    const experiment = doc.getElementById("studio-interactive");
    if (experiment) for (const event of ["pointerdown", "focusin", "input", "click"]) experiment.addEventListener(event, () => retire("experiment"), { once: true });
    const video = doc.querySelector("#latest video");
    if (video) {
      for (const event of ["play", "pointerdown", "focusin"]) video.addEventListener(event, () => retire("film"), { once: true });
      if (!video.paused) retire("film");
    }
    const configure = () => {
      enabled = !reduced.matches;
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0;
      doc.documentElement.classList.toggle("connected-motion-still", !enabled);
      records.forEach((r) => { r.lastProgress = null; r.specimen.style.cssText = ""; r.el.style.cssText = ""; });
      measure();
    };
    doc.documentElement.classList.add("connected-motion-ready");
    win.addEventListener("scroll", schedule, { passive: true });
    win.addEventListener("resize", measure, { passive: true });
    win.addEventListener("pageshow", measure);
    doc.addEventListener("visibilitychange", schedule);
    reduced.addEventListener("change", configure);
    if (win.ResizeObserver) {
      const observer = new win.ResizeObserver(measure);
      for (const selector of ["#experiment", "#learn", "#latest"]) {
        const section = doc.querySelector(selector);
        if (section) observer.observe(section);
      }
    }
    if (doc.fonts) doc.fonts.ready.then(measure);
    configure();
  }
  return { state, progress, mount };
});
