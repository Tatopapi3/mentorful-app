import type { Deck, DeckBlock, DeckSlide } from "./deck";

/*
 * The leadership deck as one self-contained page. On screen the slides stack; when printed, each slide is its own
 * 16:9 landscape page, so "Save as PDF" gives a clean deck. Sizes use the slide's own width (cqw), so a slide looks
 * the same at any size.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function block(b: DeckBlock): string {
  if (b.kind === "stats") {
    return `<div class="stats">${b.items.map((i) => `<div class="stat"><strong>${esc(i.value)}</strong><b>${esc(i.label)}</b><span>${esc(i.note)}</span></div>`).join("")}</div>`;
  }
  if (b.kind === "bars") {
    return `<div class="bars">${b.rows.map((r) => `<div class="bar"><span>${esc(r.label)}</span><i><u style="width:${Math.max(5, Math.min(100, (r.value / r.max) * 100)).toFixed(1)}%"></u></i><em>${esc(r.text)}</em></div>`).join("")}</div>`;
  }
  if (b.kind === "table") {
    return `<table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table>`;
  }
  if (b.kind === "points") {
    return `<div class="points">${b.items.map((p) => `<div class="point"><b>${esc(p.title)}</b><span>${esc(p.detail)}</span></div>`).join("")}</div>`;
  }
  return `<p class="note">${esc(b.text)}</p>`;
}

function slide(s: DeckSlide, deck: Deck, n: number): string {
  if (s.cover) {
    return `<section class="slide cover"><div class="in"><p class="kick">${esc(s.kicker)}</p><h1>${esc(s.title)}</h1>${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ""}<p class="when">${esc(deck.cycle)} · ${esc(deck.date)}</p></div></section>`;
  }
  return `<section class="slide"><div class="in"><p class="kick">${esc(s.kicker)}</p><h2>${esc(s.title)}</h2>${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ""}${s.blocks.map(block).join("")}</div><footer><span>Mentorful · ${esc(deck.school)} · ${esc(deck.cycle)} · Counts only: no names, answers or conversations</span><span>${n}</span></footer></section>`;
}

export function deckToHtml(deck: Deck, links: { pptx: string; back: string; autoPrint?: boolean }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(deck.school)} · Leadership deck</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@500;600;700&display=swap">
<style>
:root{--bg:#f3f2fb;--panel:#ffffff;--ink:#14122b;--muted:#65627f;--line:#e0def5;--teal:#0a7268;--navy:#14122b;--grad:linear-gradient(135deg,#0ea5a4,#4f46e5);--serif:"Sora",ui-sans-serif,system-ui,sans-serif;--sans:"Inter",ui-sans-serif,system-ui,sans-serif;--mono:"Inter",ui-sans-serif,system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans)}
.bar-top{position:sticky;top:0;z-index:5;display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:12px max(16px,env(safe-area-inset-left,0px));background:var(--navy);color:#f2f1ff}
.bar-top b{font-family:var(--serif);font-size:16px;margin-right:auto}
.bar-top a,.bar-top button{font:600 14px var(--sans);min-height:38px;padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:transparent;color:#f2f1ff;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center}
.bar-top .go{background:var(--grad);border-color:transparent}
.bar-top a:focus-visible,.bar-top button:focus-visible{outline:2px solid #5eead4;outline-offset:2px}
.deck{display:grid;gap:24px;justify-items:center;padding:28px max(16px,env(safe-area-inset-left,0px)) 60px}
.slide{container-type:inline-size;position:relative;width:min(100%,1180px);aspect-ratio:16/9;background:var(--panel);border:1px solid var(--line);box-shadow:0 18px 40px -26px rgba(79,70,229,.45);overflow:hidden;display:flex;flex-direction:column}
.slide.cover{background:linear-gradient(135deg,#1b1760,#0d0b2b);color:#f2f1ff}
.in{flex:1;padding:5.2cqw 5.4cqw 0;min-height:0}
.kick{font:600 1.05cqw var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--teal);margin:0 0 1cqw}
.cover .kick{color:#5eead4;margin-top:9cqw}
h1{font:600 4.6cqw/1.12 var(--serif);margin:0 0 2cqw;max-width:80%}
h2{font:600 2.9cqw/1.15 var(--serif);margin:0 0 1.4cqw;letter-spacing:-.01em}
.lead{font-size:1.5cqw;line-height:1.5;color:var(--muted);margin:0 0 2cqw;max-width:88%}
.cover .lead{font-size:1.9cqw;color:#c9c8f0}
.when{font:500 1.1cqw var(--mono);color:#a5a3c6;margin-top:5cqw}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1.6cqw;margin-top:3cqw}
.stat{background:#fff;border:1px solid var(--line);border-radius:1cqw;padding:1.8cqw 1.8cqw 1.6cqw;display:flex;flex-direction:column;gap:.5cqw}
.stat strong{font:600 4cqw/1 var(--serif);color:var(--teal);margin-bottom:.8cqw}
.stat b{font-size:1.45cqw}
.stat span{font-size:1.15cqw;color:var(--muted)}
.bars{display:grid;gap:1.3cqw;margin-top:2.2cqw}
.bar{display:grid;grid-template-columns:32cqw 1fr 9cqw;align-items:center;gap:1.6cqw;font-size:1.5cqw}
.bar i{display:block;height:1.4cqw;background:#e8e7f7;border-radius:1cqw;overflow:hidden}
.bar u{display:block;height:100%;background:var(--grad);border-radius:1cqw}
.bar em{font:600 1.25cqw var(--mono);font-style:normal}
table{width:100%;border-collapse:collapse;margin-top:1.2cqw;font-size:1.35cqw}
th,td{text-align:left;padding:.65cqw 1cqw;border:1px solid var(--line)}
thead th{font:600 1cqw var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);background:#efeefb}
tbody th{font-weight:600}
.points{display:grid;gap:1.6cqw;margin-top:2cqw}
.point{border-left:.5cqw solid #4f46e5;padding:.2cqw 0 .2cqw 1.8cqw;display:grid;gap:.3cqw}
.point b{font:600 1.9cqw var(--serif)}
.point span{font-size:1.4cqw;color:var(--muted);line-height:1.45}
.note{font-size:1.15cqw;font-style:italic;color:var(--muted);margin:1.6cqw 0 0}
footer{display:flex;justify-content:space-between;padding:0 5.4cqw 1.6cqw;font-size:.95cqw;color:var(--muted)}
@media print{
  @page{size:13.333in 7.5in;margin:0}
  body{background:#fff}
  .bar-top{display:none}
  .deck{padding:0;gap:0;display:block}
  .slide{width:13.333in;height:7.5in;aspect-ratio:auto;border:0;box-shadow:none;break-after:page;page-break-after:always}
  .slide:last-child{break-after:auto;page-break-after:auto}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@media (max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}}
</style></head><body>
<div class="bar-top"><b>${esc(deck.school)} · Leadership deck</b><a href="${esc(links.back)}">Back to Reports</a><a class="go" href="${esc(links.pptx)}">Download PowerPoint</a><button type="button" onclick="window.print()">Download PDF</button></div>${links.autoPrint ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},500)})</script>` : ""}
<main class="deck">${deck.slides.map((s, i) => slide(s, deck, i + 1)).join("")}</main>
</body></html>`;
}
