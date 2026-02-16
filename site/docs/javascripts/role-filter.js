/**
 * Role-based section filtering for the JFSC Handbook.
 *
 * Reads the user's selected role from localStorage and hides irrelevant
 * nav items + Quick Nav table rows. Also handles role card clicks on the
 * landing page with confirmation feedback and smooth scroll.
 */

(function () {
  "use strict";

  // Role → allowed section numbers (sections 1-11 are always visible)
  var ROLE_SECTIONS = {
    all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    "fund-services": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13],
    tcsp: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    "estate-agents": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14],
    "high-value-dealers": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14],
    lawyers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15],
    accountants: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16],
    npos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 17],
    "aml-providers": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18],
  };

  var ROLE_LABELS = {
    all: "All Sectors",
    "fund-services": "Fund Services",
    tcsp: "TCSPs",
    "estate-agents": "Estate Agents",
    "high-value-dealers": "High Value Dealers",
    lawyers: "Lawyers",
    accountants: "Accountants",
    npos: "NPOs",
    "aml-providers": "AML Providers",
  };

  var STORAGE_KEY = "jfsc-handbook-role";

  function getRole() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "all";
    } catch (e) {
      return "all";
    }
  }

  function setRole(role) {
    try {
      localStorage.setItem(STORAGE_KEY, role);
    } catch (e) {
      // localStorage not available
    }
  }

  /**
   * Extract section number from a nav link text like "1. Introduction"
   */
  function extractSectionNum(text) {
    var match = text.match(/^(\d+)\./);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Extract section number from a table row's first cell link text
   */
  function extractSectionNumFromRow(row) {
    var firstCell = row.querySelector("td:first-child");
    if (!firstCell) return null;
    var link = firstCell.querySelector("a");
    var text = link ? link.textContent.trim() : firstCell.textContent.trim();
    var match = text.match(/^(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Apply role filter to sidebar navigation and Quick Nav table
   */
  function applyFilter(role) {
    var allowedSections = ROLE_SECTIONS[role] || ROLE_SECTIONS.all;

    // Filter sidebar nav items
    var navItems = document.querySelectorAll(".md-nav__item");
    navItems.forEach(function (item) {
      var link = item.querySelector(".md-nav__link");
      if (!link) return;

      var text = link.textContent.trim();
      var sectionNum = extractSectionNum(text);

      if (sectionNum !== null) {
        if (allowedSections.indexOf(sectionNum) === -1) {
          item.classList.add("role-hidden");
        } else {
          item.classList.remove("role-hidden");
        }
      }
    });

    // Filter Quick Nav table rows on the home page
    var sectionList = document.getElementById("section-list");
    if (sectionList) {
      var rows = sectionList.querySelectorAll("tbody tr");
      var visibleCount = 0;
      rows.forEach(function (row) {
        var sectionNum = extractSectionNumFromRow(row);
        if (sectionNum !== null) {
          if (allowedSections.indexOf(sectionNum) === -1) {
            row.style.display = "none";
          } else {
            row.style.display = "";
            visibleCount++;
          }
        }
      });

      // Show confirmation message
      showConfirmation(role, visibleCount);
    }

    // Update role badge
    updateBadge(role);

    // Show sector banner on section pages
    showSectorBanner(role);

    // Update role cards on landing page
    updateCards(role);

    // Enable/disable Start Reading button based on whether a sector is selected
    updateStartButton(role);
  }

  /**
   * Show/hide confirmation message after role selection
   */
  function showConfirmation(role, count) {
    var el = document.getElementById("role-confirmation");
    if (!el) return;

    if (role === "all") {
      el.style.display = "none";
      return;
    }

    var label = ROLE_LABELS[role] || role;
    el.innerHTML =
      '<p class="role-confirmation-text">' +
      "Showing <strong>" +
      count +
      " sections</strong> for <strong>" +
      label +
      "</strong>. " +
      '<a href="#" class="role-reset-link">Reset to All Sectors</a>' +
      "</p>";
    el.style.display = "block";

    // Attach reset handler
    var resetLink = el.querySelector(".role-reset-link");
    if (resetLink) {
      resetLink.addEventListener("click", function (e) {
        e.preventDefault();
        setRole("all");
        applyFilter("all");
      });
    }
  }

  /**
   * Show a sector banner at the top of section pages (not the home page)
   */
  function showSectorBanner(role) {
    var BANNER_ID = "role-sector-banner";
    var existing = document.getElementById(BANNER_ID);
    if (existing) existing.remove();

    // Only show on section pages and only for non-"all" roles
    var isSectionPage = window.location.pathname.indexOf("/sections/") !== -1;
    if (!isSectionPage || role === "all") return;

    var label = ROLE_LABELS[role] || role;
    var content = document.querySelector(".md-content__inner");
    if (!content) return;

    var banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.className = "sector-banner";
    banner.innerHTML =
      "Viewing as: <strong>" + label + "</strong> " +
      '<a href="#" class="sector-banner-change">Change sector</a>';

    content.insertBefore(banner, content.firstChild);

    banner.querySelector(".sector-banner-change").addEventListener("click", function (e) {
      e.preventDefault();
      var base =
        document.querySelector('meta[name="base_url"]') ||
        document.querySelector("base");
      var baseUrl = base ? base.getAttribute("content") || base.href : "/";
      window.location.href = baseUrl;
    });
  }

  /**
   * Update the role badge in the header
   */
  function updateBadge(role) {
    var badge = document.getElementById("role-badge");
    if (badge) {
      badge.textContent = ROLE_LABELS[role] || "All Sectors";
    }
  }

  /**
   * Highlight the active role card on the landing page
   */
  function updateCards(role) {
    var cards = document.querySelectorAll(".role-card");
    cards.forEach(function (card) {
      var cardRole = card.getAttribute("data-role");
      if (cardRole === role) {
        card.classList.add("active");
      } else {
        card.classList.remove("active");
      }
    });
  }

  /**
   * Enable the Start Reading button only once a sector has been selected
   */
  function updateStartButton(role) {
    var btn = document.querySelector(".start-reading-btn");
    if (!btn) return;

    var hasSelection = !!localStorage.getItem(STORAGE_KEY);
    if (hasSelection) {
      btn.classList.remove("btn-disabled");
      btn.removeAttribute("aria-disabled");
      btn.style.pointerEvents = "";
    } else {
      btn.classList.add("btn-disabled");
      btn.setAttribute("aria-disabled", "true");
      btn.style.pointerEvents = "none";
    }
  }

  /**
   * Set up role card click handlers on the landing page
   */
  function initCards() {
    var cards = document.querySelectorAll(".role-card");
    cards.forEach(function (card) {
      card.addEventListener("click", function () {
        var role = card.getAttribute("data-role");
        if (role) {
          setRole(role);
          applyFilter(role);
        }
      });
    });
  }

  /**
   * Make role badge clickable → navigate home to change role
   */
  function initBadge() {
    var badge = document.getElementById("role-badge");
    if (badge) {
      badge.style.cursor = "pointer";
      badge.title = "Click to change sector filter";
      badge.addEventListener("click", function () {
        // Navigate to home page using site root
        var base =
          document.querySelector('meta[name="base_url"]') ||
          document.querySelector("base");
        var baseUrl = base ? base.getAttribute("content") || base.href : "/";
        window.location.href = baseUrl;
      });
    }
  }

  /**
   * Initialize on page load and on MkDocs navigation
   */
  function init() {
    var role = getRole();
    applyFilter(role);
    initCards();
    initBadge();
  }

  // Run on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Re-run on MkDocs instant navigation (if enabled)
  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      init();
    });
  }
})();
