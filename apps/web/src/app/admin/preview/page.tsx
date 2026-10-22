import { DM_Sans } from "next/font/google";
import AdminDashboard from "../AdminDashboard";
import { buildOverviewModel, type OverviewFaculty } from "../overview-model";
import { type Dimension, type DimensionStat, type ReportStats } from "@/lib/report/stats";

const dmSans = DM_Sans({
  variable: "--font-dm",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

function stat(dimension: Dimension, mean: number): DimensionStat {
  return {
    dimension,
    itemCount: 6,
    mean,
    sd: 0.4,
    ciHalfWidth: 0.1,
    ciLow: mean - 0.1,
    ciHigh: mean + 0.1,
    strength: 0.4,
  };
}

const partial = [
  [1, 0.28, 0.094, -0.036],
  [0.28, 1, 0.329, 0.447],
  [0.094, 0.329, 1, 0.308],
  [-0.036, 0.447, 0.308, 1],
];

const stats: ReportStats = {
  n: 51,
  droppedCount: 0,
  itemTotal: 26,
  dimensions: {
    structural: stat("structural", 3.1),
    relational: stat("relational", 4.61),
    cognitive: stat("cognitive", 4.52),
    efficacy: stat("efficacy", 4.54),
  },
  correlation: partial,
  partial,
};

const roster = [
  ["Math", 11],
  ["ELA", 12],
  ["Science", 10],
  ["Social Studies", 9],
  ["Arts", 7],
  ["PE / Health", 4],
  ["Special Ed", 7],
] as const;

/**
 * Synthetic leadership overview for the public demo. No database, no school
 * data — the same screen as /admin, filled with illustrative aggregates.
 */
export default function AdminPreviewPage() {
  const faculty: OverviewFaculty[] = [];
  for (const [department, count] of roster) {
    for (let i = 0; i < count; i++) {
      faculty.push({
        id: `${department}-${i}`,
        first_name: department.split(" ")[0],
        last_name: String.fromCharCode(65 + (i % 26)),
        department,
      });
    }
  }

  const model = buildOverviewModel({
    schoolName: "Preview School",
    cycleName: "Fall 2025",
    synthetic: true,
    faculty,
    pairs: [
      { id: "1", host_id: "Math-0", visitor_id: "Arts-0", domain: "CLASSROOM", status: "approved" },
      { id: "2", host_id: "Science-0", visitor_id: "ELA-0", domain: "PLANNING", status: "pending" },
      { id: "3", host_id: "ELA-1", visitor_id: "ELA-2", domain: "ASSESSMENT", status: "approved" },
      { id: "4", host_id: "Arts-1", visitor_id: "Special Ed-0", domain: "COMMUNICATION", status: "rejected" },
      { id: "5", host_id: "Social Studies-0", visitor_id: "Math-1", domain: "CLASSROOM", status: "approved" },
    ],
    conversationCount: 22,
    report: stats,
    respondentCount: 51,
    topics: [
      { domain: "CLASSROOM", n: 24 },
      { domain: "PLANNING", n: 19 },
      { domain: "ASSESSMENT", n: 15 },
      { domain: "COMMUNICATION", n: null },
      { domain: "CELEBRATIONS", n: 0 },
    ],
    topicsUnavailable: false,
  });

  return <AdminDashboard fontVariable={dmSans.variable} model={model} />;
}
