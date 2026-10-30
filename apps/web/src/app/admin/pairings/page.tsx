import { LOOK } from "@/lib/admin/look";
import PairingsView from "@/components/admin/pairings-view";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PairingsView skin={LOOK} searchParams={await searchParams} />;
}
