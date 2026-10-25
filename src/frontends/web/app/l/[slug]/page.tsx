"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BackendRefused, Game, PublicView, getPublicLeague, messageFor } from "../../api";
import StandingsTable from "../../standings-table";
import styles from "../../ui.module.css";

const gameText = (g: Game) => {
  if (g.away_name === null) return `${g.home_name} — bye`;
  if (g.home_score !== null && g.away_score !== null) return `${g.home_name} ${g.home_score} – ${g.away_score} ${g.away_name}`;
  return `${g.home_name} vs ${g.away_name}`;
};

function Games({ games }: { games: Game[] }) {
  return (
    <ul className={styles.list}>
      {games.map((g) => (
        <li key={g.id} className={styles.card}>
          {gameText(g)}
        </li>
      ))}
    </ul>
  );
}

// The public page: read-only, no sign-in, this week first (PRD §6 step 9). Nothing here can write.
export default function PublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [view, setView] = useState<PublicView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getPublicLeague(slug)
      .then(setView)
      .catch((e) => (e instanceof BackendRefused && e.message === "League not found" ? setNotFound(true) : setMessage(messageFor(e))));
  }, [slug]);

  if (notFound)
    return (
      <main className={styles.page}>
        <div className={styles.narrow}>
          <h1>League not found</h1>
        </div>
      </main>
    );

  const weeks = new Map<number, Game[]>();
  for (const g of view?.games ?? []) weeks.set(g.week, [...(weeks.get(g.week) ?? []), g]);
  const { league, current_week: week, standings } = view ?? ({} as Partial<PublicView>);

  return (
    <main className={styles.page}>
      <div className={styles.narrow}>
        {message && (
          <p className={styles.message} aria-live="polite">
            {message}
          </p>
        )}
        {view && league && (
          <>
            <h1>{league.name}</h1>
            <p className={styles.muted}>{league.location}</p>
            {(league.sport || league.season) && <p className={styles.muted}>{[league.sport, league.season].filter(Boolean).join(" · ")}</p>}
            {view.games.length === 0 ? (
              <p className={styles.muted}>No games scheduled yet</p>
            ) : (
              <>
                <h2>{`This week — Week ${week}`}</h2>
                <Games games={weeks.get(week as number) ?? []} />
                <h2>Full schedule</h2>
                {[...weeks].map(([w, list]) => (
                  <div key={w}>
                    <h3>{`Week ${w}`}</h3>
                    <Games games={list} />
                  </div>
                ))}
              </>
            )}
            <h2>Standings</h2>
            {standings && <StandingsTable standings={standings} allowTies={league.allow_ties} />}
          </>
        )}
      </div>
    </main>
  );
}
