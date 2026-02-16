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

      // — Section 2: The problem (brief)
      '<div class="pitch-section">' +
        '<h3 class="pitch-subheading">The problem we all recognise</h3>' +
        '<div class="pitch-problem-list">' +
          '<p>Policy documents live in Word files on SharePoint. Nobody is certain which version is current. Formatting breaks when someone edits on a different machine. Tracked changes become unreadable after two rounds of review. Publishing means exporting a PDF that is immediately out of date. Staff download 200&#8209;page files to search for a single paragraph.</p>' +
          '<p>It works, but only just. And the time and effort it quietly absorbs across the organisation is significant.</p>' +
        '</div>' +
      '</div>' +

      // — Section 3: What you're looking at
      '<div class="pitch-section">' +
        '<h3 class="pitch-subheading">What this site demonstrates</h3>' +
        '<div class="pitch-grid">' +
          '<div class="pitch-item">' +
            '<strong>&#128196; One source of truth</strong>' +
            '<p>No <em>final_v3_REAL_FINAL.docx</em>. One file per section, every change tracked, every version recoverable.</p>' +
          '</div>' +
          '<div class="pitch-item">' +
            '<strong>&#127760; Automatic publishing</strong>' +
            '<p>Edit a text file and the website rebuilds itself. Glossary, cross&#8209;references, navigation, and legislation links are all generated. No manual formatting.</p>' +
          '</div>' +
          '<div class="pitch-item">' +
            '<strong>&#128241; Any device, always current</strong>' +
            '<p>Staff read it on phones, tablets, or desktops. Always the latest version. No downloading, no printing.</p>' +
          '</div>' +
          '<div class="pitch-item">' +
            '<strong>&#9999;&#65039; Editing feels like Word</strong>' +
            '<p>Free editors with familiar formatting toolbars. Staff don\'t learn code. Review workflows fit existing processes.</p>' +
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
            '<strong>&#128214; One source, every format</strong>' +
            '<p>The same text file can produce a website, a print&#8209;ready PDF, a Word document for external parties, or a briefing note. Update once, every format updates with it.</p>' +
          '</div>' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#129302; AI that knows your policies</strong>' +
            '<p>Structured text is the ideal input for AI. A chatbot where staff ask "what are my CDD obligations for a high&#8209;risk customer?" and get an accurate, sourced answer from your own documents.</p>' +
          '</div>' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#128276; Targeted change alerts</strong>' +
            '<p>When a section is updated, the people affected are notified by role, team, or topic. Not an all&#8209;staff email with a PDF attachment nobody reads.</p>' +
          '</div>' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#9201; Instant rollback</strong>' +
            '<p>Published an error? Revert to any previous version in seconds. Full history preserved, nothing lost. Compare today with last quarter at the click of a button.</p>' +
          '</div>' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#127757; Translation without rebuilding</strong>' +
            '<p>Structured content goes to translators with formatting, layout, and cross&#8209;references intact. No rebuilding a 200&#8209;page document from scratch in another language.</p>' +
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
