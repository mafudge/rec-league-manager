"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { League, listLeagues } from "../api";
import OrganizerHeader from "../organizer-header";
import styles from "../ui.module.css";
import { useSignedIn } from "../use-signed-in";

export default function LeaguesPage() {
  const { onError } = useSignedIn();
  const [leagues, setLeagues] = useState<League[] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    listLeagues()
      .then(setLeagues)
      .catch((e) => setMessage(onError(e) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.narrow}>
        <OrganizerHeader />
        <h1>My leagues</h1>
        <p className={styles.message} aria-live="polite">
          {message}
        </p>
        {leagues?.length === 0 && <p>No leagues yet — create one.</p>}
        {leagues && leagues.length > 0 && (
          <ul className={styles.list}>
            {leagues.map((l) => (
              <li key={l.id} className={styles.card}>
                <Link href={`/leagues/${l.id}`} className={styles.rowLink}>
                  <strong>{l.name}</strong>
                  <span className={styles.muted}>{l.location}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link href="/leagues/new" className={styles.button}>
            Create a league
          </Link>
        </p>
      </div>
    </main>
  );
}
