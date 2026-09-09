/* One on-demand scene moves between two reserved illustration mounts.
   Native learning controls and the real chart remain independent of WebGL. */
const hero = document.querySelector('.atlas-hero');
const learning = document.querySelector('.atlas-learning');
const journey = document.querySelector('.journey');
const stage = document.querySelector('.stage');
const explorer = document.getElementById('mechanism-explorer');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-height: 520px)');
const steps = ['examples', 'relationships', 'prediction'];
let scene = null, canvas = null, active = null, frame = 0;
let lastProgress = -1, lastSelection = -2;
let needsResize = true;
let geometry = { top: 0, travel: 1, learningTop: 0, learningHeight: 1, viewport: innerHeight };
const clamp = value => Math.max(0, Math.min(1, value));

function paint() {
  frame = 0;
  if (!scene || document.hidden) return;
  const y = scrollY;
  const inLearning = geometry.learningTop < y + geometry.viewport && geometry.learningTop + geometry.learningHeight > y;
  const inHero = !compact.matches && !reduced.matches && y < geometry.top + geometry.travel + geometry.viewport;
  scene.setActive(inLearning || inHero);
  if (!inLearning && !inHero) return;
  const target = inLearning ? learning : hero;
  if (target !== active) {
    target.appendChild(canvas);
    active = target;
    needsResize = true;
    lastProgress = -1;
  }
  if (needsResize) { scene.resize(target); needsResize = false; }
  const p = reduced.matches ? .45 : inLearning
    ? clamp((y + geometry.viewport * .8 - geometry.learningTop) / Math.max(1, geometry.learningHeight + geometry.viewport * .25))
    : clamp((y - geometry.top) / geometry.travel);
  const selection = inLearning
    ? steps.indexOf(explorer.dataset.mechanismSelected || 'examples')
    : p < .16 ? -1 : p < .4 ? 0 : p < .72 ? 1 : 2;
  if (p !== lastProgress) { scene.setProgress(p); lastProgress = p; }
  if (selection !== lastSelection) { scene.setSelection(selection); lastSelection = selection; }
}
function schedule() {
  if (document.hidden) { if (scene) scene.setActive(false); return; }
  if (!frame) frame = requestAnimationFrame(paint);
}
function measure() {
  geometry = {
    top: journey.getBoundingClientRect().top + scrollY,
    travel: Math.max(1, journey.offsetHeight - stage.offsetHeight),
    learningTop: learning.parentElement.getBoundingClientRect().top + scrollY,
    learningHeight: learning.parentElement.offsetHeight,
    viewport: innerHeight,
  };
  needsResize = true;
  schedule();
}
function fallback() {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if (scene) scene.destroy();
  scene = null;
  hero.parentElement.classList.remove('atlas-ready');
  learning.parentElement.classList.remove('atlas-ready');
  document.body.classList.remove('atlas-active');
  const lens = hero.parentElement.querySelector('.optical-lens');
  if (lens && !lens.getAttribute('src')) lens.src = lens.dataset.fallbackSrc;
  const instruction = explorer.querySelector('.mechanism-instruction');
  if (instruction) instruction.textContent = 'Choose a stage below to explore the explanation.';
}
try {
  const { createCrystalScene } = await import('./design-crystals.js?v=mobile-20260909');
  scene = createCrystalScene(hero, { atlasOnly: true });
  canvas = hero.querySelector('canvas');
  active = hero;
  hero.parentElement.classList.add('atlas-ready');
  learning.parentElement.classList.add('atlas-ready');
  document.body.classList.add('atlas-active');
  const instruction = explorer.querySelector('.mechanism-instruction');
  if (instruction) instruction.textContent = 'Choose a stage to highlight its crystal and explanation.';
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fallback(); });
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', measure, { passive: true });
  addEventListener('pageshow', measure);
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', measure);
  compact.addEventListener('change', measure);
  explorer.querySelectorAll('[data-mechanism-step]').forEach(button => button.addEventListener('click', schedule));
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(measure);
    observer.observe(journey);
    observer.observe(learning.parentElement);
  }
  if (document.fonts) document.fonts.ready.then(measure);
  measure();
} catch (error) {
  fallback();
  console.warn('Prior: keeping the readable illustration fallback.', error);
}
