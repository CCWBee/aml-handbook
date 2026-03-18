/**
 * Admonition type filter — toggle visibility of Statutory / Code of Practice / Guidance.
 * Re-injects on each page load (supports navigation.instant).
 */
(function () {
  "use strict";

  var types = [
    { cls: "danger", label: "Statutory", key: "statutory" },
    { cls: "warning", label: "Code", key: "code" },
    { cls: "info", label: "Guidance", key: "guidance" },
  ];

  // Track toggle state across instant navigation
  var state = { danger: true, warning: true, info: true };

  function inject() {
    // Remove any existing bar
    var old = document.querySelector(".admonition-filter");
    if (old) old.remove();

    // Only on pages with admonitions
    if (!document.querySelector(".md-typeset .admonition")) return;

    var bar = document.createElement("div");
    bar.className = "admonition-filter";

    types.forEach(function (t) {
      var pill = document.createElement("button");
      pill.className = "af-pill af-pill--" + t.key;
      if (!state[t.cls]) pill.classList.add("af-pill--off");
      pill.setAttribute("data-type", t.cls);
      pill.innerHTML = '<span class="af-dot"></span>' + t.label;
      pill.addEventListener("click", function () {
        state[t.cls] = !state[t.cls];
        pill.classList.toggle("af-pill--off", !state[t.cls]);
        document
          .querySelectorAll(".admonition." + t.cls + ", details." + t.cls)
          .forEach(function (el) {
            el.classList.toggle("admonition-dimmed", !state[t.cls]);
          });
      });
      bar.appendChild(pill);
    });

    // Insert after h1
    var h1 = document.querySelector(".md-content__inner h1");
    if (h1) h1.insertAdjacentElement("afterend", bar);

    // Re-apply dimmed state
    types.forEach(function (t) {
      if (!state[t.cls]) {
        document
          .querySelectorAll(".admonition." + t.cls + ", details." + t.cls)
          .forEach(function (el) {
            el.classList.add("admonition-dimmed");
          });
      }
    });
  }

  // Run on initial load
  inject();

  // Re-run when navigation.instant swaps the page
  document.addEventListener("DOMContentLoaded", inject);
  if (typeof document$ !== "undefined") {
    document$.subscribe(inject);
  }
})();
