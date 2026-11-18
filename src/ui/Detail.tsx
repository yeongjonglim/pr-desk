import { ArrowLeft, Check, Copy, ExternalLink, FileText, Link2 } from "lucide-react";
import { useState } from "react";
import { BUSY_AT, reviewCandidates, type ReviewerLoad } from "../model/reviewers";
import { agoLong } from "../model/time";
import type { Item, Person, Pr } from "../model/types";
import { Avatar, displayName, StatusIcon } from "./bits";
import { copyRich, copyText, teamsLine } from "./copy";

interface Props {
  item: Item;
  me: Person;
  loads: ReviewerLoad[] | null;
  pastReviewers: Person[];
  onBack: () => void;
}

function CopyButton({ pr, primary, label = "Copy for Teams" }: { pr: Pr; primary?: boolean; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  async function go() {
    const { html, text } = teamsLine(pr);
    setState((await copyRich(html, text)) ? "done" : "failed");
    setTimeout(() => setState("idle"), 1800);
  }
  return (
    <button className={`btn ${primary ? "pri" : ""}`} onClick={go}>
      {state === "done" ? <Check size={14} /> : <Copy size={14} />}
      {state === "done" ? "Copied" : state === "failed" ? "Copy blocked" : label}
    </button>
  );
}

const REVIEW_STATE: Record<string, { text: string; tone: string }> = {
  APPROVED: { text: "Approved", tone: "green" },
  CHANGES_REQUESTED: { text: "Changes requested", tone: "amber" },
  COMMENTED: { text: "Commented", tone: "" },
  DISMISSED: { text: "Dismissed", tone: "" },
};

export function Detail({ item, me, loads, pastReviewers, onBack }: Props) {
  const { pr, stack } = item;
  const [picked, setPicked] = useState<string | null>(null);
  const asking = pr.mine && (item.action === "self-review" || item.action === "re-request");
  const candidates = asking && loads ? reviewCandidates(loads, pastReviewers, new Set([me.login, pr.author.login])).slice(0, 6) : [];
  const chosen = candidates.find((c) => c.person.login === picked) ?? candidates[0];
  const maxPending = Math.max(BUSY_AT, ...candidates.map((c) => c.pending));
  const pendingOf = (login: string) => loads?.find((l) => l.reviewer.login === login);

  return (
    <div className="det">
      <div className="crumb">
        <button className="btn ghost back" onClick={onBack} aria-label="Back to the queue">
          <ArrowLeft size={15} />
        </button>
        <span>{pr.repoFull}</span>
        <span className="mono">#{pr.number}</span>
        <div className="right">
          <button className="btn ghost" title="Copy link" onClick={() => void copyText(pr.url)}>
            <Link2 size={15} />
          </button>
          <a className="btn" href={pr.url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} />
            Open in GitHub
          </a>
        </div>
      </div>
      <div className="body">
        <div>
          <h2>{pr.title}</h2>
          <div className="meta">
            <Avatar person={pr.author} size={18} />
            {pr.mine ? "You" : displayName(pr.author)} · opened {agoLong(pr.createdAt)} ago · <span className="add">+{pr.additions.toLocaleString("en")}</span>
            <span className="del">−{pr.deletions.toLocaleString("en")}</span> · {pr.changedFiles} files
          </div>
        </div>

        <div className="pills">
          <span className="pill">
            <StatusIcon action={item.action} size={13} />
            {pr.isDraft ? "Draft" : "Ready for review"}
          </span>
          {pr.checks === "passing" && <span className="pill green">Checks passed</span>}
          {pr.checks === "failing" && <span className="pill red">Checks failing</span>}
          {pr.checks === "pending" && <span className="pill">Checks running</span>}
          {pr.conflicting && <span className="pill red">Merge conflicts</span>}
          {pr.openThreads > 0 && (
            <span className={`pill ${pr.threadsAwaitingMe ? "amber" : ""}`}>
              {pr.openThreads} open thread{pr.openThreads === 1 ? "" : "s"}
            </span>
          )}
          {pr.mine && pr.requests.length === 0 && pr.reviews.length === 0 && <span className="pill amber">No reviewer yet</span>}
        </div>

        {asking && (
          <div className="blk">
            <h3>
              Ask for a review <span>pending in the org now · yours in dark</span>
            </h3>
            {!loads && <p className="note">Loading reviewer load…</p>}
            {loads && candidates.length === 0 && <p className="note">No reviewers found in the org yet.</p>}
            {candidates.length > 0 && (
              <div className="pick" role="radiogroup" aria-label="Reviewer">
                {candidates.map((c, i) => (
                  <button
                    key={c.person.login}
                    role="radio"
                    aria-checked={c === chosen}
                    className={`cand ${c === chosen ? "on" : ""}`}
                    onClick={() => setPicked(c.person.login)}
                  >
                    <span className="radio" />
                    <Avatar person={c.person} size={20} />
                    <span className="nm">{displayName(c.person)}</span>
                    <span className="bar">
                      <span className="track">
                        <i className="y" style={{ width: `${(c.mine / maxPending) * 100}%` }} />
                        <i className="o" style={{ width: `${((c.pending - c.mine) / maxPending) * 100}%` }} />
                      </span>
                      {c.pending} pending · {c.mine ? `${c.mine} yours` : "none yours"}
                    </span>
                    {i === 0 ? <span className="pill green">Most room</span> : c.pending >= BUSY_AT ? <span className="pill red">Busy</span> : <span />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {pr.mine && (pr.requests.length > 0 || pr.reviews.length > 0) && (
          <div className="blk">
            <h3>Reviewers</h3>
            <div className="people">
              {pr.requests.map((r) => {
                const load = pendingOf(r.reviewer.login);
                return (
                  <div key={r.reviewer.login} className="person">
                    <Avatar person={r.reviewer} size={20} />
                    <span className="nm">{displayName(r.reviewer)}</span>
                    <span className="s">asked {r.since ? `${agoLong(r.since)} ago` : ""}</span>
                    {load && (
                      <span className={`s right-s ${load.pending.length >= BUSY_AT ? "hot" : ""}`}>
                        {load.pending.length} pending · {load.mine.length} yours
                      </span>
                    )}
                  </div>
                );
              })}
              {pr.reviews.map((r) => (
                <div key={r.author.login} className="person">
                  <Avatar person={r.author} size={20} />
                  <span className="nm">{displayName(r.author)}</span>
                  <span className={`s ${REVIEW_STATE[r.state]?.tone ?? ""}`}>{REVIEW_STATE[r.state]?.text ?? r.state}</span>
                  <span className="s right-s">{r.at ? `${agoLong(r.at)} ago` : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="blk">
          <div className="msg">
            <a href={pr.url} target="_blank" rel="noreferrer">
              {pr.title}
            </a>{" "}
            (+{pr.additions.toLocaleString("en")}/−{pr.deletions.toLocaleString("en")}) · {pr.repo}#{pr.number}
          </div>
          <div className="acts">
            <CopyButton pr={pr} primary />
            {asking && chosen && (
              <a className="btn" href={pr.url} target="_blank" rel="noreferrer">
                Request {displayName(chosen.person)} on GitHub
              </a>
            )}
          </div>
        </div>

        {stack && (
          <div className="blk">
            <h3>
              Stack <span>{stack.members.length} PRs, merges from the top of this list</span>
            </h3>
            <div className="stack">
              {stack.members.map((m) => (
                <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className={`stop ${m.id === pr.id ? "cur" : ""}`}>
                  <span className={`node ${m.isDraft ? "draft" : m.reviewDecision === "APPROVED" ? "ok" : ""}`} />
                  <span className="mono">#{m.number}</span>
                  <span className="tx">{m.title.replace(/^\[[^\]]+\]\s*/, "")}</span>
                  <span className="s">{m.id === pr.id ? "this PR" : m.isDraft ? "draft" : m.reviewDecision === "APPROVED" ? "approved" : "ready"}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {pr.notionUrl && (
          <a className="link" href={pr.notionUrl} target="_blank" rel="noreferrer">
            <FileText size={16} strokeWidth={1.75} />
            {pr.story ?? "Ticket"}
            <span className="s">Notion</span>
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
