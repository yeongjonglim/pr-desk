// Team and User both have `name` with different nullability, so the team's is aliased.
const REVIEWER = `
  __typename
  ... on User { login name avatarUrl }
  ... on Team { slug teamName: name organization { login } }
`;

const REQUEST_EVENTS = `
  timelineItems(itemTypes: [REVIEW_REQUESTED_EVENT], last: 10) {
    nodes { ... on ReviewRequestedEvent { createdAt requestedReviewer { ... on User { login } ... on Team { slug } } } }
  }
`;

const PR = `
  fragment Pr on PullRequest {
    id number title url isDraft createdAt updatedAt
    additions deletions changedFiles
    baseRefName headRefName body
    reviewDecision mergeable
    author { login avatarUrl ... on User { name } }
    repository { name nameWithOwner owner { login } }
    reviewRequests(first: 10) { nodes { requestedReviewer { ${REVIEWER} } } }
    latestOpinionatedReviews(first: 10) { nodes { state submittedAt author { login avatarUrl ... on User { name } } } }
    reviewThreads(last: 30) { nodes { isResolved comments(last: 1) { nodes { author { login } } } } }
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
    ${REQUEST_EVENTS}
  }
`;

export const DETAILS_QUERY = `
  ${PR}
  query Details($ids: [ID!]!) {
    nodes(ids: $ids) { ...Pr }
  }
`;

// Runs every minute for 1 point. Check runs finishing don't bump a PR's updatedAt,
// so the rollup state rides along to catch CI flips too.
export const PROBE_QUERY = `
  query Probe($mine: String!, $reviews: String!) {
    viewer { login name avatarUrl }
    mine: search(query: $mine, type: ISSUE, first: 100) {
      nodes { ... on PullRequest { id updatedAt commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } } }
    }
    reviews: search(query: $reviews, type: ISSUE, first: 50) {
      nodes { ... on PullRequest { id updatedAt commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } } }
    }
    rateLimit { cost remaining resetAt }
  }
`;

export const LOAD_QUERY = `
  query Load($q: String!, $after: String) {
    search(query: $q, type: ISSUE, first: 100, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest {
          id number title url createdAt isDraft
          author { login }
          repository { name nameWithOwner owner { login } }
          reviewRequests(first: 10) { nodes { requestedReviewer { ${REVIEWER} } } }
          ${REQUEST_EVENTS}
        }
      }
    }
    rateLimit { cost remaining resetAt }
  }
`;

export interface RawReviewer {
  __typename: "User" | "Team" | "Bot" | "Mannequin";
  login?: string;
  name?: string | null;
  avatarUrl?: string;
  slug?: string;
  teamName?: string;
  organization?: { login: string };
}

export interface RawRequestEvent {
  createdAt?: string;
  requestedReviewer?: { login?: string; slug?: string } | null;
}

export interface RawPr {
  id: string;
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  baseRefName: string;
  headRefName: string;
  body: string;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  author: { login: string; avatarUrl: string; name?: string | null } | null;
  repository: { name: string; nameWithOwner: string; owner: { login: string } };
  reviewRequests: { nodes: { requestedReviewer: RawReviewer | null }[] };
  latestOpinionatedReviews: {
    nodes: { state: string; submittedAt: string | null; author: { login: string; avatarUrl: string; name?: string | null } | null }[];
  };
  reviewThreads: { nodes: { isResolved: boolean; comments: { nodes: { author: { login: string } | null }[] } }[] };
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] };
  timelineItems: { nodes: RawRequestEvent[] };
}

export interface RawLoadPr {
  id: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
  isDraft: boolean;
  author: { login: string } | null;
  repository: { name: string; nameWithOwner: string; owner: { login: string } };
  reviewRequests: { nodes: { requestedReviewer: RawReviewer | null }[] };
  timelineItems: { nodes: RawRequestEvent[] };
}
