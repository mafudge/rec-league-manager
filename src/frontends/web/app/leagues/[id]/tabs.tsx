import styles from "../../ui.module.css";

export type Tab = "entrants" | "schedule" | "standings";

const TABS: { key: Tab; label: string }[] = [
  { key: "entrants", label: "Entrants" },
  { key: "schedule", label: "Schedule" },
  { key: "standings", label: "Standings" },
];

/** Reads a `?tab=` value; anything unknown opens Entrants. */
export const tabFrom = (value: string | null): Tab => TABS.find((t) => t.key === value)?.key ?? "entrants";

// Plain links to `?tab=...` on the same page, so a tab is bookmarkable and the back button works.
export function LeagueTabs({ active }: { active: Tab }) {
  return (
    <nav className={styles.tabs} aria-label="League sections">
      {TABS.map((t) => (
        <a key={t.key} href={`?tab=${t.key}`} className={styles.tab} aria-current={t.key === active ? "page" : undefined}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
