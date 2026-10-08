import BackendGreeting from "./backend-greeting";
import SayHello from "./say-hello";

export default function Home() {
  return (
    <main style={{ padding: "1rem", maxWidth: "40rem", margin: "0 auto" }}>
      <h1>Rec League Manager</h1>
      <BackendGreeting />
      <SayHello />
    </main>
  );
}
