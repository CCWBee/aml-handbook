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
      '<h2 class="pitch-heading">This handbook was built with Markdown.</h2>' +
      '<p class="pitch-lead">Not Word. Not SharePoint. Plain text files that generate everything you see here. If your organisation still manages policy documents in Word, consider what that costs you.</p>' +
      '<div class="pitch-grid">' +
        '<div class="pitch-item">' +
          '<div class="pitch-icon">&#128196;</div>' +
          '<strong>No more version chaos</strong>' +
          '<p>One source of truth. No <em>final_v3_REAL_FINAL.docx</em>. Every change is tracked, every version recoverable, and there is never confusion over which copy is current.</p>' +
        '</div>' +
        '<div class="pitch-item">' +
          '<div class="pitch-icon">&#127760;</div>' +
          '<strong>Instant web publishing</strong>' +
          '<p>Edit a text file, get a searchable website. Glossary tooltips, cross&#8209;references, and navigation are all built automatically. No manual formatting required.</p>' +
        '</div>' +
        '<div class="pitch-item">' +
          '<div class="pitch-icon">&#128241;</div>' +
          '<strong>Works on any device</strong>' +
          '<p>Staff read it on phones, tablets, or desktops. No downloading 200&#8209;page PDFs. No printing. Always up to date.</p>' +
        '</div>' +
        '<div class="pitch-item">' +
          '<div class="pitch-icon">&#9989;</div>' +
          '<strong>Built&#8209;in quality control</strong>' +
          '<p>Glossary definitions, section cross&#8209;references, and legislation links are all generated from the source files. Update once, correct everywhere.</p>' +
        '</div>' +
        '<div class="pitch-item">' +
          '<div class="pitch-icon">&#128176;</div>' +
          '<strong>No licence fees or vendor lock&#8209;in</strong>' +
          '<p>Plain text never goes obsolete. It works with free, open&#8209;source tools. Your content belongs to you, forever.</p>' +
        '</div>' +
        '<div class="pitch-item">' +
          '<div class="pitch-icon">&#9999;&#65039;</div>' +
          '<strong>Familiar editing experience</strong>' +
          '<p>WYSIWYG editors look and feel like Word. Staff don\'t need to learn code. Review workflows slot into existing processes.</p>' +
        '</div>' +
      '</div>' +
      '<div class="pitch-footer">' +
        '<h3 class="pitch-subheading">How hard is this to maintain?</h3>' +
        '<p>This site is a collection of plain text files and one small configuration file. That is it. There is no custom software to maintain, no database, and no web developer on call. The tools that build it are free, stable open&#8209;source packages used by thousands of organisations worldwide. They will not disappear.</p>' +
        '<p>To update content, a staff member edits a text file in a familiar word&#8209;processor&#8209;style editor and saves it. The site rebuilds itself. The entire workflow runs on infrastructure and skills the organisation already has today.</p>' +
        '<p><strong>This is not a proof of concept. It is ready now, built with capability you already own.</strong></p>' +
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
