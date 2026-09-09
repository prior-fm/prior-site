/* A real, small experiment; no model downloads or external services. */
(() => {
  "use strict";
  const section = document.getElementById("experiment");
  const engine = window.PriorTinyModel;
  if (!section || !engine) return;
  const $ = (id) => document.getElementById(id);
  const input = $("studio-example");
  const value = $("studio-example-value");
  const train = $("studio-train");
  const reset = $("studio-reset");
  const status = $("studio-status");
  const line = $("studio-line");
  const lastPoint = $("studio-points").lastElementChild;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let model = engine.initial();
  let frame = 0;
  let remaining = 0;
  let startError = 0;
  const points = () => engine.DEFAULT_TRAINING.map((p, i, all) => ({
    x: p.x, y: i === all.length - 1 ? Number(input.value) / 100 : p.y,
  }));
  const error = () => Math.sqrt(engine.loss(model, points())) * 100;
  const draw = () => {
    const y = (x) => (266 - 236 * engine.predict(model, x)).toFixed(2);
    line.setAttribute("d", `M48 ${y(0)}L392 ${y(1)}`);
    lastPoint.setAttribute("cy", (266 - 236 * Number(input.value) / 100).toFixed(2));
    value.textContent = input.value;
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    remaining = 0;
    train.disabled = false;
    train.textContent = model.steps ? "Learn again" : "Let it learn";
  };
  const finish = () => {
    stop();
    const end = error();
    status.textContent = `Overall error: ${startError.toFixed(1)} → ${end.toFixed(1)} points on the 0–100 scale. ${Number(input.value) < 50 ? "The changed example pulls the line away from the original pattern." : "Training balances the mistakes across the examples."}`;
    $("studio-chart-desc").textContent = `The solid line is the trained prediction. The dashed line is its starting point. Its root mean squared error on the current examples is ${end.toFixed(1)} points on a 0 to 100 scale. The clay point is the example you can change.`;
  };
  const advance = () => {
    frame = 0;
    const batch = reduced.matches ? remaining : Math.min(4, remaining);
    for (let i = 0; i < batch; i++) model = engine.step(model, points(), .25);
    remaining -= batch;
    draw();
    if (remaining > 0) frame = requestAnimationFrame(advance);
    else finish();
  };
  train.addEventListener("click", () => {
    stop();
    startError = error();
    remaining = 120;
    train.disabled = true;
    train.textContent = "Learning…";
    status.textContent = "Adjusting the line to reduce its mistakes…";
    advance();
  });
  input.addEventListener("input", () => {
    stop();
    draw();
    status.textContent = "The example changed. The line stays where it was until you train it again.";
    $("studio-chart-desc").textContent = "The last example has changed. The solid prediction line has not yet learned from this change. Use Learn again to adjust it.";
  });
  reset.addEventListener("click", () => {
    stop();
    model = engine.initial();
    input.value = "74";
    draw();
    train.textContent = "Let it learn";
    status.textContent = "The line has not learned from these examples yet.";
    $("studio-chart-desc").textContent = "The starting prediction slopes downward. The example points rise. Training adjusts the prediction toward the points.";
  });
  reduced.addEventListener("change", () => {
    if (remaining && reduced.matches) { cancelAnimationFrame(frame); advance(); }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && remaining) { stop(); status.textContent = "Learning paused. You can continue by choosing Learn again."; } });
  $("studio-interactive").hidden = false;
  $("studio-fallback").hidden = true;
  draw();

  // The same illustrated tile leaves the cinematic stage and settles into the
  // experiment. It fades away before any live controls or results are covered.
  const object = document.querySelector(".journey-object");
  const stage = document.querySelector(".stage");
  const journey = document.querySelector(".journey");
  const dock = $("studio-dock");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce), (max-height: 520px)");
  if (!object || !stage || !journey || !dock) return;
  const homeNext = object.nextSibling;
  let geometry = null;
  let moving = false;
  let tick = 0;
  let handoffDismissed = false;
  // Once someone starts working, the travelling illustration cannot cover them.
  for (const event of ["pointerdown", "focusin", "input", "click"]) {
    $("studio-interactive").addEventListener(event, () => {
      handoffDismissed = true;
      if (moving) object.style.visibility = "hidden";
    }, { once: true });
  }
  const restore = () => {
    if (moving) {
      stage.insertBefore(object, homeNext);
      object.classList.remove("studio-travelling");
      for (const key of ["width", "height", "transform", "opacity", "visibility", "--handoff"]) object.style.removeProperty(key);
      moving = false;
    }
  };
  const paint = () => {
    tick = 0;
    if (!geometry || motion.matches || !document.documentElement.classList.contains("motion-ready")) { restore(); return; }
    const { start, end, x, y, size, targetX, targetY, targetSize } = geometry;
    const scroll = window.scrollY;
    if (scroll <= start) { restore(); return; }
    if (!moving) {
      document.body.appendChild(object);
      object.classList.add("studio-travelling");
      object.style.width = `${size}px`;
      object.style.height = `${size}px`;
      moving = true;
    }
    const p = Math.min(1, Math.max(0, (scroll - start) / (end - start)));
    const eased = p * p * (3 - 2 * p);
    object.style.setProperty("--handoff", eased.toFixed(4));
    const scale = 1 + (targetSize / size - 1) * eased;
    object.style.transform = `translate(${x + (targetX - x) * eased}px, ${y + (targetY - scroll - y) * eased}px) scale(${scale})`;
    object.style.opacity = String(1 - Math.min(1, Math.max(0, (p - .4) / .45)));
    object.style.visibility = handoffDismissed || p >= .85 ? "hidden" : "visible";
  };
  const schedule = () => { if (!tick) tick = requestAnimationFrame(paint); };
  const measure = () => {
    restore();
    if (motion.matches) { geometry = null; return; }
    const stageBox = stage.getBoundingClientRect();
    const box = object.getBoundingClientRect();
    const destination = dock.getBoundingClientRect();
    const start = journey.getBoundingClientRect().top + window.scrollY + journey.offsetHeight - stage.offsetHeight;
    const targetSize = Math.min(160, destination.width * .35);
    geometry = { start, end: Math.max(start + 1, destination.top + window.scrollY - window.innerHeight * .3), x: box.left, y: box.top - stageBox.top, size: box.width, targetX: destination.left + (destination.width - targetSize) / 2, targetY: destination.top + window.scrollY + 30, targetSize };
    schedule();
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("pageshow", measure);
  motion.addEventListener("change", measure);
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(section);
  if (document.fonts) document.fonts.ready.then(measure);
  measure();
})();
