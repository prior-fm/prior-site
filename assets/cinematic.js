/* Prior: native-scroll cinematic stage. No animation library or background video. */
(() => {
  "use strict";
  const journey = document.querySelector(".journey");
  if (!journey) return;
  const stage = journey.querySelector(".stage");
  const layers = [...stage.querySelectorAll(".scene-image")];
  const copies = [...stage.querySelectorAll(".scene-copy")];
  const wordmark = stage.querySelector(".hero-wordmark");
  const aperture = stage.querySelector(".aperture");
  const object = stage.querySelector(".journey-object");
  const caption = object && object.querySelector(".object-caption");
  const nav = [...stage.querySelectorAll(".journey-nav a")];
  // A short landscape viewport gets the readable stacked version as well.
  const reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce), (max-height: 520px)",
  );
  let enabled = false;
  let raf = 0;
  let travel = 1;
  let top = 0;
  let lastChapter = -1;
  let lastObjectPhase = "";
  let visible = true;
  const imageReady = layers.map((layer, i) => i === 0);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
  const range = (x, a, b) => smooth((x - a) / (b - a));
  const preload = () => {
    layers.forEach((layer, i) => {
      const img = layer.querySelector("img");
      const ready = () => {
        imageReady[i] = true;
        requestRender();
      };
      img.addEventListener("load", ready, { once: true });
      if (img.complete && img.naturalWidth > 0) ready();
    });
  };
  // Opacity is controlled in one place. Outgoing images grow around the same
  // central aperture as the next scene opens, retaining the direction of travel.
  const render = () => {
    raf = 0;
    if (!enabled) return;
    const p = clamp((window.scrollY - top) / travel);
    // The optical edition shares the existing scroll clock; no extra loop.
    stage.style.setProperty("--optical-progress", p.toFixed(4));
    if (object) {
      // A single tile persists through image, computation, and prediction.
      // Everything follows native scroll, including when the visitor reverses.
      const data = range(p, 0.17, 0.3);
      const compute = range(p, 0.35, 0.56);
      const prediction = range(p, 0.7, 0.85);
      // The object has three clear jobs: show an input, expose the mechanism,
      // then show an uncertain output. The caption follows that same story.
      const phase = p < 0.34 ? "input" : p < 0.67 ? "mechanism" : "prediction";
      if (phase !== lastObjectPhase) {
        object.dataset.phase = phase;
        if (caption && caption.lastChild) {
          caption.lastChild.nodeValue = phase === "input"
            ? "Illustrated input"
            : phase === "mechanism"
              ? "Illustrated relationships"
              : "Illustrated prediction";
        }
        lastObjectPhase = phase;
      }
      object.style.setProperty("--data", data.toFixed(4));
      object.style.setProperty("--compute", compute.toFixed(4));
      object.style.setProperty("--prediction", prediction.toFixed(4));
      object.style.setProperty(
        "--object-x",
        `${(-8 + 14 * compute - 6 * prediction).toFixed(2)}deg`,
      );
      object.style.setProperty(
        "--object-y",
        `${(-22 + 44 * compute - 26 * prediction).toFixed(2)}deg`,
      );
      object.style.setProperty(
        "--object-z",
        `${(-7 + 12 * compute - 5 * prediction).toFixed(2)}deg`,
      );
      object.style.setProperty(
        "--object-scale",
        (0.88 + 0.14 * data - 0.12 * compute + 0.06 * prediction).toFixed(4),
      );
    }
    const t1 = imageReady[1] ? range(p, 0.29, 0.43) : 0;
    const t2 = imageReady[2] && imageReady[1] ? range(p, 0.6, 0.75) : 0;
    const opacities = [1 - t1, t1 * (1 - t2), t2];
    const scales = [
      1.015 + 0.65 * range(p, 0.02, 0.44),
      1.025 + 0.55 * range(p, 0.34, 0.76),
      1.025 + 0.3 * range(p, 0.66, 1),
    ];
    layers.forEach((layer, i) => {
      layer.style.opacity = opacities[i].toFixed(4);
      layer.style.transform = `scale(${scales[i].toFixed(4)})`;
      layer.style.visibility = opacities[i] < 0.002 ? "hidden" : "visible";
      if (i > 0) {
        const opening = i === 1 ? t1 : t2;
        // The next world first appears inside the shared central aperture.
        // Opening its edges as the outgoing view grows produces a spatial
        // handoff instead of treating the entire image as a slideshow frame.
        const inset = 46 * Math.pow(1 - opening, 2);
        layer.style.clipPath = `inset(${inset.toFixed(2)}% ${inset.toFixed(2)}%)`;
      }
    });
    const glow = Math.sin(t1 * Math.PI) + Math.sin(t2 * Math.PI);
    aperture.style.opacity = (glow * 0.65).toFixed(4);
    const states = [
      1 - range(p, 0.12, 0.21),
      range(p, 0.16, 0.23) * (1 - range(p, 0.32, 0.39)),
      range(p, 0.4, 0.47) * (1 - range(p, 0.63, 0.7)),
      range(p, 0.72, 0.8),
    ];
    copies.forEach((copy, i) => {
      const opacity = states[i];
      copy.style.opacity = opacity.toFixed(4);
      copy.style.transform = `translateY(${((1 - opacity) * 16).toFixed(2)}px)`;
      copy.style.visibility = opacity < 0.02 ? "hidden" : "visible";
      copy.inert = opacity < 0.5;
      copy.setAttribute("aria-hidden", String(opacity < 0.5));
    });
    wordmark.style.opacity = (1 - range(p, 0.03, 0.2)).toFixed(4);
    wordmark.style.transform = `translateY(${-24 * range(p, 0.02, 0.2)}px)`;
    const chapter = p < 0.18 ? 0 : p < 0.41 ? 1 : p < 0.72 ? 2 : 3;
    if (chapter !== lastChapter) {
      nav.forEach((link, i) => {
        if (i === chapter) link.setAttribute("aria-current", "step");
        else link.removeAttribute("aria-current");
      });
      lastChapter = chapter;
    }
  };
  const requestRender = () => {
    if (enabled && !raf && visible && !document.hidden)
      raf = requestAnimationFrame(render);
  };
  const measure = () => {
    top = journey.getBoundingClientRect().top + window.scrollY;
    travel = Math.max(1, journey.offsetHeight - stage.offsetHeight);
    nav.slice(1).forEach((link) => {
      const anchor = document.querySelector(link.getAttribute("href"));
      if (anchor)
        anchor.style.top = `${Number(link.dataset.progress) * travel}px`;
    });
    requestRender();
  };
  const configure = () => {
    enabled = !reduced.matches;
    document.documentElement.classList.toggle("motion-ready", enabled);
    if (enabled) {
      preload();
      measure();
    } else {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      layers.forEach((layer) => {
        layer.style.cssText = "";
      });
      copies.forEach((copy) => {
        copy.style.cssText = "";
        copy.inert = false;
        copy.removeAttribute("aria-hidden");
      });
      wordmark.style.cssText = "";
      aperture.style.cssText = "";
      stage.style.setProperty("--optical-progress", "0");
      if (object) object.style.cssText = "";
      if (caption && caption.lastChild) caption.lastChild.nodeValue = "Illustrated example";
      lastObjectPhase = "";
      nav.forEach((link) => link.removeAttribute("aria-current"));
      lastChapter = -1;
    }
  };
  nav.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!enabled) return;
      event.preventDefault();
      const target = Number(link.dataset.progress);
      window.scrollTo({ top: top + target * travel, behavior: "smooth" });
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });
  window.addEventListener("scroll", requestRender, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  document.addEventListener("visibilitychange", requestRender);
  reduced.addEventListener("change", configure);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) {
        measure();
        requestRender();
      }
    }).observe(journey);
  }
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(journey);
  configure();
  // Re-measure restored pages as well as fresh navigation.
  window.addEventListener("pageshow", measure);
})();
