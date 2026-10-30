import TrendsView from "@/components/admin/trends-view";
import { LOOK } from "@/lib/admin/look";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <TrendsView skin={LOOK} searchParams={await searchParams} />;
}
