import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { AuroraPublic } from "./public-frame";

/**
 * A whole page that says one thing, in the Aurora look: "this area is for school leadership", "no teacher profile is linked
 * to your email", "that page isn't here". Used where a page used to fall back to bare browser styling.
 * `signedIn` adds a way to sign out, for the screens a signed-in person can land on by mistake.
 */
export function NoticePage({ eyebrow, title, children, home = "/", signedIn = false }: { eyebrow: string; title: string; children: React.ReactNode; home?: string; signedIn?: boolean }) {
  return (
    <AuroraPublic>
      <div className="ap-card" style={{ maxWidth: 640, margin: "40px auto 0" }}>
        <p className="ev-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="ap-lead">{children}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <Link href={home} className="ev-btn primary">
            Go to the home page
          </Link>
          {signedIn ? (
            <form action={signOut}>
              <button type="submit" className="ev-btn">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </AuroraPublic>
  );
}
