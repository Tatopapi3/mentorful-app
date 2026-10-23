/**
 * A minimal stand-in for the claude.ai Dashboard runtime's `dash` global, which
 * the artifact page in public/dashboard-v2/dashboard.html is written against.
 *
 * Only what that page calls is implemented: named source datasets, derived
 * `calc` datasets, params, a change listener, and `setLink`. Sources arrive
 * already loaded from the server component, so nothing is ever "loading" here;
 * a calc whose fn throws reports `error`, which the page renders as
 * "Failed to load".
 */

export type Row = Record<string, unknown>;
export type Datasets = Record<string, Row[]>;

type Result =
  | { status: "ok"; data: Row[] }
  | { status: "error"; data: Row[]; error: string };

type CalcDef = { inputs: string[]; fn: (...inputs: Row[][]) => Row[] };

export type Dash = ReturnType<typeof createDash>;

export function createDash(initial: Datasets, initialParams: Record<string, string>) {
  let sources = initial;
  let params = { ...initialParams };
  const calcs = new Map<string, CalcDef>();
  const listeners: Array<() => void> = [];
  let cache = new Map<string, Result>();

  function data(id: string): Result {
    const hit = cache.get(id);
    if (hit) return hit;
    let out: Result;
    if (id in sources) {
      out = { status: "ok", data: sources[id] };
    } else {
      const def = calcs.get(id);
      if (!def) {
        out = { status: "error", data: [], error: `Unknown dataset "${id}"` };
      } else {
        const inputs = def.inputs.map(data);
        const bad = inputs.find((r) => r.status !== "ok");
        if (bad) {
          out = { status: "error", data: [], error: `Input of "${id}" failed` };
        } else {
          try {
            out = { status: "ok", data: def.fn(...inputs.map((r) => r.data)) };
          } catch (e) {
            console.error(`[dash] calc "${id}" threw`, e);
            out = { status: "error", data: [], error: String(e) };
          }
        }
      }
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

  return {
    calc(id: string, def: CalcDef) {
      calcs.set(id, def);
      cache = new Map();
    },
    data,
    params: () => ({ ...params }),
    setParams(patch: Record<string, string>) {
      params = { ...params, ...patch };
      notify();
    },
    onData(cb: () => void) {
      listeners.push(cb);
      queueMicrotask(() => {
        try {
          cb();
        } catch (e) {
          console.error("[dash] render threw", e);
        }
      });
    },
    setLink(id: string) {
      history.replaceState(null, "", `#${id}`);
    },
    /** Called by the React wrapper when the server sends fresh rows. */
    setSources(next: Datasets) {
      sources = next;
      notify();
    },
  };
}
