/**
 * Version comparison — inline redline diff at the clause level.
 *
 * Small toggle integrated into the admonition filter bar. Click to open
 * a version selector panel. Selecting a version shows inline redlines.
 */
(function () {
  "use strict";

  var manifestCache = null;
  var versionCache = {};
  var state = { selectedVersion: null, panelOpen: false };

  // ── Myers diff ────────────────────────────────────────────────────

  function tokenize(t) {
    return t.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  }

  function myersDiff(a, b) {
    var N = a.length, M = b.length, MAX = N + M;
    var V = new Array(2 * MAX + 2).fill(0);
    var trace = [];
    for (var d = 0; d <= MAX; d++) {
      var nv = V.slice();
      for (var k = -d; k <= d; k += 2) {
        var idx = k + MAX, x;
        if (k === -d || (k !== d && V[idx - 1] < V[idx + 1])) x = V[idx + 1];
        else x = V[idx - 1] + 1;
        var y = x - k;
        while (x < N && y < M && a[x] === b[y]) { x++; y++; }
        nv[idx] = x;
        if (x >= N && y >= M) { trace.push(nv); return build(trace, a, b, MAX); }
      }
      trace.push(nv); V = nv;
    }
    return [];
  }

  function build(trace, a, b, MAX) {
    var ops = [], x = a.length, y = b.length;
    for (var d = trace.length - 1; d >= 0; d--) {
      var V = trace[d], k = x - y, prevK;
      if (k === -d || (k !== d && (d > 0 ? trace[d-1][k-1+MAX] : 0) < (d > 0 ? trace[d-1][k+1+MAX] : 0)))
        prevK = k + 1; else prevK = k - 1;
      var px = d > 0 ? trace[d-1][prevK+MAX] : 0, py = px - prevK;
      while (x > px && y > py) { x--; y--; ops.unshift({t:"eq", w:a[x]}); }
      if (d > 0) { if (x === px) { y--; ops.unshift({t:"ins", w:b[y]}); } else { x--; ops.unshift({t:"del", w:a[x]}); } }
    }
    return ops;
  }

  function esc(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

  function renderDiff(oldT, newT) {
    if (oldT === newT) return null;
    var ops = myersDiff(tokenize(oldT), tokenize(newT));
    var html = "", ct = null, buf = [];
    function flush() {
      if (!buf.length) return;
      if (ct === "eq") html += buf.join(" ") + " ";
      else if (ct === "del") html += '<span class="vc-del">' + buf.join(" ") + "</span> ";
      else if (ct === "ins") html += '<span class="vc-ins">' + buf.join(" ") + "</span> ";
      buf = [];
    }
    ops.forEach(function(o) { if (o.t !== ct) { flush(); ct = o.t; } buf.push(esc(o.w)); });
    flush();
    return html.trim();
  }

  // ── DOM clause extraction ─────────────────────────────────────────

  function extractCurrentClauses() {
    var clauses = [], content = document.querySelector(".md-content__inner");
    if (!content) return clauses;
    content.querySelectorAll("p").forEach(function(p) {
      var s = p.querySelector("strong:first-child");
      if (!s) return;
      var m = s.textContent.match(/^(\d+)\.$/);
      if (!m) return;
      var num = parseInt(m[1]);
      var text = p.textContent.replace(/^\d+\.\s*/, "").trim();
      var listItems = [], next = p.nextElementSibling;
      while (next && (next.tagName === "UL" || next.tagName === "OL")) {
        next.querySelectorAll("li").forEach(function(li) { listItems.push(li.textContent.trim()); });
        next = next.nextElementSibling;
      }
      var admonition = null, adm = p.closest(".admonition");
      if (adm) {
        if (adm.classList.contains("danger")) admonition = "statutory";
        else if (adm.classList.contains("warning")) admonition = "code";
        else if (adm.classList.contains("info")) admonition = "guidance";
      }
      var heading = null, el = p;
      while (el) { el = el.previousElementSibling; if (el && /^H[2-4]$/.test(el.tagName)) { heading = el.textContent.replace(/¶$/, "").trim(); break; } }
      clauses.push({ num: num, admonition: admonition, heading: heading, text: text, listItems: listItems, element: p });
    });
    return clauses;
  }

  // ── Loading ───────────────────────────────────────────────────────

  function getBaseUrl() {
    var path = window.location.pathname;
    var idx = path.indexOf("/sections/");
    if (idx !== -1) return path.substring(0, idx + 1);
    return "./";
  }

  function getSectionSlug() {
    var m = window.location.pathname.match(/sections\/(\d{2}-[^/]+)/);
    return m ? m[1] : null;
  }

  function loadManifest(cb) {
    if (manifestCache) { cb(manifestCache); return; }
    fetch(getBaseUrl() + "versions/manifest.json")
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) { manifestCache = d; cb(d); })
      .catch(function() { cb(null); });
  }

  function loadVersion(vid, slug, cb) {
    var key = vid + "/" + slug;
    if (versionCache[key]) { cb(versionCache[key]); return; }
    fetch(getBaseUrl() + "versions/" + vid + "/" + slug + ".json")
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) { if (d) versionCache[key] = d; cb(d); })
      .catch(function() { cb(null); });
  }

  // ── Comparison ────────────────────────────────────────────────────

  function compareClauses(oldClauses, currentClauses) {
    var results = [], oldMap = {}, matched = {};
    oldClauses.forEach(function(c) { oldMap[(c.heading||"")+"|"+c.num] = c; });
    currentClauses.forEach(function(curr) {
      var key = (curr.heading||"")+"|"+curr.num;
      var old = oldMap[key];
      if (!old) { for (var k in oldMap) { if (k.endsWith("|"+curr.num) && !matched[k]) { old = oldMap[k]; key = k; break; } } }
      if (old) {
        matched[key] = true;
        var diff = renderDiff(old.text + " " + old.listItems.join(" "), curr.text + " " + curr.listItems.join(" "));
        if (diff) results.push({ type: "changed", clause: curr, diffHtml: diff });
      } else {
        results.push({ type: "added", clause: curr });
      }
    });
    for (var k in oldMap) { if (!matched[k]) results.push({ type: "removed", clause: oldMap[k] }); }
    return results;
  }

  // ── Redline rendering ─────────────────────────────────────────────

  function clearRedlines() {
    document.querySelectorAll(".vc-redline, .vc-badge").forEach(function(el) { el.remove(); });
    document.querySelectorAll(".vc-clause-changed, .vc-clause-new").forEach(function(el) {
      el.classList.remove("vc-clause-changed", "vc-clause-new");
    });
  }

  function renderRedlines(results) {
    clearRedlines();
    var changed = 0, added = 0, removed = 0;
    results.forEach(function(r) {
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
      } else if (r.type === "removed") { removed++; }
    });
    return { changed: changed, added: added, removed: removed };
  }

  // ── UI ────────────────────────────────────────────────────────────

  function inject() {
    var old = document.getElementById("vc-toggle");
    if (old) old.remove();
    var oldPanel = document.getElementById("vc-panel");
    if (oldPanel) oldPanel.remove();
    clearRedlines();

    var slug = getSectionSlug();
    if (!slug) return;

    loadManifest(function(manifest) {
      if (!manifest) return;
      var versions = manifest.versions.filter(function(v) { return v.id !== manifest.current; });
      if (!versions.length) return;

      // Create toggle button
      var toggle = document.createElement("button");
      toggle.id = "vc-toggle";
      toggle.className = "vc-toggle" + (state.selectedVersion ? " active" : "");
      toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>'
        + (state.selectedVersion ? '<span class="vc-summary-inline" id="vc-summary-text"></span>' : 'History');

      // Create dropdown panel
      var panel = document.createElement("div");
      panel.id = "vc-panel";
      panel.className = "vc-panel";
      panel.style.display = "none";

      var panelLabel = document.createElement("div");
      panelLabel.className = "vc-panel-label";
      panelLabel.textContent = "Compare against";
      panel.appendChild(panelLabel);

      // "None" option
      var noneBtn = document.createElement("button");
      noneBtn.className = "vc-version-btn" + (!state.selectedVersion ? " active" : "");
      noneBtn.textContent = "No comparison";
      noneBtn.addEventListener("click", function() {
        state.selectedVersion = null;
        panel.style.display = "none";
        toggle.classList.remove("active");
        toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>History';
        clearRedlines();
      });
      panel.appendChild(noneBtn);

      versions.forEach(function(v) {
        var btn = document.createElement("button");
        btn.className = "vc-version-btn" + (state.selectedVersion === v.id ? " active" : "");
        btn.textContent = v.label;
        btn.addEventListener("click", function() {
          state.selectedVersion = v.id;
          panel.style.display = "none";
          toggle.classList.add("active");
          // Update all version btns
          panel.querySelectorAll(".vc-version-btn").forEach(function(b) { b.classList.remove("active"); });
          btn.classList.add("active");
          runComparison(v.id, slug, toggle);
        });
        panel.appendChild(btn);
      });

      toggle.addEventListener("click", function(e) {
        e.stopPropagation();
        var showing = panel.style.display !== "none";
        panel.style.display = showing ? "none" : "block";
      });

      // Close panel on outside click
      document.addEventListener("click", function() {
        panel.style.display = "none";
      });
      panel.addEventListener("click", function(e) { e.stopPropagation(); });

      // Insert into the admonition filter bar or after h1
      var filterBar = document.querySelector(".admonition-filter");
      if (filterBar) {
        filterBar.style.position = "relative";
        filterBar.appendChild(toggle);
        filterBar.appendChild(panel);
      } else {
        var h1 = document.querySelector(".md-content__inner h1");
        if (h1) {
          var wrap = document.createElement("div");
          wrap.style.cssText = "position:relative;display:inline-block;float:right;margin-top:-0.5rem;";
          wrap.appendChild(toggle);
          wrap.appendChild(panel);
          h1.insertAdjacentElement("afterend", wrap);
        }
      }

      // Re-run if version was selected
      if (state.selectedVersion) {
        runComparison(state.selectedVersion, slug, toggle);
      }
    });
  }

  function runComparison(versionId, slug, toggle) {
    loadVersion(versionId, slug, function(data) {
      if (!data) return;
      var current = extractCurrentClauses();
      var results = compareClauses(data.clauses, current);
      var counts = renderRedlines(results);
      // Update toggle text
      var parts = [];
      if (counts.changed) parts.push(counts.changed + " changed");
      if (counts.added) parts.push(counts.added + " new");
      if (counts.removed) parts.push(counts.removed + " removed");
      var summaryText = parts.length ? parts.join(", ") : "No changes";
      toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>'
        + '<span class="vc-summary-inline">' + summaryText + '</span>';
    });
  }

  // ── Init ──────────────────────────────────────────────────────────
  inject();
  if (typeof document$ !== "undefined") { document$.subscribe(function() { inject(); }); }
})();
