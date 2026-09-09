/* Topic discovery enhances the existing, fully readable issue archive. */
(() => {
  "use strict";
  const archive = document.querySelector(".archive");
  if (!archive) return;
  const controls = archive.querySelector(".archive-filters");
  const status = archive.querySelector(".archive-status");
  const grid = archive.querySelector(".issue-grid");
  const earlier = archive.querySelector(".archive-more");
  const cards = [...archive.querySelectorAll(".issue-card")];
  const buttons = [...archive.querySelectorAll("[data-topic-filter]")];
  if (!controls || !status || !grid || !cards.length || !buttons.length) return;
  // Once filters are available, they cover every issue, including older ones.
  cards.forEach((card) => grid.appendChild(card));
  if (earlier) earlier.remove();
  const show = (button) => {
    const topic = button.dataset.topicFilter;
    let count = 0;
    cards.forEach((card) => {
      const visible = topic === "all" || card.dataset.topic === topic;
      card.hidden = !visible;
      if (visible) count++;
    });
    buttons.forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
    status.textContent = `${count} ${count === 1 ? "issue" : "issues"} · ${button.textContent.trim()}`;
  };
  buttons.forEach((button) =>
    button.addEventListener("click", () => show(button)),
  );
  controls.hidden = false;
  status.hidden = false;
  show(buttons[0]);
})();
