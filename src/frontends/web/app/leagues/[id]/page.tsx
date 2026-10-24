"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { League, getLeague } from "../../api";
import OrganizerHeader from "../../organizer-header";
import styles from "../../ui.module.css";
import { useSignedIn } from "../../use-signed-in";
import Entrants from "./entrants";
import Schedule from "./schedule";
import Standings from "./standings";
import { LeagueTabs, tabFrom } from "./tabs";

const publicUrl = (slug: string) => `${location.origin}/l/${slug}`;

// The league home: a tab bar over Entrants, Schedule and Standings.
export default function LeaguePage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense>
      <LeagueHome />
    </Suspense>
  );
}

function LeagueHome() {
  const { id } = useParams<{ id: string }>();
  const tab = tabFrom(useSearchParams().get("tab"));
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
      await navigator.clipboard.writeText(publicUrl(league!.slug));
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
            <p className={styles.muted}>
              <a href={publicUrl(league.slug)}>{publicUrl(league.slug)}</a>
            </p>
            <LeagueTabs active={tab} />
            {tab === "entrants" && <Entrants leagueId={id} />}
            {tab === "schedule" && <Schedule leagueId={id} />}
            {tab === "standings" && <Standings leagueId={id} allowTies={league.allow_ties} />}
          </>
        )}
      </div>
    </main>
  );
}
