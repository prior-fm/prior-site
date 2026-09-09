/* One explanation per layer. Native buttons provide the same action as a tap
   on the illustration; the complete explanation remains readable without JS. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else api.mount(root.document);
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";
  const steps = ["examples", "relationships", "prediction"];
  function mount(doc) {
    const root = doc.getElementById("mechanism-explorer");
    if (!root || root.dataset.explorerReady === "true") return;
    const buttons = [...root.querySelectorAll("[data-mechanism-step]")];
    const details = [...root.querySelectorAll("[data-mechanism-detail]")];
    const stage = root.querySelector(".mechanism-mount");
    const controls = root.querySelector(".mechanism-controls");
    const instruction = root.querySelector(".mechanism-instruction");
    if (!controls || !steps.every((step) => buttons.some((b) => b.dataset.mechanismStep === step) && details.some((d) => d.dataset.mechanismDetail === step))) return;
    function select(step, engaged = true) {
      if (!steps.includes(step)) return;
      buttons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mechanismStep === step)));
      details.forEach((detail) => { detail.hidden = detail.dataset.mechanismDetail !== step; });
      root.dataset.mechanismSelected = step;
      if (stage && engaged) stage.dataset.mechanismEngaged = "true";
    }
    buttons.forEach((button) => button.addEventListener("click", () => select(button.dataset.mechanismStep)));
    // These pointer targets duplicate the labelled native buttons directly below.
    // They stay decorative in the accessibility tree and never capture scrolling.
    const plates = [".specimen-front", ".specimen-middle", ".specimen-back"];
    plates.forEach((selector, index) => {
      const plate = stage && stage.querySelector(selector);
      if (plate) plate.addEventListener("click", () => select(steps[index]));
    });
    select("examples", false);
    root.dataset.explorerReady = "true";
    controls.hidden = false;
    if (instruction) {
      instruction.textContent = stage && stage.querySelector(".specimen") ? "Tap a layer or choose a stage below." : "Choose a stage to look inside the learning.";
      instruction.hidden = false;
    }
  }
  return { mount };
});
