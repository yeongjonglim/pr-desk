import type { RawLoadPr } from "../api/queries";
import { requestSince, reviewerOf } from "./normalize";
import type { Person } from "./types";

export interface PendingPr {
  repoFull: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  since: string;
  mine: boolean;
  isDraft: boolean;
  additions: number;
  deletions: number;
  author: Person;
}

export interface ReviewerLoad {
  reviewer: Person;
  pending: PendingPr[];
  mine: PendingPr[];
  oldest: string | null;
}

export const BUSY_AT = 6;

export function reviewerLoad(prs: RawLoadPr[], me: string): ReviewerLoad[] {
  const byReviewer = new Map<string, ReviewerLoad>();
  for (const pr of prs) {
    for (const node of pr.reviewRequests.nodes) {
      const reviewer = reviewerOf(node.requestedReviewer);
      if (!reviewer) continue;
      const entry: PendingPr = {
        repoFull: pr.repository.nameWithOwner,
        repo: pr.repository.name,
        number: pr.number,
        title: pr.title,
        url: pr.url,
        since: requestSince(pr.timelineItems.nodes, reviewer.login) ?? pr.createdAt,
        mine: pr.author?.login === me,
        isDraft: pr.isDraft,
        additions: pr.additions,
        deletions: pr.deletions,
        author: pr.author ? { login: pr.author.login, avatarUrl: pr.author.avatarUrl, name: pr.author.name } : { login: "ghost" },
      };
      const load = byReviewer.get(reviewer.login) ?? { reviewer, pending: [], mine: [], oldest: null };
      load.pending.push(entry);
      if (entry.mine) load.mine.push(entry);
      if (!load.oldest || entry.since < load.oldest) load.oldest = entry.since;
      byReviewer.set(reviewer.login, load);
    }
  }
  for (const load of byReviewer.values()) {
    load.mine.sort((a, b) => a.since.localeCompare(b.since));
    load.pending.sort((a, b) => a.since.localeCompare(b.since));
  }
  return [...byReviewer.values()].sort(
    (a, b) => b.mine.length - a.mine.length || b.pending.length - a.pending.length || a.reviewer.login.localeCompare(b.reviewer.login),
  );
}

export interface Candidate {
  person: Person;
  pending: number;
  mine: number;
}

// People worth asking: anyone holding requests in the org, plus anyone who has reviewed
// your PRs before (they may have none pending, which is the point). Lightest load first.
export function reviewCandidates(loads: ReviewerLoad[], pastReviewers: Person[], exclude: Set<string>): Candidate[] {
  const out = new Map<string, Candidate>();
  for (const l of loads) {
    if (l.reviewer.isTeam || exclude.has(l.reviewer.login)) continue;
    out.set(l.reviewer.login, { person: l.reviewer, pending: l.pending.length, mine: l.mine.length });
  }
  for (const p of pastReviewers) {
    if (exclude.has(p.login) || out.has(p.login)) continue;
    out.set(p.login, { person: p, pending: 0, mine: 0 });
  }
  return [...out.values()].sort((a, b) => a.pending - b.pending || a.mine - b.mine || a.person.login.localeCompare(b.person.login));
}
