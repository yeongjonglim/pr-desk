import { ArrowLeft, ExternalLink, TriangleAlert } from "lucide-react";
import type { Load } from "../api/desk";
import { BUSY_AT, type PendingPr, type ReviewerLoad } from "../model/reviewers";
import { ago, agoLong, days } from "../model/time";
import type { Person } from "../model/types";
import { Avatar, displayName, StateBadge } from "./bits";
import { teamsList } from "./copy";
import { CopyButton } from "./CopyButton";

function oldTone(iso: string | null) {
  const d = days(iso);
  return d > 14 ? "bad" : d > 3 ? "warn" : "";
}

interface Props {
  load: Load | undefined;
  me: Person;
  selected: string | null;
  onSelect: (login: string | null) => void;
}

export function Reviewers({ load, me, selected, onSelect }: Props) {
  if (!load) return <div className="empty">Counting open review requests…</div>;
  const others = load.loads.filter((l) => l.reviewer.login !== me.login);
  const mineRow = load.loads.find((l) => l.reviewer.login === me.login);
  const max = Math.max(BUSY_AT, ...load.loads.map((l) => l.pending.length));
  const people = others.filter((l) => !l.reviewer.isTeam);
  const heaviest = [...people].sort((a, b) => b.mine.length - a.mine.length)[0];
  const lightest = [...people].sort((a, b) => a.pending.length - b.pending.length)[0];
  const showCallout = heaviest && heaviest.mine.length >= 3 && heaviest.mine.length / heaviest.pending.length >= 0.5;
  const rows = mineRow ? [...others, mineRow] : others;
  const current = rows.find((l) => l.reviewer.login === selected) ?? null;

  return (
    <div className={`rev-work ${current ? "show-det" : ""}`}>
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
                  <tr
                    key={l.reviewer.login}
                    className={l === current ? "sel" : ""}
                    tabIndex={0}
                    aria-selected={l === current}
                    onClick={() => onSelect(l === current ? null : l.reviewer.login)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(l.reviewer.login))}
                  >
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
                            <span key={`${p.repoFull}#${p.number}`} className={`ref ${days(p.since) > 30 ? "stale" : days(p.since) < 1 ? "new" : ""}`} title={`${p.title} · ${p.state === "changes" ? "changes requested" : p.state}`}>
                              <i className={`sd ${p.state}`} />
                              {p.repo}#{p.number}
                            </span>
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
          Open review requests across {load.org}'s {load.openPrs} open PRs. A request drops off once the person reviews. Click a reviewer to see their PRs.
        </p>
      </div>
      {current && <ReviewerPanel load={current} me={me} onClose={() => onSelect(null)} />}
    </div>
  );
}

function PendingRow({ p, showAuthor }: { p: PendingPr; showAuthor: boolean }) {
  return (
    <a className="prow" href={p.url} target="_blank" rel="noreferrer">
      <div className="prow-top">
        <div className="prow-t">{p.title}</div>
        <StateBadge state={p.state} compact />
      </div>
      <div className="prow-m">
        <span className="mono">
          {p.repo}#{p.number}
        </span>
        {showAuthor && (
          <span className="by">
            <Avatar person={p.author} size={14} />
            {displayName(p.author)}
          </span>
        )}
        <span>
          +{p.additions.toLocaleString("en")} −{p.deletions.toLocaleString("en")}
        </span>
        <span className={`since ${oldTone(p.since)}`}>asked {ago(p.since)} ago</span>
      </div>
    </a>
  );
}

function ReviewerPanel({ load, me, onClose }: { load: ReviewerLoad; me: Person; onClose: () => void }) {
  const isMe = load.reviewer.login === me.login;
  const theirs = load.pending.filter((p) => !p.mine);
  const profile = load.reviewer.isTeam ? null : `https://github.com/${load.reviewer.login}`;
  return (
    <aside className="det" aria-label={`Pending reviews for ${displayName(load.reviewer)}`}>
      <div className="crumb">
        <button className="btn ghost back" onClick={onClose} aria-label="Back to reviewers">
          <ArrowLeft size={15} />
        </button>
        <span>Reviewer</span>
        <div className="right">
          {profile && (
            <a className="btn" href={profile} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              GitHub profile
            </a>
          )}
          <button className="btn ghost" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
      </div>
      <div className="body">
        <div className="who-head">
          <Avatar person={load.reviewer} size={36} />
          <div>
            <h2>{isMe ? "You" : (load.reviewer.name ?? load.reviewer.login)}</h2>
            <div className="meta">
              {load.pending.length} pending{isMe ? "" : ` · ${load.mine.length} yours`} · oldest {agoLong(load.oldest)}
            </div>
          </div>
        </div>
        <div className="acts">
          {!isMe && load.mine.length > 0 && <CopyButton primary get={() => teamsList(load.mine)} label={`Copy your ${load.mine.length} for Teams`} />}
          <CopyButton primary={isMe || load.mine.length === 0} get={() => teamsList(load.pending)} label={`Copy all ${load.pending.length}`} />
        </div>
        {!isMe && load.mine.length > 0 && (
          <div className="blk">
            <h3>
              Yours <span>{load.mine.length}, oldest first</span>
            </h3>
            <div className="plist">
              {load.mine.map((p) => (
                <PendingRow key={`${p.repoFull}#${p.number}`} p={p} showAuthor={false} />
              ))}
            </div>
          </div>
        )}
        {(isMe ? load.pending : theirs).length > 0 && (
          <div className="blk">
            <h3>
              {isMe ? "Asked of you" : "Others'"} <span>{(isMe ? load.pending : theirs).length}, oldest first</span>
            </h3>
            <div className="plist">
              {(isMe ? load.pending : theirs).map((p) => (
                <PendingRow key={`${p.repoFull}#${p.number}`} p={p} showAuthor />
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
