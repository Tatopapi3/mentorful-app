import CopyButton from "@/components/admin/copy-button";
import { Muted, Panel, type Skin } from "@/components/admin/kit";
import { narrativeText, type Narrative } from "@/lib/admin/narrative";

/** The board narrative: the cycle told in plain language, each line traceable to a number listed beneath it. */
export default function NarrativePanel({ skin, narrative, download }: { skin: Skin; narrative: Narrative; download: string }) {
  const text = narrativeText(narrative);
  const btn = skin === "nick" ? "nk-btn" : "ev-btn sm";
  return (
    <Panel skin={skin} title="Board narrative" eyebrow="Written from the numbers" count={`${narrative.sections.length} sections`}>
      <p style={{ margin: "0 0 14px", maxWidth: 720, color: "var(--ev-muted, var(--muted))", fontSize: 14.5 }}>
        A plain-language account of the cycle for a board packet or a staff email. Every sentence is built from a figure the dashboard shows, listed at the end, so nothing is said that the data doesn&apos;t support.
      </p>
      <article style={{ maxWidth: 760, border: "1px solid var(--ev-line, var(--line))", borderRadius: 12, background: "var(--ev-panel-solid, var(--card))", padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 20, fontFamily: "var(--ev-display, var(--font-serif, Georgia, serif))" }}>{narrative.title}</h3>
        {narrative.sections.map((s) => (
          <section key={s.heading} style={{ margin: "16px 0 0" }}>
            <h4 style={{ margin: "0 0 4px", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ev-muted, var(--muted))" }}>{s.heading}</h4>
            {s.paragraphs.map((p, i) => (
              <p key={i} style={{ margin: "4px 0", lineHeight: 1.55 }}>{p}</p>
            ))}
          </section>
        ))}
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>The numbers behind this ({narrative.basis.length})</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
            {narrative.basis.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </details>
      </article>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0 0" }}>
        <CopyButton skin={skin} text={text} />
        <a href={download} className={btn}>Download as a text file</a>
      </div>
      <Muted skin={skin}>Counts and averages only. Groups under five are left out, survey answers are anonymous, and nothing here shows what teachers said to each other.</Muted>
    </Panel>
  );
}
