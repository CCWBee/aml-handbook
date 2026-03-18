/**
 * Version comparison — inline redline diff at the clause level.
 *
 * Loads version snapshots, diffs against live DOM content,
 * and renders redline markup inline. Re-injects on navigation.instant.
 */
(function () {
  "use strict";

  var MANIFEST_URL = null; // resolved relative to site root
  var manifestCache = null;
  var versionCache = {};
  var state = { selectedVersion: null };

  // ── Myers diff on word tokens ──────────────────────────────────────

  function tokenize(text) {
    return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  }

  function myersDiff(oldWords, newWords) {
    var N = oldWords.length;
    var M = newWords.length;
    var MAX = N + M;
    var V = new Array(2 * MAX + 2);
    var trace = [];

    for (var i = 0; i < V.length; i++) V[i] = 0;

    for (var d = 0; d <= MAX; d++) {
      var newV = V.slice();
      for (var k = -d; k <= d; k += 2) {
        var idx = k + MAX;
        var x;
        if (k === -d || (k !== d && V[idx - 1] < V[idx + 1])) {
          x = V[idx + 1];
        } else {
          x = V[idx - 1] + 1;
        }
        var y = x - k;
        while (x < N && y < M && oldWords[x] === newWords[y]) {
          x++;
          y++;
        }
        newV[idx] = x;
        if (x >= N && y >= M) {
          trace.push(newV);
          return buildOps(trace, oldWords, newWords, MAX);
        }
      }
      trace.push(newV);
      V = newV;
    }
    return [];
  }

  function buildOps(trace, oldWords, newWords, MAX) {
    var ops = [];
    var x = oldWords.length;
    var y = newWords.length;

    for (var d = trace.length - 1; d >= 0; d--) {
      var V = trace[d];
      var k = x - y;
      var idx = k + MAX;
      var prevK;

      if (k === -d || (k !== d && (d > 0 ? trace[d - 1][idx - 1] : 0) < (d > 0 ? trace[d - 1][idx + 1] : 0))) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }

      var prevX = d > 0 ? trace[d - 1][prevK + MAX] : 0;
      var prevY = prevX - prevK;

      // Diagonal (equal)
      while (x > prevX && y > prevY) {
        x--;
        y--;
        ops.unshift({ type: "equal", word: oldWords[x] });
      }

      if (d > 0) {
        if (x === prevX) {
          // Insert
          y--;
          ops.unshift({ type: "insert", word: newWords[y] });
        } else {
          // Delete
          x--;
          ops.unshift({ type: "delete", word: oldWords[x] });
        }
      }
    }
    return ops;
  }

  function renderDiff(oldText, newText) {
    var oldWords = tokenize(oldText);
    var newWords = tokenize(newText);

    if (oldText === newText) return null; // no change

    var ops = myersDiff(oldWords, newWords);
    var html = "";
    var currentType = null;
    var buffer = [];

    function flushBuffer() {
      if (buffer.length === 0) return;
      if (currentType === "equal") {
        html += buffer.join(" ") + " ";
      } else if (currentType === "delete") {
        html += '<span class="vc-del">' + buffer.join(" ") + "</span> ";
      } else if (currentType === "insert") {
        html += '<span class="vc-ins">' + buffer.join(" ") + "</span> ";
      }
      buffer = [];
    }

    ops.forEach(function (op) {
      if (op.type !== currentType) {
        flushBuffer();
        currentType = op.type;
      }
      buffer.push(escapeHtml(op.word));
    });
    flushBuffer();

    return html.trim();
  }

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ── DOM clause extraction (current page) ──────────────────────────

  function extractCurrentClauses() {
    var clauses = [];
    var content = document.querySelector(".md-content__inner");
    if (!content) return clauses;

    var paragraphs = content.querySelectorAll("p");
    paragraphs.forEach(function (p) {
      var strong = p.querySelector("strong:first-child");
      if (!strong) return;
      var numMatch = strong.textContent.match(/^(\d+)\.$/);
      if (!numMatch) return;

      var num = parseInt(numMatch[1]);
      var text = p.textContent.replace(/^\d+\.\s*/, "").trim();

      // Collect list items after this paragraph
      var listItems = [];
      var next = p.nextElementSibling;
      while (next && (next.tagName === "UL" || next.tagName === "OL")) {
        next.querySelectorAll("li").forEach(function (li) {
          listItems.push(li.textContent.trim());
        });
        next = next.nextElementSibling;
      }

      // Determine admonition type
      var admonition = null;
      var adm = p.closest(".admonition");
      if (adm) {
        if (adm.classList.contains("danger")) admonition = "statutory";
        else if (adm.classList.contains("warning")) admonition = "code";
        else if (adm.classList.contains("info")) admonition = "guidance";
      }

      // Get heading context
      var heading = null;
      var el = p;
      while (el) {
        el = el.previousElementSibling;
        if (el && /^H[2-4]$/.test(el.tagName)) {
          heading = el.textContent.replace(/¶$/, "").trim();
          break;
        }
      }

      clauses.push({
        num: num,
        admonition: admonition,
        heading: heading,
        text: text,
        listItems: listItems,
        element: p,
      });
    });

    return clauses;
  }

  // ── Version loading ───────────────────────────────────────────────

  function getBaseUrl() {
    // Find the site root from the canonical URL or page structure
    var base = document.querySelector('link[rel="canonical"]');
    if (base) {
      var href = base.getAttribute("href");
      var match = href.match(/^(.*?\/)sections\//);
      if (match) return match[1];
    }
    // Fallback: navigate up from current path
    var path = window.location.pathname;
    var idx = path.indexOf("/sections/");
    if (idx !== -1) return path.substring(0, idx + 1);
    return "./";
  }

  function getSectionSlug() {
    var path = window.location.pathname;
    var match = path.match(/sections\/(\d{2}-[^/]+)/);
    return match ? match[1] : null;
  }

  function loadManifest(callback) {
    if (manifestCache) {
      callback(manifestCache);
      return;
    }
    var url = getBaseUrl() + "versions/manifest.json";
    fetch(url)
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        manifestCache = data;
        callback(data);
      })
      .catch(function () {
        callback(null);
      });
  }

  function loadVersion(versionId, sectionSlug, callback) {
    var key = versionId + "/" + sectionSlug;
    if (versionCache[key]) {
      callback(versionCache[key]);
      return;
    }
    var url = getBaseUrl() + "versions/" + versionId + "/" + sectionSlug + ".json";
    fetch(url)
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (data) versionCache[key] = data;
        callback(data);
      })
      .catch(function () {
        callback(null);
      });
  }

  // ── Comparison logic ──────────────────────────────────────────────

  function compareClauses(oldClauses, currentClauses) {
    var results = [];
    var oldMap = {};
    oldClauses.forEach(function (c) {
      var key = (c.heading || "") + "|" + c.num;
      oldMap[key] = c;
    });

    var matchedOldKeys = {};

    currentClauses.forEach(function (curr) {
      var key = (curr.heading || "") + "|" + curr.num;
      var old = oldMap[key];

      if (!old) {
        // Try matching by number only
        for (var k in oldMap) {
          if (k.endsWith("|" + curr.num) && !matchedOldKeys[k]) {
            old = oldMap[k];
            key = k;
            break;
          }
        }
      }

      if (old) {
        matchedOldKeys[key] = true;
        var oldFull = old.text + " " + old.listItems.join(" ");
        var currFull = curr.text + " " + curr.listItems.join(" ");
        var diffHtml = renderDiff(oldFull, currFull);

        if (diffHtml) {
          results.push({
            type: "changed",
            clause: curr,
            diffHtml: diffHtml,
          });
        }
      } else {
        results.push({
          type: "added",
          clause: curr,
        });
      }
    });

    // Check for removed clauses
    for (var k in oldMap) {
      if (!matchedOldKeys[k]) {
        results.push({
          type: "removed",
          clause: oldMap[k],
        });
      }
    }

    return results;
  }

  // ── Redline rendering ─────────────────────────────────────────────

  function clearRedlines() {
    document
      .querySelectorAll(
        ".vc-redline, .vc-badge, .vc-summary, .vc-clause-changed, .vc-clause-new"
      )
      .forEach(function (el) {
        if (el.classList.contains("vc-redline") || el.classList.contains("vc-badge") || el.classList.contains("vc-summary")) {
          el.remove();
        } else {
          el.classList.remove("vc-clause-changed", "vc-clause-new");
        }
      });
  }

  function renderRedlines(results) {
    clearRedlines();

    var changed = 0;
    var added = 0;
    var removed = 0;

    results.forEach(function (r) {
      if (r.type === "changed" && r.clause.element) {
        changed++;
        r.clause.element.classList.add("vc-clause-changed");
        var div = document.createElement("div");
        div.className = "vc-redline";
        div.innerHTML = r.diffHtml;
        r.clause.element.insertAdjacentElement("afterend", div);
      } else if (r.type === "added" && r.clause.element) {
        added++;
        r.clause.element.classList.add("vc-clause-new");
        var badge = document.createElement("span");
        badge.className = "vc-badge vc-badge--new";
        badge.textContent = "NEW";
        r.clause.element.insertAdjacentElement("afterbegin", badge);
      } else if (r.type === "removed") {
        removed++;
      }
    });

    // Update summary in the version bar
    var summary = document.getElementById("vc-summary");
    if (summary) {
      var parts = [];
      if (changed) parts.push(changed + " changed");
      if (added) parts.push(added + " added");
      if (removed) parts.push(removed + " removed");
      summary.textContent = parts.length ? parts.join(", ") : "No changes";
      summary.style.display = "inline";
    }
  }

  // ── UI injection ──────────────────────────────────────────────────

  function inject() {
    // Remove old bar
    var old = document.getElementById("version-compare");
    if (old) old.remove();
    clearRedlines();

    // Only on section pages
    var slug = getSectionSlug();
    if (!slug) return;

    loadManifest(function (manifest) {
      if (!manifest) return;

      var bar = document.createElement("div");
      bar.id = "version-compare";
      bar.className = "version-compare";

      // Get comparable versions (all stored versions)
      var comparableVersions = manifest.versions.filter(function (v) {
        return v.id !== manifest.current;
      });

      if (comparableVersions.length === 0) {
        bar.innerHTML =
          '<span class="vc-label">Version tracking active</span>';
        insertBar(bar);
        return;
      }

      // Build version selector
      var label = document.createElement("span");
      label.className = "vc-label";
      label.textContent = "Compare with:";
      bar.appendChild(label);

      var select = document.createElement("select");
      select.className = "vc-select";
      var optNone = document.createElement("option");
      optNone.value = "";
      optNone.textContent = "Current (no comparison)";
      select.appendChild(optNone);

      comparableVersions.forEach(function (v) {
        var opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.label;
        if (state.selectedVersion === v.id) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener("change", function () {
        state.selectedVersion = select.value || null;
        if (state.selectedVersion) {
          runComparison(state.selectedVersion, slug);
        } else {
          clearRedlines();
          var s = document.getElementById("vc-summary");
          if (s) s.style.display = "none";
        }
      });

      bar.appendChild(select);

      var summary = document.createElement("span");
      summary.id = "vc-summary";
      summary.className = "vc-summary-badge";
      summary.style.display = "none";
      bar.appendChild(summary);

      insertBar(bar);

      // Re-run comparison if version was selected
      if (state.selectedVersion) {
        runComparison(state.selectedVersion, slug);
      }
    });
  }

  function insertBar(bar) {
    // Insert after h1, after admonition filter if present
    var filter = document.querySelector(".admonition-filter");
    if (filter) {
      filter.insertAdjacentElement("afterend", bar);
    } else {
      var h1 = document.querySelector(".md-content__inner h1");
      if (h1) h1.insertAdjacentElement("afterend", bar);
    }
  }

  function runComparison(versionId, slug) {
    loadVersion(versionId, slug, function (data) {
      if (!data) return;
      var currentClauses = extractCurrentClauses();
      var results = compareClauses(data.clauses, currentClauses);
      renderRedlines(results);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────

  inject();

  // Re-inject on navigation.instant page swaps
  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      inject();
    });
  }
})();
