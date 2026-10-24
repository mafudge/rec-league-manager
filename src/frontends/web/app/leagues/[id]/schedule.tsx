"use client";

import { useEffect, useState } from "react";

import { Game, clearScores, generateSchedule, listGames } from "../../api";
import styles from "../../ui.module.css";
import { useSignedIn } from "../../use-signed-in";

// The Schedule tab: generate the round robin, read it week by week, clear scores. Every message is the backend's.
export default function Schedule({ leagueId }: { leagueId: string }) {
  const { onError } = useSignedIn();
  const [games, setGames] = useState<Game[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    listGames(leagueId)
      .then(setGames)
      .catch((e) => setMessage(onError(e) ?? ""));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setMessage("");
    try {
      const note = await action();
      await listGames(leagueId).then(setGames);
      setMessage(note ?? "");
    } catch (err) {
      setMessage(onError(err) ?? "");
    } finally {
      setBusy(false);
    }
  }

  const generate = () => run(async () => (await generateSchedule(leagueId)).message);
  const clear = () => {
    if (!window.confirm("Clear every score in this league?")) return;
    return run(async () => {
      await clearScores(leagueId);
      return null;
    });
  };

  const weeks = new Map<number, Game[]>();
  for (const g of games ?? []) weeks.set(g.week, [...(weeks.get(g.week) ?? []), g]);

  return (
    <section>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={generate} disabled={busy}>
          Generate schedule
        </button>
        <button type="button" className={styles.linkButton} onClick={clear} disabled={busy}>
          Clear all scores
        </button>
      </div>
      <p className={styles.message} aria-live="polite">
        {message}
      </p>
      {games?.length === 0 && <p className={styles.muted}>No schedule yet — add entrants, then generate.</p>}
      {[...weeks].map(([week, list]) => (
        <div key={week}>
          <h2>Week {week}</h2>
          <ul className={styles.list}>
            {list.map((g) => (
              <li key={g.id} className={styles.card}>
                {g.away_name === null ? `${g.home_name} — bye` : `${g.home_name} vs ${g.away_name}`}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
