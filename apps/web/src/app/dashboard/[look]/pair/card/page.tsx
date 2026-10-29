import { CardEditor } from "@/components/teacher/card-editor";
import { PairTabs } from "@/components/teacher/pair-tabs";
import { loadLookbook } from "@/lib/teacher/lookbook-data";
import { loadTeacher } from "@/lib/teacher/load";
import { teacherBase, teacherLookOf } from "@/lib/teacher/look";

export default async function MyCardPage({ params }: { params: Promise<{ look: string }> }) {
  const base = teacherBase(await teacherLookOf(params));
  const data = await loadTeacher();
  if (!data.model) return null;
  const { model } = data;
  const lb = await loadLookbook();
  // What the card shows from the profile itself; the teacher can't edit these here.
  const own = lb.cards.find((c) => c.profileId === lb.meId);
  const identity = {
    name: model.me.name,
    initials: model.me.initials,
    department: model.me.department,
    yearsTeaching: own?.yearsTeaching ?? null,
    strengthTags: own?.strengthTags ?? [],
    domains: model.me.domains,
    style: model.me.style,
    archetype: model.me.archetype,
    inspiration: model.me.inspiration,
  };

  return (
    <main className="ev-main ev-wide">
      <header className="ta-hello">
        <p className="ev-eyebrow">My pair · My card</p>
        <h1>
          Introduce <em>yourself</em>.
        </h1>
        <p className="ev-lead">Your card is how colleagues get to know you before they work with you. You write it, you choose what goes on it, and it stays private until you decide to share it.</p>
      </header>
      <PairTabs current="card" base={base} />
      <CardEditor key={lb.mine.saved ? "saved" : "new"} initial={lb.mine.input} photoUrl={lb.mine.photoUrl} saved={lb.mine.saved} identity={identity} ready={lb.ready} />
    </main>
  );
}
