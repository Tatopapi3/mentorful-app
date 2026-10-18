import type { Severity } from "@/lib/admin/actions";

const LABEL: Record<Severity, string> = { do: "Do this", watch: "Keep an eye on", good: "Going well" };

export function SeverityTag({ severity }: { severity: Severity }) {
  return <span className={`ev-badge${severity === "do" ? " amber" : ""}`}>{LABEL[severity]}</span>;
}
