/* A guided view of real, local gradient descent. No model service is involved. */
(() => {
  "use strict";
  const api = window.PriorTinyModel;
  const app = document.getElementById("lesson-app");
  if (!api || !app) return;
  const el = (id) => document.getElementById(id);
  const plot = el("model-plot");
  const fields = el("example-fields");
  const stepButtons = [...document.querySelectorAll("[data-step]")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ns = "http://www.w3.org/2000/svg";
  const clone = (points) => points.map((point) => ({ ...point }));
  const clamp = (value, low = 0, high = 1) =>
    Math.max(low, Math.min(high, value));
  const xPos = (x) => 64 + x * 520;
  const yPos = (y) => 352 - y * 304;
  const number = (value, places = 3) => {
    if (!Number.isFinite(value)) return "Outside range";
    if (value !== 0 && Math.abs(value) < 0.001) return value.toExponential(1);
    return Number(value.toFixed(places)).toLocaleString("en", {
      maximumFractionDigits: places,
    });
  };
  let training = clone(api.DEFAULT_TRAINING);
  let model = api.initial();
  let phase = "teach";
  let tested = false;
  let frame = 0;
  let running = false;
  let target = 0;
  let lastTime = 0;
  let dragIndex = null;
  const inputs = [];
  const errorText = (points) => {
    try {
      const value = api.loss(model, points) * 100;
      return value > 0 && value < 0.001 ? "<0.001" : number(value);
    } catch (error) {
      return "Outside range";
    }
  };
  const captions = {
    teach: [
      "Examples are the starting point.",
      "Each blue point pairs an input with an expected answer. Adjust an answer below, or drag its point up and down. Changing an example resets the model.",
    ],
    train: [
      "Watch the model learn a line.",
      "Training adjusts the line to reduce its error on your examples. The vertical gaps show its mistakes. Pause or take a single step to look more closely.",
    ],
    test: [
      "Now try examples it did not train on.",
      "The outlined diamonds were kept out of training. Compare the model’s predictions with their expected answers. A useful fit needs to work beyond its training examples.",
    ],
  };
  const announce = (message) => {
    el("lesson-status").textContent = message;
  };
  const node = (tag, attrs, text) => {
    const item = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) =>
      item.setAttribute(key, value),
    );
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    running = false;
  };
  const drawGrid = () => {
    const grid = el("plot-grid");
    for (let i = 0; i <= 5; i++) {
      const fraction = i / 5;
      grid.appendChild(
        node("line", {
          x1: xPos(fraction),
          x2: xPos(fraction),
          y1: 48,
          y2: 352,
          class: "plot-gridline",
        }),
      );
      grid.appendChild(
        node("line", {
          x1: 64,
          x2: 584,
          y1: yPos(fraction),
          y2: yPos(fraction),
          class: "plot-gridline",
        }),
      );
      grid.appendChild(
        node(
          "text",
          {
            x: xPos(fraction),
            y: 376,
            "text-anchor": "middle",
            class: "plot-tick",
          },
          i * 2,
        ),
      );
      grid.appendChild(
        node(
          "text",
          {
            x: 49,
            y: yPos(fraction) + 5,
            "text-anchor": "end",
            class: "plot-tick",
          },
          i * 2,
        ),
      );
    }
    grid.appendChild(
      node(
        "text",
        { x: 324, y: 410, "text-anchor": "middle", class: "plot-axis" },
        "Input",
      ),
    );
    grid.appendChild(
      node("text", { x: 64, y: 26, class: "plot-axis" }, "Answer"),
    );
  };
  // Clip the learned line mathematically, rather than turning off-chart values
  // into a misleading horizontal line along the plot's boundary.
  const lineEnds = () => {
    const candidates = [];
    const add = (x, y) => {
      if (
        x >= 0 &&
        x <= 1 &&
        y >= 0 &&
        y <= 1 &&
        !candidates.some(
          (point) => Math.abs(point.x - x) + Math.abs(point.y - y) < 1e-8,
        )
      )
        candidates.push({ x, y });
    };
    add(0, api.predict(model, 0));
    add(1, api.predict(model, 1));
    if (Math.abs(model.slope) > 1e-12) {
      add(-model.offset / model.slope, 0);
      add((1 - model.offset) / model.slope, 1);
    }
    return candidates;
  };
  const draw = () => {
    const errors = el("plot-errors");
    const examples = el("plot-training");
    const line = el("plot-line");
    const tests = el("plot-test");
    [errors, examples, line, tests].forEach((group) => group.replaceChildren());
    training.forEach((point, index) => {
      errors.appendChild(
        node("line", {
          x1: xPos(point.x),
          x2: xPos(point.x),
          y1: yPos(point.y),
          y2: yPos(clamp(api.predict(model, point.x))),
          class: "plot-error",
        }),
      );
      examples.appendChild(
        node("circle", {
          cx: xPos(point.x),
          cy: yPos(point.y),
          r: 9,
          class: "plot-example",
          "data-example-index": index,
        }),
      );
    });
    const ends = lineEnds();
    if (ends.length >= 2)
      line.appendChild(
        node("line", {
          x1: xPos(ends[0].x),
          y1: yPos(ends[0].y),
          x2: xPos(ends[1].x),
          y2: yPos(ends[1].y),
          class: "plot-model",
        }),
      );
    if (tested)
      api.TEST_DATA.forEach((point) => {
        const x = xPos(point.x),
          y = yPos(point.y);
        tests.appendChild(
          node("path", {
            d: `M${x} ${y - 9}L${x + 9} ${y}L${x} ${y + 9}L${x - 9} ${y}Z`,
            class: "plot-test-point",
          }),
        );
      });
    el("plot-summary").textContent =
      model.steps === 0
        ? "The line has not learned yet. Each blue circle is an example; the answer controls give the same information as the plot."
        : `After ${model.steps} training steps, error on the training examples is ${errorText(training)}. ${tested ? "The test table compares predictions with answers kept out of training." : "Test on new examples to check the learned pattern."}`;
  };
  const render = () => {
    el("step-title").textContent = captions[phase][0];
    el("step-description").textContent = captions[phase][1];
    stepButtons.forEach((button) => {
      if (button.dataset.step === phase)
        button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    plot.setAttribute("data-phase", phase);
    el("training-error").textContent = errorText(training);
    el("test-error").textContent = tested
      ? errorText(api.TEST_DATA)
      : "Not tested";
    el("step-count").textContent = model.steps;
    el("model-slope").textContent = number(model.slope);
    el("model-offset").textContent = number(model.offset * 10);
    el("model-equation").textContent =
      `Answer = ${number(model.slope)} × input ${model.offset < 0 ? "−" : "+"} ${number(Math.abs(model.offset * 10))}`;
    el("train-button").disabled = running;
    el("train-button").textContent = model.steps
      ? "Continue training"
      : "Train the model";
    el("pause-button").hidden = !running;
    el("step-button").disabled = running;
    el("step-button").hidden = phase !== "train";
    el("rate-value").textContent = Number(el("learning-rate").value).toFixed(2);
    el("test-results").hidden = !tested;
    el("example-controls").hidden = phase !== "teach";
    const rows = el("test-rows");
    rows.replaceChildren();
    if (tested)
      api.TEST_DATA.forEach((point) => {
        const prediction = api.predict(model, point.x) * 10;
        const row = document.createElement("tr");
        [
          point.x * 10,
          prediction,
          point.y * 10,
          Math.abs(prediction - point.y * 10),
        ].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = number(value);
          row.appendChild(cell);
        });
        rows.appendChild(row);
      });
    draw();
  };
  const updateExample = (index, value, speak = true) => {
    stop();
    training[index] = { ...training[index], y: value };
    model = api.initial();
    tested = false;
    phase = "teach";
    inputs[index].value = Number((value * 10).toFixed(2));
    render();
    if (speak)
      announce(
        "Example changed. The model and previous test results have been reset. Train again to see the effect.",
      );
  };
  const reset = (restore = false) => {
    stop();
    if (restore) training = clone(api.DEFAULT_TRAINING);
    model = api.initial();
    tested = false;
    phase = "teach";
    if (restore) el("learning-rate").value = "0.25";
    inputs.forEach((input, index) => {
      input.value = Number((training[index].y * 10).toFixed(2));
    });
    render();
    announce(
      restore
        ? "Original examples and step size restored. Ready to train."
        : "Model reset. Your examples and step size are unchanged.",
    );
  };
  const advance = () => {
    try {
      model = api.step(model, training, Number(el("learning-rate").value));
      return true;
    } catch (error) {
      stop();
      render();
      announce(
        "Training stopped because the updates became too large. Lower the step size and reset the model, or restore the original setup.",
      );
      return false;
    }
  };
  const tick = (time) => {
    frame = 0;
    if (!running) return;
    if (time - lastTime >= 45) {
      lastTime = time;
      for (let i = 0; i < 4 && model.steps < target; i++)
        if (!advance()) return;
      render();
      if (model.steps >= target) {
        stop();
        render();
        announce(
          "This training round is complete. Test on new examples to see whether the pattern carries over.",
        );
        return;
      }
    }
    frame = requestAnimationFrame(tick);
  };
  const start = () => {
    stop();
    phase = "train";
    tested = false;
    target = model.steps + 240;
    running = true;
    lastTime = 0;
    if (reduced.matches) {
      while (model.steps < target) if (!advance()) return;
      stop();
      render();
      announce(
        "Training round complete. The updated line is shown without animation. Test on new examples next.",
      );
    } else {
      render();
      announce("Training started. You can pause at any time.");
      frame = requestAnimationFrame(tick);
    }
  };
  const showTest = () => {
    stop();
    phase = "test";
    tested = true;
    render();
    announce(
      model.steps
        ? `Test results ready. Error on examples kept out of training is ${errorText(api.TEST_DATA)}. Read the predictions below.`
        : "These are the untrained model’s predictions. Train the model, then compare the results.",
    );
  };

  training.forEach((point, index) => {
    const label = document.createElement("label");
    label.className = "example-field";
    const text = document.createElement("span");
    text.textContent = `Answer for input ${point.x * 10}`;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "10";
    input.step = "0.05";
    input.inputMode = "decimal";
    input.value = Number((point.y * 10).toFixed(2));
    input.addEventListener("change", () => {
      const value = Number(input.value);
      if (
        !input.value.trim() ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 10
      ) {
        input.value = Number((training[index].y * 10).toFixed(2));
        announce(
          "Use an answer from 0 to 10. The previous value has been restored.",
        );
        return;
      }
      updateExample(index, value / 10);
    });
    label.appendChild(text);
    label.appendChild(input);
    fields.appendChild(label);
    inputs.push(input);
  });
  stepButtons.forEach((button) =>
    button.addEventListener("click", () => {
      if (button.dataset.step === "test") {
        showTest();
        return;
      }
      stop();
      phase = button.dataset.step;
      tested = false;
      render();
      announce(captions[phase][0]);
    }),
  );
  el("train-button").addEventListener("click", start);
  el("pause-button").addEventListener("click", () => {
    stop();
    render();
    announce(
      "Training paused. Continue, take one step, or test the current model.",
    );
  });
  el("step-button").addEventListener("click", () => {
    stop();
    phase = "train";
    tested = false;
    if (advance()) {
      render();
      announce(`One training step complete. Error is ${errorText(training)}.`);
    }
  });
  el("test-button").addEventListener("click", showTest);
  el("reset-button").addEventListener("click", () => reset());
  el("restore-button").addEventListener("click", () => reset(true));
  el("misleading-button").addEventListener("click", () => {
    updateExample(training.length - 1, 0.15, false);
    announce(
      "The final example now contradicts the original pattern. Train again, then test against the original held-out examples to compare what changes.",
    );
  });
  el("learning-rate").addEventListener("input", () => {
    const wasRunning = running;
    stop();
    render();
    if (wasRunning)
      announce(
        "Training paused because you changed the step size. Continue when ready.",
      );
  });
  plot.addEventListener("pointerdown", (event) => {
    if (phase !== "teach") return;
    const value = event.target.getAttribute("data-example-index");
    if (value === null) return;
    dragIndex = Number(value);
    plot.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  plot.addEventListener("pointermove", (event) => {
    if (dragIndex === null) return;
    const matrix = plot.getScreenCTM();
    if (!matrix) return;
    const point = plot.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    updateExample(
      dragIndex,
      Math.round(clamp((352 - local.y) / 304) * 200) / 200,
      false,
    );
  });
  const finishDrag = () => {
    if (dragIndex === null) return;
    dragIndex = null;
    announce(
      "Example adjusted. Train again to see how it changes the learned line.",
    );
  };
  plot.addEventListener("pointerup", finishDrag);
  plot.addEventListener("pointercancel", finishDrag);
  plot.addEventListener("lostpointercapture", finishDrag);
  const pauseForEnvironment = () => {
    if (running) {
      stop();
      render();
      announce("Training paused. Continue when you are ready.");
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseForEnvironment();
  });
  reduced.addEventListener("change", pauseForEnvironment);
  window.addEventListener("pagehide", pauseForEnvironment);
  drawGrid();
  render();
  app.hidden = false;
  el("lesson-fallback").hidden = true;
  document.querySelectorAll("[data-interactive-only]").forEach((section) => {
    section.hidden = false;
  });
  if (el("lesson-start"))
    el("lesson-start").setAttribute("href", "#lesson-app");
})();
