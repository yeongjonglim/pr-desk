export interface Person {
  login: string;
  name?: string | null;
  avatarUrl?: string;
  isTeam?: boolean;
}

export type Checks = "passing" | "failing" | "pending" | "none";
export type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";

export interface ReviewRequest {
  reviewer: Person;
  since: string | null;
}

export interface Review {
  author: Person;
  state: ReviewState;
  at: string | null;
}

export interface Pr {
  id: string;
  number: number;
  title: string;
  url: string;
  repo: string;
  repoFull: string;
  owner: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  baseRef: string;
  headRef: string;
  author: Person;
  mine: boolean;
  requests: ReviewRequest[];
  reviews: Review[];
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  conflicting: boolean;
  checks: Checks;
  openThreads: number;
  threadsAwaitingMe: number;
  story: string | null;
  notionUrl: string | null;
  myRequestSince: string | null;
}

export interface StackInfo {
  key: string;
  position: number;
  members: Pr[];
  below: Pr | null;
}

export type ActionKind =
  | "merge"
  | "fix-ci"
  | "conflicts"
  | "address-review"
  | "reply"
  | "re-request"
  | "review"
  | "self-review"
  | "waiting"
  | "waiting-ci"
  | "blocked";

export type Group = "needs-you" | "self-review" | "waiting" | "blocked" | "quiet";

export interface Item {
  pr: Pr;
  action: ActionKind;
  group: Group;
  since: string;
  stack: StackInfo | null;
}
