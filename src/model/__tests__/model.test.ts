import { describe, expect, it } from "vitest";
import type { RawLoadPr } from "../../api/queries";
import { actionFor, groupFor } from "../classify";
import { reviewCandidates, reviewerLoad } from "../reviewers";
import { findStacks } from "../stacks";
import type { Pr } from "../types";

let n = 0;
function pr(over: Partial<Pr> = {}): Pr {
  n++;
  return {
    id: `id${n}`,
    number: n,
    title: `PR ${n}`,
    url: `https://github.com/acme/app/pull/${n}`,
    repo: "app",
    repoFull: "acme/app",
    owner: "acme",
    isDraft: false,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    additions: 1,
    deletions: 1,
    changedFiles: 1,
    baseRef: "main",
    headRef: `branch-${n}`,
    author: { login: "me" },
    mine: true,
    requests: [],
    reviews: [],
    reviewDecision: "REVIEW_REQUIRED",
    conflicting: false,
    checks: "passing",
    openThreads: 0,
    threadsAwaitingMe: 0,
    story: null,
    notionUrl: null,
    myRequestSince: null,
    ...over,
  };
}

describe("actionFor", () => {
  it("actionFor_NoReviewerRequested_IsSelfReviewEvenWhenReady", () => {
    expect(actionFor(pr(), null)).toBe("self-review");
    expect(actionFor(pr({ isDraft: true }), null)).toBe("self-review");
  });

  it("actionFor_ReviewerRequested_IsWaiting", () => {
    expect(actionFor(pr({ requests: [{ reviewer: { login: "alice" }, since: null }] }), null)).toBe("waiting");
  });

  it("actionFor_ApprovedAndGreen_IsMerge", () => {
    expect(actionFor(pr({ reviewDecision: "APPROVED" }), null)).toBe("merge");
  });

  it("actionFor_ApprovedWithChecksRunning_WaitsOnCi", () => {
    expect(actionFor(pr({ reviewDecision: "APPROVED", checks: "pending" }), null)).toBe("waiting-ci");
  });

  it("actionFor_FailingChecks_BeatsWaitingOnReviewer", () => {
    expect(actionFor(pr({ checks: "failing", requests: [{ reviewer: { login: "a" }, since: null }] }), null)).toBe("fix-ci");
  });

  it("actionFor_ReviewedWithNoPendingRequest_AsksAgain", () => {
    expect(actionFor(pr({ reviews: [{ author: { login: "a" }, state: "COMMENTED", at: null }] }), null)).toBe("re-request");
  });

  it("actionFor_SomeoneElsesPr_IsReview", () => {
    expect(actionFor(pr({ mine: false, author: { login: "other" } }), null)).toBe("review");
  });
});

describe("findStacks", () => {
  it("findStacks_ChainedBases_OrdersFromBottomAndBlocksUpper", () => {
    const a = pr({ headRef: "a" });
    const b = pr({ baseRef: "a", headRef: "b" });
    const c = pr({ baseRef: "b", headRef: "c" });
    const lone = pr();
    const stacks = findStacks([c, lone, b, a]);
    expect(stacks.get(a.id)?.members.map((m) => m.id)).toEqual([a.id, b.id, c.id]);
    expect(stacks.get(c.id)?.position).toBe(3);
    expect(stacks.get(a.id)?.below).toBeNull();
    expect(stacks.get(b.id)?.below?.id).toBe(a.id);
    expect(stacks.has(lone.id)).toBe(false);
    expect(actionFor(b, stacks.get(b.id)!)).toBe("blocked");
  });

  it("findStacks_SameBranchNameInAnotherRepo_IsNotAStack", () => {
    const a = pr({ headRef: "x" });
    const b = pr({ baseRef: "x", repoFull: "acme/other" });
    expect(findStacks([a, b]).size).toBe(0);
  });
});

function loadPr(author: string, reviewers: string[], at = "2026-11-10T00:00:00Z"): RawLoadPr {
  n++;
  return {
    id: `l${n}`,
    number: n,
    title: `PR ${n}`,
    url: "",
    createdAt: "2026-11-01T00:00:00Z",
    isDraft: false,
    additions: 1,
    deletions: 1,
    author: { login: author },
    repository: { name: "app", nameWithOwner: "acme/app", owner: { login: "acme" } },
    reviewRequests: { nodes: reviewers.map((login) => ({ requestedReviewer: { __typename: "User" as const, login } })) },
    timelineItems: { nodes: reviewers.map((login) => ({ createdAt: at, requestedReviewer: { login } })) },
  };
}

describe("reviewerLoad", () => {
  it("reviewerLoad_CountsPendingAndYoursPerReviewer", () => {
    const loads = reviewerLoad(
      [loadPr("me", ["alice"]), loadPr("me", ["alice", "bob"]), loadPr("eve", ["alice"], "2026-11-01T00:00:00Z")],
      "me",
    );
    const alice = loads.find((l) => l.reviewer.login === "alice")!;
    expect(alice.pending).toHaveLength(3);
    expect(alice.mine).toHaveLength(2);
    expect(alice.oldest).toBe("2026-11-01T00:00:00Z");
    expect(loads[0].reviewer.login).toBe("alice");
  });

  it("reviewCandidates_LightestFirst_IncludesPastReviewersWithNothingPending", () => {
    const loads = reviewerLoad([loadPr("me", ["alice"]), loadPr("x", ["alice"]), loadPr("x", ["bob"])], "me");
    const c = reviewCandidates(loads, [{ login: "carol" }], new Set(["me"]));
    expect(c.map((x) => x.person.login)).toEqual(["carol", "bob", "alice"]);
  });
});

describe("groupFor", () => {
  const now = Date.parse("2026-11-18T00:00:00Z");

  it("groupFor_DraftWithFailingChecks_StaysInSelfReview", () => {
    const p = pr({ isDraft: true, checks: "failing", updatedAt: "2026-11-17T00:00:00Z" });
    expect(groupFor(p, actionFor(p, null), now)).toBe("self-review");
  });

  it("groupFor_MyPrUntouchedForAMonth_IsQuiet", () => {
    const p = pr({ conflicting: true, updatedAt: "2026-09-01T00:00:00Z" });
    expect(groupFor(p, actionFor(p, null), now)).toBe("quiet");
  });

  it("groupFor_OldReviewRequestOnMe_StillNeedsMe", () => {
    const p = pr({ mine: false, author: { login: "x" }, updatedAt: "2026-09-01T00:00:00Z" });
    expect(groupFor(p, "review", now)).toBe("needs-you");
  });
});

describe("normalize story", () => {
  it("normalize_TicketKeyInTitleOrBranch_IsTheStory", async () => {
    const { normalize } = await import("../normalize");
    const raw = (title: string, headRefName: string) =>
      ({
        id: "x", number: 1, title, url: "", isDraft: false, createdAt: "", updatedAt: "", additions: 0, deletions: 0, changedFiles: 0,
        baseRefName: "main", headRefName, body: "", reviewDecision: null, mergeable: "MERGEABLE", author: { login: "me", avatarUrl: "" },
        repository: { name: "app", nameWithOwner: "acme/app", owner: { login: "acme" } },
        reviewRequests: { nodes: [] }, latestOpinionatedReviews: { nodes: [] }, reviewThreads: { nodes: [] }, commits: { nodes: [] }, timelineItems: { nodes: [] },
      }) as Parameters<typeof normalize>[0];
    expect(normalize(raw("[ABC-12] Fix login", "x"), "me").story).toBe("ABC-12");
    expect(normalize(raw("Fix login", "feat/abc-12-fix-login"), "me").story).toBe("ABC-12");
    expect(normalize(raw("Upgrade to UTF-8 everywhere", "chore/utf8"), "me").story).toBeNull();
  });
});
