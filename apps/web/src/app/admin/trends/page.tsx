import TrendsView from "@/components/admin/trends-view";
import { NickDenied } from "@/components/nick/page";
import { requireAdmin } from "@/lib/admin/require";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await requireAdmin())) return <NickDenied />;
  return <TrendsView skin="nick" searchParams={await searchParams} />;
}
