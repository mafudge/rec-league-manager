"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createLeague } from "../../api";
import OrganizerHeader from "../../organizer-header";
import styles from "../../ui.module.css";
import { useSignedIn } from "../../use-signed-in";

// Sends what was typed; the backend's message is shown as-is (no validation of our own).
export default function NewLeaguePage() {
  const router = useRouter();
  const { onError } = useSignedIn();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [sport, setSport] = useState("");
  const [season, setSeason] = useState("");
  const [weeks, setWeeks] = useState("");
  const [allowTies, setAllowTies] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const league = await createLeague({
        name,
        location,
        sport,
        season,
        weeks: weeks.trim() === "" ? null : Number(weeks),
        allow_ties: allowTies,
      });
      router.push(`/leagues/${league.id}`);
    } catch (err) {
      setMessage(onError(err) ?? "");
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.narrow}>
        <OrganizerHeader />
        <h1>Create a league</h1>
        <form onSubmit={submit} noValidate className={`${styles.form} ${styles.card}`}>
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="location">Location</label>
          <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <label htmlFor="sport">Sport</label>
          <input id="sport" value={sport} onChange={(e) => setSport(e.target.value)} />
          <label htmlFor="season">Season</label>
          <input id="season" value={season} onChange={(e) => setSeason(e.target.value)} />
          <label htmlFor="weeks">Weeks</label>
          <input id="weeks" type="number" inputMode="numeric" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
          <label htmlFor="ties" className={styles.checkRow}>
            <input id="ties" type="checkbox" checked={allowTies} onChange={(e) => setAllowTies(e.target.checked)} />
            Games can end in a tie
          </label>
          <p className={styles.message} aria-live="polite">
            {message}
          </p>
          <button type="submit" className={styles.button} disabled={busy}>
            Create league
          </button>
        </form>
      </div>
    </main>
  );
}
