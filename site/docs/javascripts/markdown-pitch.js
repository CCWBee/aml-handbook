/**
 * "Why Markdown?" pitch modal.
 *
 * Shows automatically on first visit to the home page.
 * A persistent button in the corner lets users reopen it.
 * Dismissal is remembered via localStorage.
 */
(function () {
  "use strict";

  var SEEN_KEY = "aml-handbook-pitch-seen";
  var modal = null;
  var backdrop = null;
  var trigger = null;

  var CONTENT =
    '<div class="pitch-modal">' +
      '<button class="pitch-close" aria-label="Close">&times;</button>' +

      // — Section 1: The hook
      '<h2 class="pitch-heading">What if your documents could do this?</h2>' +
      '<p class="pitch-lead">Everything on this site was generated from plain text files. Not Word. Not SharePoint. Simple, editable text that produces a searchable, cross&#8209;referenced, mobile&#8209;friendly website automatically.</p>' +
      '<p class="pitch-lead">Close this box and try it. Select a sector, browse a section, tap a highlighted term for its definition. Then come back and consider: <strong>what does it cost us to keep doing this in Word?</strong></p>' +

      // — Section 2: The problem
      '<div class="pitch-section">' +
        '<h3 class="pitch-subheading">The problem we all recognise</h3>' +
        '<div class="pitch-problem-list">' +
          '<p>The handbook is a 200+ page Word document so old and fragile that a simple edit can take half an hour. Collaborative editing is painful. Tracking who changed what is possible but manual, and getting to the current version is an ordeal in itself. Policy staff spend time fighting formatting instead of writing policy.</p>' +
          '<p>For the people who actually need to read it, the experience is worse. Twenty separate PDFs on a website, ctrl+F to find what you need, no links between sections, no way to know if what you are reading is current. Comms manually converts the docx for publication. The document sits on SharePoint, but it is not a living resource. It is a file.</p>' +
        '</div>' +
      '</div>' +

      // — Section 3: What you're looking at
      '<div class="pitch-section">' +
        '<h3 class="pitch-subheading">What this site demonstrates</h3>' +
        '<div class="pitch-grid">' +
          '<div class="pitch-item">' +
            '<strong>&#128196; One source of truth</strong>' +
            '<p>One file per section instead of one enormous document. Each section is small, fast to open, and simple to edit. The handbook stops being a monolith.</p>' +
          '</div>' +
          '<div class="pitch-item">' +
            '<strong>&#9999;&#65039; Policy writes, formatting is handled</strong>' +
            '<p>Policy staff write content and nothing else. Formatting, layout, glossary tooltips, cross&#8209;references, and legislation links are all generated automatically. Comms controls the look and feel once, at the top level, for every document.</p>' +
          '</div>' +
          '<div class="pitch-item">' +
            '<strong>&#128269; Searchable and linked</strong>' +
            '<p>One website instead of twenty PDFs. Full&#8209;text search across every section. Terms link to definitions. Sections cross&#8209;reference each other. Legislation links to the official source. The handbook becomes a tool people actually use.</p>' +
          '</div>' +
          '<div class="pitch-item">' +
            '<strong>&#128241; Always current, any device</strong>' +
            '<p>Staff read the handbook on whatever device they have. No downloading, no guessing whether the PDF is the latest version. An edit is published the moment it is saved.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // — Section 4: What else opens up
      '<div class="pitch-teaser">' +
        '<h3 class="pitch-subheading">And this is just a starting point</h3>' +
        '<p class="pitch-teaser-lead">Once documents live as structured text, capabilities that are impossible in Word become straightforward.</p>' +
        '<div class="pitch-teaser-grid">' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#128269; Side&#8209;by&#8209;side version comparison</strong>' +
            '<p>See exactly what changed between any two versions, word by word, highlighted in colour. Every edit attributed to a person. A complete audit trail regulators can inspect on demand.</p>' +
          '</div>' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#128214; Every format from one source</strong>' +
            '<p>The same text file can produce a website, a print&#8209;ready PDF, or a Word document for external parties. Policy updates once and every output updates with it. No manual reformatting, no divergence between versions.</p>' +
          '</div>' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#129302; AI that knows your policies</strong>' +
            '<p>Structured text is the ideal input for AI. A chatbot where staff ask "what are my CDD obligations for a high&#8209;risk customer?" and get an accurate, sourced answer from your own documents. Not a generic internet search.</p>' +
          '</div>' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#128276; Targeted change alerts</strong>' +
            '<p>When a section is updated, the people affected are notified by role, team, or topic. Not an all&#8209;staff email hoping someone reads the attachment.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // — Section 5: The bottom line
      '<div class="pitch-bottom">' +
        '<h3 class="pitch-subheading">Can we actually do this?</h3>' +
        '<p>Yes. Today. This site is a collection of plain text files and one small configuration file. There is no custom software, no database, no web developer on retainer. The tools that build it are free, stable, open&#8209;source packages used by thousands of organisations worldwide.</p>' +
        '<p>To update content, someone edits a text file in a familiar editor and saves it. The site rebuilds. The workflow runs entirely on infrastructure and skills the organisation already has.</p>' +
        '<p class="pitch-closing"><strong>This is not a prototype. It is working software, built with capability we already own, ready to scale across any document we manage.</strong></p>' +
      '</div>' +
    '</div>';

  function isHomePage() {
    var path = window.location.pathname;
    return path === "/" ||
      path.match(/\/index\.html?$/) ||
      path.match(/\/aml-handbook\/?$/) ||
      path.match(/\/aml-handbook\/index\.html?$/);
  }

  function createTrigger() {
    if (trigger) return;
    trigger = document.createElement("button");
    trigger.className = "pitch-trigger";
    trigger.textContent = "Why Markdown?";
    trigger.addEventListener("click", openModal);
    document.body.appendChild(trigger);
  }

  function removeTrigger() {
    if (trigger) {
      trigger.remove();
      trigger = null;
    }
  }

  function openModal() {
    if (modal) return;

    backdrop = document.createElement("div");
    backdrop.className = "pitch-backdrop";
    backdrop.addEventListener("click", closeModal);

    var container = document.createElement("div");
    container.innerHTML = CONTENT;
    modal = container.firstChild;

    modal.querySelector(".pitch-close").addEventListener("click", closeModal);

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    document.body.style.overflow = "hidden";

    // Animate in
    requestAnimationFrame(function () {
      backdrop.classList.add("visible");
      modal.classList.add("visible");
    });
  }

  function closeModal() {
    if (!modal) return;

    backdrop.classList.remove("visible");
    modal.classList.remove("visible");
    document.body.style.overflow = "";

    // Remove after transition
    setTimeout(function () {
      if (backdrop) { backdrop.remove(); backdrop = null; }
      if (modal) { modal.remove(); modal = null; }
    }, 250);

    // Remember dismissal
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch (e) {}
  }

  function init() {
    if (!isHomePage()) {
      removeTrigger();
      return;
    }

    createTrigger();

    // Auto-show on first visit
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        // Small delay so the page renders first
        setTimeout(openModal, 600);
      }
    } catch (e) {}
  }

  // Close on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal) closeModal();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Re-run on MkDocs instant navigation
  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      init();
    });
  }
})();
