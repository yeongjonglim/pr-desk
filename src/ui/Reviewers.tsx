import { TriangleAlert } from "lucide-react";
import type { Load } from "../api/desk";
import { BUSY_AT } from "../model/reviewers";
import { agoLong, days } from "../model/time";
import type { Person } from "../model/types";
import { Avatar, displayName } from "./bits";

function oldTone(iso: string | null) {
  const d = days(iso);
  return d > 14 ? "bad" : d > 3 ? "warn" : "";
}

export function Reviewers({ load, me }: { load: Load | undefined; me: Person }) {
  if (!load) return <div className="empty">Counting open review requests…</div>;
  const others = load.loads.filter((l) => l.reviewer.login !== me.login);
  const mineRow = load.loads.find((l) => l.reviewer.login === me.login);
  const max = Math.max(BUSY_AT, ...load.loads.map((l) => l.pending.length));
  const heaviest = others.filter((l) => !l.reviewer.isTeam).sort((a, b) => b.mine.length - a.mine.length)[0];
  const lightest = others.filter((l) => !l.reviewer.isTeam).sort((a, b) => a.pending.length - b.pending.length)[0];
  const showCallout = heaviest && heaviest.mine.length >= 3 && heaviest.mine.length / heaviest.pending.length >= 0.5;
  const rows = mineRow ? [...others, mineRow] : others;
  // The repo most of your pending PRs live in goes unnamed, so the chips stay short.
  const repoCounts = new Map<string, number>();
  for (const l of others) for (const p of l.mine) repoCounts.set(p.repo, (repoCounts.get(p.repo) ?? 0) + 1);
  const mainRepo = [...repoCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="reviewers">
      {showCallout && (
        <div className="callout">
          <TriangleAlert size={16} />
          <p>
            You've asked {displayName(heaviest.reviewer)} for {heaviest.mine.length} of their {heaviest.pending.length} pending reviews.
            {lightest && lightest !== heaviest && (
              <span>
                {" "}
                {displayName(lightest.reviewer)} has {lightest.pending.length} pending{lightest.mine.length ? `, ${lightest.mine.length} yours` : " and none from you"}.
              </span>
            )}
          </p>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reviewer</th>
              <th className="num">Pending</th>
              <th className="num">Yours</th>
              <th>Load</th>
              <th>Oldest waiting</th>
              <th>Your PRs with them</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const isMe = l.reviewer.login === me.login;
              return (
                <tr key={l.reviewer.login}>
                  <td>
                    <div className="nm">
                      <Avatar person={l.reviewer} size={26} />
                      {isMe ? "You" : displayName(l.reviewer)}
                      {l.reviewer.isTeam && <span className="teamtag">team</span>}
                      {isMe && <small>asked of you</small>}
                    </div>
                  </td>
                  <td className="num">{l.pending.length}</td>
                  <td className={`num ${l.pending.length >= BUSY_AT && l.mine.length ? "hot" : ""}`}>{isMe ? "–" : l.mine.length}</td>
                  <td>
                    <div className="track wide">
                      {!isMe && <i className="y" style={{ width: `${(l.mine.length / max) * 100}%` }} />}
                      <i className="o" style={{ width: `${((l.pending.length - (isMe ? 0 : l.mine.length)) / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className={`old ${oldTone(l.oldest)}`}>{agoLong(l.oldest)}</td>
                  <td>
                    <div className="refs">
                      {!isMe &&
                        l.mine.map((p) => (
                          <a key={`${p.repoFull}#${p.number}`} className={`ref ${days(p.since) > 30 ? "stale" : days(p.since) < 1 ? "new" : ""}`} href={p.url} target="_blank" rel="noreferrer" title={`${p.repo}#${p.number} · ${p.title} · asked ${agoLong(p.since)} ago`}>
                            {p.repo === mainRepo ? "" : p.repo}#{p.number}
                          </a>
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="foot-note">
        Open review requests across {load.org}'s {load.openPrs} open PRs. A request drops off once the person reviews.
      </p>
    </div>
  );
}
