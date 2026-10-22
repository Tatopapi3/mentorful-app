/**
 * A tiny in-memory stand-in for the Supabase query builder, for the local preview only. It supports just
 * what Nick's pages call: select, insert, update, eq, in, or, order, limit, range, single, maybeSingle and a
 * head/count select. It is not a database and checks nothing; it lets the real pages render on made-up data.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;
export type Visibility = (table: string, rows: Row[]) => Row[];

type Order = { col: string; asc: boolean; nullsFirst: boolean };

function compare(a: any, b: any, asc: boolean, nullsFirst: boolean) {
  const an = a === null || a === undefined;
  const bn = b === null || b === undefined;
  if (an || bn) return an && bn ? 0 : an === nullsFirst ? -1 : 1;
  const c = a < b ? -1 : a > b ? 1 : 0;
  return asc ? c : -c;
}

/** A change the demo made, so it can be kept in the visitor's own cookie and replayed on the next request. */
export type Write = { t: "u"; table: string; ids: string[]; patch: Row } | { t: "i"; table: string; rows: Row[] };

class Query implements PromiseLike<any> {
  private written: Write | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private orders: Order[] = [];
  private cols: string[] | null = null;
  private lim: number | null = null;
  private rng: [number, number] | null = null;
  private mode: "select" | "insert" | "update" = "select";
  private payload: Row | Row[] | null = null;
  private head = false;
  private wantCount = false;
  private one: "single" | "maybe" | null = null;

  constructor(
    private tables: Tables,
    private table: string,
    private visible: Visibility,
    private onWrite?: (w: Write) => void | Promise<void>,
  ) {}

  select(columns?: string, opts?: { count?: "exact"; head?: boolean }) {
    if (this.mode === "select") {
      this.cols = columns && columns !== "*" ? columns.split(",").map((c) => c.trim()) : null;
    }
    if (opts?.head) this.head = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.payload = rows;
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
    this.payload = patch;
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: any) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  in(col: string, vals: any[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  or(expr: string) {
    const parts = expr.split(",").map((p) => p.split("."));
    this.filters.push((r) => parts.some(([col, op, ...v]) => op === "eq" && String(r[col]) === v.join(".")));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const asc = opts?.ascending ?? true;
    this.orders.push({ col, asc, nullsFirst: opts?.nullsFirst ?? !asc });
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  range(a: number, b: number) {
    this.rng = [a, b];
    return this;
  }
  single() {
    this.one = "single";
    return this;
  }
  maybeSingle() {
    this.one = "maybe";
    return this;
  }

  private run(): { data: any; error: any; count?: number | null } {
    const all = this.tables[this.table] ?? (this.tables[this.table] = []);
    const matches = (r: Row) => this.filters.every((f) => f(r));

    if (this.mode === "insert") {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((r) => ({ id: `new-${Math.random().toString(36).slice(2, 10)}`, created_at: new Date().toISOString(), ...r }));
      all.push(...rows);
      this.written = { t: "i", table: this.table, rows };
      return { data: null, error: null };
    }
    if (this.mode === "update") {
      const hit = this.visible(this.table, all).filter(matches);
      for (const r of hit) Object.assign(r, this.payload);
      this.written = { t: "u", table: this.table, ids: hit.map((r) => String(r.id)), patch: this.payload as Row };
      return { data: null, error: null };
    }

    let rows = this.visible(this.table, all).filter(matches);
    const count = rows.length;
    for (const o of [...this.orders].reverse()) rows = [...rows].sort((a, b) => compare(a[o.col], b[o.col], o.asc, o.nullsFirst));
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim !== null) rows = rows.slice(0, this.lim);
    if (this.head) return { data: null, error: null, count };
    const cols = this.cols;
    const out = cols ? rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null]))) : rows.map((r) => ({ ...r }));
    const base = this.wantCount ? { count } : {};
    if (this.one === "single") return out.length === 1 ? { data: out[0], error: null, ...base } : { data: null, error: { message: `expected one row, got ${out.length}` }, ...base };
    if (this.one === "maybe") return { data: out[0] ?? null, error: null, ...base };
    return { data: out, error: null, ...base };
  }

  then<T1 = any, T2 = never>(onfulfilled?: ((v: any) => T1 | PromiseLike<T1>) | null, onrejected?: ((e: any) => T2 | PromiseLike<T2>) | null): PromiseLike<T1 | T2> {
    return Promise.resolve()
      .then(async () => {
        const result = this.run();
        if (this.written && this.onWrite) await this.onWrite(this.written);
        return result;
      })
      .then(onfulfilled, onrejected);
  }
}

export function createMockClient(opts: {
  tables: Tables;
  visible: Visibility;
  user: { id: string; email: string } | null;
  rpc?: Record<string, (args: any) => any>;
  onWrite?: (w: Write) => void | Promise<void>;
}) {
  return {
    from: (table: string) => new Query(opts.tables, table, opts.visible, opts.onWrite),
    rpc: async (name: string, args: any) => {
      const fn = opts.rpc?.[name];
      return fn ? { data: fn(args), error: null } : { data: null, error: { message: `rpc ${name} is not available in preview mode` } };
    },
    auth: {
      getUser: async () => ({ data: { user: opts.user }, error: null }),
      signInWithOtp: async () => ({ error: null }),
      exchangeCodeForSession: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
    },
  };
}
