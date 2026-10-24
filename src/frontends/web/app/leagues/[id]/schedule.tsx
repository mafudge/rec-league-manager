"use client";

import { useEffect, useState } from "react";

import { Game, clearScores, generateSchedule, listGames, saveScore } from "../../api";
import styles from "../../ui.module.css";
import { useSignedIn } from "../../use-signed-in";

// The Schedule tab: generate the round robin, read it week by week, clear scores. Every message is the backend's.
export default function Schedule({ leagueId }: { leagueId: string }) {
  const { onError } = useSignedIn();
  const [games, setGames] = useState<Game[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = (): Promise<void> =>
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
              <GameRow key={`${g.id}-${g.home_score}-${g.away_score}`} game={g} onCleared={load} onSaved={(saved) => setGames((all) => all && all.map((x) => (x.id === saved.id ? saved : x)))} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

// A blank field goes to the backend as "" (never null, which means Clear) so its whole-numbers message is what shows.
const toScore = (text: string) => (text.trim() === "" ? "" : Number(text));

// One game: who plays whom (or the score), plus two score fields that stay available so a score can be corrected.
function GameRow({ game: g, onSaved, onCleared }: { game: Game; onSaved: (g: Game) => void; onCleared: () => void }) {
  const { onError } = useSignedIn();
  const [home, setHome] = useState(g.home_score?.toString() ?? "");
  const [away, setAway] = useState(g.away_score?.toString() ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (g.away_name === null) return <li className={styles.card}>{`${g.home_name} — bye`}</li>;

  const played = g.home_score !== null && g.away_score !== null;
  async function save() {
    setSaving(true);
    setError("");
    try {
      onSaved(await saveScore(g.id, toScore(home), toScore(away)));
    } catch (err) {
      setError(onError(err) ?? "");
    } finally {
      setSaving(false);
    }
  }

  // Clear undoes one game's score (both null); no confirmation, it's one game. The schedule reloads so it reads unplayed.
  async function clearOne() {
    setSaving(true);
    setError("");
    try {
      await saveScore(g.id, null, null);
      await onCleared();
    } catch (err) {
      setError(onError(err) ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className={styles.card}>
      <div>{played ? `${g.home_name} ${g.home_score} – ${g.away_score} ${g.away_name}` : `${g.home_name} vs ${g.away_name}`}</div>
      <div className={styles.scoreRow}>
        <input type="number" min="0" step="1" inputMode="numeric" aria-label={`${g.home_name} score`} value={home} onChange={(e) => setHome(e.target.value)} />
        <input type="number" min="0" step="1" inputMode="numeric" aria-label={`${g.away_name} score`} value={away} onChange={(e) => setAway(e.target.value)} />
        <button type="button" className={styles.button} onClick={save} disabled={saving} aria-label={`Save ${g.home_name} vs ${g.away_name}`}>
          Save
        </button>
      </div>
      {played && (
        <div className={styles.actions}>
          <button type="button" className={styles.linkButton} onClick={clearOne} disabled={saving} aria-label={`Clear ${g.home_name} vs ${g.away_name}`}>
            Clear
          </button>
        </div>
      )}
      {error && <p className={styles.message} role="alert">{error}</p>}
    </li>
  );
}
