import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * Shared site header: logo mark + "Mentorful" wordmark, linking home.
 *
 * Always the navy mark — the app is light-only (see `color-scheme: light` in
 * globals.css), so every surface this sits on is white. `public/logo-light.png`
 * is the mark for dark surfaces; it's kept in the repo but unreferenced until
 * something dark needs it.
 *
 * The image is `alt=""` because the wordmark next to it already carries the
 * name — announcing it twice is noise for a screen reader.
 *
 * `right` renders opposite the logo — the survey uses it for the section
 * progress readout. `sticky` adds the bordered, card-background bar that
 * stays pinned while the survey scrolls. Both default off, so the pages that
 * render `<SiteHeader />` bare are unchanged.
 */
export default function SiteHeader({
  right,
  sticky = false,
}: {
  right?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <header className={sticky ? "site-header site-header--sticky" : "site-header"}>
      <div className="site-header__inner">
        <Link href="/" className="site-header__link">
          <Image src="/logo-navy.png" alt="" width={30} height={30} />
          <span className="site-wordmark">Mentorful</span>
        </Link>
        {right}
      </div>
    </header>
  );
}
