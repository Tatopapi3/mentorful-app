import { AdminFrame, Chip, Muted, Panel, Row, type Skin } from "@/components/admin/kit";
import { requireAdmin } from "@/lib/admin/require";

const RULES = [
  { who: "What you can see", what: "Who is paired and where pairs cross departments. School-wide Culture Scan averages and how they connect. How many conversations happened and in which domains. Participation as rates, with any group under 5 left out." },
  { who: "What stays with teachers", what: "What was said in a conversation. Each pair's notes and logs belong to the two people in the pair. Leadership never reads them." },
  { who: "What nobody can see", what: "Who answered the Culture Scan, or how any one person answered. Answers are filed under a random code that is never connected to a login." },
];

// Don't take our word for it: these counts are read as you, right now, from the same database the rest of the app
// uses. If a private table ever showed you rows, this page would say so.
export default async function PrivacyView({ skin }: { skin: Skin }) {
  const admin = await requireAdmin();
  if (!admin) return null;
  const { supabase } = admin;
  const [logs, answers, pairs] = await Promise.all([
    supabase.from("conversation_logs").select("id", { count: "exact", head: true }),
    supabase.from("survey_responses").select("id", { count: "exact", head: true }),
    supabase.from("pairings").select("id", { count: "exact", head: true }),
  ]);
  const checks = [
    { label: "Conversation logs your account can read", n: logs.count ?? 0, private: true, why: "Conversations belong to the pair. There is no leadership read access." },
    { label: "Individual Culture Scan answers your account can read", n: answers.count ?? 0, private: true, why: "Only the report engine reads answers, and it returns averages." },
    { label: "Pairings your account can read", n: pairs.count ?? 0, private: false, why: "Who is paired is not private from leadership." },
  ];

  return (
    <AdminFrame skin={skin} eyebrow="Trust" title="What leadership can and can’t see" sub="Teachers only share honestly if they trust where it goes. This is the boundary, and a live check of it.">
      {RULES.map((r) => (
        <Panel key={r.who} skin={skin} title={r.who}>
          <Muted skin={skin}>{r.what}</Muted>
        </Panel>
      ))}
      <Panel skin={skin} title="Check it yourself" eyebrow="Live, as you" count="read just now">
        {checks.map((c) => (
          <Row key={c.label} skin={skin} chip={<Chip skin={skin} tone={c.private && c.n > 0 ? "amber" : undefined}>{c.private ? (c.n === 0 ? "Private, as designed" : "Should be 0") : "Visible to leadership"}</Chip>} title={`${c.n} · ${c.label}`} detail={c.why} />
        ))}
      </Panel>
    </AdminFrame>
  );
}
