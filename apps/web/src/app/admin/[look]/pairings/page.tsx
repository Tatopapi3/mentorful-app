import { lookOf } from "@/lib/admin/look";
import PairingsView from "@/components/admin/pairings-view";

export const dynamic = "force-dynamic";

export default async function Page({ params: routeParams, searchParams }: { params: Promise<{ look: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PairingsView skin={await lookOf(routeParams)} searchParams={await searchParams} />;
}
