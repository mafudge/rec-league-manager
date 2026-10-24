"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { League, getLeague } from "../../api";
import OrganizerHeader from "../../organizer-header";
import styles from "../../ui.module.css";
import { useSignedIn } from "../../use-signed-in";

// The league home. Tabs (Entrants, Schedule, Scores, Standings) arrive with the screens they open.
export default function LeaguePage() {
  const { id } = useParams<{ id: string }>();
  const { onError } = useSignedIn();
  const [league, setLeague] = useState<League | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    getLeague(id)
      .then(setLeague)
      .catch((e) => setMessage(onError(e) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/l/${league!.slug}`);
      setCopied("Link copied");
    } catch {
      setCopied("Couldn't copy the link");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.narrow}>
        <OrganizerHeader />
        {message && (
          <p className={styles.message} aria-live="polite">
            {message}
          </p>
        )}
        {league && (
          <>
            <h1>{league.name}</h1>
            <p className={styles.muted}>{league.location}</p>
            <p className={styles.muted}>{[league.sport, league.season].filter(Boolean).join(" · ")}</p>
            <button type="button" className={styles.linkButton} onClick={copyLink}>
              Copy public link
            </button>{" "}
            <span aria-live="polite">{copied}</span>
          </>
        )}
      </div>
    </main>
  );
}
