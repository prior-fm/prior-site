(function () {
  "use strict";
  var BLOCKS = [
    [30, 1],
    [90, 2],
    [150, 3],
    [240, 4],
  ];
  var buttons = document.querySelectorAll(".hrs");
  var total = document.getElementById("total");
  var blocks = document.querySelectorAll(".block");
  var pathLinks = document.querySelectorAll("[data-path-link]");
  function isPath(value) {
    return value === "basics" || value === "deeper";
  }
  var path = readPath();

  function readPath() {
    var value = "all";
    try {
      value = new URLSearchParams(location.search || "").get("path") || "all";
    } catch (error) {
      value = "all";
    }
    return isPath(value) ? value : "all";
  }
  function pathStart() {
    return path === "deeper" ? 3 : 1;
  }
  function updatePathUI() {
    document.documentElement.classList.remove(
      "path-basics",
      "path-deeper",
      "path-all",
    );
    document.documentElement.classList.add("path-" + path);
    pathLinks.forEach(function (link) {
      link.setAttribute(
        "aria-current",
        link.getAttribute("data-path-link") === path ? "page" : "false",
      );
    });
  }
  function setPath(nextPath, replace) {
    path = isPath(nextPath) ? nextPath : "all";
    updatePathUI();
    if (replace && history.replaceState) {
      var query = new URLSearchParams(location.search || "");
      if (path === "all") query.delete("path");
      else query.set("path", path);
      var search = query.toString();
      history.replaceState(
        null,
        "",
        (location.pathname || "roadmap.html") +
          (search ? "?" + search : "") +
          (location.hash || ""),
      );
    }
  }
  function show(hours) {
    var parts = 0;
    BLOCKS.forEach(function (block) {
      if (block[0] <= hours) parts = block[1];
    });
    var visible = [];
    blocks.forEach(function (section) {
      var part = Number(section.getAttribute("data-part"));
      var hiddenByHours = part > parts;
      var hiddenByPath =
        path === "basics"
          ? part > 1
          : path === "deeper"
            ? part < pathStart()
            : false;
      var hidden = hiddenByHours || hiddenByPath;
      section.classList.toggle("off", hidden);
      section.setAttribute("aria-hidden", hidden ? "true" : "false");
      if (!hidden) visible.push(part);
    });
    buttons.forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        path === "all" && Number(button.getAttribute("data-hours")) === hours
          ? "true"
          : "false",
      );
    });
    if (path === "all") {
      total.textContent =
        hours +
        " hours in the month: part" +
        (parts > 1 ? "s 1 to " + parts : " 1") +
        ", " +
        parts * 4 +
        " ideas, " +
        parts * 4 +
        " free sources.";
    } else {
      var first = visible[0];
      var last = visible[visible.length - 1];
      var label =
        visible.length > 1
          ? "s " + first + " to " + last
          : " " + (first || pathStart());
      total.textContent =
        (path === "basics" ? "Foundations path: part" : "Deeper path: part") +
        label +
        ", " +
        visible.length * 4 +
        " ideas, " +
        visible.length * 4 +
        " free sources.";
    }
  }
  function sync() {
    var hash = (location.hash || "").slice(1);
    var fromHash = Number(hash);
    var validHours = BLOCKS.some(function (block) {
      return block[0] === fromHash;
    });
    setPath(readPath(), false);
    if (validHours && path === "deeper" && fromHash < 150) setPath("all", true);
    show(validHours ? fromHash : 240);
  }
  updatePathUI();
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      var hours = Number(button.getAttribute("data-hours"));
      setPath("all", true);
      if (history.replaceState)
        history.replaceState(
          null,
          "",
          (location.pathname || "roadmap.html") +
            (location.search || "") +
            "#" +
            hours,
        );
      show(hours);
    });
  });
  window.addEventListener("hashchange", sync);
  window.addEventListener("popstate", sync);
  sync();
})();
