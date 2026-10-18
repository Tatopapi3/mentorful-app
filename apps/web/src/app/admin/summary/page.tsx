import SummaryView from "@/components/admin/summary-view";
import { NickDenied } from "@/components/nick/page";
import { requireAdmin } from "@/lib/admin/require";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await requireAdmin())) return <NickDenied />;
  return <SummaryView skin="nick" searchParams={await searchParams} />;
}
