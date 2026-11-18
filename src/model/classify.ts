import type { ActionKind, Group, Item, Pr, StackInfo } from "./types";

const GROUP: Record<ActionKind, Group> = {
  merge: "needs-you",
  "fix-ci": "needs-you",
  conflicts: "needs-you",
  "address-review": "needs-you",
  reply: "needs-you",
  "re-request": "needs-you",
  review: "needs-you",
  "self-review": "self-review",
  waiting: "waiting",
  "waiting-ci": "waiting",
  blocked: "blocked",
};

const PRIORITY: ActionKind[] = [
  "merge",
  "fix-ci",
  "conflicts",
  "address-review",
  "reply",
  "re-request",
  "review",
  "self-review",
  "waiting-ci",
  "waiting",
  "blocked",
];

export function actionFor(pr: Pr, stack: StackInfo | null): ActionKind {
  if (!pr.mine) return "review";
  if (stack?.below) return "blocked";
  if (pr.checks === "failing") return "fix-ci";
  if (pr.conflicting) return "conflicts";
  if (pr.reviewDecision === "CHANGES_REQUESTED") return "address-review";
  if (pr.threadsAwaitingMe > 0) return "reply";
  if (pr.reviewDecision === "APPROVED" && !pr.isDraft) return pr.checks === "pending" ? "waiting-ci" : "merge";
  if (pr.requests.length > 0) return "waiting";
  if (pr.reviews.length > 0) return "re-request";
  return "self-review";
}

function sinceFor(pr: Pr, action: ActionKind): string {
  switch (action) {
    case "review":
      return pr.myRequestSince ?? pr.updatedAt;
    case "waiting": {
      const times = pr.requests.map((r) => r.since).filter((s): s is string => !!s);
      return times.length ? times.sort()[0] : pr.updatedAt;
    }
    case "merge": {
      const approvals = pr.reviews.filter((r) => r.state === "APPROVED" && r.at).map((r) => r.at!);
      return approvals.length ? approvals.sort().at(-1)! : pr.updatedAt;
    }
    default:
      return pr.updatedAt;
  }
}

const QUIET_DAYS = 30;

// A draft is still yours to finish, whatever else is wrong with it, and a PR of yours
// nobody has touched in a month shouldn't crowd today's work.
export function groupFor(pr: Pr, action: ActionKind, now = Date.now()): Group {
  if (pr.mine && action !== "blocked" && now - Date.parse(pr.updatedAt) > QUIET_DAYS * 86_400_000) return "quiet";
  if (pr.mine && pr.isDraft && GROUP[action] === "needs-you") return "self-review";
  return GROUP[action];
}

export function classify(mine: Pr[], reviews: Pr[], stacks: Map<string, StackInfo>, now = Date.now()): Item[] {
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const pr of [...mine, ...reviews]) {
    if (seen.has(pr.id)) continue;
    seen.add(pr.id);
    const stack = stacks.get(pr.id) ?? null;
    const action = actionFor(pr, stack);
    items.push({ pr, action, group: groupFor(pr, action, now), since: sinceFor(pr, action), stack });
  }
  return items.sort(compareItems);
}

// Within a group: by action priority, then the longest-waiting first, since that's what's overdue.
// Self-review and blocked read better newest first and in stack order respectively.
export function compareItems(a: Item, b: Item): number {
  const p = PRIORITY.indexOf(a.action) - PRIORITY.indexOf(b.action);
  if (p !== 0) return p;
  if (a.action === "blocked" && a.stack && b.stack) {
    return a.stack.key === b.stack.key ? a.stack.position - b.stack.position : a.stack.key.localeCompare(b.stack.key);
  }
  if (a.action === "self-review") return b.since.localeCompare(a.since);
  return a.since.localeCompare(b.since);
}

export const GROUP_ORDER: Group[] = ["needs-you", "self-review", "waiting", "blocked", "quiet"];

export const GROUP_LABEL: Record<Group, string> = {
  "needs-you": "Needs you",
  "self-review": "Self-review, nobody asked yet",
  waiting: "Waiting on reviewers",
  blocked: "Blocked by a lower PR in the stack",
  quiet: "Quiet for 30+ days",
};

export const ACTION_LABEL: Record<ActionKind, string> = {
  merge: "Approved, ready to merge",
  "fix-ci": "Checks failing",
  conflicts: "Merge conflicts",
  "address-review": "Changes requested",
  reply: "Unanswered comments",
  "re-request": "Reviewed, ask again",
  review: "asked you",
  "self-review": "Nobody asked yet",
  waiting: "Waiting",
  "waiting-ci": "Approved, checks running",
  blocked: "Blocked",
};
