import type { RawPr, RawReviewer } from "../api/queries";
import type { Checks, Person, Pr, Review, ReviewRequest, ReviewState } from "./types";

const NOTION = /https:\/\/(?:www\.)?notion\.so\/[^\s)\]>"']+/;
// A ticket key like ABC-123: bracketed in the title ("[ABC-123] Fix …") or in the branch
// ("feat/ABC-123-fix-…").
const TITLE_KEY = /\[([A-Z][A-Z0-9]+-\d+)\]/;
const BRANCH_KEY = /(?:^|\/)([A-Za-z][A-Za-z0-9]+-\d+)(?:-|$)/;

export function reviewerOf(raw: RawReviewer | null): Person | null {
  if (!raw) return null;
  if (raw.__typename === "Team" && raw.slug) {
    return { login: raw.slug, name: raw.teamName ?? raw.slug, isTeam: true };
  }
  if (raw.login) return { login: raw.login, name: raw.name, avatarUrl: raw.avatarUrl };
  return null;
}

export function requestSince(events: RawPr["timelineItems"]["nodes"], key: string): string | null {
  let since: string | null = null;
  for (const e of events) {
    const who = e.requestedReviewer?.login ?? e.requestedReviewer?.slug;
    if (who === key && e.createdAt && (!since || e.createdAt > since)) since = e.createdAt;
  }
  return since;
}

function checksOf(raw: RawPr): Checks {
  const state = raw.commits.nodes[0]?.commit.statusCheckRollup?.state;
  if (!state) return "none";
  if (state === "SUCCESS") return "passing";
  if (state === "FAILURE" || state === "ERROR") return "failing";
  return "pending";
}

export function normalize(raw: RawPr, me: string): Pr {
  const requests: ReviewRequest[] = raw.reviewRequests.nodes
    .map((n) => reviewerOf(n.requestedReviewer))
    .filter((p): p is Person => p !== null)
    .map((reviewer) => ({ reviewer, since: requestSince(raw.timelineItems.nodes, reviewer.login) }));

  const reviews: Review[] = raw.latestOpinionatedReviews.nodes
    .filter((r) => r.author)
    .map((r) => ({
      author: { login: r.author!.login, avatarUrl: r.author!.avatarUrl, name: r.author!.name },
      state: r.state as ReviewState,
      at: r.submittedAt,
    }));

  const open = raw.reviewThreads.nodes.filter((t) => !t.isResolved);
  const author: Person = raw.author ? { login: raw.author.login, avatarUrl: raw.author.avatarUrl, name: raw.author.name } : { login: "ghost" };
  // Search's review-requested:@me also matches requests to my teams, which we can't tell apart
  // without listing team membership, so a team request stands in when there is no direct one.
  const mineRequest = requests.find((r) => r.reviewer.login === me) ?? requests.find((r) => r.reviewer.isTeam);

  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    repo: raw.repository.name,
    repoFull: raw.repository.nameWithOwner,
    owner: raw.repository.owner.login,
    isDraft: raw.isDraft,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    additions: raw.additions,
    deletions: raw.deletions,
    changedFiles: raw.changedFiles,
    baseRef: raw.baseRefName,
    headRef: raw.headRefName,
    author,
    mine: author.login === me,
    requests,
    reviews,
    reviewDecision: raw.reviewDecision,
    conflicting: raw.mergeable === "CONFLICTING",
    checks: checksOf(raw),
    openThreads: open.length,
    threadsAwaitingMe: open.filter((t) => {
      const last = t.comments.nodes.at(-1)?.author?.login;
      return last !== undefined && last !== me;
    }).length,
    story: (raw.title.match(TITLE_KEY) ?? raw.headRefName.match(BRANCH_KEY))?.[1]?.toUpperCase() ?? null,
    notionUrl: raw.body?.match(NOTION)?.[0] ?? null,
    myRequestSince: mineRequest?.since ?? null,
  };
}
