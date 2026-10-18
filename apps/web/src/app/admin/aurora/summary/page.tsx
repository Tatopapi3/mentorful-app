import SummaryView from "@/components/admin/summary-view";


export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {

  return <SummaryView skin="aurora" searchParams={await searchParams} />;
}
