import { headers } from "next/headers";
import { AuroraPublic } from "@/components/aurora/public-frame";
import { CopyButton } from "@/components/demo/copy-button";
import { ADMIN_PAGES, OPEN_PAGES, TEACHER_PAGES, deepLink, type Page, type Who } from "@/lib/demo/share-links";
import { STAGE_CHARACTERS } from "@/lib/preview/stageTables";
import { DemoTabs } from "../tabs";

export const metadata = { title: "Share links" };
export const dynamic = "force-dynamic";

type Group = { title: string; who: Who; pages: Page[] };

function Section({ title, intro, base, keyed, groups }: { title: string; intro: string; base: string; keyed?: string; groups: Group[] }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h2>{title}</h2>
      <p className="ev-muted" style={{ maxWidth: 760 }}>
        {intro}
      </p>
      {groups.map((g) => (
        <div key={g.title} style={{ marginTop: 18 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{g.title}</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {g.pages.map((p) => {
              const link = deepLink({ base, key: keyed, who: g.who, path: p.path });
              return (
                <div key={g.title + p.path} className="ap-card" style={{ padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <b>{p.label}</b>
                    {p.note && <span className="ev-muted"> · {p.note}</span>}
                    <div className="ev-muted" style={{ fontSize: 12, wordBreak: "break-all" }}>
                      {p.path}
                    </div>
                  </div>
                  <CopyButton text={link} label="Copy link" />
                  <a className="ev-btn sm" href={link}>
                    Open
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

export default async function Links() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3400";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const here = `${proto}://${host}`;
  const key = process.env.NEXT_PUBLIC_SHARE_KEY || undefined;
  const buildUrl = process.env.NEXT_PUBLIC_BUILD_URL;
  const buildKey = process.env.NEXT_PUBLIC_BUILD_KEY || undefined;
  const stagingUrl = process.env.NEXT_PUBLIC_STAGING_URL;
  const stagingKey = process.env.NEXT_PUBLIC_STAGING_KEY || undefined;

  return (
    <AuroraPublic>
      <DemoTabs current="/demo/links" />
      <p className="ev-eyebrow">For the team · not for the audience</p>
      <h1>
        Share links, <em>one click each.</em>
      </h1>
      <p className="ev-lead">
        A page copied from the address bar has no access key and does not know who you are, so it opens &ldquo;private&rdquo; for a teammate. Every link below carries both, so use the Copy link button on the row you need.
      </p>

      <Section
        title="Stage prototype (Demo Day)"
        intro="Made-up data. Each link opens straight on the page, as the person named. Use one tab."
        base={here}
        keyed={key}
        groups={[
          { title: "Audience pages", who: "none", pages: [{ label: "The show", path: "/demo" }, { label: "The slides (5)", path: "/demo/slides" }] },
          { title: "As Mr. David, the principal", who: "admin", pages: ADMIN_PAGES },
          { title: `As ${STAGE_CHARACTERS.first}, the English teacher`, who: "first", pages: TEACHER_PAGES },
          { title: `As ${STAGE_CHARACTERS.second}, the Science teacher`, who: "second", pages: TEACHER_PAGES.slice(0, 3) },
          { title: "No sign-in needed", who: "none", pages: OPEN_PAGES },
        ]}
      />

      {buildUrl && (
        <Section
          title="Full build on made-up data"
          intro="The whole app on a sample school, with a Principal and a Teacher. Nothing you click is saved for anyone else."
          base={buildUrl}
          keyed={buildKey}
          groups={[
            { title: "As the principal", who: "admin", pages: ADMIN_PAGES },
            { title: "As a teacher", who: "first", pages: TEACHER_PAGES },
            { title: "No sign-in needed", who: "none", pages: OPEN_PAGES },
          ]}
        />
      )}

      {stagingUrl && (
        <Section
          title="Shared test site (the real database)"
          intro="Real sign-in. Open the first link once (it carries the key), sign in with your admin or teacher email, and then every other link works in the same browser. Anything you click here is saved for real, so keep to the checklist."
          base={stagingUrl}
          keyed={stagingKey}
          groups={[
            { title: "Start here", who: "none", pages: [{ label: "Sign in", path: "/login" }] },
            { title: "Principal pages (admin email)", who: "none", pages: ADMIN_PAGES.slice(0, 9) },
            { title: "Teacher pages (teacher email)", who: "none", pages: TEACHER_PAGES },
          ]}
        />
      )}
    </AuroraPublic>
  );
}
