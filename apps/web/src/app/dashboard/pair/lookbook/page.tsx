import { Lookbook } from "@/components/teacher/lookbook";
import { LookbookSwitch } from "@/components/teacher/lookbook-switch";
import { PairTabs } from "@/components/teacher/pair-tabs";
import { loadLookbook } from "@/lib/teacher/lookbook-data";
import { loadTeacher } from "@/lib/teacher/load";
import { teacherBase } from "@/lib/teacher/look";

export default async function LookbookPage() {
  const base = teacherBase();
  const data = await loadTeacher();
  if (!data.model) return null;
  const lb = await loadLookbook();
  const partnerByProfile = Object.fromEntries(data.model.partners.filter((p) => p.id).map((p) => [p.id, p.pairingId]));

  return (
    <main className="ev-main ev-wide">
      <header className="ta-hello">
        <p className="ev-eyebrow">My pair · Lookbook</p>
        <h1>
          Find your <em>people</em>.
        </h1>
        <p className="ev-lead">Your colleagues by name, department and strengths. Search or filter to find someone who is strong where you want to grow.</p>
      </header>
      <PairTabs current="lookbook" base={base} />

      <Lookbook cards={lb.cards} meId={lb.meId} partnerByProfile={partnerByProfile} ready={lb.ready} />

      <LookbookSwitch hidden={lb.hidden} ready={lb.ready} />
    </main>
  );
}
