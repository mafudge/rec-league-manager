"use client";

import { FormEvent, useState } from "react";

import { API_URL, BackendRefused, fetchHello } from "./api";

// Sends the name as typed; the backend decides what's valid (SCAF-14).
export default function SayHello() {
  const [name, setName] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function ask(e: FormEvent) {
    e.preventDefault();
    setAsking(true);
    try {
      setReply(await fetchHello(name));
    } catch (err) {
      setReply(err instanceof BackendRefused ? err.message : `Can't reach the backend at ${API_URL}`);
    } finally {
      setAsking(false);
    }
  }

  return (
    <form onSubmit={ask} style={{ display: "grid", gap: "0.5rem", maxWidth: "20rem", marginTop: "2rem" }}>
      <label htmlFor="name">Your name</label>
      <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
      <button type="submit" disabled={asking}>
        Say hello
      </button>
      {reply !== null && <p aria-live="polite">{reply}</p>}
    </form>
  );
}
