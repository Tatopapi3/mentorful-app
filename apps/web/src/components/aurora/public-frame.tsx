import Link from "next/link";
import "@/app/aurora.css";
import "@/app/aurora-public.css";
import { THEME_SCRIPT } from "./chrome";
import { auroraFonts } from "./fonts";
import { MentorfulMark } from "./mentorful-mark";
import { ThemeButton } from "./theme-button";

/**
 * The Aurora look for the pages people see before they are signed in (the landing page, sign-in, the Culture Scan and
 * its thank-you): the same canvas, badge, type and Day / Night as the two dashboards, without their navigation.
 * `right` sits opposite the badge, for example the survey's section progress. Pages pass their own content as children
 * and keep their own logic: only the look lives here, so changing how the survey works never changes how it looks.
 */
export function AuroraPublic({ right, children, wide = false }: { right?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`ev ${auroraFonts}`} data-theme="light" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <div className="ev-aurora" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <header className="ev-topbar ap-bar">
        <Link href="/" className="ev-brand" aria-label="Mentorful home">
          <span className="mark" aria-hidden>
            <MentorfulMark size={30} />
          </span>
          <span className="word">Mentorful</span>
        </Link>
        <span className="ap-spacer" />
        {right ? <div className="ap-right">{right}</div> : null}
        <div className="ev-tools">
          <ThemeButton />
        </div>
      </header>
      <div className={`ap-main${wide ? " wide" : ""}`}>{children}</div>
      <footer className="ev-foot">
        <span>Mentorful</span>
        <span>Your answers and private conversations are never shown to leaders</span>
      </footer>
    </div>
  );
}
