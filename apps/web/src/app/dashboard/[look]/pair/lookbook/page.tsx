import Link from "next/link";
import { Icon } from "@/components/teacher/icons";
import { Lookbook } from "@/components/teacher/lookbook";
import { PairTabs } from "@/components/teacher/pair-tabs";
import { loadLookbook } from "@/lib/teacher/lookbook-data";
import { loadTeacher } from "@/lib/teacher/load";
import { teacherBase, teacherLookOf } from "@/lib/teacher/look";

export default async function LookbookPage({ params }: { params: Promise<{ look: string }> }) {
  const base = teacherBase(await teacherLookOf(params));
  const data = await loadTeacher();
  if (!data.model) return null;
  const lb = await loadLookbook();
  const partnerByProfile = Object.fromEntries(data.model.partners.filter((p) => p.id).map((p) => [p.id, p.pairingId]));
  const mineShared = lb.mine.input.published;

  return (
    <main className="ev-main ev-wide">
      <header className="ta-hello">
        <p className="ev-eyebrow">My pair · Lookbook</p>
        <h1>
          Find your <em>people</em>.
        </h1>
        <p className="ev-lead">Colleagues who&rsquo;ve chosen to introduce themselves: what they&rsquo;re good at, where they&rsquo;ve been, and what they hope to get out of working with a co-mentor. Everything on a card is written by the teacher, and sharing is always their choice.</p>
      </header>
      <PairTabs current="lookbook" base={base} />

      {lb.ready && !mineShared ? (
        <p className="ev-note ta-lb-nudge">
          <Icon name="users" size={16} />
          <span>
            You haven&rsquo;t shared your own card yet, so colleagues can&rsquo;t see you here.{" "}
            <Link href={`${base}/pair/card`}>Make my card</Link>
          </span>
        </p>
      ) : null}

      <Lookbook cards={lb.cards} meId={lb.meId} partnerByProfile={partnerByProfile} ready={lb.ready} />
    </main>
  );
}
