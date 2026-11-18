import type { Item } from "./types";

export interface Snapshot {
  at: string;
  items: Record<string, Fingerprint>;
}

interface Fingerprint {
  action: string;
  requested: string[];
  reviews: string[];
  checks: string;
  updatedAt: string;
}

const KEY = "pr-desk:seen";

export function fingerprint(item: Item): Fingerprint {
  return {
    action: item.action,
    requested: item.pr.requests.map((r) => r.reviewer.login).sort(),
    reviews: item.pr.reviews.map((r) => `${r.author.login}:${r.state}`).sort(),
    checks: item.pr.checks,
    updatedAt: item.pr.updatedAt,
  };
}

export function takeSnapshot(items: Item[]): Snapshot {
  return { at: new Date().toISOString(), items: Object.fromEntries(items.map((i) => [i.pr.id, fingerprint(i)])) };
}

export function loadSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

export function saveSnapshot(s: Snapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private windows can refuse storage; change markers just reset next visit.
  }
}

const NEW_STATE: Record<string, string> = {
  merge: "Approved, ready to merge",
  "fix-ci": "Checks started failing",
  conflicts: "Now has merge conflicts",
  "address-review": "Changes requested",
  reply: "New comments for you",
  "re-request": "Reviewed",
  review: "New review request",
  "waiting-ci": "Approved, checks running",
};

// One short line saying what changed since the snapshot, or null when nothing did.
export function changeOf(item: Item, snap: Snapshot | null): string | null {
  if (!snap) return null;
  const before = snap.items[item.pr.id];
  const now = fingerprint(item);
  if (!before) return item.pr.mine ? "New" : "New review request";
  const added = now.requested.filter((r) => !before.requested.includes(r));
  if (added.length) return `Asked ${added.join(", ")}`;
  const reviewed = now.reviews.filter((r) => !before.reviews.includes(r));
  if (reviewed.length) {
    const [who, state] = reviewed[0].split(":");
    return `${who} ${state === "APPROVED" ? "approved" : state === "CHANGES_REQUESTED" ? "requested changes" : "commented"}`;
  }
  if (now.action !== before.action) return NEW_STATE[now.action] ?? "Status changed";
  if (now.checks !== before.checks) return now.checks === "passing" ? "Checks passed" : now.checks === "failing" ? "Checks failed" : "Checks running";
  if (now.updatedAt !== before.updatedAt) return "New activity";
  return null;
}
