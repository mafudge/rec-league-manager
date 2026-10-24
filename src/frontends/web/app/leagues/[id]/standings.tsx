"use client";

import { useEffect, useState } from "react";

import { Standings as StandingsData, getStandings } from "../../api";
import StandingsTable from "../../standings-table";
import styles from "../../ui.module.css";
import { useSignedIn } from "../../use-signed-in";

// The Standings tab. It mounts when the tab opens, so opening it after saving a score fetches fresh numbers.
export default function Standings({ leagueId, allowTies }: { leagueId: string; allowTies: boolean }) {
  const { onError } = useSignedIn();
  const [standings, setStandings] = useState<StandingsData | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getStandings(leagueId)
      .then(setStandings)
      .catch((e) => setMessage(onError(e) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  return (
    <section>
      {message && (
        <p className={styles.message} aria-live="polite">
          {message}
        </p>
      )}
      {standings && <StandingsTable standings={standings} allowTies={allowTies} />}
    </section>
  );
}
