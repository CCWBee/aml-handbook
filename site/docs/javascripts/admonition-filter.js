/**
 * Admonition type filter — toggle visibility of Statutory / Code of Practice / Guidance.
 * Three colour-coded pills, click to dim/show each type.
 */
(function () {
  "use strict";

  // Only show on section pages (not home, glossary, appendix)
  if (!document.querySelector(".md-typeset .admonition")) return;

  var types = [
    { cls: "danger", label: "Statutory", key: "statutory" },
    { cls: "warning", label: "Code", key: "code" },
    { cls: "info", label: "Guidance", key: "guidance" },
  ];

  // Build the filter bar
  var bar = document.createElement("div");
  bar.className = "admonition-filter";

  types.forEach(function (t) {
    var pill = document.createElement("button");
    pill.className = "af-pill af-pill--" + t.key;
    pill.setAttribute("data-type", t.cls);
    pill.setAttribute("data-active", "1");
    pill.textContent = t.label;
    pill.addEventListener("click", function () {
      var active = pill.getAttribute("data-active") === "1";
      pill.setAttribute("data-active", active ? "0" : "1");
      pill.classList.toggle("af-pill--off", active);

      document
        .querySelectorAll(".admonition." + t.cls + ", details." + t.cls)
        .forEach(function (el) {
          el.classList.toggle("admonition-dimmed", active);
        });
    });
    bar.appendChild(pill);
  });

  document.body.appendChild(bar);
})();
