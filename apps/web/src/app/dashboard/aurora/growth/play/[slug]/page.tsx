import Link from "next/link";
import { notFound } from "next/navigation";
import { ProtocolPlayer } from "@/components/teacher/protocol-player";
import { loadHub } from "@/lib/teacher/hub-data";
import { loadTeacher } from "@/lib/teacher/load";
import { protocolFor } from "@/lib/teacher/protocols";

export default async function PlayPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ with?: string }> }) {
  const { slug } = await params;
  const { with: withPair } = await searchParams;
  const protocol = protocolFor(slug);
  if (!protocol) notFound();
  const data = await loadTeacher();
  if (!data.model) return null;
  const { model } = data;
  const hub = await loadHub();
  const partner = model.partners.find((p) => p.pairingId === withPair) ?? model.partners[0];

  if (!partner) {
    return (
      <main className="ev-main">
        <header className="ta-hello">
          <p className="ev-eyebrow">Pedagogy games</p>
          <h1>{protocol.name}</h1>
        </header>
        <section className="ev-empty">
          <h3>You play this one with a co-mentor</h3>
          <p className="ev-muted">When your school lead confirms your pairing, you can run it together here.</p>
          <Link className="ev-btn" href="/dashboard/aurora/growth#games">Back to the games</Link>
        </section>
      </main>
    );
  }

  const last = hub.games.filter((g) => g.pairing_id === partner.pairingId && g.module === protocol.name && g.note)[0] ?? null;
  return (
    <main className="ev-main ev-wide">
      <ProtocolPlayer
        protocol={protocol}
        ready={hub.ready}
        pair={{ pairingId: partner.pairingId, partnerFirst: partner.first, partnerName: partner.name, domain: partner.domain }}
        myDomains={model.me.domains}
        theirDomains={partner.theirDomains}
        others={model.partners.length > 1 ? model.partners.map((p) => ({ pairingId: p.pairingId, first: p.first })) : []}
        last={last ? { note: last.note!, at: last.created_at } : null}
      />
    </main>
  );
}
