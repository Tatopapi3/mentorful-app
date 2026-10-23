import ReportsView from "@/components/admin/reports-view";
import { lookOf } from "@/lib/admin/look";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ look: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ReportsView skin={await lookOf(params)} searchParams={await searchParams} />;
}
