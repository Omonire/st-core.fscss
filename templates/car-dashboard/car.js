/* Figsh Drive — connected car dashboard
   All chart geometry is baked into the compiled CSS; this file only
   handles range switching, the peak marker, and control state. */

(function () {
  "use strict";

  /* Must stay in sync with the @arr declarations in car.fscss.
     Polygon stop counts are compiled per array, so these cannot be
     derived from the DOM. */
  var SERIES = {
    "7d":  { data: [62, 71, 55, 84, 90, 73, 68],              labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    "30d": { data: [48, 55, 52, 61, 58, 67, 72, 69, 75, 71], labels: ["Day 1", "Day 4", "Day 7", "Day 10", "Day 13", "Day 16", "Day 19", "Day 22", "Day 25", "Day 28"] },
    "90d": { data: [66, 71, 64, 77, 69, 58, 63, 74, 81, 76, 70, 65], labels: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8", "Week 9", "Week 10", "Week 11", "Week 12"] }
  };

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------------
     Sidebar (off-canvas below 1180px)
     ---------------------------------------------------------------- */
  (function sidebar() {
    var btn = $("#menuBtn");
    var scrim = $("#scrim");
    if (!btn || !scrim) { return; }

    function setOpen(open) {
      document.body.classList.toggle("nav-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    }

    btn.addEventListener("click", function () {
      setOpen(!document.body.classList.contains("nav-open"));
    });
    scrim.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
        setOpen(false);
        btn.focus();
      }
    });

    /* Horizontal swipe to open, swipe left to close. Only engages when
       the drawer is not already open, so it can't fight the scrim. */
    var startX = 0, startY = 0, tracking = false;

    document.addEventListener("touchstart", function (e) {
      if (!e.touches.length) { return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = window.matchMedia("(max-width: 1180px)").matches;
    }, { passive: true });

    document.addEventListener("touchend", function (e) {
      if (!tracking || !e.changedTouches.length) { tracking = false; return; }
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      tracking = false;
      if (Math.abs(dx) < 55 || Math.abs(dy) > 45) { return; }
      if (dx > 0 && !document.body.classList.contains("nav-open")) { setOpen(true); }
      else if (dx < 0 && document.body.classList.contains("nav-open")) { setOpen(false); }
    }, { passive: true });
  })();

  /* ----------------------------------------------------------------
     Chart range tabs
     ---------------------------------------------------------------- */
  (function chartTabs() {
    var tablist = $("#chartTabs");
    if (!tablist) { return; }

    var tabs = $$('[role="tab"]', tablist);
    var panels = {};
    tabs.forEach(function (t) { panels[t.getAttribute("aria-controls")] = t; });

    function paintPeak(key) {
      var panel = $("#range-" + key);
      var peak = panel && $("[data-peak]", panel);
      var series = SERIES[key];
      if (!peak || !series) { return; }

      /* Peak = highest value, matching the chart's inverted Y
         (st-core writes --st-p as 100 - value, so higher is smaller %). */
      var best = 0;
      series.data.forEach(function (v, i) { if (v > series.data[best]) { best = i; } });

      var x = series.data.length > 1 ? (best / (series.data.length - 1)) * 100 : 50;
      peak.style.setProperty("--st-peak-x", x.toFixed(3) + "%");
      peak.style.setProperty("--st-peak-y", (100 - series.data[best]).toFixed(3) + "%");
    }

    function describe(key) {
      var s = SERIES[key];
      if (!s) { return; }
      var max = Math.max.apply(null, s.data);
      var min = Math.min.apply(null, s.data);
      var avg = (s.data.reduce(function (a, b) { return a + b; }, 0) / s.data.length).toFixed(1);
      var label = key === "7d" ? "last 7 days" : key === "30d" ? "last 30 days" : "last 90 days";
      $("#chartDesc").textContent =
        "Average speed over the " + label + ": peak " + max +
        " km/h, low " + min + " km/h, mean " + avg + " km/h across " +
        s.data.length + " sessions.";
    }

    function select(key, moveFocus) {
      tabs.forEach(function (t) {
        var on = t.id === "tab-" + key;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;

        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) {
          panel.classList.toggle("is-active", on);
          panel.hidden = !on;
        }
        if (on && moveFocus) { t.focus(); }
      });
      paintPeak(key);
      describe(key);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        select(tab.id.replace("tab-", ""), false);
      });
    });

    /* Roving tabindex: only the selected tab is in the tab order. */
    tablist.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) { return; }
      var next = null;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") { next = (i + 1) % tabs.length; }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { next = (i - 1 + tabs.length) % tabs.length; }
      else if (e.key === "Home") { next = 0; }
      else if (e.key === "End") { next = tabs.length - 1; }

      if (next === null) { return; }
      e.preventDefault();
      select(tabs[next].id.replace("tab-", ""), true);
    });

    select("7d", false);
  })();

  /* ----------------------------------------------------------------
     Count-up values
     ---------------------------------------------------------------- */
  (function counters() {
    var nodes = $$("[data-count]");
    if (!nodes.length) { return; }

    if (reduceMotion) {
      nodes.forEach(function (n) { n.textContent = n.dataset.count; });
      return;
    }

    nodes.forEach(function (node, idx) {
      var target = parseFloat(node.dataset.count);
      var places = parseInt(node.dataset.decimals || "0", 10);
      var dur = 950;
      var delay = 90 + idx * 70;

      setTimeout(function () {
        var start = performance.now();
        function step(now) {
          var t = Math.min((now - start) / dur, 1);
          var eased = 1 - Math.pow(1 - t, 3);
          node.textContent = (target * eased).toFixed(places);
          if (t < 1) { requestAnimationFrame(step); }
        }
        requestAnimationFrame(step);
      }, delay);
    });
  })();

  /* ----------------------------------------------------------------
     Lock toggle
     ---------------------------------------------------------------- */
  (function lock() {
    var btn = $("#lockBtn");
    if (!btn) { return; }
    var locked = false;

    btn.addEventListener("click", function () {
      locked = !locked;
      btn.classList.toggle("is-on", locked);
      btn.setAttribute("aria-pressed", locked ? "true" : "false");
      btn.setAttribute("aria-label", locked ? "Unlock vehicle" : "Lock vehicle");
    });
  })();

  /* ----------------------------------------------------------------
     Dropdown
     ---------------------------------------------------------------- */
  (function dropdown() {
    var btn = $("#moreBtn");
    var menu = $("#moreMenu");
    if (!btn || !menu) { return; }

    function setOpen(open) {
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(menu.hidden);
    });

    document.addEventListener("click", function (e) {
      if (!menu.hidden && !menu.contains(e.target)) { setOpen(false); }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) {
        setOpen(false);
        btn.focus();
      }
    });

    $$(".dropdown-item", menu).forEach(function (item) {
      item.addEventListener("click", function () { setOpen(false); });
    });
  })();

  /* ----------------------------------------------------------------
     Climate
     The cabin temp owns its element outright — it is deliberately NOT a
     [data-count] target, otherwise this block and the counter above
     would both write to the same node on load.
     ---------------------------------------------------------------- */
  (function climate() {
    var temp = $("#cabinTemp");
    if (!temp) { return; }

    var MIN = 16, MAX = 30, value = 22;

    function render(next) {
      value = next;
      temp.textContent = String(value);
    }

    if (!reduceMotion) {
      var start = performance.now() + 240;
      (function step(now) {
        var t = Math.min(Math.max((now - start) / 900, 0), 1);
        if (t <= 0) {
          temp.textContent = "0";
          requestAnimationFrame(step);
          return;
        }
        var eased = 1 - Math.pow(1 - t, 3);
        temp.textContent = String(Math.round(22 * eased));
        if (t < 1) { requestAnimationFrame(step); }
      })(performance.now());
    }

    $$("[data-climate]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        render(Math.min(MAX, Math.max(MIN, value + parseInt(btn.dataset.climate, 10))));
      });
    });

    $$(".pill").forEach(function (pill) {
      pill.addEventListener("click", function () {
        $$(".pill").forEach(function (p) {
          p.classList.remove("is-on");
          p.setAttribute("aria-pressed", "false");
        });
        pill.classList.add("is-on");
        pill.setAttribute("aria-pressed", "true");
      });
    });
  })();
})();