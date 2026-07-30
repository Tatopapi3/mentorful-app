import SiteHeader from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Mentorful MVP</h1>
        <p style={{ marginTop: 8 }}>
          Demo routes:
        </p>
        <ul style={{ marginTop: 12, lineHeight: 1.8 }}>
          <li><a href="/dashboard">Dashboard</a></li>
          <li><a href="/survey">Culture Scan survey</a></li>
          <li><a href="/report">Culture Scan report</a></li>
          <li><a href="/admin/map">Admin Faculty Map</a></li>
        </ul>
      </main>
    </>
  );
}
