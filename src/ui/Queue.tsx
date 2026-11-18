import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ACTION_LABEL, GROUP_LABEL, GROUP_ORDER } from "../model/classify";
import { changeOf, type Snapshot } from "../model/seen";
import { ago, clock, days } from "../model/time";
import type { Item } from "../model/types";
import { Avatar, displayName, StatusIcon } from "./bits";

export type GroupBy = "action" | "repo" | "story";
export type Filter = "all" | "mine" | "reviews";

interface Section {
  key: string;
  label: string;
  items: Item[];
  collapsed: boolean;
}

export function sections(items: Item[], groupBy: GroupBy): Section[] {
  if (groupBy === "action") {
    return GROUP_ORDER.map((g) => ({ key: g, label: GROUP_LABEL[g], items: items.filter((i) => i.group === g), collapsed: g === "blocked" || g === "quiet" })).filter(
      (s) => s.items.length,
    );
  }
  const keyOf = (i: Item) => (groupBy === "repo" ? i.pr.repoFull : (i.pr.story ?? "No ticket"));
  const map = new Map<string, Item[]>();
  for (const i of items) map.set(keyOf(i), [...(map.get(keyOf(i)) ?? []), i]);
  return [...map.entries()]
    .sort((a, b) => (a[0] === "No ticket" ? 1 : b[0] === "No ticket" ? -1 : b[1].filter((i) => i.group === "needs-you").length - a[1].filter((i) => i.group === "needs-you").length || b[1].length - a[1].length))
    .map(([key, list]) => ({ key, label: key, items: list, collapsed: false }));
}

function meta(item: Item, change: string | null, me: string) {
  const { pr, action, stack } = item;
  const parts: { text: string; tone?: string }[] = [];
  if (change) parts.push({ text: change, tone: "new" });
  if (action === "review") {
    parts.push({ text: `${displayName(pr.author)} asked you` });
    parts.push({ text: `+${pr.additions} −${pr.deletions}` });
  } else if (action === "waiting") {
    const who = pr.requests.map((r) => displayName(r.reviewer));
    const teamOnly = pr.requests.every((r) => r.reviewer.isTeam);
    parts.push({ text: teamOnly ? `only the ${who.join(", ")} team, no person` : `with ${who.join(", ")}`, tone: teamOnly ? "warn" : undefined });
  } else if (action === "fix-ci") {
    parts.push({ text: "Checks failing", tone: "bad" });
  } else if (action === "reply") {
    parts.push({ text: `${pr.threadsAwaitingMe} comment${pr.threadsAwaitingMe === 1 ? "" : "s"} waiting on you`, tone: "warn" });
  } else if (action === "blocked" && stack?.below) {
    parts.push({ text: `after #${stack.below.number}` });
  } else {
    parts.push({ text: ACTION_LABEL[action], tone: action === "conflicts" || action === "address-review" ? "warn" : undefined });
  }
  if (stack) parts.push({ text: stack.position === 1 ? `base of ${stack.members.length}` : `${stack.position} of ${stack.members.length} in stack` });
  if (pr.isDraft && pr.author.login === me) parts.push({ text: "draft" });
  return parts;
}

function ageTone(item: Item) {
  const d = days(item.since);
  if (item.action === "review") return d > 3 ? "bad" : d > 1 ? "warn" : "";
  if (item.action === "waiting") return d > 5 ? "bad" : d > 2 ? "warn" : "";
  return "";
}

interface Props {
  items: Item[];
  groupBy: GroupBy;
  selectedId: string | null;
  baseline: Snapshot | null;
  me: string;
  onSelect: (id: string) => void;
}

export function QueueList({ items, groupBy, selectedId, baseline, me, onSelect }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const list = sections(items, groupBy);
  if (!items.length) return <div className="empty">Nothing here. Every PR you own or were asked to review is accounted for.</div>;
  return (
    <div className="list" role="listbox" aria-label="Pull requests">
      {list.map((s) => {
        const isOpen = open[s.key] ?? !s.collapsed;
        return (
          <section key={s.key}>
            <button className="gh" onClick={() => setOpen({ ...open, [s.key]: !isOpen })} aria-expanded={isOpen}>
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {s.label} <span className="c">{s.items.length}</span>
            </button>
            {isOpen &&
              s.items.map((item) => {
                const change = changeOf(item, baseline);
                const people = item.pr.mine ? item.pr.requests.map((r) => r.reviewer) : [item.pr.author];
                const approvers = item.action === "merge" ? item.pr.reviews.filter((r) => r.state === "APPROVED").map((r) => r.author) : [];
                return (
                  <div
                    key={item.pr.id}
                    id={`row-${item.pr.id}`}
                    role="option"
                    aria-selected={item.pr.id === selectedId}
                    className={`row ${item.pr.id === selectedId ? "sel" : ""}`}
                    onClick={() => onSelect(item.pr.id)}
                  >
                    <StatusIcon action={item.action} />
                    <div className="row-main">
                      <div className="t">{item.pr.title}</div>
                      <div className="m">
                        <span className="mono">
                          {item.pr.repo}#{item.pr.number}
                        </span>
                        {meta(item, change, me).map((p, i) => (
                          <span key={i} className={p.tone}>
                            {p.text}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="who">
                      {[...approvers, ...people].slice(0, 3).map((p) => (
                        <Avatar key={p.login} person={p} size={20} />
                      ))}
                    </div>
                    <span className={`age ${ageTone(item)}`} title={`since ${clock(item.since)}, ${new Date(item.since).toDateString()}`}>
                      {change && <span className="nd" />}
                      {ago(item.since)}
                    </span>
                  </div>
                );
              })}
          </section>
        );
      })}
    </div>
  );
}
