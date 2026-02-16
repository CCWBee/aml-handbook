/**
 * Tap-to-show tooltips for <abbr> elements.
 *
 * Works on all devices: tap/click an abbreviation to see its definition.
 * On touch devices, this replaces the native hover tooltip which doesn't work.
 * On desktop, this supplements the hover tooltip with click-to-show.
 */
(function () {
  "use strict";

  var activeTooltip = null;
  var activeAbbr = null;

  function dismissTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
    // Restore title on previously active abbr
    if (activeAbbr && activeAbbr.getAttribute("data-title")) {
      activeAbbr.setAttribute("title", activeAbbr.getAttribute("data-title"));
      activeAbbr.removeAttribute("data-title");
      activeAbbr = null;
    }
  }

  function showTooltip(abbr) {
    // If tapping the same abbr, dismiss instead
    if (activeAbbr === abbr) {
      dismissTooltip();
      return;
    }

    dismissTooltip();

    var title = abbr.getAttribute("title") || abbr.getAttribute("data-title");
    if (!title) return;

    // Store and remove title to prevent native tooltip
    abbr.setAttribute("data-title", title);
    abbr.removeAttribute("title");
    activeAbbr = abbr;

    var tip = document.createElement("div");
    tip.className = "abbr-tooltip";
    tip.textContent = title;
    document.body.appendChild(tip);

    // Position below the abbreviation
    var rect = abbr.getBoundingClientRect();
    var tipWidth = tip.offsetWidth;
    var left = rect.left + window.scrollX;
    var top = rect.bottom + window.scrollY + 8;

    // Keep within viewport horizontally
    if (left + tipWidth > window.innerWidth - 12) {
      left = window.innerWidth - tipWidth - 12;
    }
    if (left < 12) left = 12;

    tip.style.left = left + "px";
    tip.style.top = top + "px";

    activeTooltip = tip;
  }

  function handleClick(e) {
    // Find if we clicked on or inside an <abbr>
    var abbr = e.target.closest
      ? e.target.closest("abbr[title], abbr[data-title]")
      : null;

    // Fallback for browsers without closest
    if (!abbr && e.target.tagName === "ABBR") {
      abbr = e.target;
    }

    if (abbr) {
      e.preventDefault();
      e.stopPropagation();
      showTooltip(abbr);
    } else {
      dismissTooltip();
    }
  }

  function init() {
    // Use both touchend and click to cover all devices
    // touchend fires before click on mobile, so we use it for faster response
    var usesTouch = false;

    document.addEventListener("touchend", function (e) {
      usesTouch = true;
      var touch = e.changedTouches[0];
      var target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!target) return;

      var abbr = target.closest
        ? target.closest("abbr[title], abbr[data-title]")
        : null;
      if (!abbr && target.tagName === "ABBR") abbr = target;

      if (abbr) {
        e.preventDefault();
        showTooltip(abbr);
      } else {
        dismissTooltip();
      }
    }, { passive: false });

    document.addEventListener("click", function (e) {
      // Skip if touch already handled it
      if (usesTouch) {
        usesTouch = false;
        return;
      }
      handleClick(e);
    });

    // Dismiss on scroll
    document.addEventListener("scroll", dismissTooltip, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Dismiss on MkDocs instant navigation
  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      dismissTooltip();
    });
  }
})();
