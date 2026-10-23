/**
 * Standalone runtime for the "Mentorful Teacher Dashboard" artifact
 * (claude.ai/artifact/4tD28CDa5xajoG2969LUvo), so the published page runs
 * outside claude.ai with its own sample data.
 *
 * It stands in for the Dashboard runtime's `dash` global, the same way
 * src/app/dashboard/v2/dash.ts does for /dashboard/v2, plus what that one gets
 * from its server component: each source is fetched from ./data and reads as
 * "loading" until it arrives. Only what the page calls is implemented.
 *
 * The page is mounted like the host mounts it: its markup goes into
 * #dash-root, and each <script> runs in its own function scope.
 */
(function () {
  const BASE = "/mentortrdash/";
  const SOURCES = ["profiles", "pairings", "logs", "chat", "suggestions", "cohort", "games"];
  const DEFAULT_PARAMS = { teacher: "liam" };

  const sources = {}; // id -> { status, data, message? }
  const calcs = new Map(); // id -> { inputs, fn }
  const listeners = [];
  let cache = new Map();
  const query = new URLSearchParams(location.search);
  let params = { ...DEFAULT_PARAMS, ...(query.get("teacher") ? { teacher: query.get("teacher") } : {}) };

  function data(id) {
    const hit = cache.get(id);
    if (hit) return hit;
    let out;
    if (id in sources) {
      out = sources[id];
    } else if (calcs.has(id)) {
      const def = calcs.get(id);
      const inputs = def.inputs.map(data);
      if (inputs.some((r) => r.status === "error")) out = { status: "error", data: [], message: `An input of "${id}" failed` };
      else if (inputs.some((r) => r.status !== "ok")) out = { status: "loading", data: [] };
      else {
        try {
          out = { status: "ok", data: def.fn(...inputs.map((r) => r.data)) };
        } catch (e) {
          console.error(`[dash] calc "${id}" threw`, e);
          out = { status: "error", data: [], message: String(e) };
        }
      }
    } else {
      out = { status: "missing", data: [], message: `Unknown dataset "${id}"` };
    }
    cache.set(id, out);
    return out;
  }

  function notify() {
    cache = new Map();
    for (const cb of listeners) {
      try {
        cb();
      } catch (e) {
        console.error("[dash] render threw", e);
      }
    }
  }

  window.dash = {
    data,
    calc(id, def) {
      calcs.set(id, def);
      cache = new Map();
    },
    onData(cb) {
      listeners.push(cb);
      try {
        cb();
      } catch (e) {
        console.error("[dash] render threw", e);
      }
    },
    params: () => ({ ...params }),
    setParams(patch) {
      params = { ...params, ...patch };
      const url = new URL(location.href);
      if (params.teacher && params.teacher !== DEFAULT_PARAMS.teacher) url.searchParams.set("teacher", params.teacher);
      else url.searchParams.delete("teacher");
      history.replaceState(null, "", url);
      notify();
    },
    resetParams() {
      dash.setParams({ ...DEFAULT_PARAMS });
    },
    setLink(id) {
      history.replaceState(null, "", `${location.pathname}${location.search}#${id}`);
    },
    refresh() {},
    colors: ["#00897b", "#e09b2d", "#16283c", "#26a79a", "#7e93a6", "#c98bc4", "#7fb2d9", "#5a6670"],
  };

  SOURCES.forEach((id) => {
    sources[id] = { status: "loading", data: [] };
    fetch(`${BASE}data/${id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((rows) => {
        sources[id] = { status: "ok", data: Array.isArray(rows) ? rows : rows.rows || rows.data || [] };
      })
      .catch((e) => {
        console.error(`[dash] source "${id}" failed`, e);
        sources[id] = { status: "error", data: [], message: String(e) };
      })
      .finally(notify);
  });

  // Charts size themselves from the box they are in, so redraw on resize.
  let raf = 0;
  addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(notify);
  });

  function mount() {
    const root = document.getElementById("dash-root");
    const tpl = document.getElementById("mf-page");
    const page = tpl.content.cloneNode(true);
    const scripts = [...page.querySelectorAll("script")].map((s) => {
      s.remove();
      return s.textContent || "";
    });
    root.replaceChildren(page);
    for (const code of scripts) {
      try {
        new Function(code)();
      } catch (e) {
        console.error("[dash] page script threw", e);
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
