import Link from "next/link";
import "@/app/aurora.css";
import "@/app/aurora-public.css";
import { THEME_SCRIPT } from "./chrome";
import { auroraFonts } from "./fonts";
import { MentorfulMark } from "./mentorful-mark";
import { ThemeButton } from "./theme-button";

/**
 * The look for the pages people see before they are signed in (the landing page, sign-in, the Culture Scan and its
 * thank-you): the Aurora palette, type, badge and Day / Night, kept deliberately plain. A flat header, no navigation,
 * no decoration, so the page is the form or the question and nothing else.
 * `right` sits opposite the badge, for example the survey's section progress. `bleed` lets a page use the full width
 * (the sign-in split). Pages pass their own content as children and keep their own logic: only the look lives here, so
 * changing how the survey works never changes how it looks.
 */
export function AuroraPublic({ right, children, bleed = false }: { right?: React.ReactNode; children: React.ReactNode; bleed?: boolean }) {
  return (
    <div className={`ev ap ${auroraFonts}`} data-theme="light" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <header className="ap-header">
        <Link href="/" className="ev-brand" aria-label="Mentorful home">
          <span className="mark" aria-hidden>
            <MentorfulMark size={30} />
          </span>
          <span className="word">Mentorful</span>
        </Link>
        <span className="ap-spacer" />
        {right ? <div className="ap-right">{right}</div> : null}
        <ThemeButton />
      </header>
      <div className={`ap-main${bleed ? " bleed" : ""}`}>{children}</div>
      {bleed ? null : (
        <footer className="ap-foot">
          <span>Mentorful</span>
          <span>Your answers and private conversations are never shown to leaders</span>
        </footer>
      )}
    </div>
  );
}
