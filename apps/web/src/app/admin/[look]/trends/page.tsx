import TrendsView from "@/components/admin/trends-view";
import { lookOf } from "@/lib/admin/look";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ look: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TrendsView skin={await lookOf(params)} searchParams={await searchParams} />;
}
