import { Inter, Playfair_Display } from "next/font/google";
import TeacherDashboard from "../TeacherDashboard";

const inter = Inter({
  variable: "--font-td-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-td-serif",
  weight: ["600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata = { title: "Teacher dashboard" };

/**
 * The redesigned teacher home, filled with illustrative copy. No database and
 * no school data — the signed-in journal still lives at /dashboard.
 */
export default function TeacherPreviewPage() {
  return <TeacherDashboard fontVariable={`${inter.variable} ${playfair.variable}`} />;
}
