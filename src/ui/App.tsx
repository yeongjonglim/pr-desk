import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NeedsTokenError } from "../api/github";
import { useDesk, useLoad } from "../hooks";
import { changeOf, loadSnapshot, saveSnapshot, takeSnapshot, type Snapshot } from "../model/seen";
import { clock } from "../model/time";
import type { Item, Person } from "../model/types";
import { Detail } from "./Detail";
import { QueueList, sections, type Filter, type GroupBy } from "./Queue";
import { Reviewers } from "./Reviewers";
import { Sidebar, type View } from "./Sidebar";
import { TokenScreen } from "./TokenScreen";

function pref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(`pr-desk:${key}`) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function setPref(key: string, value: string) {
  try {
    localStorage.setItem(`pr-desk:${key}`, value);
  } catch {
    // Preference just won't stick.
  }
}

// Remembered so the slower org-wide reviewer query can start before the queue arrives.
function lastSeenOrg(): { org?: string; me?: string } {
  try {
    return JSON.parse(localStorage.getItem("pr-desk:org") ?? "{}");
  } catch {
    return {};
  }
}

function rememberOrg(org: string, me: string) {
  setPref("org", JSON.stringify({ org, me }));
}

const viewFromHash = (): View => (location.hash === "#reviewers" ? "reviewers" : "queue");

export function App() {
  const client = useQueryClient();
  const desk = useDesk();
  const load = useLoad(desk.data?.org ?? lastSeenOrg().org, desk.data?.me.login ?? lastSeenOrg().me);
  const [view, setView] = useState<View>(viewFromHash);
  const [groupBy, setGroupBy] = useState<GroupBy>(() => pref("groupBy", "action"));
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [reviewer, setReviewer] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<Snapshot | null>(loadSnapshot);
  const itemsRef = useRef<Item[]>([]);

  const items = useMemo(() => {
    const all = desk.data?.items ?? [];
    return filter === "mine" ? all.filter((i) => i.pr.mine) : filter === "reviews" ? all.filter((i) => !i.pr.mine) : all;
  }, [desk.data, filter]);
  itemsRef.current = desk.data?.items ?? [];

  const ordered = useMemo(() => sections(items, groupBy).flatMap((s) => s.items), [items, groupBy]);
  const selected = ordered.find((i) => i.pr.id === selectedId) ?? ordered[0] ?? null;
  const changed = (desk.data?.items ?? []).filter((i) => changeOf(i, baseline)).length;

  // The first load starts the history. After that, leaving the tab records what you saw,
  // so coming back highlights only what changed while you were away.
  useEffect(() => {
    if (desk.data?.org) rememberOrg(desk.data.org, desk.data.me.login);
  }, [desk.data?.org, desk.data?.me.login]);

  useEffect(() => {
    if (desk.data && !loadSnapshot()) saveSnapshot(takeSnapshot(desk.data.items));
  }, [desk.data]);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden" && itemsRef.current.length) saveSnapshot(takeSnapshot(itemsRef.current));
      if (document.visibilityState === "visible") setBaseline(loadSnapshot());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== "queue" || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input, textarea, select")) return;
      const idx = ordered.findIndex((i) => i.pr.id === selected?.pr.id);
      if (e.key === "j" || e.key === "k") {
        const next = ordered[Math.min(ordered.length - 1, Math.max(0, idx + (e.key === "j" ? 1 : -1)))];
        if (next) {
          setSelectedId(next.pr.id);
          document.getElementById(`row-${next.pr.id}`)?.scrollIntoView({ block: "nearest" });
        }
      } else if (e.key === "o" && selected) {
        window.open(selected.pr.url, "_blank", "noreferrer");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, ordered, selected]);

  if (desk.error instanceof NeedsTokenError) {
    return <TokenScreen reason={desk.error.message === "No GitHub token in this browser yet." ? undefined : desk.error.message} onSaved={() => void client.resetQueries()} />;
  }
  if (!desk.data) {
    return (
      <div className="boot">
        {desk.error ? (
          <>
            <p>Couldn't load your pull requests.</p>
            <p className="muted">{desk.error.message}</p>
            <button className="btn" onClick={() => void desk.refetch()}>
              Try again
            </button>
          </>
        ) : (
          <p className="muted">Loading your pull requests…</p>
        )}
      </div>
    );
  }

  const me: Person = desk.data.me;
  const pastReviewers = uniqueReviewers(desk.data.items);
  const counts = { all: desk.data.items.length, mine: desk.data.items.filter((i) => i.pr.mine).length, reviews: desk.data.items.filter((i) => !i.pr.mine).length };

  return (
    <div className="app">
      <Sidebar
        me={me}
        org={desk.data.org}
        view={view}
        queueCount={desk.data.items.filter((i) => i.group === "needs-you").length}
        reviewerCount={load.data?.loads.length ?? null}
        loads={load.data?.loads ?? []}
        syncedAt={desk.dataUpdatedAt}
        error={desk.error?.message ?? null}
        fetching={desk.isFetching}
        onView={setView}
        onReviewer={(login) => {
          setView("reviewers");
          setReviewer(login);
        }}
      />
      <main className="main">
        {view === "queue" ? (
          <>
            <div className="top">
              <h1>Queue</h1>
              <div className="seg" role="tablist">
                {(["all", "mine", "reviews"] as Filter[]).map((f) => (
                  <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                    {f === "all" ? "Everything" : f === "mine" ? "Mine" : "Reviews"} <span className="c">{counts[f]}</span>
                  </button>
                ))}
              </div>
              {changed > 0 && baseline && (
                <button className="pill blue" title="Mark everything as seen" onClick={() => {
                  const s = takeSnapshot(desk.data!.items);
                  saveSnapshot(s);
                  setBaseline(s);
                }}>
                  <span className="dot" />
                  {changed} changed since {clock(baseline.at)}
                </button>
              )}
              <div className="right">
                <label className="select">
                  Group by
                  <select
                    value={groupBy}
                    onChange={(e) => {
                      setGroupBy(e.target.value as GroupBy);
                      setPref("groupBy", e.target.value);
                    }}
                  >
                    <option value="action">Next action</option>
                    <option value="repo">Repository</option>
                    <option value="story">Story</option>
                  </select>
                </label>
                <button className="btn ghost" title="Refresh now" onClick={() => void client.invalidateQueries()}>
                  <RefreshCw size={14} className={desk.isFetching ? "spin" : ""} />
                </button>
              </div>
            </div>
            <div className={`work ${showDetail ? "show-det" : ""}`}>
              <QueueList items={items} groupBy={groupBy} selectedId={selected?.pr.id ?? null} baseline={baseline} me={me.login} onSelect={(id) => {
                  setSelectedId(id);
                  setShowDetail(true);
                }} />
              {selected ? <Detail key={selected.pr.id} item={selected} me={me} loads={load.data?.loads ?? null} pastReviewers={pastReviewers} onBack={() => setShowDetail(false)} /> : <div />}
            </div>
          </>
        ) : (
          <>
            <div className="top">
              <h1>Reviewers</h1>
              <span className="pill">Pending review requests in {desk.data.org}</span>
              <div className="right legend">
                <span>
                  <i className="sw y" />
                  Your PRs
                </span>
                <span>
                  <i className="sw o" />
                  Others'
                </span>
              </div>
            </div>
            <Reviewers load={load.data} me={me} selected={reviewer} onSelect={setReviewer} />
          </>
        )}
      </main>
    </div>
  );
}

function uniqueReviewers(items: Item[]): Person[] {
  const seen = new Map<string, Person>();
  for (const i of items) {
    if (!i.pr.mine) continue;
    for (const r of i.pr.reviews) seen.set(r.author.login, r.author);
  }
  return [...seen.values()];
}
