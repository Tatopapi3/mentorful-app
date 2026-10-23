import ReportsView from "@/components/admin/reports-view";
import { NickDenied } from "@/components/nick/page";
import { requireAdmin } from "@/lib/admin/require";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await requireAdmin())) return <NickDenied />;
  return <ReportsView skin="nick" searchParams={await searchParams} />;
}
