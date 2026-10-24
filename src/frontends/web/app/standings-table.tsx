import { Standings } from "./api";
import styles from "./ui.module.css";

const diffText = (n: number) => (n > 0 ? `+${n}` : String(n));

// One standings table, shared by the organizer's tab and the public page. The backend sorts the rows.
export default function StandingsTable({ standings, allowTies }: { standings: Standings; allowTies: boolean }) {
  return (
    <div>
      {standings.played === 0 && <p className={styles.muted}>No games played yet</p>}
      <div className={styles.tableScroll}>
        <table className={styles.standings}>
          <thead>
            <tr>
              <th scope="col">Entrant</th>
              <th scope="col">W</th>
              <th scope="col">L</th>
              {allowTies && <th scope="col">T</th>}
              <th scope="col">PF</th>
              <th scope="col">PA</th>
              <th scope="col">Diff</th>
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((r) => (
              <tr key={r.entrant_id}>
                <td>{r.name}</td>
                <td>{r.w}</td>
                <td>{r.l}</td>
                {allowTies && <td>{r.t}</td>}
                <td>{r.pf}</td>
                <td>{r.pa}</td>
                <td>{diffText(r.diff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.muted}>{standings.tiebreak}</p>
    </div>
  );
}
