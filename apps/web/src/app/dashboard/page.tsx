import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import CultureScanCard from "./CultureScanCard";
import TeacherOrbit from "./TeacherOrbit";
import { initials, orbitLogs, placeDots, rhythmGrid } from "@/lib/teacher/orbit";
import LogConversationForm from "./LogConversationForm";
import { submitLog } from "./actions";
import {
  DOMAIN_LABEL,
  ARCHETYPE_LABEL,
  TEACHING_STYLE,
  domainsForTags,
  type TeachingStyle,
} from "@/lib/domains";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your dashboard" };

/**
 * The teacher's own view.
 *
 * Everything runs on the session client. A teacher sees their own profile, the
 * colleagues they are paired with, and the conversation logs they are a party
 * to — no more, because 011's policies say so rather than because this page
 * remembers to filter. The queries below are written to be correct anyway; RLS
 * is the floor, not the plan.
 *
 * Nothing here reads survey_responses. The Culture Scan is anonymous, and a
 * teacher's own answers are deliberately unrecoverable — see CLAUDE.md.
 */

function fullName(p: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return "A colleague";
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "A colleague";
}

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  teaching_style: string | null;
  archetype_id: string | null;
  inspiration: string | null;
  strength_tags: unknown;
  school_id: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: meRow } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, department, teaching_style, archetype_id, inspiration, strength_tags, school_id"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const me = meRow as Profile | null;

  if (!me) {
    return (
      <>
        <SiteHeader />
        <main className="wrap tch-denied">
          <h1>Your dashboard</h1>
          <p>
            No teacher profile is linked to {user.email}. Ask your school lead to add you to the
            roster.
          </p>
        </main>
      </>
    );
  }

  const myDomains = domainsForTags(me.strength_tags);
  const myStyle = me.teaching_style
    ? TEACHING_STYLE[me.teaching_style as TeachingStyle]
    : null;
  const myArchetype = me.archetype_id ? ARCHETYPE_LABEL[me.archetype_id] : null;

  // Pairings the caller is in. RLS restricts these to their own either way.
  const { data: pairingRows } = await supabase
    .from("pairings")
    .select("id, host_id, visitor_id, domain, strategic_tag, cycle_id")
    .or(`host_id.eq.${me.id},visitor_id.eq.${me.id}`)
    .eq("status", "approved");

  const pairs = pairingRows ?? [];
  const partnerIds = pairs.map((p) => (p.host_id === me.id ? p.visitor_id : p.host_id));

  const { data: partnerRows } = partnerIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, department, teaching_style, archetype_id, strength_tags")
        .in("id", partnerIds)
    : { data: [] };

  const partners = new Map(
    (partnerRows ?? []).map((p) => [p.id, p as unknown as Profile])
  );

  // The journal. 011 scopes this to logs the caller is host or visitor on.
  const { data: logRows } = await supabase
    .from("conversation_logs")
    .select(
      "id, domain, vision, strength_noted, more_frequently, less_frequently, resources, status, submitted_at, created_at, host_id, visitor_id, logged_by, is_visit_debrief"
    )
    .order("submitted_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });

  const logs = logRows ?? [];

  const pairOptions = pairs.map((p) => ({
    id: p.id,
    partnerName: fullName(partners.get(p.host_id === me.id ? p.visitor_id : p.host_id) ?? null),
    domain: p.domain,
  }));

  const entries = orbitLogs(logs as never, me.id, (id) => fullName(id ? partners.get(id) ?? null : null), (d) => DOMAIN_LABEL[d as keyof typeof DOMAIN_LABEL] ?? d);

  return (
    <>
      <SiteHeader />
      <main className="wrap tch">
        <header className="tch-head">
          <p className="mono tch-eyebrow">Your dashboard</p>
          <h1>{fullName(me)}</h1>
        </header>

        <TeacherOrbit
          me={{ name: fullName(me), initials: initials(fullName(me)) }}
          partners={[...new Set(partnerIds)].slice(0, 2).map((id) => ({ name: fullName(partners.get(id) ?? null), initials: initials(fullName(partners.get(id) ?? null)) }))}
          logs={placeDots(entries)}
          rhythm={rhythmGrid(entries)}
        />

        <div className="tch-top">
          {/* ------------------------------------------------ profile card */}
          <section className="tch-card tch-profile">
            <div className="tch-ident">
              <h2>{fullName(me)}</h2>
              {me.department ? <p className="tch-dept">{me.department}</p> : null}
            </div>

            {myDomains.length > 0 ? (
              <div className="tch-block">
                <span className="mono">Strong in</span>
                <ul className="tch-chips">
                  {myDomains.map((d) => (
                    <li key={d}>{DOMAIN_LABEL[d]}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {myStyle ? (
              <div className="tch-block">
                <span className="mono">Teaching style</span>
                <p className="tch-style">{myStyle.label}</p>
                <p className="tch-tagline">{myStyle.tagline}</p>
              </div>
            ) : null}

            {myArchetype ? (
              <div className="tch-block">
                <span className="mono">Archetype</span>
                <p className="tch-style">{myArchetype}</p>
              </div>
            ) : null}

            {/* The inspiration sentence carries no header, by design. It reads
                as something the teacher said, not a field they filled in. */}
            {me.inspiration ? <blockquote className="tch-quote">{me.inspiration}</blockquote> : null}
          </section>

          {/* ----------------------------------------------- co-mentor cards */}
          <section className="tch-card">
            <div className="tch-card-head">
              <h2>Your co-mentors</h2>
              <span className="mono">{pairs.length} this cycle</span>
            </div>

            {pairs.length === 0 ? (
              <p className="tch-empty">No pairings this cycle yet.</p>
            ) : (
              <ul className="tch-mentors">
                {pairs.map((p) => {
                  const partner = partners.get(p.host_id === me.id ? p.visitor_id : p.host_id);
                  const theirDomains = domainsForTags(partner?.strength_tags);
                  const shared = myDomains.filter((d) => theirDomains.includes(d));
                  const theirArchetype = partner?.archetype_id
                    ? ARCHETYPE_LABEL[partner.archetype_id]
                    : null;
                  const contrast =
                    myArchetype && theirArchetype && myArchetype !== theirArchetype;
                  const iHost = p.host_id === me.id;

                  return (
                    <li key={p.id} className="tch-mentor">
                      <div className="tch-mentor-top">
                        <b>{fullName(partner ?? null)}</b>
                        <span className="tch-dept">{partner?.department}</span>
                      </div>

                      <p className="tch-role">
                        {iHost
                          ? "They visit your classroom."
                          : "You visit their classroom."}
                        {p.domain ? ` Focus: ${DOMAIN_LABEL[p.domain] ?? p.domain}.` : ""}
                      </p>

                      {/* Shared-focus, not complementary strengths: every pair in
                          this data is strong in the same domains. The contrast
                          that makes the pairing useful is the archetype. */}
                      {shared.length > 0 ? (
                        <p className="tch-insight">
                          You’re both strong in{" "}
                          <b>{shared.map((d) => DOMAIN_LABEL[d]).join(" and ")}</b>, so this is
                          peer coaching rather than teaching.
                          {contrast ? (
                            <>
                              {" "}
                              You come at it as a <b>{myArchetype}</b>, they come at it as a{" "}
                              <b>{theirArchetype}</b>.
                            </>
                          ) : null}
                        </p>
                      ) : contrast ? (
                        <p className="tch-insight">
                          You come at it as a <b>{myArchetype}</b>, they come at it as a{" "}
                          <b>{theirArchetype}</b>.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* -------------------------------------------- conversation journal */}
        <section className="tch-card">
          <div className="tch-card-head">
            <h2>Conversation journal</h2>
            <span className="mono">{logs.length} entries</span>
          </div>

          <p className="tch-lede">
            Private to you and the colleague in each conversation. Your school lead sees how many
            conversations happened and in which domains, never what was said.
          </p>

          <LogConversationForm pairs={pairOptions} />

          {logs.length === 0 ? (
            <p className="tch-empty">Nothing logged yet.</p>
          ) : (
            <ol className="tch-logs">
              {logs.map((l) => {
                const otherId = l.host_id === me.id ? l.visitor_id : l.host_id;
                const other = partners.get(otherId);
                const iHost = l.host_id === me.id;
                const when = l.submitted_at ?? l.created_at;
                return (
                  <li key={l.id} id={`log-${l.id}`} className="tch-entry">
                    <div className="tch-entry-head">
                      <span className="tch-chip">{DOMAIN_LABEL[l.domain] ?? l.domain}</span>
                      <span className="tch-entry-who">
                        {iHost ? "They observed you" : "You observed them"}
                        {other ? ` · ${fullName(other)}` : ""}
                      </span>
                      <span className="mono tch-entry-when">
                        {l.status === "draft"
                          ? "Draft"
                          : new Date(when).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                      </span>
                    </div>

                    <dl className="tch-fields">
                      {l.vision ? (
                        <>
                          <dt>Working toward</dt>
                          <dd>{l.vision}</dd>
                        </>
                      ) : null}
                      {l.strength_noted ? (
                        <>
                          <dt>Noticed working</dt>
                          <dd>{l.strength_noted}</dd>
                        </>
                      ) : null}
                      {l.more_frequently ? (
                        <>
                          <dt>More of</dt>
                          <dd>{l.more_frequently}</dd>
                        </>
                      ) : null}
                      {l.less_frequently ? (
                        <>
                          <dt>Less of</dt>
                          <dd>{l.less_frequently}</dd>
                        </>
                      ) : null}
                      {l.resources ? (
                        <>
                          <dt>Swapping</dt>
                          <dd>{l.resources}</dd>
                        </>
                      ) : null}
                    </dl>

                    {l.status === "draft" ? (
                      <form action={submitLog} className="tch-submit">
                        <input type="hidden" name="log_id" value={l.id} />
                        <button className="btn btn-ghost" type="submit">
                          Submit this entry
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <CultureScanCard />
      </main>
    </>
  );
}
