"use client";

import { FormEvent, useEffect, useState } from "react";

import { Entrant, addEntrant, listEntrants } from "../../api";
import styles from "../../ui.module.css";
import { useSignedIn } from "../../use-signed-in";

// The Entrants tab: who is in the league, and a one-row form to add someone. Validation is the backend's.
export default function Entrants({ leagueId }: { leagueId: string }) {
  const { onError } = useSignedIn();
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listEntrants(leagueId)
      .then(setEntrants)
      .catch((e) => setMessage(onError(e) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const added = await addEntrant(leagueId, name);
      setEntrants((list) => [...list, added]);
      setName("");
    } catch (err) {
      setMessage(onError(err) ?? "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <form className={`${styles.form} ${styles.addRow}`} onSubmit={submit}>
        <label htmlFor="entrant-name">Name</label>
        <input id="entrant-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <button type="submit" className={styles.button} disabled={busy}>
          Add
        </button>
      </form>
      <p className={styles.message} aria-live="polite">
        {message}
      </p>
      <ul className={styles.list}>
        {entrants.map((e) => (
          <li key={e.id} className={styles.card}>
            {e.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
