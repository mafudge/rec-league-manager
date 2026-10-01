import HealthStatus from "./health-status";

export default function Home() {
  return (
    <main style={{ padding: "1rem", maxWidth: "40rem", margin: "0 auto" }}>
      <h1>Rec League Manager</h1>
      <HealthStatus />
    </main>
  );
}
