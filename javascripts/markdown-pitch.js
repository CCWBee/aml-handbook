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

      // — Hook
      '<h2 class="pitch-heading">What if your documents could do this?</h2>' +
      '<p class="pitch-lead">Everything on this site was generated from plain text files. Not Word, not SharePoint. Simple, editable text that automatically produces the searchable, cross&#8209;referenced, mobile&#8209;friendly website you are looking at right now.</p>' +
      '<p class="pitch-lead">Close this box and try it for yourself. Select a sector, browse a section, tap a highlighted term for its definition. Then ask yourself: <strong>what does it cost us to keep doing this in Word?</strong></p>' +

      // — The problem
      '<div class="pitch-section">' +
        '<h3 class="pitch-subheading">Where we are today</h3>' +
        '<div class="pitch-problem-list">' +
          '<p>The handbook is a 200+ page Word document. It is so large and fragile that a straightforward edit can take half an hour. Collaborative editing is painful. Tracking changes is possible but manual, and confirming the current version is an ordeal. Policy staff spend their time fighting formatting instead of writing policy.</p>' +
          '<p>For the people who need to read it, the experience is harder still. Twenty separate PDFs on a website. No links between sections. No way to tell whether what you are reading is current. Comms manually converts the docx for publication each time. The document sits on SharePoint, but it is not a living resource. It is a file.</p>' +
        '</div>' +
      '</div>' +

      // — What this changes
      '<div class="pitch-section">' +
        '<h3 class="pitch-subheading">What changes with this approach</h3>' +
        '<div class="pitch-grid">' +
          '<div class="pitch-item">' +
            '<strong>&#128196; One source of truth</strong>' +
            '<p>One file per section instead of one enormous document. Each section is small, fast to open, and simple to edit independently.</p>' +
          '</div>' +
          '<div class="pitch-item">' +
            '<strong>&#9999;&#65039; Content separated from formatting</strong>' +
            '<p>Policy staff write content. Formatting, layout, glossary tooltips, cross&#8209;references, and legislation links are generated automatically. Comms controls the look and feel once, at the top level, across every document.</p>' +
          '</div>' +
          '<div class="pitch-item">' +
            '<strong>&#128269; Searchable, linked, and usable</strong>' +
            '<p>One website instead of twenty PDFs. Full&#8209;text search across every section. Terms link to definitions. Sections cross&#8209;reference each other. Legislation links to the official source.</p>' +
          '</div>' +
          '<div class="pitch-item">' +
            '<strong>&#128241; Always current, any device</strong>' +
            '<p>Staff read it on whatever device they have. No downloading, no guessing versions. An edit is live the moment it is saved.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // — What else opens up
      '<div class="pitch-teaser">' +
        '<h3 class="pitch-subheading">What else this makes possible</h3>' +
        '<p class="pitch-teaser-lead">Once documents are structured text rather than formatted files, things that are currently impractical become straightforward.</p>' +
        '<div class="pitch-teaser-grid">' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#128269; Side&#8209;by&#8209;side version comparison</strong>' +
            '<p>See exactly what changed between any two versions, word by word, highlighted in colour. Every edit attributed to a person, giving regulators a complete audit trail on demand.</p>' +
          '</div>' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#128214; Every format from one source</strong>' +
            '<p>The same source file produces a website, a print&#8209;ready PDF, or a Word document for external parties. Policy updates once and every output stays in sync. No manual reformatting.</p>' +
          '</div>' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#129302; AI that knows your policies</strong>' +
            '<p>Structured text is the ideal input for AI. Staff could ask "what are my CDD obligations for a high&#8209;risk customer?" and get an accurate, sourced answer drawn directly from your own documents.</p>' +
          '</div>' +
          '<div class="pitch-teaser-item">' +
            '<strong>&#128276; Targeted change notifications</strong>' +
            '<p>When a section is updated, the people affected are notified by role, team, or topic. No more relying on all&#8209;staff emails and hoping someone reads the attachment.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // — The bottom line
      '<div class="pitch-bottom">' +
        '<h3 class="pitch-subheading">Can we actually do this?</h3>' +
        '<p>Yes, and not as a future project. This site is a collection of plain text files and one small configuration file. There is no custom software to maintain, no database, and no web developer on retainer. The tools that build it are free, stable, open&#8209;source packages already used by thousands of organisations worldwide.</p>' +
        '<p>To update content, someone opens a text file in a familiar editor, makes their changes, and saves. The site rebuilds itself. The entire workflow runs on infrastructure and skills the organisation already has.</p>' +
        '<p class="pitch-closing"><strong>This is not a prototype. It is working software, built with capability we already own, ready to scale to any document we manage.</strong></p>' +
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
