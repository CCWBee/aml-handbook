/**
 * Touch-friendly tooltips for <abbr> elements.
 *
 * On devices without hover (phones/tablets), tapping an abbreviation
 * shows its definition as a tooltip. Tapping elsewhere dismisses it.
 */
(function () {
  "use strict";

  var activeTooltip = null;

  function dismissTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  function showTooltip(abbr) {
    dismissTooltip();

    var title = abbr.getAttribute("title");
    if (!title) return;

    var tip = document.createElement("div");
    tip.className = "abbr-tooltip";
    tip.textContent = title;
    document.body.appendChild(tip);

    // Position below the abbreviation
    var rect = abbr.getBoundingClientRect();
    var tipWidth = tip.offsetWidth;
    var left = rect.left + window.scrollX;
    var top = rect.bottom + window.scrollY + 6;

    // Keep within viewport horizontally
    if (left + tipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tipWidth - 8;
    }
    if (left < 8) left = 8;

    tip.style.left = left + "px";
    tip.style.top = top + "px";

    activeTooltip = tip;

    // Prevent the title from also showing as a native tooltip
    abbr.setAttribute("data-title", title);
    abbr.removeAttribute("title");
    setTimeout(function () {
      abbr.setAttribute("title", abbr.getAttribute("data-title"));
    }, 100);
  }

  function init() {
    // Only activate on touch devices
    if (!("ontouchstart" in window)) return;

    document.addEventListener("click", function (e) {
      var abbr = e.target.closest("abbr[title]");
      if (abbr) {
        e.preventDefault();
        showTooltip(abbr);
      } else {
        dismissTooltip();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Re-init on MkDocs instant navigation
  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      dismissTooltip();
    });
  }
})();
