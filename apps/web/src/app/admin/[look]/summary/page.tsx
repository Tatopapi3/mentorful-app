import { lookOf } from "@/lib/admin/look";
import SummaryView from "@/components/admin/summary-view";


export const dynamic = "force-dynamic";

export default async function Page({ params: routeParams, searchParams }: { params: Promise<{ look: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {

  return <SummaryView skin={await lookOf(routeParams)} searchParams={await searchParams} />;
}
