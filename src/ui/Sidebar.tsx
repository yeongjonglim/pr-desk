import { ListTodo, LogOut, Users } from "lucide-react";
import { forgetToken } from "../api/github";
import type { ReviewerLoad } from "../model/reviewers";
import { BUSY_AT } from "../model/reviewers";
import { agoLong } from "../model/time";
import type { Person } from "../model/types";
import { Avatar, displayName } from "./bits";

export type View = "queue" | "reviewers";

interface Props {
  me: Person;
  org: string | null;
  view: View;
  queueCount: number;
  reviewerCount: number | null;
  loads: ReviewerLoad[];
  syncedAt: number;
  error: string | null;
  fetching: boolean;
  onView: (v: View) => void;
  onReviewer: (login: string) => void;
}

export function Sidebar({ me, org, view, queueCount, reviewerCount, loads, syncedAt, error, fetching, onView, onReviewer }: Props) {
  const top = loads.filter((l) => l.mine.length > 0 && l.reviewer.login !== me.login).slice(0, 6);
  return (
    <aside className="side">
      <div className="ws">
        <span className="mark">{(org ?? me.login).slice(0, 1)}</span>
        {org ?? me.login}
      </div>
      <nav>
        <a href="#queue" className={`nav ${view === "queue" ? "on" : ""}`} onClick={() => onView("queue")}>
          <ListTodo size={16} strokeWidth={1.75} />
          Queue<span className="n">{queueCount}</span>
        </a>
        <a href="#reviewers" className={`nav ${view === "reviewers" ? "on" : ""}`} onClick={() => onView("reviewers")}>
          <Users size={16} strokeWidth={1.75} />
          Reviewers<span className="n">{reviewerCount ?? "–"}</span>
        </a>
      </nav>
      {top.length > 0 && (
        <>
          <div className="sec">
            <span>Waiting on</span>
            <span>yours / all</span>
          </div>
          {top.map((l) => (
            <a key={l.reviewer.login} href="#reviewers" className="rv" onClick={() => onReviewer(l.reviewer.login)}>
              <Avatar person={l.reviewer} size={18} />
              <span className="rv-name">{displayName(l.reviewer)}</span>
              <span className={`load ${l.pending.length >= BUSY_AT ? "hot" : ""}`}>
                <b>{l.mine.length}</b>/ {l.pending.length}
              </span>
            </a>
          ))}
        </>
      )}
      <div className="foot">
        <span className={`live ${error ? "off" : fetching ? "busy" : ""}`} />
        <span className="foot-text" title={error ?? undefined}>
          {error ? "Sync failed, retrying" : syncedAt ? `Synced ${agoLong(new Date(syncedAt).toISOString())} ago`.replace("just now ago", "just now") : "Syncing…"}
        </span>
        <button
          className="icon-btn"
          title="Forget this browser's token"
          onClick={() => {
            forgetToken();
            location.reload();
          }}
        >
          <LogOut size={14} />
        </button>
        <Avatar person={me} size={20} />
      </div>
    </aside>
  );
}
