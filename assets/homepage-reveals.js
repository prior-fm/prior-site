/* Once-only entrances. No scroll handler, model changes or playback control. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else api.mount(root);
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";
  function mount(win) {
    const doc = win.document;
    const archive = doc.getElementById("archive");
    if (!archive || archive.dataset.revealsMounted === "true") return;
    const illustrations = [...archive.querySelectorAll(".issue-art")];
    illustrations.forEach((el, index) => {
      el.dataset.homeReveal = "art";
      el.dataset.revealWeight = index < 3 ? "leading" : "quiet";
    });
    const nodes = [...doc.querySelectorAll("[data-home-reveal]")];
    if (!nodes.length) return;
    archive.dataset.revealsMounted = "true";
    const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    const timers = new Map();
    // Observe stable frames, never the image/text whose mask is being changed.
    const targets = new Map(nodes.map((el) => [el,
      el.dataset.homeReveal === "paths" ? el : el.parentElement || el]));
    let observer;
    function settle(el) {
      if (timers.has(el)) { win.clearTimeout(timers.get(el)); timers.delete(el); }
      el.dataset.revealState = "settled";
      if (observer) observer.unobserve(targets.get(el));
    }
    function settleAll() { nodes.forEach(settle); }
    function enter(el) {
      if (el.dataset.revealState !== "waiting") return;
      if (reduced.matches) { settle(el); return; }
      el.dataset.revealState = "entering";
      observer.unobserve(targets.get(el));
      // Cleanup is independent of animationend, including backgrounded pages.
      timers.set(el, win.setTimeout(() => settle(el), 850));
    }
    function revealHashTarget() {
      let id;
      try { id = decodeURIComponent((win.location.hash || "").slice(1)); } catch (_) { return; }
      const target = id && doc.getElementById(id);
      if (target) nodes.forEach((el) => { if (target === el || target.contains(el) || el.contains(target)) settle(el); });
    }
    if (!win.IntersectionObserver || reduced.matches) { settleAll(); return; }
    observer = new win.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) nodes.forEach((el) => { if (targets.get(el) === entry.target) enter(el); });
      });
    }, { threshold: 0, rootMargin: "0px 0px -6% 0px" });
    nodes.forEach((el) => {
      // Preserve restored/deep-linked content already above the viewport.
      const target = targets.get(el);
      const box = target.getBoundingClientRect();
      if (box.bottom <= 0 && box.height > 0) settle(el);
      else { el.dataset.revealState = "waiting"; observer.observe(target); }
    });
    revealHashTarget();
    doc.addEventListener("focusin", (event) => {
      const card = event.target.closest && event.target.closest(".issue-card");
      if (card) illustrations.forEach((el) => { if (card.contains(el)) settle(el); });
      nodes.forEach((el) => { if (el.contains(event.target)) settle(el); });
    });
    const filters = archive.querySelector(".archive-filters");
    if (filters) filters.addEventListener("click", (event) => {
      if (event.target.closest && event.target.closest("[data-topic-filter]")) illustrations.forEach(settle);
    });
    reduced.addEventListener("change", () => { if (reduced.matches) { settleAll(); observer.disconnect(); } });
    win.addEventListener("hashchange", revealHashTarget);
    win.addEventListener("pageshow", (event) => { if (event.persisted) { settleAll(); observer.disconnect(); } });
  }
  return { mount };
});
