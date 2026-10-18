import fs from "node:fs";
import path from "node:path";

export const WEB = path.resolve(import.meta.dirname, "..");
export const read = (rel: string) => fs.readFileSync(path.join(WEB, rel), "utf8");

export function walk(dir: string, ext: RegExp): string[] {
  return fs.readdirSync(path.join(WEB, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name === ".next" ? [] : walk(rel, ext);
    return ext.test(e.name) ? [rel] : [];
  });
}

/** SQL with comments removed, so a sketch in a comment never counts as applied. */
export const sqlCode = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");

export const stripTsComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Small deterministic generator so fixtures are identical on every run. */
export function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
